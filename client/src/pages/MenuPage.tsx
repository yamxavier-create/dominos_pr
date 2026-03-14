import { MainMenu } from '../components/lobby/MainMenu'
import { AudioControls } from '../components/game/AudioControls'

export function MenuPage() {
  return (
    <div className="min-h-screen felt-table flex items-center justify-center p-4">
      <MainMenu />
      <AudioControls />
    </div>
  )
}
