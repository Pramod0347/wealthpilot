import Logo from '../Logo'

type BootstrapState =
  | 'checking_server'
  | 'server_warming'
  | 'server_ready'
  | 'checking_auth'
  | 'server_error'

type ServerWakeScreenProps = {
  state: BootstrapState
  elapsedSeconds?: number
  onRetry?: () => void
}

const screenCopy: Record<BootstrapState, { title: string; subtitle: string }> = {
  checking_server: {
    title: 'Checking secure server',
    subtitle: 'Preparing WealthPilot…',
  },
  server_warming: {
    title: 'Starting WealthPilot',
    subtitle: 'Secure server is waking up. This can take 30–60 seconds on the free plan.',
  },
  server_ready: {
    title: 'Server is running',
    subtitle: 'Checking your session…',
  },
  checking_auth: {
    title: 'Checking your session',
    subtitle: 'Please wait…',
  },
  server_error: {
    title: 'Server unavailable',
    subtitle: 'We couldn’t reach the secure server.',
  },
}

export default function ServerWakeScreen({
  state,
  elapsedSeconds = 0,
  onRetry,
}: ServerWakeScreenProps) {
  const copy = screenCopy[state]
  const showSpinner = state !== 'server_error'

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-4">
          <Logo />
          <div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">WealthPilot</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Personal Finance</div>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center gap-4">
            {showSpinner ? (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                <div className="text-xl font-semibold">!</div>
              </div>
            )}

            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {state === 'server_warming'
                  ? `Waking server • ${elapsedSeconds}s`
                  : state === 'server_error'
                    ? 'Retry required'
                    : 'Secure startup in progress'}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {state === 'server_warming'
                  ? 'Please keep this tab open.'
                  : state === 'server_error'
                    ? 'Use retry once the backend is available again.'
                    : 'We are verifying the backend before showing the app.'}
              </div>
            </div>
          </div>
        </div>

        {state === 'server_error' ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700 active:scale-[0.99]"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  )
}
