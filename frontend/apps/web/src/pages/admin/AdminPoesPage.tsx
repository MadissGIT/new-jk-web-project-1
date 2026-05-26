import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { extractApiError, http } from '../../shared/api/http'
import { tokens } from '../../shared/theme/tokens'

type PoeAccessibility = {
  wheelchair_accessible: boolean
  has_ramp: boolean
  has_stairs: boolean
}

type Poe = {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  location: { lat: number; lng: number; address?: string | null }
  accessibility: PoeAccessibility
  rating: number
  reviews_count: number
  duration_minutes: number
  images: string[]
}

type ListResponse<T> = { data: T[]; meta: { total: number } }

const categories = [
  'art',
  'coffee',
  'history',
  'nature',
  'music',
  'relax',
  'landmark',
  'museum',
  'restaurant',
  'entertainment',
]
const categoryLabel: Record<string, string> = {
  art: 'Искусство',
  coffee: 'Кофейня',
  history: 'История',
  nature: 'Природа',
  music: 'Музыка',
  relax: 'Спокойное место',
  landmark: 'Достопримечательность',
  museum: 'Музей',
  restaurant: 'Ресторан',
  entertainment: 'Развлечения',
}

const DEFAULT_FORM: FormState = {
  title: '',
  lat: '56.8379',
  lng: '60.6055',
  category: 'art',
  description: '',
  address: '',
  tags: '',
  durationMinutes: '30',
  wheelchairAccessible: false,
  hasRamp: false,
  hasStairs: false,
  images: [],
}

type FormState = {
  title: string
  lat: string
  lng: string
  category: string
  description: string
  address: string
  tags: string
  durationMinutes: string
  wheelchairAccessible: boolean
  hasRamp: boolean
  hasStairs: boolean
  images: string[]
}

function formStateFromPoe(poe: Poe): FormState {
  return {
    title: poe.title,
    lat: String(poe.location.lat),
    lng: String(poe.location.lng),
    category: poe.category,
    description: poe.description,
    address: poe.location.address ?? '',
    tags: poe.tags.join(', '),
    durationMinutes: String(poe.duration_minutes),
    wheelchairAccessible: poe.accessibility.wheelchair_accessible,
    hasRamp: poe.accessibility.has_ramp,
    hasStairs: poe.accessibility.has_stairs,
    images: poe.images ?? [],
  }
}

