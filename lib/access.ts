export type Access = { signedIn: boolean; isOwner: boolean };

// These headers must be supplied/overwritten by the Cloudflare Worker after Access JWT verification.
// Never deploy this app behind a proxy that forwards client-supplied identity.
export function requestAccess(headers: Pick<Headers, 'get'>): Access {
  const userId = headers.get('oai-authenticated-user-id')?.trim();
  const email = headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  const ownerId = process.env.LIVE_SEARCH_OWNER_USER_ID?.trim();
  const ownerEmail = process.env.LIVE_SEARCH_OWNER_EMAIL?.trim().toLowerCase();
  const signedIn = Boolean(userId && email);
  // Prefer a site-scoped ID when configured. The initial owner allowlist comes
  // from the Cloudflare Access owner's verified email, never from request body/query fields.
  const isOwner = signedIn && Boolean(ownerId ? userId === ownerId : ownerEmail && email === ownerEmail);
  return { signedIn, isOwner };
}

export function liveEnabled() { return process.env.LIVE_SEARCH_ENABLED === 'true'; }
