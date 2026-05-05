import { ButtonHTMLAttributes, ReactNode, ElementType } from 'react'
import clsx from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ElementType | ReactNode
  fullWidth?: boolean
}

const variants = {
  primary:   'bg-accent hover:bg-accent-hover text-white shadow-sm shadow-accent/20 active:scale-[0.97]',
  secondary: 'bg-elevated hover:opacity-90 text-t1 active:scale-[0.97]',
  ghost:     'text-t2 hover:text-t1 active:scale-[0.97]',
  danger:    'bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 active:scale-[0.97]',
  success:   'bg-success/10 hover:bg-success/20 text-success border border-success/20 active:scale-[0.97]',
}

const variantStyle: Record<string, React.CSSProperties> = {
  secondary: { border: '1px solid var(--bdr-4)' },
  ghost:     {},
}

const sizes = {
  sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2   rounded-lg gap-2',
  lg: 'text-md px-5 py-2.5 rounded-xl gap-2',
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Button({
  children, variant = 'secondary', size = 'md', className,
  disabled, loading, icon: Icon, onClick, type = 'button', fullWidth, ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={variantStyle[variant] || {}}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-all duration-150 select-none outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-40 cursor-not-allowed pointer-events-none',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : Icon ? (
        typeof Icon === 'function'
          ? <Icon size={14} strokeWidth={2} className="flex-shrink-0" />
          : <span className="flex-shrink-0 flex items-center">{Icon as ReactNode}</span>
      ) : null}
      {children}
    </button>
  )
}
