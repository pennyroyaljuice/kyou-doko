import {estimateBicycleLeg,bicycleSpeedKmh} from './bicycle-estimate';
import { AppError, distance, radius, rank, sortDestinations, totals, type SearchInput, type SearchResult, type Destination } from './domain';
import type { DiscoveryProvider } from './providers';
export async function search(input:SearchInput, provider:DiscoveryProvider, excluded:ReadonlySet<string>=new Set()):Promise<SearchResult> {
  if (input.mode === 'TRANSIT') throw new AppError('電車検索は現在提供していません。日本の公共交通はGoogle Routes APIの対象外です。',422);
  const origin = await provider.resolve(input.origin);
  const discovered = (provider.discover ? await provider.discover(origin.point,input) : await provider.nearby(origin.point,radius(input),input.theme));
  const excludedCount=discovered.filter(p=>excluded.has(p.id)).length;
  const places=discovered.filter(p=>!excluded.has(p.id)).slice(0,80);
  let unavailable = 0;
  const items:Destination[] = [];
  const start = new Date();
  const routeMode=input.mode==='BICYCLE'?'WALK':input.mode;
  const getLeg=async(from:typeof origin.point,to:typeof origin.point,departure:Date)=>{const leg=await provider.route(from,to,routeMode,departure,{avoidHighways:input.mode==='DRIVE'&&input.avoidHighways===true});return leg&&input.mode==='BICYCLE'?estimateBicycleLeg(leg):leg;};
  // Reserve a bounded route budget; retain discovery reserves for rejected candidates.
  let routeCalls=0;const routeLimit=20;
  for (let i=0;i<places.length&&items.length<8&&routeCalls<routeLimit;i+=2) {
    const batch = await Promise.all(places.slice(i,i+2).map(async p=>{
      if (input.metric === 'distance' && distance(origin.point,p.point)*(input.roundTrip?2:1)>input.budget*1000) return null;
      if(routeCalls>=routeLimit)return null;routeCalls++;
      const outbound = await getLeg(origin.point,p.point,start);
      if (!outbound) { unavailable++; return null; }
      const outboundValue=input.metric==='time'?outbound.seconds/60:outbound.meters/1000;
      if(outboundValue>input.budget)return null;
      if(input.roundTrip&&routeCalls>=routeLimit)return null;
      if(input.roundTrip)routeCalls++;
      const inbound = input.roundTrip ? await getLeg(p.point,origin.point,new Date(start.getTime()+outbound.seconds*1000)) : undefined;
      if (input.roundTrip && !inbound) { unavailable++; return null; }
      const result=totals(p,outbound,inbound??undefined);
      return rank([result],input).length?result:null;
    }));
    items.push(...batch.filter((p):p is Destination=>p!==null));
  }
  const notices = [`出発地から約${Math.round(radius(input)/1000)}km圏内の4か所で${input.mode==='DRIVE'?'候補':'近場も含めた候補'}を探索し、最大20回の経路計算で8件を目標に候補を確認します。探索位置は目安で、${input.mode==='BICYCLE'?'徒歩経路の距離と自転車の推定時間':'実際の経路時間・距離'}が上限以内の候補を近い順に表示します。すべての到達可能地点を網羅するものではありません。`];
  if(excludedCount)notices.push(`${excludedCount}件をアカウントの除外設定により省きました。追加の自動検索は行いません。`);
  if (input.theme === 'nature') notices.push('自然・景色に関するGoogleの施設分類で探索します。峠の専用分類はなく、すべての峠や山道を探せるものではありません。');
  if (input.mode === 'DRIVE' && input.avoidHighways) notices.push('高速道路をなるべく避ける条件で往路・復路を計算しています。Googleの回避指定は完全な除外を保証しません。有料道路の回避とは別の条件です。');
  if (unavailable) notices.push(`${unavailable}件は指定手段の経路が見つからないため除外しました。地域・手段が未対応の場合があります。`);
  const ranked=sortDestinations(items,input).slice(0,8);
  if(input.mode==='BICYCLE')notices.push(`自転車は推定値です。徒歩経路の距離を平均時速${bicycleSpeedKmh}kmで換算しています。階段・歩行者専用道など、自転車で通行できない道を含む可能性があります。実際の自転車経路・距離・時間は外部Google Mapsで確認してください。`);
  if(!ranked.length&&items.length)notices.push('取得できた経路はすべて指定した時間・距離の上限を超えました。往復は帰りの分も含みます。');
  if(ranked.length && (input.metric==='time'?ranked[0].seconds/60:ranked[0].meters/1000)<input.budget*0.75) notices.push('今回の候補は指定上限より短い移動に偏っています。道路網や候補分類・探索範囲の制限により、上限に近い候補を取得できない場合があります。');
  return {source:'google',origin:origin.point,originLabel:origin.label,input,destinations:ranked,notices};
}
