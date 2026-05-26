import type { Place } from '../../entities/place/types';

export type YandexMapProps = {
  places: Place[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  currentLocation?: { lat: number; lng: number };
  routePath?: Array<{ lat: number; lng: number }>;
  travelledPath?: Array<{ lat: number; lng: number }>;
  /**
   * Включает «следование за пользователем»: при каждом обновлении
   * `currentLocation` карта плавно сдвигается, чтобы пользователь оставался
   * в центре. Сам зум при этом не пересоздаёт инстанс карты (в отличие от
   * передачи нового `center`/`zoom` пропсами).
   */
  followUser?: boolean;
};
