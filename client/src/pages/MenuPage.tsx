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
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <MainMenu />
      <AudioControls />
    </div>
  )
}
