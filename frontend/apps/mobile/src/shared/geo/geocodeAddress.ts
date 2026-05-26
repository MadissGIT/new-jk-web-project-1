export type GeocodedPoint = {
  lat: number;
  lng: number;
  address: string;
};

function yandexApiKey() {
  return process.env.EXPO_PUBLIC_YANDEX_JS_API_KEY?.trim() ?? '';
}

/** Ручной ввод «широта, долгота» или «долгота широта». */
export function parseManualCoordinates(input: string): GeocodedPoint | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return null;

  const first = Number(match[1].replace(',', '.'));
  const second = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  // Для Екатеринбурга широта ~56, долгота ~60.
  const looksLikeLatLng = first >= 50 && first <= 70 && second >= 50 && second <= 70;
  if (looksLikeLatLng) {
    if (first > second) {
      return { lat: first, lng: second, address: trimmed };
    }
    return { lat: second, lng: first, address: trimmed };
  }

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return { lat: first, lng: second, address: trimmed };
  }

  return null;
}

export function parseLatLngFields(latRaw: string, lngRaw: string, fallbackAddress: string): GeocodedPoint | null {
  const lat = Number(latRaw.trim().replace(',', '.'));
  const lng = Number(lngRaw.trim().replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, address: fallbackAddress.trim() || `${lat}, ${lng}` };
}

/**
 * Определяет координаты по адресу через HTTP Геокодер Яндекса
 * (тот же ключ, что и для JS API карт).
 */
export async function geocodeAddress(
  query: string,
  options?: { city?: string },
): Promise<GeocodedPoint> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Укажите адрес места встречи');
  }

  const manual = parseManualCoordinates(trimmed);
  if (manual) return manual;

  const apiKey = yandexApiKey();
  if (!apiKey) {
    throw new Error(
      'Не настроен ключ Яндекс Геокодера (EXPO_PUBLIC_YANDEX_JS_API_KEY в .env)',
    );
  }

  const city = options?.city ?? 'Екатеринбург';
  const hasCity = /екатеринбург/i.test(trimmed);
  const searchQuery = hasCity ? trimmed : `${trimmed}, ${city}, Россия`;

  const url = new URL('https://geocode-maps.yandex.ru/1.x/');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('geocode', searchQuery);
  url.searchParams.set('results', '1');
  // Ограничиваем поиск Екатеринбургом и окрестностями.
  url.searchParams.set('rspn', '1');
  url.searchParams.set('bbox', '60.35,56.65~60.85,56.98');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Геокодер недоступен (код ${response.status})`);
  }

  const data = (await response.json()) as {
    response?: {
      GeoObjectCollection?: {
        featureMember?: Array<{
          GeoObject?: {
            Point?: { pos?: string };
            metaDataProperty?: {
              GeocoderMetaData?: { text?: string };
            };
          };
        }>;
      };
    };
  };

  const geoObject = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const pos = geoObject?.Point?.pos;
  if (!pos) {
    throw new Error(
      'Не удалось найти координаты по адресу. Уточните адрес или укажите широту и долготу вручную.',
    );
  }

  const [lngStr, latStr] = pos.split(' ');
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Геокодер вернул некорректные координаты');
  }

  const formatted = geoObject.metaDataProperty?.GeocoderMetaData?.text?.trim();
  return {
    lat,
    lng,
    address: formatted || trimmed,
  };
}
