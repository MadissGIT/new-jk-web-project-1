import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...props }: Props) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export function TicketsIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M21 11.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4.5a2 2 0 0 1 0 4V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3.5a2 2 0 0 1 0-4Z" />
      <path d="M12 6v12" strokeDasharray="2 3" />
    </svg>
  )
}

export function SearchIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function EyeIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function MapPinIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  )
}

export function ClockIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function PeopleIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 11a3 3 0 0 0 0-6" />
      <path d="M17.5 20a5.5 5.5 0 0 0-3-4.9" />
    </svg>
  )
}

export function MoneyIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v18" />
      <path d="M17 7.5A4 4 0 0 0 12 6c-2.2 0-4 1-4 2.7 0 4 8.5 1.8 8.5 6.3 0 1.8-1.9 3-4.5 3a5.8 5.8 0 0 1-5-2.3" />
    </svg>
  )
}

export function AnalyticsIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  )
}

export function KnowledgeIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M12 3a6 6 0 0 1 4 10.5V16a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5A6 6 0 0 1 12 3Z" />
      <path d="M10 21h4" />
    </svg>
  )
}

export function SettingsIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

export function BellIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function UserIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

export function ArrowRightIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  )
}

export function LogoutIcon(props: Props) {
  return (
    <svg {...base(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}
