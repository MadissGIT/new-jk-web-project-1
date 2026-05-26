export type SlotLike = {
  starts_at: string;
  ends_at?: string | null;
  status?: string;
};

const TZ_AWARE_RE = /(?:z|[+-]\d{2}:?\d{2})$/i;
const API_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/;

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function parseApiDateTime(value: string) {
  if (TZ_AWARE_RE.test(value)) {
    return new Date(value);
  }

  const match = value.match(API_DATE_RE);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0),
      0,
    );
  }

  return new Date(value);
}

export function toLocalApiDateTime(value: Date) {
  return [
    value.getFullYear(),
    padDatePart(value.getMonth() + 1),
    padDatePart(value.getDate()),
  ].join('-') + `T${padDatePart(value.getHours())}:${padDatePart(value.getMinutes())}:00`;
}

export function getSlotLifecycle(
  slot: SlotLike,
  durationMinutes = 60,
  nowMs = Date.now(),
): 'upcoming' | 'active' | 'ended' {
  const startsAt = parseApiDateTime(slot.starts_at).getTime();
  const endsAt = slot.ends_at
    ? parseApiDateTime(slot.ends_at).getTime()
    : startsAt + Math.max(1, durationMinutes) * 60_000;

  if (nowMs >= endsAt) return 'ended';
  if (nowMs >= startsAt) return 'active';
  return 'upcoming';
}

export function getTourSlotState(slots: SlotLike[] | undefined, durationMinutes: number) {
  const sorted = [...(slots ?? [])].sort(
    (a, b) => parseApiDateTime(a.starts_at).getTime() - parseApiDateTime(b.starts_at).getTime(),
  );
  const active = sorted.find((slot) => getSlotLifecycle(slot, durationMinutes) === 'active');
  const upcoming = sorted.find((slot) => getSlotLifecycle(slot, durationMinutes) === 'upcoming');
  const ended = [...sorted].reverse().find((slot) => getSlotLifecycle(slot, durationMinutes) === 'ended');

  return {
    active,
    upcoming,
    ended,
    status: active ? 'active' : upcoming ? 'upcoming' : ended ? 'ended' : 'none',
  };
}

export function pickUpcomingSlot(slots: SlotLike[] | undefined) {
  return (slots ?? [])
    .filter((slot) => getSlotLifecycle(slot) === 'upcoming')
    .sort(
      (a, b) =>
        parseApiDateTime(a.starts_at).getTime() - parseApiDateTime(b.starts_at).getTime(),
    )[0];
}

export function formatHoursRu(hours: number) {
  const n = Math.abs(hours);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} час`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} часа`;
  return `${n} часов`;
}

export function formatDefaultSlotDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

export function parseGuideSlotDateTime(
  dateStr: string,
  timeStr: string,
  durationHours: number,
) {
  const dateMatch = dateStr.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const timeMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!dateMatch) {
    throw new Error('Укажите дату в формате ДД.ММ.ГГГГ');
  }
  if (!timeMatch) {
    throw new Error('Укажите время в формате ЧЧ:ММ');
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (hours > 23 || minutes > 59) {
    throw new Error('Некорректное время');
  }

  const starts = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(starts.getTime())) {
    throw new Error('Некорректная дата');
  }
  if (starts.getTime() < Date.now() - 60_000) {
    throw new Error('Дата и время тура должны быть в будущем');
  }

  const ends = new Date(starts);
  ends.setHours(ends.getHours() + Math.max(1, durationHours));
  return { starts, ends };
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Короткая подпись для карточки: «Сегодня в 16:00 (4 часа)». */
export function formatTourCardSchedule(startsAt: string, durationMinutes: number, endsAt?: string | null) {
  const lifecycle = getSlotLifecycle({ starts_at: startsAt, ends_at: endsAt }, durationMinutes);
  if (lifecycle === 'active') {
    return `Идет сейчас (${formatHoursRu(Math.max(1, Math.round(durationMinutes / 60)))})`;
  }
  if (lifecycle === 'ended') {
    return 'Тур прошел';
  }

  const date = parseApiDateTime(startsAt);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  let dayLabel: string;
  if (isSameCalendarDay(date, now)) {
    dayLabel = 'Сегодня';
  } else if (isSameCalendarDay(date, tomorrow)) {
    dayLabel = 'Завтра';
  } else {
    dayLabel = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  const hours = Math.max(1, Math.round(durationMinutes / 60));
  return `${dayLabel} в ${time} (${formatHoursRu(hours)})`;
}

export function formatSlotDateTime(value: string) {
  return parseApiDateTime(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTourScheduleLabel(
  durationMinutes: number,
  slots: SlotLike[] | undefined,
  fallback?: string | null,
) {
  const hoursLabel = formatHoursRu(Math.max(1, Math.round(durationMinutes / 60)));
  const state = getTourSlotState(slots, durationMinutes);

  if (state.active) {
    return `${hoursLabel} · тур идет`;
  }

  const upcoming = (slots ?? [])
    .filter((slot) => getSlotLifecycle(slot, durationMinutes) === 'upcoming')
    .sort((a, b) => parseApiDateTime(a.starts_at).getTime() - parseApiDateTime(b.starts_at).getTime());

  if (upcoming.length) {
    const firstLabel = formatSlotDateTime(upcoming[0].starts_at);
    if (upcoming.length === 1) {
      return `${hoursLabel}, ${firstLabel}`;
    }
    return `${hoursLabel}, ближайший: ${firstLabel} (+ещё ${upcoming.length - 1})`;
  }

  if (state.ended) {
    return `${hoursLabel} · тур прошел`;
  }

  if (fallback?.trim()) {
    return fallback.trim();
  }

  return `${hoursLabel} · даты уточняются`;
}
