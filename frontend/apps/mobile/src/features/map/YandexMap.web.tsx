import { useEffect, useRef, useState } from 'react';

import { EKATERINBURG_CENTER } from '../../entities/place/places';
import type { InterestId } from '../../entities/preferences/preferencesStore';
import { colors } from '../../shared/theme/colors';
import type { YandexMapProps } from './YandexMap.types';

/**
 * Кастомная стилизация маркеров: эмодзи + цвет на основе категории POI.
 * Категория берётся из `Place.categories[0]`, который мы строим в `poeToPlace`
 * по полю POE.category и тегам.
 */
const CATEGORY_VISUAL: Record<
  InterestId | 'fallback',
  { color: string; icon: string }
> = {
  art: { color: '#8E4DD1', icon: '🎨' },
  coffee: { color: '#7A4A2A', icon: '☕' },
  history: { color: '#A07A3A', icon: '🏛️' },
  nature: { color: '#3F8E4F', icon: '🌳' },
  music: { color: '#D78A1F', icon: '🎵' },
  relax: { color: '#3D7AB3', icon: '🌿' },
  fallback: { color: '#5B5B5B', icon: '📍' },
};

function getCategoryVisual(categories: readonly string[]): {
  color: string;
  icon: string;
} {
  for (const category of categories) {
    const visual = CATEGORY_VISUAL[category as InterestId];
    if (visual) return visual;
  }
  return CATEGORY_VISUAL.fallback;
}

// Глобальный объект Yandex Maps 2.1 с их CDN.
declare global {
  interface Window {
    ymaps?: any;
  }
}

