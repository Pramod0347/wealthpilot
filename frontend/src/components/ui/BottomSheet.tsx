import { useEffect, type ReactNode } from 'react'
import { Icon } from '../Icon'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  overlayClassName?: string
}

export default function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = '',
  overlayClassName = '',
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        overlayClassName,
      ].join(' ')}
      onClick={onClose}
      aria-hidden={!open}
    >
      <section
        className={[
          'flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none dark:border-slate-700/60 dark:bg-slate-900',
          open ? 'translate-y-0' : 'translate-y-full',
          className,
        ].join(' ')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-slate-200 px-5 pb-4 pt-3 dark:border-slate-700/50">
          <div className="flex-1">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
            {title ? <div className="text-base font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</div> : null}
            {subtitle ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
            aria-label="Close"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700/50">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  )
}
