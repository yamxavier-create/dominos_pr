import { useState } from 'react'
import { MainMenu } from '../components/lobby/MainMenu'
import { AudioControls } from '../components/game/AudioControls'
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow'

export function MenuPage() {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('onboarding_done')
  )

  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <div className="fixed inset-0 felt-table grid place-items-center px-4 overflow-hidden">
      <MainMenu />
      <AudioControls />
    </div>
  )
}
