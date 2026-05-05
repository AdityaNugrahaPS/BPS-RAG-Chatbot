import { ReactNode } from 'react'
import clsx from 'clsx'

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children?: ReactNode
  onDismiss?: () => void
  className?: string
}

const cfg = {
  info:    { wrap: 'bg-accent/[0.07]  border-accent/20  text-accent',   dot: 'bg-accent'   },
  success: { wrap: 'bg-success/[0.07] border-success/20 text-success',  dot: 'bg-success'  },
  warning: { wrap: 'bg-warning/[0.07] border-warning/20 text-warning',  dot: 'bg-warning'  },
  error:   { wrap: 'bg-danger/[0.07]  border-danger/20  text-danger',   dot: 'bg-danger'   },
}

export default function Alert({ variant = 'info', title, children, onDismiss, className }: AlertProps) {
  const v = cfg[variant]
  return (
    <div className={clsx(
      'flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm',
      v.wrap, className,
    )}>
      <span className={clsx('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', v.dot)} />
      <div className="flex-1 min-w-0">
        {title    && <p className="font-semibold mb-0.5 text-sm">{title}</p>}
        {children && <p className="text-xs opacity-75 leading-relaxed">{children}</p>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss}
          className="opacity-50 hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}
