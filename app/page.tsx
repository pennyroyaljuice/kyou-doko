import Explorer from '@/components/Explorer';
import { googleConfig } from '@/lib/runtime-config';
export const dynamic = 'force-dynamic';
export default function Page() {
  const { serverKey, browserKey } = googleConfig();
  return <Explorer liveAvailable={Boolean(serverKey && browserKey)} mapsApiKey={browserKey} />;
}
