import { useState } from 'react'
import { MainMenu } from '../components/lobby/MainMenu'
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow'

export function MenuPage() {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('onboarding_done')
  )

  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <div className="fixed inset-0 felt-table flex items-start justify-center px-4 pt-3 pb-4 overflow-y-auto">
      <MainMenu />
    </div>
  )
}
