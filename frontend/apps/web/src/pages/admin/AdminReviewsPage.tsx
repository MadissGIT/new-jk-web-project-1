import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { extractApiError, http } from '../../shared/api/http'
import { tokens } from '../../shared/theme/tokens'

type Review = {
  id: string
  user: { id: string; name: string }
  rating: number
  text: string
  created_at: string
}
type ListResponse<T> = { data: T[]; meta: { total: number } }

async function fetchReviews() {
  const response = await http.get<ListResponse<Review>>('/admin/reviews', { params: { limit: 100 } })
  return response.data
}

async function hideReview(id: string) {
  return http.post(`/admin/reviews/${id}/hide`, { suspicious: true, reported_count: 1 })
}

export function AdminReviewsPage() {
  const queryClient = useQueryClient()
  const reviews = useQuery({ queryKey: ['admin', 'reviews'], queryFn: fetchReviews })
  const hide = useMutation({ mutationFn: hideReview, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }) })

  return <div style={{ display: 'grid', gap: 20 }}>
    <header><h1 style={titleStyle}>Отзывы</h1><p style={subtitleStyle}>Модерация отзывов пользователей</p></header>
    {reviews.isLoading ? <StateBox text="Загружаем отзывы..." /> : reviews.isError ? <StateBox text={extractApiError(reviews.error)} tone="danger" /> : (
      <section style={{ display: 'grid', gap: 12 }}>{(reviews.data?.data ?? []).map((review) => <article key={review.id} style={cardStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><div style={{ display: 'flex', gap: 12 }}><Avatar name={review.user.name} /><div><strong>{review.user.name}</strong><div style={subtitleStyle}>{formatDate(review.created_at)}</div></div></div><div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><span style={{ color: '#E4B400', letterSpacing: 1 }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><button type="button" onClick={() => hide.mutate(review.id)} style={buttonStyle}>Скрыть</button></div></div><p style={{ margin: 0 }}>{review.text}</p></article>)}</section>
    )}
    {hide.error ? <StateBox text={extractApiError(hide.error)} tone="danger" /> : null}
  </div>
}

function Avatar({ name }: { name: string }) { return <div style={{ width: 34, height: 34, borderRadius: '50%', background: tokens.color.surfaceAlt, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{name.slice(0, 2).toUpperCase()}</div> }
function StateBox({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' }) { return <div style={{ ...cardStyle, padding: 28, textAlign: 'center', color: tone === 'danger' ? tokens.color.danger : tokens.color.textSecondary }}>{text}</div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) }
const titleStyle = { margin: 0, fontSize: 24, color: tokens.color.textPrimary } as const
const subtitleStyle = { margin: '4px 0 0', color: tokens.color.textSecondary, fontSize: 13 } as const
const cardStyle = { background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 12, boxShadow: tokens.shadow.card, padding: 18, display: 'grid', gap: 16 } as const
const buttonStyle = { border: `1px solid ${tokens.color.border}`, background: tokens.color.surface, color: tokens.color.textPrimary, borderRadius: 8, padding: '7px 10px', cursor: 'pointer' } as const
