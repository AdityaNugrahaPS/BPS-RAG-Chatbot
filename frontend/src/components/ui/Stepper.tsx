import clsx from 'clsx'
import type { Step } from '../../types'

interface StepperProps {
  steps: Step[]
  currentStep: number
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const done   = i < currentStep
        const active = i === currentStep
        const last   = i === steps.length - 1

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                'text-2xs font-bold transition-all duration-250',
                done   && 'bg-success text-bg',
                active && 'bg-accent text-white ring-4 ring-accent/15',
              )}
              style={!done && !active ? { background: 'var(--fill-4)', color: 'var(--txt-4)', border: '1px solid var(--bdr-4)' } : {}}>
                {done ? <CheckIcon /> : <span>{i + 1}</span>}
              </div>
              <span className={clsx(
                'text-xs font-medium hidden sm:block truncate transition-colors duration-200',
                active ? 'text-t1' : done ? 'text-success' : 'text-t4',
              )}>
                {step.title}
              </span>
            </div>

            {!last && (
              <div className="flex-1 mx-3">
                <div className={clsx(
                  'h-px w-full rounded-full transition-all duration-400',
                  done ? 'bg-success/30' : '',
                )}
                style={!done ? { background: 'var(--bdr-3)' } : {}} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