function parseTags(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function fetchPoes() {
  const response = await http.get<ListResponse<Poe>>('/admin/poes', { params: { limit: 100 } })
  return response.data
}

function payloadFromForm(form: FormState) {
  return {
    title: form.title,
    description: form.description,
    category: form.category,
    tags: parseTags(form.tags),
    lat: Number(form.lat),
    lng: Number(form.lng),
    address: form.address,
    wheelchair_accessible: form.wheelchairAccessible,
    has_ramp: form.hasRamp,
    has_stairs: form.hasStairs,
    duration_minutes: Math.max(1, Number(form.durationMinutes) || 30),
    images: form.images.filter(Boolean),
  }
}

async function createPoe(form: FormState) {
  return http.post('/poes', {
    city_id: 'ekb',
    ...payloadFromForm(form),
    opening_hours: [],
  })
}

async function updatePoe(payload: { id: string; form: FormState }) {
  return http.patch(`/admin/poes/${payload.id}`, payloadFromForm(payload.form))
}

export function AdminPoesPage() {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Poe | null>(null)
  const queryClient = useQueryClient()
  const poes = useQuery({ queryKey: ['admin', 'poes'], queryFn: fetchPoes })
  const create = useMutation({
    mutationFn: createPoe,
    onSuccess: () => {
      setCreating(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'poes'] })
    },
  })
  const update = useMutation({
    mutationFn: updatePoe,
    onSuccess: () => {
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'poes'] })
    },
  })

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={titleStyle}>Точки интереса</h1>
          <p style={subtitleStyle}>Управление точками интереса (POI)</p>
        </div>
        <Button tone="success" onClick={() => setCreating(true)}>+ Добавить POI</Button>
      </header>
      <section style={panelStyle}>
        {poes.isLoading ? (
          <StateBox text="Загружаем точки..." />
        ) : poes.isError ? (
          <StateBox text={extractApiError(poes.error)} tone="danger" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: tokens.color.surfaceAlt }}>
                <Th>Фото</Th>
                <Th>Название</Th>
                <Th>Категория</Th>
                <Th>Доступность</Th>
                <Th>Длительность</Th>
                <Th>Координаты</Th>
                <Th>Действия</Th>
              </tr>
            </thead>
            <tbody>
              {(poes.data?.data ?? []).map((poe) => (
                <tr key={poe.id} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
                  <Td>
                    {poe.images?.[0] ? (
                      <img
                        src={poe.images[0]}
                        alt=""
                        style={{
                          width: 64,
                          height: 48,
                          objectFit: 'cover',
                          borderRadius: 6,
                          border: `1px solid ${tokens.color.border}`,
                        }}
                      />
                    ) : (
                      <div style={emptyPhotoStyle}>—</div>
                    )}
                  </Td>
                  <Td>
                    <div style={{ fontWeight: 700 }}>{poe.title}</div>
                    <div style={{ fontSize: 12, color: tokens.color.textMuted }}>{poe.location.address}</div>
                  </Td>
                  <Td>
                    <Badge>{categoryLabel[poe.category] || poe.category}</Badge>
                  </Td>
                  <Td>
                    <AccessibilityBadges accessibility={poe.accessibility} />
                  </Td>
                  <Td>{poe.duration_minutes} мин</Td>
                  <Td style={{ fontSize: 12 }}>
                    {poe.location.lat}, {poe.location.lng}
                  </Td>
                  <Td>
                    <Button onClick={() => setEditing(poe)}>Редактировать</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {create.error || update.error ? (
        <StateBox text={extractApiError(create.error || update.error)} tone="danger" />
      ) : null}
      {creating ? (
        <PoeForm
          title="Добавить новый POI"
          submitting={create.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(form) => create.mutate(form)}
        />
      ) : null}
      {editing ? (
        <PoeForm
          title="Редактировать POI"
          submitting={update.isPending}
          initial={formStateFromPoe(editing)}
          onClose={() => setEditing(null)}
          onSubmit={(form) => update.mutate({ id: editing.id, form })}
        />
      ) : null}
    </div>
  )
}

type BadgeTone = 'ok' | 'no' | 'warn'

function AccessibilityBadges({ accessibility }: { accessibility: PoeAccessibility }) {
  const items: Array<{ key: string; label: string; tone: BadgeTone }> = [
    {
      key: 'wheel',
      label: accessibility.wheelchair_accessible ? 'Коляска' : 'Без коляски',
      tone: accessibility.wheelchair_accessible ? 'ok' : 'no',
    },
    {
      key: 'ramp',
      label: accessibility.has_ramp ? 'Пандус' : 'Без пандуса',
      tone: accessibility.has_ramp ? 'ok' : 'no',
    },
    {
      key: 'stairs',
      label: accessibility.has_stairs ? 'Есть лестницы' : 'Без лестниц',
      tone: accessibility.has_stairs ? 'warn' : 'ok',
    },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map((item) => {
        const palette = BADGE_PALETTE[item.tone]
        return (
          <span
            key={item.key}
            style={{
              fontSize: 11,
              borderRadius: 999,
              padding: '2px 8px',
              background: palette.bg,
              color: palette.fg,
              fontWeight: 700,
            }}
          >
            {palette.icon} {item.label}
          </span>
        )
      })}
    </div>
  )
}

const BADGE_PALETTE: Record<BadgeTone, { bg: string; fg: string; icon: string }> = {
  ok: { bg: '#E1F4E8', fg: '#27623F', icon: '✓' },
  no: { bg: '#F9E0E0', fg: '#933333', icon: '×' },
  warn: { bg: '#FCEBD4', fg: '#8A5A1E', icon: '⚠' },
}

