import { AppError, distance, radius, rank, totals, type SearchInput, type SearchResult, type Destination } from './domain';
import type { DiscoveryProvider } from './providers';
export async function search(input:SearchInput, provider:DiscoveryProvider):Promise<SearchResult> {
  if (input.mode === 'TRANSIT') throw new AppError('電車検索は現在提供していません。日本の公共交通はGoogle Routes APIの対象外です。',422);
  const origin = await provider.resolve(input.origin);
  const places = await provider.nearby(origin.point,radius(input),input.theme);
  let unavailable = 0;
  const items:Destination[] = [];
  const start = new Date();
  // Batch by two: keep upstream concurrency and request count bounded.
  for (let i=0;i<places.length;i+=2) {
    const batch = await Promise.all(places.slice(i,i+2).map(async p=>{
      if (input.metric === 'distance' && distance(origin.point,p.point)*(input.roundTrip?2:1)>input.budget*1000) return null;
      const outbound = await provider.route(origin.point,p.point,input.mode,start,{avoidHighways:input.mode === 'DRIVE' && input.avoidHighways === true});
      if (!outbound) { unavailable++; return null; }
      const inbound = input.roundTrip ? await provider.route(p.point,origin.point,input.mode,new Date(start.getTime()+outbound.seconds*1000),{avoidHighways:input.mode === 'DRIVE' && input.avoidHighways === true}) : undefined;
      if (input.roundTrip && !inbound) { unavailable++; return null; }
      return totals(p,outbound,inbound??undefined);
    }));
    items.push(...batch.filter((p):p is Destination=>p!==null));
  }
  const notices = ['最大50km圏内・最大8スポットの探索です。すべての到達可能地点を網羅するものではありません。'];
  if (input.theme === 'nature') notices.push('自然・景色に関するGoogleの施設分類で探索します。峠の専用分類はなく、すべての峠や山道を探せるものではありません。');
  if (input.mode === 'DRIVE' && input.avoidHighways) notices.push('高速道路をなるべく避ける条件で往路・復路を計算しています。Googleの回避指定は完全な除外を保証しません。有料道路の回避とは別の条件です。');
  if (unavailable) notices.push(`${unavailable}件は指定手段の経路が見つからないため除外しました。地域・手段が未対応の場合があります。`);
  return {source:'google',origin:origin.point,originLabel:origin.label,input,destinations:rank(items,input),notices};
}
