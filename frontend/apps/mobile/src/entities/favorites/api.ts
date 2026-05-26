import { http } from '../../shared/api/http';

export type FavoriteEntityType = 'tour' | 'route' | 'poe';

export type FavoriteItem = {
  id: string;
  title: string;
};

export type FavoritesPayload = {
  tours: FavoriteItem[];
  routes: FavoriteItem[];
  poes: FavoriteItem[];
};

export type FavoriteMutationPayload = {
  entity_type: FavoriteEntityType;
  entity_id: string;
};

export type FavoriteMutationResult = FavoriteMutationPayload & {
  is_favorite: boolean;
};

type DetailResponse<T> = {
  data: T;
};

export async function fetchFavorites(): Promise<FavoritesPayload> {
  const { data } = await http.get<DetailResponse<FavoritesPayload>>('/favorites');
  return data.data;
}

export async function addFavorite(
  payload: FavoriteMutationPayload,
): Promise<FavoriteMutationResult> {
  const { data } = await http.post<DetailResponse<FavoriteMutationResult>>('/favorites', payload);
  return data.data;
}

export async function removeFavorite(
  payload: FavoriteMutationPayload,
): Promise<FavoriteMutationResult> {
  const { data } = await http.delete<DetailResponse<FavoriteMutationResult>>('/favorites', {
    data: payload,
  });
  return data.data;
}