function PoeForm({
  title,
  initial,
  submitting,
  onClose,
  onSubmit,
}: {
  title: string
  initial?: FormState
  submitting?: boolean
  onClose: () => void
  onSubmit: (form: FormState) => void
}) {
  const [form, setForm] = useState<FormState>(initial ?? DEFAULT_FORM)
  const [imageInput, setImageInput] = useState('')

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))

  const addImage = () => {
    const url = imageInput.trim()
    if (!url) return
    if (form.images.includes(url)) {
      setImageInput('')
      return
    }
    update({ images: [...form.images, url] })
    setImageInput('')
  }

  const removeImage = (url: string) => {
    update({ images: form.images.filter((item) => item !== url) })
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={modalStyle}>
        <button type="button" onClick={onClose} style={modalCloseStyle}>×</button>
        <h2 style={{ margin: 0 }}>{title}</h2>

        <Field label="Название" value={form.title} onChange={(value) => update({ title: value })} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Широта" value={form.lat} onChange={(value) => update({ lat: value })} />
          <Field label="Долгота" value={form.lng} onChange={(value) => update({ lng: value })} />
        </div>

        <label style={labelStyle}>Категория</label>
        <select
          value={form.category}
          onChange={(event) => update({ category: event.target.value })}
          style={inputStyle}
        >
          {categories.map((item) => (
            <option key={item} value={item}>{categoryLabel[item]}</option>
          ))}
        </select>

        <Field
          label="Теги (через запятую, нужны для подбора маршрута)"
          value={form.tags}
          onChange={(value) => update({ tags: value })}
          placeholder="например: art, gallery, modern"
        />

        <Field
          label="Длительность посещения, мин"
          value={form.durationMinutes}
          onChange={(value) => update({ durationMinutes: value.replace(/[^0-9]/g, '') })}
        />

        <Field label="Адрес" value={form.address} onChange={(value) => update({ address: value })} />
        <Field
          label="Описание"
          value={form.description}
          onChange={(value) => update({ description: value })}
          textarea
        />

        <div>
          <label style={labelStyle}>Доступность</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <Checkbox
              label="Доступно для инвалидной коляски"
              checked={form.wheelchairAccessible}
              onChange={(value) => update({ wheelchairAccessible: value })}
            />
            <Checkbox
              label="Есть пандус"
              checked={form.hasRamp}
              onChange={(value) => update({ hasRamp: value })}
            />
            <Checkbox
              label="Есть лестницы"
              checked={form.hasStairs}
              onChange={(value) => update({ hasStairs: value })}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Фотографии (URL)</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              value={imageInput}
              onChange={(event) => setImageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addImage()
                }
              }}
              placeholder="https://...jpg"
              style={{ ...inputStyle, flex: 1 }}
            />
            <Button onClick={addImage}>+ Добавить</Button>
          </div>
          {form.images.length === 0 ? (
            <div style={{ marginTop: 8, fontSize: 12, color: tokens.color.textMuted }}>
              Пока не добавлено ни одного фото. Без фото в карточке будет показан плейсхолдер.
            </div>
          ) : (
            <div
              style={{
                marginTop: 10,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {form.images.map((url) => (
                <div key={url} style={imageThumbWrapStyle}>
                  <img src={url} alt="" style={imageThumbStyle} />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    style={imageRemoveBtnStyle}
                    aria-label="Удалить фото"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button tone="success" onClick={() => onSubmit(form)} disabled={submitting}>
            {submitting ? 'Сохраняем...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  textarea,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  textarea?: boolean
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {textarea ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...inputStyle, height: 84, paddingTop: 10 }}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          style={inputStyle}
        />
      )}
    </label>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 16, height: 16 }}
      />
      <span style={{ fontSize: 13, color: tokens.color.textPrimary }}>{label}</span>
    </label>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>{children}</th>
}

function Td({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px 14px', fontSize: 14, verticalAlign: 'top', ...style }}>{children}</td>
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        background: tokens.color.surfaceAlt,
        borderRadius: 999,
        padding: '4px 9px',
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  )
}

function Button({
  children,
  tone = 'neutral',
  onClick,
  disabled,
}: {
  children: ReactNode
  tone?: 'neutral' | 'success'
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${tone === 'success' ? '#0EA98E' : tokens.color.border}`,
        background: tone === 'success' ? '#0EA98E' : tokens.color.surface,
        color: tone === 'success' ? '#fff' : tokens.color.textPrimary,
        borderRadius: 8,
        padding: '8px 12px',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

function StateBox({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' }) {
  return (
    <div
      style={{
        padding: 28,
        textAlign: 'center',
        color: tone === 'danger' ? tokens.color.danger : tokens.color.textSecondary,
      }}
    >
      {text}
    </div>
  )
}

const titleStyle = { margin: 0, fontSize: 24, color: tokens.color.textPrimary } as const
const subtitleStyle = { margin: '5px 0 0', color: tokens.color.textSecondary, fontSize: 13 } as const
const panelStyle = {
  background: tokens.color.surface,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 12,
  boxShadow: tokens.shadow.card,
  overflow: 'hidden',
} as const
const labelStyle = { fontSize: 13, fontWeight: 700, color: tokens.color.textPrimary } as const
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  height: 38,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 8,
  padding: '0 10px',
  outline: 'none',
} as const
const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 50,
  overflow: 'auto',
  padding: '24px 16px',
} as const
const modalStyle = {
  position: 'relative',
  width: 520,
  maxWidth: 'calc(100vw - 32px)',
  background: tokens.color.surface,
  borderRadius: 14,
  padding: 22,
  display: 'grid',
  gap: 12,
  maxHeight: 'calc(100vh - 48px)',
  overflowY: 'auto',
} as const
const modalCloseStyle = {
  position: 'absolute',
  top: 10,
  right: 14,
  border: 'none',
  background: 'transparent',
  fontSize: 22,
  cursor: 'pointer',
} as const
const emptyPhotoStyle = {
  width: 64,
  height: 48,
  borderRadius: 6,
  border: `1px dashed ${tokens.color.border}`,
  display: 'grid',
  placeItems: 'center',
  color: tokens.color.textMuted,
  fontSize: 18,
} as const
const imageThumbWrapStyle = {
  position: 'relative',
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 8,
  overflow: 'hidden',
  aspectRatio: '4 / 3',
  background: tokens.color.surfaceAlt,
} as const
const imageThumbStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
} as const
const imageRemoveBtnStyle = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 22,
  height: 22,
  border: 'none',
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
} as const
