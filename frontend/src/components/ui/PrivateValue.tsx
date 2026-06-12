import type { ReactNode } from 'react'
import { usePrivacyMode } from '../../context/PrivacyContext'
import { formatPrivateValue, getSensitiveTextClass } from '../../utils/privacy'

export default function PrivateValue({
  value,
  mask = '••••',
  className = '',
  revealClassName = '',
  hideColor = false,
}: {
  value: ReactNode
  mask?: string
  className?: string
  revealClassName?: string
  hideColor?: boolean
}) {
  const { privacyMode } = usePrivacyMode()
  const renderedValue = typeof value === 'string' ? formatPrivateValue(value, privacyMode, mask) : value
  const toneClass = privacyMode && hideColor ? getSensitiveTextClass('', privacyMode) : revealClassName

  return <span className={[className, toneClass].filter(Boolean).join(' ')}>{renderedValue}</span>
}