const SCRIPT_ID = 'yandex-maps-v21-sdk';
// JS API 2.1 — зрелая версия, стандартный ключ «JavaScript API и HTTP Геокодер»
// из кабинета разработчика работает с ней из коробки.
const SDK_URL = (key: string) =>
  `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;

let loaderPromise: Promise<any> | null = null;

function loadYandexMaps(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'));
  }
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.ymaps));
      existing.addEventListener('error', (event) => {
        loaderPromise = null;
        existing.remove();
        reject(event);
      });
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SDK_URL(apiKey);
    script.async = true;
    script.onload = () => resolve(window.ymaps);
    script.onerror = (event) => {
      // Сбрасываем кэш промиса, чтобы после правки ключа перезагрузка оживила SDK.
      loaderPromise = null;
      script.remove();
      reject(event);
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function YandexMap({
  places,
  selectedId,
  onSelect,
  center,
  zoom = 13,
  currentLocation,
  routePath,
  travelledPath,
  followUser,
}: YandexMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const apiKey = process.env.EXPO_PUBLIC_YANDEX_JS_API_KEY;
  const [sdkError, setSdkError] = useState(false);

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    const container = containerRef.current;

    setSdkError(false);

    loadYandexMaps(apiKey)
      .then(
        (ymaps) =>
          new Promise<any>((resolve) => {
            ymaps.ready(() => resolve(ymaps));
          }),
      )
      .then((ymaps) => {
        if (cancelled || !container) return;

        if (mapRef.current) {
          mapRef.current.destroy();
          mapRef.current = null;
        }

        // Важно: в 2.1 координаты идут [lat, lng] (в 3.0 было наоборот).
        const map = new ymaps.Map(container, {
          center: [
            center?.lat ?? EKATERINBURG_CENTER.lat,
            center?.lng ?? EKATERINBURG_CENTER.lng,
          ],
          zoom,
          controls: ['zoomControl', 'geolocationControl'],
        });
        mapRef.current = map;

        const fitMapToContainer = () => {
          if (resizeFrame !== null) {
            window.cancelAnimationFrame(resizeFrame);
          }
          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = null;
            map.container.fitToViewport();
          });
        };

        fitMapToContainer();
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(fitMapToContainer);
          resizeObserver.observe(container);
        }

        if (routePath && routePath.length > 1) {
          const coordinates = routePath.map((point) => [point.lat, point.lng]);

          // Используем pedestrian MultiRoute — он по умолчанию красиво рисует
          // пеший путь по тротуарам пунктиром. Но у MultiRoute есть нюанс:
          // если между двумя waypoint'ами пешеходный путь не строится (далеко
          // или нет данных), Яндекс соединяет их «прямой direct-линией»
          // салатово-зелёного цвета — это и была та самая «зелёная линия,
          // ведущая в никуда». Стандартные опции `pedestrianRoute*` её не
          // перекрашивают, поэтому ловим момент построения и сами проходим
          // по всем сегментам активного маршрута, приглушая чужие цвета.
          if (ymaps.multiRouter) {
            const route = new ymaps.multiRouter.MultiRoute(
              {
                referencePoints: coordinates,
                params: {
                  routingMode: 'pedestrian',
                  results: 1,
                },
              },
              {
                boundsAutoApply: false,
                wayPointVisible: true,
                viaPointVisible: false,
                pinIconFillColor: colors.textPrimary,
                routeActiveStrokeColor: colors.textPrimary,
                routeActiveStrokeWidth: 4,
                routeActiveStrokeStyle: 'dash',
                pedestrianRouteActiveStrokeColor: colors.textPrimary,
                pedestrianRouteActiveStrokeWidth: 4,
                pedestrianRouteActiveStrokeStyle: 'dash',
                routeStrokeColor: 'rgba(0,0,0,0)',
                routeStrokeWidth: 0,
                pedestrianRouteStrokeColor: 'rgba(0,0,0,0)',
                pedestrianRouteStrokeWidth: 0,
              },
            );

            // Перекрашиваем каждый «реальный» сегмент маршрута в наш цвет, а
            // direct-вставки (когда pedestrian обрывается) делаем полностью
            // прозрачными. Делать это нужно после успешного построения —
            // отдельным событием от model.
            const repaintSegments = () => {
              try {
                const activeRoute = route.getActiveRoute?.();
                if (!activeRoute) return;
                const paths = activeRoute.getPaths();
                for (let i = 0; i < paths.getLength(); i += 1) {
                  const segments = paths.get(i).getSegments();
                  for (let j = 0; j < segments.getLength(); j += 1) {
                    const segment = segments.get(j);
                    const type =
                      typeof segment.getType === 'function'
                        ? segment.getType()
                        : '';
                    const isPedestrian =
                      !type ||
                      type === 'walking' ||
                      type === 'pedestrian' ||
                      type === 'walk';
                    segment.options.set({
                      strokeColor: isPedestrian
                        ? colors.textPrimary
                        : 'rgba(0,0,0,0)',
                      strokeWidth: isPedestrian ? 4 : 0,
                      strokeStyle: isPedestrian ? 'dash' : 'solid',
                      strokeOpacity: isPedestrian ? 0.95 : 0,
                    });
                  }
                }
              } catch {
                // если внутреннее API поменялось — просто оставим дефолт
              }
            };

            route.model.events.add('requestsuccess', repaintSegments);
            // На случай, если model уже успела построить маршрут к моменту,
            // когда мы навешиваем обработчик.
            repaintSegments();

            map.geoObjects.add(route);
          } else {
            // SDK не подгрузил пакет маршрутизации — рисуем хотя бы прямую,
            // чтобы пользователь видел общее направление.
            const routeLine = new ymaps.Polyline(
              coordinates,
              {},
              {
                strokeColor: colors.textPrimary,
                strokeWidth: 4,
                strokeOpacity: 0.92,
              },
            );
            map.geoObjects.add(routeLine);
          }
        }

        if (travelledPath && travelledPath.length > 1) {
          // Цвет пройденного пути специально НЕ зелёный: салатовый и зелёный
          // у Яндекс-маршрутов уже используются под direct-сегменты, и
          // пользователь путал «свой след» с лишней направляющей. Тёплый
          // оранжевый хорошо читается поверх тёмно-синего пунктирного
          // pedestrian-маршрута и не сливается с тайлами карты.
          const travelledLine = new ymaps.Polyline(
            travelledPath.map((point) => [point.lat, point.lng]),
            {},
            {
              strokeColor: '#E58838',
              strokeWidth: 6,
              strokeOpacity: 0.9,
            },
          );
          map.geoObjects.add(travelledLine);
        }

        if (currentLocation) {
          const currentPlacemark = new ymaps.Placemark(
            [currentLocation.lat, currentLocation.lng],
            {
              hintContent: 'Вы здесь',
            },
            {
              preset: 'islands#redCircleDotIcon',
              iconColor: '#D71920',
            },
          );
          map.geoObjects.add(currentPlacemark);
        }

        // Кастомный layout pins: круглая «капля» с эмодзи внутри.
        // У выбранного POI рисуем расширенную обводку, чтобы он легко
        // считывался без обращения к балуну.
        const PinLayout = ymaps.templateLayoutFactory.createClass(
          [
            '<div style="',
            'transform: translate(-50%, -50%);',
            'display: inline-flex; align-items: center; justify-content: center;',
            'width: 36px; height: 36px; border-radius: 50%;',
            'background: {{ properties.color }};',
            'border: {{ properties.borderWidth }}px solid #FFFFFF;',
            'box-shadow: 0 4px 10px rgba(0,0,0,0.18);',
            'font-size: 18px; line-height: 1; color: #FFFFFF;',
            'outline: {{ properties.outlineWidth }}px solid {{ properties.outlineColor }};',
            'outline-offset: -1px;',
            '">{{ properties.icon }}</div>',
          ].join(''),
        );

        for (const place of places) {
          const visual = getCategoryVisual(place.categories);
          const isSelected = place.id === selectedId;
          const placemark = new ymaps.Placemark(
            [place.lat, place.lng],
            {
              hintContent: place.name,
              balloonContentHeader: place.name,
              balloonContentBody: place.description,
              balloonContentFooter: place.address,
              icon: visual.icon,
              color: visual.color,
              borderWidth: isSelected ? 3 : 2,
              outlineWidth: isSelected ? 2 : 0,
              outlineColor: colors.textPrimary,
            },
            {
              iconLayout: PinLayout,
              iconShape: {
                type: 'Circle',
                coordinates: [0, 0],
                radius: 18,
              },
            },
          );
          placemark.events.add('click', () => onSelect?.(place.id));
          map.geoObjects.add(placemark);
        }

        if (routePath && routePath.length > 1) {
          const bounds = map.geoObjects.getBounds();
          if (bounds) {
            map.setBounds(bounds, {
              checkZoomRange: true,
              zoomMargin: [48, 48, 48, 48],
            });
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Yandex Maps SDK load failed', err);
        setSdkError(true);
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [
    apiKey,
    places,
    selectedId,
    center?.lat,
    center?.lng,
    zoom,
    onSelect,
    currentLocation?.lat,
    currentLocation?.lng,
    routePath,
    travelledPath,
  ]);

  // «Следование за пользователем». Делаем это отдельным эффектом, чтобы НЕ
  // пересоздавать инстанс карты на каждое обновление координат — иначе
  // будет мигание и пользователь не сможет ориентироваться. Двигаем только
  // центр у уже созданного `mapRef.current`.
  useEffect(() => {
    if (!followUser) return;
    if (!currentLocation) return;
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setCenter([currentLocation.lat, currentLocation.lng], zoom, {
        duration: 300,
      });
    } catch {
      // setCenter может бросать на половине жизненного цикла destroy —
      // безопасно игнорируем, чтобы не валить весь экран.
    }
  }, [followUser, currentLocation?.lat, currentLocation?.lng, zoom]);

  if (!apiKey) {
    return (
      <div style={overlayStyle}>
        <div style={overlayTitleStyle}>Карта не настроена</div>
        <div style={overlayBodyStyle}>
          Добавьте <code>EXPO_PUBLIC_YANDEX_JS_API_KEY</code> в
          <br />
          <code>frontend/apps/mobile/.env</code>
          <br />
          и перезапустите Metro с флагом <code>--clear</code>.
        </div>
      </div>
    );
  }

  if (sdkError) {
    const testUrl = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    return (
      <div style={overlayStyle}>
        <div style={overlayTitleStyle}>Не удалось загрузить карту</div>
        <div style={overlayBodyStyle}>
          Откройте ссылку ниже в новой вкладке — Яндекс покажет настоящую
          причину (невалидный ключ, ограничение по домену и т.д.):
          <div style={{ marginTop: 10 }}>
            <a
              href={testUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.textPrimary, wordBreak: 'break-all' }}
            >
              {testUrl}
            </a>
          </div>
          <ul style={{ textAlign: 'left', margin: '12px 0 0', paddingLeft: 20 }}>
            <li>
              в кабинете разработчика должен быть сервис «<b>JavaScript API и
              HTTP Геокодер</b>»;
            </li>
            <li>
              в настройках ключа → «HTTP-рефереры» — либо очистить список,
              либо добавить <code>localhost</code> и <code>localhost:8081</code>;
            </li>
            <li>ключу может требоваться до пары часов на активацию;</li>
            <li>проверьте блокировщики/VPN, режущие <code>api-maps.yandex.ru</code>.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        alignSelf: 'stretch',
        width: '100%',
        height: '100%',
        minHeight: 0,
      }}
    />
  );
}

const overlayStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: 240,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  backgroundColor: '#EFE9DF',
  color: colors.textPrimary,
  fontSize: 13,
  textAlign: 'center',
  gap: 8,
};

const overlayTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

const overlayBodyStyle: React.CSSProperties = {
  maxWidth: 420,
  lineHeight: 1.45,
  color: colors.textMuted,
};
