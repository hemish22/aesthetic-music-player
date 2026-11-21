import type { PlayerSource } from '../sources/types'
import { Icon } from './icons'

interface Props {
  source: PlayerSource
  isPlaying: boolean
}

/** Very small always-on prev / play / next pill. Can be switched off in the controls panel. */
export function MiniTransport({ source, isPlaying }: Props) {
  return (
    <div className="mini-transport">
      <button onClick={() => source.prev()} aria-label="Previous">
        <Icon name="prev" size={10} />
      </button>
      <button onClick={() => source.toggle()} aria-label={isPlaying ? 'Pause' : 'Play'}>
        <Icon name={isPlaying ? 'pause' : 'play'} size={11} />
      </button>
      <button onClick={() => source.next()} aria-label="Next">
        <Icon name="next" size={10} />
      </button>
    </div>
  )
}
