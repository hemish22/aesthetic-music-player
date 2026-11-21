/** Animated glow blobs tinted by the --c1/--c2/--c3 palette variables, plus film grain. */
export function Background() {
  return (
    <div className="bg" aria-hidden>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="vignette" />
      <div className="grain" />
    </div>
  )
}
