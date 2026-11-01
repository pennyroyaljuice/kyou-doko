import {highlyRated} from './themes';
import {estimateBicycleLeg,bicycleSpeedKmh} from './bicycle-estimate';
import { AppError, distance, radius, rank, sortDestinations, totals, type SearchInput, type SearchResult, type Destination } from './domain';
import type { DiscoveryProvider } from './providers';
export async function search(input:SearchInput, provider:DiscoveryProvider, excluded:ReadonlySet<string>=new Set()):Promise<SearchResult> {
  if (input.mode === 'TRANSIT') throw new AppError('電車検索は現在提供していません。日本の公共交通はGoogle Routes APIの対象外です。',422);
  excluded=new Set([...excluded,...(input.seenPlaceIds??[])]);
  const origin = await provider.resolve(input.origin);
  const discovered = (provider.discover ? await provider.discover(origin.point,input) : await provider.nearby(origin.point,radius(input),input.theme));
  const excludedCount=discovered.filter(p=>excluded.has(p.id)).length;
  let places=discovered.filter(p=>!excluded.has(p.id)&&(input.theme!=='highrated'||highlyRated(p))&&(input.theme!=='reviews'||(p.userRatingCount??0)>0)).slice(0,80);
  const ratingPriority=(a:typeof places[number],b:typeof places[number])=>input.theme==='reviews'?(b.userRatingCount??0)-(a.userRatingCount??0)||(b.rating??0)-(a.rating??0):input.theme==='highrated'?(b.rating??0)-(a.rating??0)||(b.userRatingCount??0)-(a.userRatingCount??0):0;
  if(input.theme==='highrated'||input.theme==='reviews')places.sort(ratingPriority);
  let unavailable = 0;
  const items:Destination[] = [];
  const start = new Date();
  const routeMode=input.mode==='BICYCLE'?'WALK':input.mode;
  const getLeg=async(from:typeof origin.point,to:typeof origin.point,departure:Date)=>{const leg=await provider.route(from,to,routeMode,departure,{avoidHighways:input.mode==='DRIVE'&&input.avoidHighways===true});return leg&&input.mode==='BICYCLE'?estimateBicycleLeg(leg):leg;};
  // Reserve a bounded route budget; retain discovery reserves for rejected candidates.
  let routeCalls=0;const routeLimit=24;
  let fallbackUsed=false,failed=0;
  const estimates:number[]=[];
  async function refill(){
    if(fallbackUsed||!provider.fallback)return;fallbackUsed=true;
    let extra:Awaited<ReturnType<NonNullable<typeof provider.fallback>>>;
    try{extra=await provider.fallback(origin.point,input);}catch{return;}
    const seen=new Set(places.map(p=>p.id));
    for(const p of extra)if(!seen.has(p.id)&&!excluded.has(p.id)&&(input.theme!=='highrated'||highlyRated(p))&&distance(origin.point,p.point)<=radius(input)){seen.add(p.id);places.push(p);}
  }
  for (let i=0;items.length<8&&routeCalls<routeLimit;i+=2) {
    if(items.length<8&&((i>=2&&failed>=2)||i>=places.length)){
      await refill();
      if(failed>=2){
        const measured=[...estimates].sort((a,b)=>a-b);
        const factor=measured.length?measured[Math.floor(measured.length/2)]:1;
        const target=input.budget*0.85;
        places=[...places.slice(0,i),...places.slice(i).sort((a,b)=>ratingPriority(a,b)||Math.abs(distance(origin.point,a.point)*factor-target)-Math.abs(distance(origin.point,b.point)*factor-target))];
      }
    }
    if(input.theme==='highrated')places=[...places.slice(0,i),...places.slice(i).sort(ratingPriority)];
    if(i>=places.length)break;
    const batch = await Promise.all(places.slice(i,i+2).map(async p=>{
      if (input.metric === 'distance' && distance(origin.point,p.point)*(input.roundTrip?2:1)>input.budget*1000) return null;
      if(routeCalls>=routeLimit)return null;routeCalls++;
      const outbound = await getLeg(origin.point,p.point,start);
      if (!outbound) { failed++;unavailable++; return null; }
      const outboundValue=input.metric==='time'?outbound.seconds/60:outbound.meters/1000;
      const direct=distance(origin.point,p.point);
      if(outboundValue>input.budget){if(direct>100)estimates.push(outboundValue*(input.roundTrip?2:1)/direct);failed++;return null;}
      if(input.roundTrip&&routeCalls>=routeLimit)return null;
      if(input.roundTrip)routeCalls++;
      const inbound = input.roundTrip ? await getLeg(p.point,origin.point,new Date(start.getTime()+outbound.seconds*1000)) : undefined;
      if (input.roundTrip && !inbound) { failed++;unavailable++; return null; }
      const result=totals(p,outbound,inbound??undefined);
      const actualValue=input.metric==='time'?result.seconds/60:result.meters/1000;
      if(direct>100)estimates.push(actualValue/direct);
      if(!rank([result],input).length){failed++;return null;}return result;
    }));
    items.push(...batch.filter((p):p is Destination=>p!==null));
  }
  const notices = [`出発地から約${Math.round(radius(input)/1000)}km圏内の最大5か所で${input.mode==='DRIVE'?'候補':'近場も含めた候補'}を探索し、最大24回の経路計算で8件を目標に候補を確認します。探索位置は目安で、${input.mode==='BICYCLE'?'徒歩経路の距離と自転車の推定時間':'実際の経路時間・距離'}が上限以内の候補を近い順に表示します。すべての到達可能地点を網羅するものではありません。`];
  if(excludedCount)notices.push(`${excludedCount}件をアカウントの除外設定により省きました。追加の自動検索は行いません。`);
  if (input.theme === 'nature') notices.push('自然・景色に関するGoogleの施設分類で探索します。峠の専用分類はなく、すべての峠や山道を探せるものではありません。');
  if (input.mode === 'DRIVE' && input.avoidHighways) notices.push('高速道路をなるべく避ける条件で往路・復路を計算しています。Googleの回避指定は完全な除外を保証しません。有料道路の回避とは別の条件です。');
  if (unavailable) notices.push(`${unavailable}件は指定手段の経路が見つからないため除外しました。地域・手段が未対応の場合があります。`);
  const ranked=(input.theme==='reviews'?sortDestinations(items,input,'reviews'):input.theme==='highrated'?sortDestinations(items,input,'rating'):rank(items,input)).slice(0,8);
  if(input.mode==='BICYCLE')notices.push(`自転車は推定値です。徒歩経路の距離を平均時速${bicycleSpeedKmh}kmで換算しています。階段・歩行者専用道など、自転車で通行できない道を含む可能性があります。実際の自転車経路・距離・時間は外部Google Mapsで確認してください。`);
  if(!ranked.length&&items.length)notices.push('取得できた経路はすべて指定した時間・距離の上限を超えました。往復は帰りの分も含みます。');
  if(ranked.length && (input.metric==='time'?ranked[0].seconds/60:ranked[0].meters/1000)<input.budget*0.75) notices.push('今回の候補は指定上限より短い移動に偏っています。道路網や候補分類・探索範囲の制限により、上限に近い候補を取得できない場合があります。');
  return {source:'google',origin:origin.point,originLabel:origin.label,input,destinations:ranked,notices};
}
