import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { extractApiError, http } from '../../shared/api/http'
import { tokens } from '../../shared/theme/tokens'

type Status = 'pending' | 'approved' | 'rejected'
type Payload = {
  displayName?: string
  bio?: string
  specializations?: string[]
  languages?: string[]
  experienceYears?: number
  contacts?: string
}
type GuideApplication = {
  id: string
  user_id: string
  payload: Payload
  status: Status
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}
type AdminUser = {
  id: string
  name: string
  surname: string
  email: string
}
type ListResponse<T> = {
  data: T[]
  meta: { total: number }
}

const labels: Record<Status, string> = {
  pending: 'Ожидают',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

async function fetchApplications() {
  const response = await http.get<ListResponse<GuideApplication>>('/admin/guides/applications', {
    params: { limit: 100 },
  })
  return response.data
}

async function fetchUsers() {
  const response = await http.get<ListResponse<AdminUser>>('/admin/users', { params: { limit: 100 } })
  return response.data
}

async function approve(id: string) {
  return http.post(`/admin/guides/applications/${id}/approve`)
}

async function reject(id: string) {
  return http.post(`/admin/guides/applications/${id}/reject`, { reason: null })
}

export function GuideApplicationsPage() {
  const [status, setStatus] = useState<Status | 'all'>('pending')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<GuideApplication | null>(null)
  const queryClient = useQueryClient()

  const applications = useQuery({ queryKey: ['admin', 'guide-applications'], queryFn: fetchApplications })
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchUsers })
  const approveMutation = useMutation({
    mutationFn: approve,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'guide-applications'] }),
  })
  const rejectMutation = useMutation({
    mutationFn: reject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'guide-applications'] }),
  })

  const rows = applications.data?.data ?? []
  const userById = useMemo(() => new Map((users.data?.data ?? []).map((user) => [user.id, user])), [users.data?.data])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((item) => {
      const user = userById.get(item.user_id)
      const payload = item.payload
      const matchesStatus = status === 'all' || item.status === status
      const haystack = [
        payload.displayName,
        payload.bio,
        payload.contacts,
        payload.specializations?.join(' '),
        payload.languages?.join(' '),
        user?.email,
      ].filter(Boolean).join(' ').toLowerCase()
      return matchesStatus && (!needle || haystack.includes(needle))
    })
  }, [query, rows, status, userById])

  const counts = useMemo(() => ({
    pending: rows.filter((item) => item.status === 'pending').length,
    approved: rows.filter((item) => item.status === 'approved').length,
    rejected: rows.filter((item) => item.status === 'rejected').length,
  }), [rows])

  const busy = approveMutation.isPending || rejectMutation.isPending
  const actionError = approveMutation.error || rejectMutation.error

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, color: tokens.color.textPrimary }}>Модерация гидов</h1>
        <p style={{ margin: '5px 0 0', color: tokens.color.textSecondary }}>Заявки на получение статуса гида</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <StatCard active={status === 'pending'} label="Ожидают" value={counts.pending} tone="warning" onClick={() => setStatus('pending')} />
        <StatCard active={status === 'approved'} label="Одобрено" value={counts.approved} tone="success" onClick={() => setStatus('approved')} />
        <StatCard active={status === 'rejected'} label="Отклонено" value={counts.rejected} tone="danger" onClick={() => setStatus('rejected')} />
      </section>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по имени или email..." style={inputStyle} />
        <button type="button" onClick={() => setStatus('all')} style={pillStyle(status === 'all')}>Все</button>
      </div>

      {applications.isLoading ? (
        <StateBox text="Загружаем заявки..." />
      ) : applications.isError ? (
        <StateBox text={extractApiError(applications.error)} tone="danger" />
      ) : filtered.length ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 14 }}>
          {filtered.map((item) => (
            <GuideCard
              key={item.id}
              application={item}
              email={userById.get(item.user_id)?.email}
              busy={busy}
              onDetails={() => setSelected(item)}
              onApprove={() => approveMutation.mutate(item.id)}
              onReject={() => rejectMutation.mutate(item.id)}
            />
          ))}
        </section>
      ) : (
        <StateBox text="Заявок с такими параметрами нет" />
      )}

      {actionError ? <StateBox text={extractApiError(actionError)} tone="danger" /> : null}

      {selected ? (
        <ApplicationModal
          application={selected}
          email={userById.get(selected.user_id)?.email}
          busy={busy}
          onClose={() => setSelected(null)}
          onApprove={() => approveMutation.mutate(selected.id)}
          onReject={() => rejectMutation.mutate(selected.id)}
        />
      ) : null}
    </div>
  )
}

function GuideCard({ application, email, busy, onDetails, onApprove, onReject }: { application: GuideApplication; email?: string; busy: boolean; onDetails: () => void; onApprove: () => void; onReject: () => void }) {
  const payload = application.payload
  const isPending = application.status === 'pending'
  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar name={payload.displayName} />
        <div>
          <strong>{payload.displayName || 'Без имени'}</strong>
          <div style={{ color: tokens.color.textSecondary, fontSize: 12 }}>{email || payload.contacts || 'email не указан'}</div>
        </div>
      </div>
      <p style={{ minHeight: 54, color: tokens.color.textPrimary, lineHeight: 1.45 }}>{payload.bio || 'Биография не заполнена'}</p>
      <Info label="Опыт" value={`${payload.experienceYears ?? 0} лет`} />
      <Info label="Языки" value={payload.languages?.join(', ') || '—'} />
      <Info label="Заявка" value={formatDate(application.created_at)} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(payload.specializations ?? []).map((item) => <Badge key={item}>{item}</Badge>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isPending ? '1fr auto auto' : '1fr', gap: 8, paddingTop: 12, borderTop: `1px solid ${tokens.color.border}` }}>
        <ActionButton onClick={onDetails}>Подробнее</ActionButton>
        {isPending ? <>
          <IconButton disabled={busy} tone="success" onClick={onApprove}>✓</IconButton>
          <IconButton disabled={busy} tone="danger" onClick={onReject}>×</IconButton>
        </> : <Badge tone={application.status === 'approved' ? 'success' : 'danger'}>{labels[application.status]}</Badge>}
      </div>
    </article>
  )
}

