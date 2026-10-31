import { NextResponse } from 'next/server';
import { requestAccess, liveEnabled } from '@/lib/access';
import { googleConfig } from '@/lib/runtime-config';
export async function GET(request: Request) {
  const access = requestAccess(request.headers);
  const { serverKey, browserKey } = googleConfig();
  return NextResponse.json({ ...access, ownerUserId: access.isOwner ? request.headers.get('oai-authenticated-user-id') : undefined, liveAvailable: Boolean(access.canSearch && liveEnabled() && serverKey && browserKey) }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
