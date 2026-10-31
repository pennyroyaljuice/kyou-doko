import { AppError, distance, radius, rank, totals, type SearchInput, type SearchResult, type Destination } from './domain';
import type { DiscoveryProvider } from './providers';
export async function search(input:SearchInput, provider:DiscoveryProvider):Promise<SearchResult> {
  if (input.mode === 'TRANSIT') throw new AppError('電車検索は現在提供していません。日本の公共交通はGoogle Routes APIの対象外です。',422);
  const origin = await provider.resolve(input.origin);
  const places = (provider.discover ? await provider.discover(origin.point,input) : await provider.nearby(origin.point,radius(input),input.theme)).slice(0,8);
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
  const notices = [`出発地から約${Math.round(radius(input)/1000)}km圏内の4方向で候補を探索し、最大8スポットの経路を確認します。探索位置は目安で、実際の経路時間・距離が上限以内の候補を近い順に表示します。すべての到達可能地点を網羅するものではありません。`];
  if (input.theme === 'nature') notices.push('自然・景色に関するGoogleの施設分類で探索します。峠の専用分類はなく、すべての峠や山道を探せるものではありません。');
  if (input.mode === 'DRIVE' && input.avoidHighways) notices.push('高速道路をなるべく避ける条件で往路・復路を計算しています。Googleの回避指定は完全な除外を保証しません。有料道路の回避とは別の条件です。');
  if (unavailable) notices.push(`${unavailable}件は指定手段の経路が見つからないため除外しました。地域・手段が未対応の場合があります。`);
  const ranked=rank(items,input);
  if(ranked.length && (input.metric==='time'?ranked[0].seconds/60:ranked[0].meters/1000)<input.budget*0.75) notices.push('今回の候補は指定上限より短い移動に偏っています。道路網や候補分類・探索範囲の制限により、上限に近い候補を取得できない場合があります。');
  return {source:'google',origin:origin.point,originLabel:origin.label,input,destinations:ranked,notices};
}
