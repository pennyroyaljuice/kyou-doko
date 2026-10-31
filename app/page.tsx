import Explorer from '@/components/Explorer';
import { googleConfig } from '@/lib/runtime-config';
import { headers } from 'next/headers';
import { requestAccess, liveEnabled } from '@/lib/access';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = requestAccess(await headers());
  const { serverKey, browserKey } = googleConfig();
  return <Explorer liveAvailable={Boolean(access.canSearch && liveEnabled() && serverKey && browserKey)} liveAccess={access.canSearch} signedIn={access.signedIn} isOwner={access.isOwner} publicEnabled={process.env.PUBLIC_SEARCH_ENABLED==='true'} />;
}
