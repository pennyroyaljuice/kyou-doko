import {directionSector,geographicOrder,explorationAreas,explorationFraction,pointAlongBearing} from './exploration';
import {estimateBicycleLeg,bicycleSpeedKmh} from './bicycle-estimate';
import { AppError, distance, radius, rank, totals, type SearchInput, type SearchResult, type Destination } from './domain';
import type { DiscoveryProvider } from './providers';
import {placeKind} from './themes';
import {DirectionalRouteBudget} from './route-budget';
import {newSearchAudit,type SearchAudit} from './search-audit';
export async function search(input:SearchInput, provider:DiscoveryProvider, excluded:ReadonlySet<string>=new Set(),onAudit?:(audit:SearchAudit)=>void):Promise<SearchResult> {
  if (input.mode === 'TRANSIT') throw new AppError('電車検索は現在提供していません。日本の公共交通はGoogle Routes APIの対象外です。',422);
  excluded=new Set([...excluded,...(input.seenPlaceIds??[])]);
  const origin = await provider.resolve(input.origin);
  if(input.originLabel)origin.label=input.originLabel;
  const start = new Date();
  const routeMode=input.mode==='BICYCLE'?'WALK':input.mode;
  const getLeg=async(from:typeof origin.point,to:typeof origin.point,departure:Date)=>{const leg=await provider.route(from,to,routeMode,departure,{avoidHighways:input.mode==='DRIVE'&&input.avoidHighways===true});return leg&&input.mode==='BICYCLE'?estimateBicycleLeg(leg):leg;};
  const budget=new DirectionalRouteBudget(24,input.roundTrip?2:1),audit=newSearchAudit();const routeLimit=24;
  const estimates:number[]=[];
  const observations:{point:typeof origin.point;cost:number;direct:number}[]=[];
  // Measure each direction itself, rather than project a road speed measured
  // across a different bay or mountain range. These probes share the same cap.
  const calibrate=async(center:typeof origin.point)=>{
    const trace=audit.sectors[directionSector(origin.point,center)];trace.queries++;
    if(!budget.probe())return center;
    audit.calibrationCalls++;trace.calibrationCalls++;
    const leg=await getLeg(origin.point,center,start);
    if(!leg){trace.calibrationUnavailable++;return pointAlongBearing(origin.point,center,distance(origin.point,center)*0.55);}
    const value=(input.metric==='time'?leg.seconds/60:leg.meters/1000)*(input.roundTrip?2:1);
    if(value<=0)return center;
    const reach=Math.min(1000000,radius(input)*(input.mode==='DRIVE'&&input.metric==='time'?(input.avoidHighways?1.4:2):1));
    return pointAlongBearing(origin.point,center,Math.max(100,Math.min(reach*.98,distance(origin.point,center)*input.budget*.95/value)));
  };
  const discovered = (provider.discover ? await provider.discover(origin.point,input,provider.radialDiscovery?calibrate:undefined) : await provider.nearby(origin.point,radius(input),input.theme));
  const excludedCount=discovered.filter(p=>excluded.has(p.id)).length;
  const ratingTheme=input.theme==='highrated'||input.theme==='reviews';
  const eligible=(p:typeof discovered[number])=>!ratingTheme||(typeof p.rating==='number'&&Number.isFinite(p.rating)&&p.rating>=1&&p.rating<=5&&typeof p.userRatingCount==='number'&&Number.isFinite(p.userRatingCount)&&p.userRatingCount>0);
  let places=discovered.filter(p=>!excluded.has(p.id)&&eligible(p)).slice(0,100);
  const auditDiscovered=(pool:typeof places)=>{for(const p of pool)audit.sectors[directionSector(origin.point,p.point)].discovered++;};
  auditDiscovered(places);audit.discoveryAreas=provider.radialDiscovery?2:1;
  const ratingPriority=(a:typeof places[number],b:typeof places[number])=>input.theme==='reviews'?(b.userRatingCount??0)-(a.userRatingCount??0)||(b.rating??0)-(a.rating??0):input.theme==='highrated'?(b.rating??0)-(a.rating??0)||(b.userRatingCount??0)-(a.userRatingCount??0):0;

  let unavailable = 0;
  const items:Destination[] = [],belowMinimum:Destination[]=[];
  // Reserve a bounded route budget; retain discovery reserves for rejected candidates.
  let refinements=0,failed=0;
  const refinementLimit=Math.min(3,Math.max(0,provider.refinementLimit??1));
  let refinedIds=new Set<string>();
  let refinedCenter:typeof origin.point|undefined;
  const emptyRefinementSectors=new Set<number>();
  const attempts:number[]=Array(9).fill(0);
  // Initial circles are conservative. A measured fast road must be allowed to
  // move the refinement beyond that estimate; actual routes still enforce the cap.
  const refinementReach=Math.min(1000000,radius(input)*(input.mode==='DRIVE'&&input.metric==='time'?(input.avoidHighways?1.4:2):1));
  async function refill(){
    if(refinements>=refinementLimit||!provider.fallback)return;refinements++;
    let extra:Awaited<ReturnType<NonNullable<typeof provider.fallback>>>;
    const measured=observations.filter(o=>o.direct>100&&o.cost>0).sort((a,b)=>Number(a.cost>input.budget)-Number(b.cost>input.budget)||Math.abs(input.budget-a.cost)-Math.abs(input.budget-b.cost));
    // Complete the origin-centred ring before spending the last query on the
    // best direction. Rating preferences must not alter this spatial plan.
    const crossDirection=provider.radialDiscovery&&refinements<=2?explorationAreas(origin.point,input)[refinements===1?1:3].center:undefined;
    const sectorGap=(point:typeof origin.point)=>{const gap=Math.abs(directionSector(origin.point,point)-directionSector(origin.point,crossDirection!));return Math.min(gap,8-gap);};
    const calibration=crossDirection?[...measured].sort((a,b)=>sectorGap(a.point)-sectorGap(b.point)||Math.abs(input.budget-a.cost)-Math.abs(input.budget-b.cost)):measured;
    const best=calibration.find(o=>!emptyRefinementSectors.has(directionSector(origin.point,o.point)))??calibration[0],reach=radius(input);
    const peer=best?measured.filter(o=>o!==best&&directionSector(origin.point,o.point)===directionSector(origin.point,best.point)&&Math.abs(o.direct-best.direct)>500&&(o.cost-input.budget)*(best.cost-input.budget)<0).sort((a,b)=>Math.abs(a.direct-best.direct)-Math.abs(b.direct-best.direct))[0]:undefined;
    const slope=best&&peer?(best.cost-peer.cost)/(best.direct-peer.direct):0;
    // A nearby island/mountain route can take far longer despite similar air
    // distance. Do not treat that discontinuity as a smooth cost gradient.
    const usableSlope=best&&slope>best.cost/best.direct*0.2&&slope<best.cost/best.direct*3;
    // Use the same target margin in all directions. Giving only the final
    // local refinement a tighter target makes its whole town beat every tile.
    const targetFraction=provider.radialDiscovery?0.95:0.98;
    const desired=best?(usableSlope?best.direct+(input.budget*targetFraction-best.cost)/slope:best.direct*input.budget*targetFraction/best.cost):0;
    const area=crossDirection?{center:await calibrate(crossDirection),radius:Math.max(100,Math.min(50000,reach*0.75))}:best?{center:pointAlongBearing(origin.point,best.point,Math.max(100,Math.min(refinementReach*0.98,desired))),radius:Math.max(100,Math.min(50000,reach*0.15))}:undefined;
    audit.discoveryAreas++;
    if(area&&!crossDirection)audit.sectors[directionSector(origin.point,area.center)].queries++;
    try{extra=await provider.fallback(origin.point,input,area);}catch{audit.discoveryFailures++;return;}
    const seen=new Set(places.map(p=>p.id));refinedIds=new Set();refinedCenter=area?.center;
    for(const p of extra)if(!seen.has(p.id)&&!excluded.has(p.id)&&eligible(p)&&distance(origin.point,p.point)<=refinementReach){seen.add(p.id);refinedIds.add(p.id);places.push(p);auditDiscovered([p]);}
    if(!refinedIds.size&&area)emptyRefinementSectors.add(directionSector(origin.point,area.center));
  }
  for (let i=0;budget.used<routeLimit;i++) {
    if((i>=4&&i<=8)||i>=places.length){
      await refill();
    }
    const measured=[...estimates].sort((a,b)=>a-b),factor=measured.length?measured[Math.floor(measured.length/2)]:null;
    const accepted=items.length+belowMinimum.length,remaining=routeLimit-budget.used;
    const fillFirst=failed>=2&&accepted<8&&remaining<=(8-accepted)*(input.roundTrip?2:1)+4;
    // Relax the planning lower bound when filling, but keep the upper target.
    const target=factor?input.budget:radius(input)*explorationFraction(input);
    const predictedValues=new Map<string,number>();
    const predicted=(p:typeof places[number])=>{
      const cached=predictedValues.get(p.id);if(cached!==undefined)return cached;
      const local=observations.filter(o=>o.direct>100&&directionSector(origin.point,o.point)===directionSector(origin.point,p.point)).sort((a,b)=>Math.abs(a.direct-distance(origin.point,p.point))-Math.abs(b.direct-distance(origin.point,p.point)))[0];
      const value=distance(origin.point,p.point)*(local?local.cost/local.direct:factor??1);predictedValues.set(p.id,value);return value;
    };
    const score=(p:typeof places[number])=>Math.abs(predicted(p)-target);
    const quality=(p:typeof places[number])=>Math.floor(score(p)/Math.max(1,target*0.03));
    const pending=places.slice(i),withinEstimate=(p:typeof places[number])=>factor===null||(predicted(p)<=input.budget&&predicted(p)>=(fillFirst?0:input.minBudget??0));
    // Defer predicted over-budget candidates, but still check them if needed; never fabricate or reject a route on this estimate alone.
    const preferred=pending.filter(withinEstimate),reserve=pending.filter(p=>!withinEstimate(p));
    // Once eight candidates exist, spend the remaining bounded budget checking possible improvements too.
    const improvementPool=items.length+belowMinimum.length>=8;
    // Cost bands and spatial spread stay first; rating can beat a small cost
    // difference within a band instead of requiring an exact cost tie.
    const order=(pool:typeof places)=>geographicOrder(pool,origin.point,(a,b)=>ratingPriority(a,b)||score(a)-score(b),items,attempts,quality,placeKind);
    const ordered=improvementPool?order(pending):[...order(preferred),...order(reserve)];
    // Keep a local refinement probe while respecting untested-direction reserves.
    const probes=pending.filter(p=>refinedIds.has(p.id)).sort((a,b)=>refinedCenter?distance(refinedCenter,a.point)-distance(refinedCenter,b.point):score(a)-score(b)).slice(0,1),probeIds=new Set(probes.map(p=>p.id));
    const untested=geographicOrder(pending.filter(p=>budget.attempts[directionSector(origin.point,p.point)]===0),origin.point,(a,b)=>ratingPriority(a,b)||score(a)-score(b),[],[],quality,placeKind);
    const firstBySector=untested.filter((p,index)=>untested.findIndex(other=>directionSector(origin.point,other.point)===directionSector(origin.point,p.point))===index),firstIds=new Set(firstBySector.map(p=>p.id));
    places=[...places.slice(0,i),...firstBySector,...probes.filter(p=>!firstIds.has(p.id)),...ordered.filter(p=>!probeIds.has(p.id)&&!firstIds.has(p.id))];
    // Reserved directions may postpone a refinement probe; retain it until tried.
    for(const p of places.slice(i,i+1))refinedIds.delete(p.id);
    if(i>=places.length){if(provider.fallback&&refinements<refinementLimit){i--;continue;}break;}
    const batch = await Promise.all(places.slice(i,i+1).map(async p=>{
      const sector=directionSector(origin.point,p.point),trace=audit.sectors[sector];
      if (input.metric === 'distance' && distance(origin.point,p.point)*(input.roundTrip?2:1)>input.budget*1000) return null;
      const pendingSectors=places.slice(i).filter(p=>input.metric!=='distance'||distance(origin.point,p.point)*(input.roundTrip?2:1)<=input.budget*1000).map(p=>directionSector(origin.point,p.point));
      const futureProbes=provider.radialDiscovery?Math.max(0,Math.min(2,refinementLimit)-refinements):0;
      const permit=budget.reserve(sector,pendingSectors,futureProbes);
      if(!permit){trace.budgetDeferred++;return null;}
      attempts[sector]++;trace.attempted++;
      const candidateLeg=async(from:typeof origin.point,to:typeof origin.point,departure:Date)=>{permit.leg();trace.routeCalls++;return getLeg(from,to,departure);};
      try{
      const outbound = await candidateLeg(origin.point,p.point,start);
      if (!outbound) { failed++;unavailable++;trace.unavailable++; return null; }
      const outboundValue=input.metric==='time'?outbound.seconds/60:outbound.meters/1000;
      const direct=distance(origin.point,p.point);
      if(outboundValue>input.budget){observations.push({point:p.point,cost:outboundValue*(input.roundTrip?2:1),direct});if(direct>100)estimates.push(outboundValue*(input.roundTrip?2:1)/direct);failed++;trace.overUpper++;return null;}
      const inbound = input.roundTrip ? await candidateLeg(p.point,origin.point,new Date(start.getTime()+outbound.seconds*1000)) : undefined;
      if (input.roundTrip && !inbound) { failed++;unavailable++;trace.unavailable++; return null; }
      const result=totals(p,outbound,inbound??undefined);
      const actualValue=input.metric==='time'?result.seconds/60:result.meters/1000;
      observations.push({point:p.point,cost:actualValue,direct});
      if(direct>100)estimates.push(actualValue/direct);
      if(!rank([result],input).length){failed++;trace.overUpper++;return null;}
      if(actualValue<(input.minBudget??0))trace.belowMinimum++;else trace.withinRange++;
      return result;
      }finally{permit.close();}
    }));
    for(const item of batch){if(!item)continue;const value=input.metric==='time'?item.seconds/60:item.meters/1000;if(value<(input.minBudget??0))belowMinimum.push(item);else items.push(item);}
  }
  const notices = [`出発地から約${Math.round(radius(input)/1000)}kmを初期探索の目安に、実測に応じて位置を補正する最大5範囲で${input.mode==='DRIVE'?'候補':'近場も含めた候補'}を探索し、最大24回の経路計算で8件を目標に候補を確認します。探索位置は目安で、${input.mode==='BICYCLE'?'徒歩経路の距離と自転車の推定時間':'実際の経路時間・距離'}が上限以内の候補を近い順に表示します。すべての到達可能地点を網羅するものではありません。`];
  if(excludedCount)notices.push(`${excludedCount}件をアカウントの除外設定により省きました。既出・除外済みの場所は経路確認の対象から外します。`);
  if (input.theme === 'nature') notices.push('自然・景色に関するGoogleの施設分類で探索します。峠の専用分類はなく、すべての峠や山道を探せるものではありません。');
  if (input.mode === 'DRIVE' && input.avoidHighways) notices.push('高速道路をなるべく避ける条件で往路・復路を計算しています。Googleの回避指定は完全な除外を保証しません。有料道路の回避とは別の条件です。');
  if (unavailable) notices.push(`${unavailable}件は指定手段の経路が見つからないため除外しました。地域・手段が未対応の場合があります。`);
  const actualValue=(d:Destination)=>input.metric==='time'?d.seconds/60:d.meters/1000;
  const order=(pool:Destination[])=>[...pool].sort((a,b)=>actualValue(b)-actualValue(a)||ratingPriority(a,b));
  const choose=(pool:Destination[])=>geographicOrder(pool,origin.point,(a,b)=>ratingPriority(a,b)||actualValue(b)-actualValue(a),[],[],d=>Math.floor((input.budget-actualValue(d))/Math.max(1,input.budget*0.03)),placeKind);
  const selected=choose(items).slice(0,8);
  const ranked=[...order(selected),...order(choose(belowMinimum).slice(0,8-selected.length))];
  for(const p of ranked)audit.sectors[directionSector(origin.point,p.point)].selected++;
  audit.categories=[...new Set(places.map(placeKind))].map(kind=>({kind,candidates:places.filter(p=>placeKind(p)===kind).length,selected:ranked.filter(p=>placeKind(p)===kind).length}));
  audit.routeCalls=budget.used;onAudit?.(audit);
  if(input.mode==='BICYCLE')notices.push(`自転車は推定値です。徒歩経路の距離を平均時速${bicycleSpeedKmh}kmで換算しています。階段・歩行者専用道など、自転車で通行できない道を含む可能性があります。実際の自転車経路・距離・時間は外部Google Mapsで確認してください。`);
  if(!ranked.length&&items.length)notices.push('取得できた経路はすべて指定した時間・距離の上限を超えました。往復は帰りの分も含みます。');
  if(ranked.length && (input.metric==='time'?ranked[0].seconds/60:ranked[0].meters/1000)<input.budget*0.75) notices.push('今回の候補は指定上限より短い移動に偏っています。道路網や候補分類・探索範囲の制限により、上限に近い候補を取得できない場合があります。');
  return {source:'google',origin:origin.point,originLabel:origin.label,input,destinations:ranked,notices};
}
