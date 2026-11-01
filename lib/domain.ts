import type { DestinationTheme } from './themes';
export type Point = { lat: number; lng: number };
export type Mode = 'DRIVE' | 'TRANSIT' | 'BICYCLE' | 'WALK';
export type SearchInput = { source: 'demo' | 'google'; origin: string | Point; mode: Mode; metric: 'time' | 'distance'; budget: number; roundTrip: boolean; avoidHighways?: boolean; theme?: DestinationTheme; sort?: 'budget'|'rating' };
export type Place = { rating?:number; userRatingCount?:number; id: string; name: string; description: string; category: string; point: Point; photo?: { ticket: string; authors: { name: string; uri?: string }[] }; attributions?: { name: string; uri: string }[] };
export type Leg = { seconds: number; meters: number; polyline?: string };
export type Destination = Place & { outbound: Leg; inbound?: Leg; seconds: number; meters: number };
export type SearchResult = { ratingsAvailable?:boolean; source: 'demo' | 'google'; origin: Point; originLabel: string; input: SearchInput; destinations: Destination[]; notices: string[] };
export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function isPoint(v: unknown): v is Point {
  if (!v || typeof v !== 'object') return false;
  const p = v as Point;
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}
export function parseInput(v: unknown): SearchInput {
  if (!v || typeof v !== 'object') throw new AppError('検索条件を確認してください。');
  const x = v as SearchInput;
  if (!['demo','google'].includes(x.source) || !['DRIVE','TRANSIT','BICYCLE','WALK'].includes(x.mode) || !['time','distance'].includes(x.metric) || typeof x.roundTrip !== 'boolean') throw new AppError('検索条件が正しくありません。');
  if (x.mode === 'TRANSIT') throw new AppError('電車検索は現在提供していません。日本の公共交通はGoogle Routes APIの対象外です。',422);
  if (!(typeof x.origin === 'string' ? x.origin.trim().length > 0 && x.origin.length <= 200 : isPoint(x.origin))) throw new AppError('出発地点を入力してください（200文字以内）。');
  const min = x.metric === 'time' ? 5 : 1, max = x.metric === 'time' ? 480 : 300;
  if (typeof x.budget !== 'number' || !Number.isFinite(x.budget) || x.budget < min || x.budget > max) throw new AppError(`上限は${min}〜${max}${x.metric === 'time' ? '分' : 'km'}で指定してください。`);
  if (x.avoidHighways !== undefined && typeof x.avoidHighways !== 'boolean') throw new AppError('高速道路の設定が正しくありません。');
  if (x.theme !== undefined && !['all','tourism','nature','highrated'].includes(x.theme)) throw new AppError('目的地の種類が正しくありません。');
  if(x.sort!==undefined&&!['budget','rating'].includes(x.sort))throw new AppError('並び順が正しくありません。');
  return { sort:x.sort??'budget', theme:x.theme ?? 'all', avoidHighways:x.mode === 'DRIVE' && x.avoidHighways === true, source:x.source, origin:typeof x.origin === 'string' ? x.origin.trim() : {lat:x.origin.lat,lng:x.origin.lng}, mode:x.mode, metric:x.metric, budget:x.budget, roundTrip:x.roundTrip };
}
export function distance(a: Point, b: Point) {
  const r = Math.PI / 180, dlat = (b.lat-a.lat)*r, dlng = (b.lng-a.lng)*r;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2), Math.sqrt(1-(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2)));
}
export function rank(items: Destination[], input: SearchInput) {
  const value = (d: Destination) => input.metric === 'time' ? d.seconds / 60 : d.meters / 1000;
  return items.filter(d => value(d) <= input.budget).sort((a,b) => value(b)-value(a));
}
export function radius(input: SearchInput) {
  const speed = {DRIVE:50,TRANSIT:60,BICYCLE:15,WALK:4}[input.mode];
  const km = input.metric === 'distance' ? input.budget : input.budget / 60 * speed;
  return Math.max(100, Math.min(300000, km * 1000 / (input.roundTrip ? 2 : 1)));
}
export function totals(place: Place, outbound: Leg, inbound?: Leg): Destination {
  return {...place, outbound, inbound, seconds:outbound.seconds+(inbound?.seconds??0), meters:outbound.meters+(inbound?.meters??0)};
}

export function sortDestinations(items:Destination[],input:SearchInput,sort:'budget'|'rating'=input.sort??'budget'){
 // Eligibility is decided once by the search. Display sorting must preserve every result.
 const value=(d:Destination)=>input.metric==='time'?d.seconds:d.meters;
 return [...items].sort((a,b)=>sort==='rating'?(b.rating??-1)-(a.rating??-1)||(b.userRatingCount??0)-(a.userRatingCount??0)||value(b)-value(a):value(b)-value(a));
}
