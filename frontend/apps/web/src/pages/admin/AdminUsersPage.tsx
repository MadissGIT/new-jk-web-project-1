import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { extractApiError, http } from '../../shared/api/http'
import { tokens } from '../../shared/theme/tokens'

type UserRole = 'user' | 'employee' | 'admin'
type UserStatus = 'active' | 'blocked'

type AdminUser = {
  id: string
  name: string
  surname: string
  patronymic?: string | null
  email: string
  role: UserRole
  status: UserStatus
  date_of_birth: string
  created_at: string
  blocked_at?: string | null
  block_reason?: string | null
}

type ListResponse<T> = {
  data: T[]
  meta: { total: number }
}

const roleLabel: Record<UserRole, string> = {
  user: 'Турист',
  employee: 'Гид',
  admin: 'Админ',
}

const statusLabel: Record<UserStatus, string> = {
  active: 'Активен',
  blocked: 'Заблокирован',
}

async function fetchUsers() {
  const response = await http.get<ListResponse<AdminUser>>('/admin/users', {
    params: { limit: 100 },
  })
  return response.data
}

async function blockUser(id: string) {
  return http.post(`/admin/users/${id}/block`, { reason: null })
}

async function unblockUser(id: string) {
  return http.post(`/admin/users/${id}/unblock`)
}

