// The package's default entry bundles Node/React Native readers that break the browser build,
// so we import the prebuilt browser bundle and borrow the types from @types/jsmediatags.
declare module 'jsmediatags/dist/jsmediatags.min.js' {
  import type { read } from 'jsmediatags'
  const jsmediatags: { read: typeof read }
  export default jsmediatags
}
