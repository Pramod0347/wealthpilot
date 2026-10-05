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
        'fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-md transition-opacity duration-200 ease-out sm:items-center sm:p-4 motion-reduce:transition-none',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        overlayClassName,
      ].join(' ')}
      onClick={onClose}
      aria-hidden={!open}
    >
      <section
        className={[
          'flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-slate-200 bg-white shadow-2xl transition-all duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 sm:max-h-[85vh] sm:rounded-3xl sm:border sm:border-slate-800/90 sm:shadow-2xl motion-reduce:transition-none',
          open
            ? 'translate-y-0 sm:scale-100 sm:opacity-100'
            : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0',
          className,
        ].join(' ')}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 pb-4 pt-3 dark:border-slate-800 sm:pt-4">
          <div className="flex-1">
            {/* Mobile drag handle only */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            {title ? (
              <div className="text-lg font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                {title}
              </div>
            ) : null}
            {subtitle ? (
              <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {subtitle}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer ? (
          <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  )
}