function ApplicationModal({ application, email, busy, onClose, onApprove, onReject }: { application: GuideApplication; email?: string; busy: boolean; onClose: () => void; onApprove: () => void; onReject: () => void }) {
  const payload = application.payload
  const isPending = application.status === 'pending'
  return (
    <div style={modalBackdropStyle}>
      <div style={modalStyle}>
        <button type="button" onClick={onClose} style={modalCloseStyle}>×</button>
        <h2 style={{ margin: 0 }}>Заявка на статус гида</h2>
        <p style={{ margin: '4px 0 18px', color: tokens.color.textSecondary }}>Подробная информация о кандидате</p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Avatar name={payload.displayName} /><strong>{payload.displayName || 'Без имени'}</strong></div>
          <Info label="Email" value={email || 'не найден'} />
          <Info label="О себе" value={payload.bio || '—'} />
          <Info label="Опыт работы" value={`${payload.experienceYears ?? 0} лет`} />
          <Info label="Языки" value={payload.languages?.join(', ') || '—'} />
          <Info label="Специализации" value={payload.specializations?.join(', ') || '—'} />
          <Info label="Публичные контакты" value={payload.contacts || '—'} />
          <Info label="Дата заявки" value={formatDate(application.created_at)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <ActionButton onClick={onClose}>Закрыть</ActionButton>
          {isPending ? <>
            <ActionButton disabled={busy} tone="danger" onClick={onReject}>Отклонить</ActionButton>
            <ActionButton disabled={busy} tone="success" onClick={onApprove}>Одобрить</ActionButton>
          </> : null}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone, active, onClick }: { label: string; value: number; tone: 'warning' | 'success' | 'danger'; active: boolean; onClick: () => void }) {
  const color = tone === 'success' ? '#0EA98E' : tone === 'danger' ? tokens.color.danger : '#D6A000'
  return <button type="button" onClick={onClick} style={{ ...cardStyle, textAlign: 'left', borderColor: active ? '#0EA98E' : tokens.color.border }}><div style={{ display: 'flex', justifyContent: 'space-between', color: tokens.color.textSecondary }}>{label}<span style={{ color }}>◎</span></div><div style={{ marginTop: 28, fontSize: 28, fontWeight: 800, color }}>{value}</div></button>
}

function Avatar({ name }: { name?: string }) {
  const initials = (name || 'Гид').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#0EA98E', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{initials}</div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span style={{ color: tokens.color.textSecondary, fontSize: 12 }}>{label}</span><div style={{ marginTop: 2 }}>{value}</div></div>
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' }) {
  const color = tone === 'success' ? '#0EA98E' : tone === 'danger' ? tokens.color.danger : tokens.color.textPrimary
  return <span style={{ background: tokens.color.surfaceAlt, color, borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }}>{children}</span>
}

function ActionButton({ children, disabled, tone = 'neutral', onClick }: { children: ReactNode; disabled?: boolean; tone?: 'neutral' | 'success' | 'danger'; onClick: () => void }) {
  const color = tone === 'success' ? '#0EA98E' : tone === 'danger' ? tokens.color.danger : tokens.color.textPrimary
  return <button type="button" disabled={disabled} onClick={onClick} style={{ border: `1px solid ${tokens.color.border}`, color, background: tokens.color.surface, borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>{children}</button>
}

function IconButton(props: { children: ReactNode; disabled?: boolean; tone: 'success' | 'danger'; onClick: () => void }) {
  const color = props.tone === 'success' ? '#0EA98E' : tokens.color.danger
  return <button type="button" disabled={props.disabled} onClick={props.onClick} style={{ width: 34, border: 'none', borderRadius: 8, background: color, color: '#fff', fontWeight: 800, cursor: props.disabled ? 'not-allowed' : 'pointer' }}>{props.children}</button>
}

function StateBox({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' }) {
  return <div style={{ ...cardStyle, padding: 28, color: tone === 'danger' ? tokens.color.danger : tokens.color.textSecondary, textAlign: 'center' }}>{text}</div>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

const inputStyle = { width: 360, height: 38, border: `1px solid ${tokens.color.border}`, borderRadius: 8, padding: '0 12px', outline: 'none' } as const
const cardStyle = { background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: 12, boxShadow: tokens.shadow.card, padding: 18, display: 'grid', gap: 12 } as const
const pillStyle = (active: boolean) => ({ height: 38, border: `1px solid ${active ? '#0EA98E' : tokens.color.border}`, borderRadius: 999, background: active ? '#EAF7F2' : tokens.color.surface, color: active ? '#0EA98E' : tokens.color.textPrimary, padding: '0 14px', fontWeight: 700, cursor: 'pointer' }) as const
const modalBackdropStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 50 } as const
const modalStyle = { position: 'relative', width: 460, maxWidth: 'calc(100vw - 32px)', background: tokens.color.surface, borderRadius: 14, padding: 22, boxShadow: '0 20px 60px rgba(31,42,68,0.25)' } as const
const modalCloseStyle = { position: 'absolute', top: 10, right: 14, border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: tokens.color.textSecondary } as const
