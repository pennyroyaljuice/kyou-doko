import Explorer from '@/components/Explorer';
import { googleConfig } from '@/lib/runtime-config';
import { headers } from 'next/headers';
import { requestAccess, liveEnabled } from '@/lib/access';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const access = requestAccess(await headers());
  const { serverKey, browserKey } = googleConfig();
  return <Explorer liveAvailable={Boolean(access.isOwner && liveEnabled() && serverKey && browserKey)} mapsApiKey={access.isOwner && liveEnabled() ? browserKey : ''} liveAccess={access.isOwner} signedIn={access.signedIn} />;
}
