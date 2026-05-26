import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { extractApiError, http } from '../../shared/api/http'
import { tokens } from '../../shared/theme/tokens'
import {
  ClockIcon,
  EyeIcon,
  MapPinIcon,
  MoneyIcon,
  PeopleIcon,
  SearchIcon,
} from '../../shared/ui/Icon'

type TourStatus = 'draft' | 'moderation' | 'published' | 'hidden' | 'rejected'
type Tour = {
  id: string
  title: string
  short_description: string
  city_id: string
  duration_minutes: number
  group_size_max?: number
  status: TourStatus
  price: { amount: number; currency: string }
  guide: { name: string }
  cover_image_url?: string | null
}
type ListResponse<T> = { data: T[]; meta: { total: number } }

async function fetchTours() {
  const response = await http.get<ListResponse<Tour>>('/admin/tours', { params: { limit: 100 } })
  return response.data
}

const approveTour = (id: string) => http.post(`/admin/tours/${id}/approve`, { reason: null })
const rejectTour = (id: string) => http.post(`/admin/tours/${id}/reject`, { reason: null })

const statusConfig: Record<TourStatus, { label: string; color: string; background: string }> = {
  draft: { label: 'Черновик', color: '#A97600', background: '#FFF6D8' },
  moderation: { label: 'На проверке', color: '#A97600', background: '#FFF6D8' },
  published: { label: 'Опубликован', color: '#0A8F73', background: '#E6FAF5' },
  hidden: { label: 'Скрыт', color: tokens.color.danger, background: '#FCEBEB' },
  rejected: { label: 'Отклонён', color: '#A70F1A', background: '#FCEBEB' },
}

export function AdminToursPage() {
  const [selected, setSelected] = useState<Tour | null>(null)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const tours = useQuery({ queryKey: ['admin', 'tours'], queryFn: fetchTours })

  const refreshAndClose = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'tours'] })
    setSelected(null)
  }

  const approve = useMutation({ mutationFn: approveTour, onSuccess: refreshAndClose })
  const reject = useMutation({ mutationFn: rejectTour, onSuccess: refreshAndClose })
  const busy = approve.isPending || reject.isPending

  const filteredTours = useMemo(() => {
    const items = tours.data?.data ?? []
    const query = search.trim().toLocaleLowerCase('ru-RU')
    if (!query) return items
    return items.filter((tour) => {
      const haystack = `${tour.title} ${tour.city_id} ${tour.guide.name}`.toLocaleLowerCase('ru-RU')
      return haystack.includes(query)
    })
  }, [search, tours.data?.data])

  return (
    <div style={pageStyle}>
      <section style={toolbarStyle}>
        <label style={searchStyle}>
          <SearchIcon size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск туров..."
            style={searchInputStyle}
          />
        </label>
      </section>

      <header>
        <h1 style={titleStyle}>Модерация туров</h1>
        <p style={subtitleStyle}>Управление турами и экскурсиями</p>
      </header>

      {tours.isLoading ? (
        <StateBox text="Загружаем туры..." />
      ) : tours.isError ? (
        <StateBox text={extractApiError(tours.error)} tone="danger" />
      ) : filteredTours.length === 0 ? (
        <StateBox text="Туры не найдены" />
      ) : (
        <section style={gridStyle}>
          {filteredTours.map((tour) => (
            <TourCard key={tour.id} tour={tour} onDetails={() => setSelected(tour)} />
          ))}
        </section>
      )}

      {approve.error || reject.error ? (
        <StateBox text={extractApiError(approve.error || reject.error)} tone="danger" />
      ) : null}

      {selected ? (
        <TourDetailsModal
          tour={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onApprove={() => approve.mutate(selected.id)}
          onReject={() => reject.mutate(selected.id)}
        />
      ) : null}
    </div>
  )
}

