/** Устаревшая метка старых туров — при чтении трактуем как «ничего не отмечено». */
export const LEGACY_ACCESSIBILITY_NOT_SET_TAG = 'accessibility_not_set';
export const WIDE_PASSAGES_TAG = 'wide_passages';

export type GuideTourAccessibility = {
  ramp: boolean;
  widePassages: boolean;
  /** true = на маршруте есть ступени */
  stairs: boolean;
};

export function hasAccessibilitySelection(accessibility: GuideTourAccessibility) {
  return accessibility.ramp || accessibility.widePassages || accessibility.stairs;
}

/** Если гид ничего не отметил: без пандуса, без широких проходов, без ступеней. */
export const DEFAULT_ACCESSIBILITY_WHEN_EMPTY = {
  wheelchair_accessible: false,
  avoid_stairs_possible: true,
} as const;

export function buildAccessibilityForApi(
  accessibility: GuideTourAccessibility,
  baseTags: string[],
) {
  const tags = baseTags.filter(
    (tag) => tag !== LEGACY_ACCESSIBILITY_NOT_SET_TAG && tag !== WIDE_PASSAGES_TAG,
  );

  if (!hasAccessibilitySelection(accessibility)) {
    return {
      ...DEFAULT_ACCESSIBILITY_WHEN_EMPTY,
      tags,
    };
  }

  if (accessibility.widePassages) {
    tags.push(WIDE_PASSAGES_TAG);
  }

  return {
    wheelchair_accessible: accessibility.ramp,
    avoid_stairs_possible: accessibility.stairs ? false : true,
    tags,
  };
}

export type TourAccessibilityView = {
  ramp: boolean;
  widePassages: boolean;
  /** true = есть ступени */
  stairs: boolean;
};

/** Гид явно отметил хотя бы один пункт доступности. */
export function isTourAccessibilitySpecified(
  accessibility: { wheelchair_accessible: boolean; avoid_stairs_possible: boolean },
  tags: string[] | undefined,
): boolean {
  if (tags?.includes(LEGACY_ACCESSIBILITY_NOT_SET_TAG)) {
    return false;
  }
  if (tags?.includes(WIDE_PASSAGES_TAG)) {
    return true;
  }
  if (accessibility.wheelchair_accessible) {
    return true;
  }
  if (!accessibility.avoid_stairs_possible) {
    return true;
  }
  return false;
}

export function getTourAccessibilityView(
  accessibility: { wheelchair_accessible: boolean; avoid_stairs_possible: boolean },
  tags: string[] | undefined,
): TourAccessibilityView {
  if (!isTourAccessibilitySpecified(accessibility, tags)) {
    return {
      ramp: false,
      widePassages: false,
      stairs: false,
    };
  }

  return {
    ramp: accessibility.wheelchair_accessible,
    widePassages: tags?.includes(WIDE_PASSAGES_TAG) ?? false,
    stairs: !accessibility.avoid_stairs_possible,
  };
}
