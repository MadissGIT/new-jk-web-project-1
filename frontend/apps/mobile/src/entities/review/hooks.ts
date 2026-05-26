import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteMyReview, fetchMyReviews } from './api';

export function useMyReviews(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['reviews', 'me', params],
    queryFn: () => fetchMyReviews({ page: 1, limit: 50, ...params }),
    staleTime: 30_000,
  });
}

export function useDeleteMyReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => deleteMyReview(reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews', 'me'] });
    },
  });
}
