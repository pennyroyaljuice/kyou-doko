import Explorer from '@/components/Explorer';
export const dynamic = 'force-dynamic';
export default function Page() {
  return <Explorer liveAvailable={Boolean(process.env.GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)} />;
}