function TourCard({ tour, onDetails }: { tour: Tour; onDetails: () => void }) {
  return (
    <article style={cardStyle}>
      {tour.cover_image_url ? (
        <img src={tour.cover_image_url} alt="" style={cardImageStyle} />
      ) : null}

      <div style={cardHeaderStyle}>
        <h2 style={cardTitleStyle}>{tour.title}</h2>
        <Badge status={tour.status} />
      </div>

      <div style={cardBodyStyle}>
        <Info label="Город" value={tour.city_id} />
        <Info label="Гид" value={tour.guide.name} />
        <Info label="Время" value={formatDuration(tour.duration_minutes)} />
        <Info label="Цена" value={formatPrice(tour.price.amount)} strong />
      </div>

      <Button onClick={onDetails} fullWidth icon={<EyeIcon size={17} />}>
        Просмотреть детали
      </Button>
    </article>
  )
}

function TourDetailsModal({
  tour,
  busy,
  onApprove,
  onClose,
  onReject,
}: {
  tour: Tour
  busy: boolean
  onApprove: () => void
  onClose: () => void
  onReject: () => void
}) {
  return (
    <div
      style={modalBackdropStyle}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <article style={modalStyle}>
        <button type="button" aria-label="Закрыть" onClick={onClose} style={modalCloseStyle}>
          ×
        </button>

        <div style={modalHeaderStyle}>
          <h2 style={modalTitleStyle}>{tour.title}</h2>
          <Badge status={tour.status} />
        </div>

        <p style={modalDescriptionStyle}>
          {tour.short_description || 'Описание тура пока не заполнено.'}
        </p>

        {tour.cover_image_url ? (
          <img src={tour.cover_image_url} alt="" style={modalImageStyle} />
        ) : null}

        <div style={modalInfoGridStyle}>
          <IconInfo icon={<MapPinIcon size={21} />} value={tour.city_id} />
          <IconInfo icon={<ClockIcon size={21} />} value={formatDuration(tour.duration_minutes)} />
          <IconInfo icon={<PeopleIcon size={21} />} value={tour.group_size_max ? `До ${tour.group_size_max} чел.` : 'Групповой тур'} />
          <IconInfo icon={<MoneyIcon size={21} />} value={formatPrice(tour.price.amount)} />
        </div>

        <section style={guideBoxStyle}>
          <span style={guideLabelStyle}>Гид</span>
          <strong style={{ fontSize: 16 }}>{tour.guide.name}</strong>
        </section>

        {tour.status === 'moderation' ? (
          <footer style={modalFooterStyle}>
            <Button disabled={busy} onClick={onClose}>
              Закрыть
            </Button>
            <Button disabled={busy} tone="danger" onClick={onReject}>
              Отклонить
            </Button>
            <Button disabled={busy} tone="success" onClick={onApprove}>
              Опубликовать
            </Button>
          </footer>
        ) : null}
      </article>
    </div>
  )
}

function Badge({ status }: { status: TourStatus }) {
  const config = statusConfig[status]
  return (
    <span
      style={{
        color: config.color,
        background: config.background,
        borderRadius: 999,
        padding: '5px 12px',
        fontSize: 13,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  )
}

function Info({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div>
      <span style={infoLabelStyle}>{label}</span>
      <div style={strong ? infoStrongValueStyle : infoValueStyle}>{value}</div>
    </div>
  )
}

function IconInfo({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div style={iconInfoStyle}>
      <span style={iconStyle}>{icon}</span>
      <span>{value}</span>
    </div>
  )
}

function Button({
  children,
  disabled,
  fullWidth,
  icon,
  tone = 'neutral',
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  fullWidth?: boolean
  icon?: ReactNode
  tone?: 'neutral' | 'success' | 'danger'
  onClick: () => void
}) {
  const color =
    tone === 'success' ? '#0A8F73' : tone === 'danger' ? tokens.color.danger : tokens.color.textPrimary
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: fullWidth ? '100%' : 'auto',
        minHeight: 40,
        border: `1px solid ${tokens.color.border}`,
        background: tokens.color.surface,
        color,
        borderRadius: 8,
        padding: '9px 14px',
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      {children}
    </button>
  )
}

function StateBox({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' }) {
  return (
    <div style={{ ...cardStyle, padding: 28, textAlign: 'center', color: tone === 'danger' ? tokens.color.danger : tokens.color.textSecondary }}>
      {text}
    </div>
  )
}

function formatDuration(minutes: number) {
  const hours = Math.max(1, Math.round(minutes / 60))
  if (hours % 10 === 1 && hours % 100 !== 11) return `${hours} час`
  if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100)) return `${hours} часа`
  return `${hours} часов`
}