export function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [status, setStatus] = useState<UserStatus | 'all'>('all')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const queryClient = useQueryClient()

  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchUsers })
  const blockMutation = useMutation({
    mutationFn: blockUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
  const unblockMutation = useMutation({
    mutationFn: unblockUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const rows = users.data?.data ?? []
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((user) => {
      const matchesQuery = !needle || `${user.name} ${user.surname} ${user.email}`.toLowerCase().includes(needle)
      const matchesRole = role === 'all' || user.role === role
      const matchesStatus = status === 'all' || user.status === status
      return matchesQuery && matchesRole && matchesStatus
    })
  }, [query, role, rows, status])

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((user) => user.status === 'active').length,
      blocked: rows.filter((user) => user.status === 'blocked').length,
      tourists: rows.filter((user) => user.role === 'user').length,
      guides: rows.filter((user) => user.role === 'employee').length,
    }),
    [rows],
  )

  const busy = blockMutation.isPending || unblockMutation.isPending
  const actionError = blockMutation.error || unblockMutation.error

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <PageTitle title="Пользователи" subtitle="Управление зарегистрированными пользователями" />

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14 }}>
        <StatCard label="Всего" value={stats.total} />
        <StatCard label="Активных" value={stats.active} tone="success" />
        <StatCard label="Заблокировано" value={stats.blocked} tone="danger" />
        <StatCard label="Туристов" value={stats.tourists} />
        <StatCard label="Гидов" value={stats.guides} tone="success" />
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: `1px solid ${tokens.color.border}` }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по email или имени..."
            style={inputStyle}
          />
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole | 'all')} style={selectStyle}>
            <option value="all">Роль: Все</option>
            <option value="user">Турист</option>
            <option value="employee">Гид</option>
            <option value="admin">Админ</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as UserStatus | 'all')} style={selectStyle}>
            <option value="all">Статус: Все</option>
            <option value="active">Активные</option>
            <option value="blocked">Заблокированные</option>
          </select>
        </div>

        {users.isLoading ? (
          <StateBox text="Загружаем пользователей..." />
        ) : users.isError ? (
          <StateBox text={extractApiError(users.error)} tone="danger" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.color.surfaceAlt, color: tokens.color.textSecondary }}>
                <Th>ID</Th>
                <Th>Пользователь</Th>
                <Th>Email</Th>
                <Th>Роль</Th>
                <Th>Дата регистрации</Th>
                <Th>Статус</Th>
                <Th>Действия</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((user) => (
                <tr key={user.id} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
                  <Td>{user.id.slice(0, 8)}</Td>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={user} />
                      <strong>{fullName(user)}</strong>
                    </div>
                  </Td>
                  <Td>{user.email}</Td>
                  <Td><Badge>{roleLabel[user.role]}</Badge></Td>
                  <Td>{formatDate(user.created_at)}</Td>
                  <Td>
                    <Badge tone={user.status === 'blocked' ? 'danger' : 'success'}>
                      {statusLabel[user.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ActionButton onClick={() => setSelectedUser(user)}>Просмотреть</ActionButton>
                      {user.status === 'blocked' ? (
                        <ActionButton disabled={busy} onClick={() => unblockMutation.mutate(user.id)}>Разблокировать</ActionButton>
                      ) : (
                        <ActionButton disabled={busy} tone="danger" onClick={() => blockMutation.mutate(user.id)}>Заблокировать</ActionButton>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {actionError ? <StateBox text={extractApiError(actionError)} tone="danger" /> : null}

      {selectedUser ? (
        <Modal title="Информация о пользователе" subtitle="Подробные данные пользователя" onClose={() => setSelectedUser(null)}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar user={selectedUser} large />
              <div>
                <strong>{fullName(selectedUser)}</strong>
                <div style={{ color: tokens.color.textSecondary }}>{roleLabel[selectedUser.role]}</div>
              </div>
            </div>
            <Info label="ID" value={selectedUser.id} />
            <Info label="Email" value={selectedUser.email} />
            <Info label="Дата регистрации" value={formatDate(selectedUser.created_at)} />
            <Info label="Статус" value={statusLabel[selectedUser.status]} />
            {selectedUser.block_reason ? <Info label="Причина блокировки" value={selectedUser.block_reason} /> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <ActionButton onClick={() => setSelectedUser(null)}>Закрыть</ActionButton>
              {selectedUser.status === 'blocked' ? (
                <ActionButton disabled={busy} onClick={() => unblockMutation.mutate(selectedUser.id)}>Разблокировать</ActionButton>
              ) : (
                <ActionButton disabled={busy} tone="danger" onClick={() => blockMutation.mutate(selectedUser.id)}>Заблокировать</ActionButton>
              )}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function fullName(user: AdminUser) {
  return [user.surname, user.name].filter(Boolean).join(' ') || user.email
}

function initials(user: AdminUser) {
  return `${user.name?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase() || 'U'
}

function Avatar({ user, large }: { user: AdminUser; large?: boolean }) {
  const size = large ? 48 : 28
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#EAF7F2', color: '#0EA98E', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
      {initials(user)}
    </div>
  )
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h1 style={{ margin: 0, fontSize: 24, color: tokens.color.textPrimary }}>{title}</h1>
      <p style={{ margin: '5px 0 0', color: tokens.color.textSecondary, fontSize: 14 }}>{subtitle}</p>
    </header>
  )
}

function StatCard({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'success' | 'danger' }) {
  const color = tone === 'success' ? '#0EA98E' : tone === 'danger' ? tokens.color.danger : tokens.color.textPrimary
  return <div style={{ ...panelStyle, padding: 18 }}><div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div><div style={{ marginTop: 10, color: tokens.color.textSecondary, fontSize: 13 }}>{label}</div></div>
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12 }}>{children}</th>
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '12px 14px', fontSize: 14, color: tokens.color.textPrimary }}>{children}</td>
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' }) {
  const color = tone === 'success' ? '#0EA98E' : tone === 'danger' ? tokens.color.danger : tokens.color.textPrimary
  return <span style={{ color, background: tokens.color.surfaceAlt, borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 700 }}>{children}</span>
}

function ActionButton({ children, disabled, tone = 'neutral', onClick }: { children: ReactNode; disabled?: boolean; tone?: 'neutral' | 'danger'; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ border: `1px solid ${tone === 'danger' ? tokens.color.danger : tokens.color.border}`, background: tokens.color.surface, color: tone === 'danger' ? tokens.color.danger : tokens.color.textPrimary, borderRadius: 8, padding: '7px 10px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>{children}</button>
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle: string; children: ReactNode; onClose: () => void }) {
  return <div style={modalBackdropStyle}><div style={modalStyle}><button type="button" onClick={onClose} style={modalCloseStyle}>×</button><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><p style={{ margin: '4px 0 18px', color: tokens.color.textSecondary }}>{subtitle}</p>{children}</div></div>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div style={{ color: tokens.color.textSecondary, fontSize: 12 }}>{label}</div><div style={{ marginTop: 2, color: tokens.color.textPrimary }}>{value}</div></div>
}

function StateBox({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' }) {
  return <div style={{ padding: 28, textAlign: 'center', color: tone === 'danger' ? tokens.color.danger : tokens.color.textSecondary }}>{text}</div>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

const panelStyle = {
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 12,
  boxShadow: tokens.shadow.card,
  overflow: 'hidden',
} as const

const inputStyle = {
  flex: 1,
  height: 38,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 8,
  padding: '0 12px',
  outline: 'none',
} as const

const selectStyle = {
  height: 38,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 8,
  padding: '0 10px',
  background: tokens.color.surface,
} as const

const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 50,
} as const

const modalStyle = {
  position: 'relative',
  width: 420,
  maxWidth: 'calc(100vw - 32px)',
  background: tokens.color.surface,
  borderRadius: 14,
  padding: 22,
  boxShadow: '0 20px 60px rgba(31,42,68,0.25)',
} as const

const modalCloseStyle = {
  position: 'absolute',
  right: 14,
  top: 10,
  border: 'none',
  background: 'transparent',
  fontSize: 22,
  cursor: 'pointer',
  color: tokens.color.textSecondary,
} as const
