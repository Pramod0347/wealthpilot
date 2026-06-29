import wealthPilotLogo from '../assets/logo.png'
import wealthPilotMobileLogo from '../assets/logo_mobile.png'

export default function Logo({
  collapsed = false,
  mobile = false,
}: {
  collapsed?: boolean
  mobile?: boolean
}) {
  if (mobile) {
    return (
      <img
        src={wealthPilotMobileLogo}
        alt="WealthPilot"
        className="h-11 w-11 shrink-0 rounded-2xl object-cover"
      />
    )
  }

  if (collapsed) {
    return (
      <img
        src={wealthPilotMobileLogo}
        alt="WealthPilot"
        className="h-12 w-12 shrink-0 rounded-2xl object-cover"
      />
    )
  }

  return (
    <img
      src={wealthPilotLogo}
      alt="WealthPilot"
      className="h-auto w-[198px] max-w-full shrink-0"
    />
  )
}
