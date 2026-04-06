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
    <div className="fixed inset-0 felt-table flex flex-col items-center justify-center px-4 py-8 overflow-hidden">
      <div className="m-auto">
        <MainMenu />
      </div>
      <AudioControls />
    </div>
  )
}
