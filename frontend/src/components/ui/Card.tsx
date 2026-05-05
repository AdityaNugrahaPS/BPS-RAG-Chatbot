import { ReactNode } from 'react'
import clsx from 'clsx'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

const paddings = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }

export default function Card({ children, className, padding = 'md', hover = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{ border: '1px solid var(--bdr-2)' }}
      className={clsx(
        'bg-elevated rounded-2xl',
        hover && 'cursor-pointer transition-all duration-200 hover:opacity-90',
        paddings[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