function formatPrice(amount: number) {
  return `${amount.toLocaleString('ru-RU')} ₽`
}

const pageStyle: CSSProperties = { display: 'grid', gap: 22 }
const toolbarStyle: CSSProperties = { display: 'flex', alignItems: 'center' }
const searchStyle: CSSProperties = {
  width: 460,
  maxWidth: '100%',
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 14px',
  background: tokens.color.surfaceAlt,
  borderRadius: 12,
  border: `1px solid ${tokens.color.border}`,
}
const searchInputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: tokens.color.textPrimary,
  fontSize: 15,
}
const titleStyle: CSSProperties = { margin: 0, fontSize: 28, lineHeight: 1.15, color: tokens.color.textPrimary }
const subtitleStyle: CSSProperties = { margin: '6px 0 0', color: tokens.color.textSecondary, fontSize: 15 }
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
}
const cardStyle: CSSProperties = {
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 14,
  boxShadow: tokens.shadow.card,
  padding: 24,
  display: 'grid',
  gap: 18,
}
const cardImageStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  height: 'auto',
  objectFit: 'cover',
  objectPosition: 'center',
  borderRadius: 12,
  background: tokens.color.surfaceAlt,
}
const cardHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }
const cardTitleStyle: CSSProperties = { margin: 0, color: tokens.color.textPrimary, fontSize: 22, lineHeight: 1.25 }
const cardBodyStyle: CSSProperties = { display: 'grid', gap: 14 }
const infoLabelStyle: CSSProperties = { color: tokens.color.textSecondary, fontSize: 15 }
const infoValueStyle: CSSProperties = { marginTop: 3, color: tokens.color.textPrimary, fontSize: 18, lineHeight: 1.2 }
const infoStrongValueStyle: CSSProperties = { ...infoValueStyle, fontWeight: 800 }
const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 24, 39, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: 24,
}
const modalStyle: CSSProperties = {
  position: 'relative',
  width: 680,
  maxWidth: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 48px)',
  overflowY: 'auto',
  background: tokens.color.surface,
  borderRadius: 14,
  padding: '34px 40px 36px',
  boxShadow: '0 22px 70px rgba(15, 23, 42, 0.22)',
}
const modalCloseStyle: CSSProperties = {
  position: 'absolute',
  top: 20,
  right: 20,
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  color: '#111827',
  fontSize: 30,
  lineHeight: 1,
  cursor: 'pointer',
}
const modalHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, paddingRight: 42 }
const modalTitleStyle: CSSProperties = { margin: 0, color: tokens.color.textPrimary, fontSize: 27, lineHeight: 1.2 }
const modalDescriptionStyle: CSSProperties = { margin: '26px 0', color: tokens.color.textPrimary, fontSize: 18, lineHeight: 1.45 }
const modalImageStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  height: 'auto',
  objectFit: 'cover',
  objectPosition: 'center',
  borderRadius: 12,
  margin: '0 0 26px',
  background: tokens.color.surfaceAlt,
}
const modalInfoGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '22px 36px', marginBottom: 24 }
const iconInfoStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 13, color: tokens.color.textSecondary, fontSize: 18 }
const iconStyle: CSSProperties = { width: 22, color: '#0A8F73', fontWeight: 900, textAlign: 'center' }
const guideBoxStyle: CSSProperties = { background: '#EEF6FC', borderRadius: 12, padding: '20px 22px', display: 'grid', gap: 8 }
const guideLabelStyle: CSSProperties = { color: tokens.color.textPrimary, fontWeight: 800, fontSize: 17 }
const modalFooterStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 26 }
