import { useEffect, useState } from 'react'
import { EMPTY_STATE as EMPTY, type PlayerSource, type PlayerState } from '../sources/types'

/** Re-render whenever the source reports a change. */
export function usePlayer(source: PlayerSource | null): PlayerState {
  const [state, setState] = useState<PlayerState>(source?.getState() ?? EMPTY)

  useEffect(() => {
    if (!source) {
      setState(EMPTY)
      return
    }
    setState(source.getState())
    return source.subscribe(() => setState(source.getState()))
  }, [source])

  return state
}

/** Position in ms, refreshed on an interval so progress UI stays live without a per-frame render. */
export function usePosition(source: PlayerSource | null, intervalMs = 200): number {
  const [pos, setPos] = useState(0)
  useEffect(() => {
    if (!source) return
    const tick = () => setPos(source.positionMs())
    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [source, intervalMs])
  return pos
}
