import { cn } from '../../utils/format'
import type { ReactNode } from 'react'

interface Props {
  icon:     string          // emoji or short text e.g. "G", "📍"
  iconBg:   string          // tailwind bg class e.g. "bg-blue-600"
  iconColor?: string        // tailwind text class, defaults to text-white
  title:    string
  subtitle?: string
  badge?:   ReactNode       // e.g. <DataBadge />
  actions?: ReactNode       // e.g. refresh button, tabs
}

export function SectionHeader({ icon, iconBg, iconColor = 'text-white', title, subtitle, badge, actions }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className={cn('text-base font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2')}>
          <span className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm shrink-0',
            iconBg, iconColor
          )}>
            {icon}
          </span>
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-9">{subtitle}</p>
        )}
      </div>
      {(badge || actions) && (
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {actions}
        </div>
      )}
    </div>
  )
}
