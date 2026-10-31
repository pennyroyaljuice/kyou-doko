// Read the browser key on the server at request time, so hosted runtime settings
// work without embedding a credential into the source or the build output.
export function googleConfig() {
  const publicKeyName = ['NEXT', 'PUBLIC', 'GOOGLE', 'MAPS', 'API', 'KEY'].join('_');
  return { serverKey: process.env.GOOGLE_MAPS_API_KEY ?? '', browserKey: process.env[publicKeyName] ?? '' };
}
