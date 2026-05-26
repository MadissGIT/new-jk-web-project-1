import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuthStore } from '../../shared/auth/authStore'
import { useLogout } from '../../shared/auth/hooks'
import { tokens } from '../../shared/theme/tokens'
import {
  AnalyticsIcon,
  BellIcon,
  KnowledgeIcon,
  LogoutIcon,
  TicketsIcon,
  UserIcon,
} from '../../shared/ui/Icon'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

type NavEntry = {
  to: string
  label: string
  icon: IconComponent
}

const navItems: NavEntry[] = [
  { to: '/admin/users', label: 'Пользователи', icon: UserIcon },
  { to: '/admin/guides', label: 'Заявки гидов', icon: UserIcon },
  { to: '/admin/tours', label: 'Туры', icon: TicketsIcon },
  { to: '/admin/poes', label: 'Точки интереса', icon: KnowledgeIcon },
  { to: '/admin/reviews', label: 'Отзывы', icon: AnalyticsIcon },
]

export function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: tokens.color.pageBg,
        color: tokens.color.textPrimary,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      }}
    >
      <aside
        style={{
          width: 250,
          background: tokens.color.surface,
          color: tokens.color.textPrimary,
          borderRight: `1px solid ${tokens.color.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 14px',
          gap: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 24,
            fontWeight: 800,
            color: '#111827',
            padding: '0 12px',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid #007D68',
              color: '#007D68',
              display: 'grid',
              placeItems: 'center',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ◇
          </span>
          TourAdmin
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <button
            type="button"
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              border: 'none',
              color: tokens.color.textSecondary,
              borderRadius: tokens.radius.sm,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            <LogoutIcon size={18} />
            Выйти
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            height: 64,
            background: tokens.color.surface,
            borderBottom: `1px solid ${tokens.color.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 28px',
            gap: 20,
          }}
        >
          <button
            type="button"
            aria-label="Уведомления"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: tokens.color.textSecondary,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <BellIcon size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: tokens.color.surfaceAlt,
                color: tokens.color.textSecondary,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <UserIcon size={20} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {user?.name ? `${user.name}` : 'Админ'}
              </span>
              {user?.email ? (
                <span style={{ fontSize: 12, color: tokens.color.textMuted }}>
                  {user.email}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: 28, minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, label, icon: IconComp }: NavEntry) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 12,
        textDecoration: 'none',
        fontSize: 16,
        fontWeight: isActive ? 700 : 600,
        background: isActive ? '#DDF6EE' : 'transparent',
        color: isActive ? '#007D68' : '#4B5563',
        transition: 'background 120ms ease, color 120ms ease',
      })}
    >
      <IconComp size={18} />
      {label}
    </NavLink>
  )
}
