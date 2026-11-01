import {it,expect,vi,afterEach} from 'vitest';
import {directionSector,geographicOrder,explorationAreas} from '../lib/exploration';
import {distance,type SearchInput,type Place} from '../lib/domain';
import {GoogleProvider} from '../lib/google';
import {search} from '../lib/search';
const origin={lat:35,lng:139};const input:SearchInput={source:'google',origin,mode:'DRIVE',metric:'time',budget:120,roundTrip:true};
const make=(id:string,sector:number,km=10,rating=4.5):Place=>{const angle=sector*Math.PI/4;return {id,name:id,point:{lat:origin.lat+Math.cos(angle)*km/111.2,lng:origin.lng+Math.sin(angle)*km/(111.2*Math.cos(origin.lat*Math.PI/180))},description:'',category:'公園',rating,userRatingCount:100};};
afterEach(()=>vi.unstubAllGlobals());
it('一方向に多数あっても8方向へ分散する',()=>{const places=[...Array.from({length:40},(_,i)=>make('east'+i,2)),...Array.from({length:8},(_,i)=>make('s'+i,i))];const ordered=geographicOrder(places,origin,()=>0);expect(new Set(ordered.slice(0,8).map(p=>directionSector(origin,p.point))).size).toBe(8);expect(ordered).toHaveLength(48);expect(places[0].id).toBe('east0');});
it.each(['all','highrated','reviews'] as const)('%sでも経路確認前に方向を分散し8件を返す',async theme=>{const places=[...Array.from({length:40},(_,i)=>make('east'+i,2,10,5)),...Array.from({length:8},(_,i)=>make('s'+i,i,10,4.1))];const route=vi.fn(async()=>({seconds:3000,meters:20000}));const result=await search({...input,theme},{resolve:async()=>({point:origin,label:'起点'}),discover:async()=>places,nearby:async()=>[],route});expect(result.destinations).toHaveLength(8);expect(new Set(result.destinations.map(p=>directionSector(origin,p.point))).size).toBe(8);expect(route).toHaveBeenCalledTimes(24);});
it('海などで候補がない方向を無理に埋めず存在する候補を使う',async()=>{const places=Array.from({length:12},(_,i)=>make(String(i),2));const result=await search(input,{resolve:async()=>({point:origin,label:'起点'}),nearby:async()=>places,route:async()=>({seconds:100,meters:100})});expect(result.destinations).toHaveLength(8);expect(new Set(result.destinations.map(p=>directionSector(origin,p.point))).size).toBe(1);});
it('方向の分散後も不通と時間超過を除外して上限内の候補を補充する',async()=>{const places=Array.from({length:8},(_,s)=>[make('bad'+s,s,20),make('good'+s,s,10)]).flat();const route=vi.fn(async(from,to)=>({seconds:distance(origin,from===origin?to:from)>15000?8000:3000,meters:10000}));const result=await search(input,{resolve:async()=>({point:origin,label:'起点'}),nearby:async()=>places,route});expect(result.destinations).toHaveLength(8);expect(result.destinations.every(p=>p.id.startsWith('good'))).toBe(true);expect(route.mock.calls.length).toBeLessThanOrEqual(24);});
it('初期4範囲と補正1範囲で探索し再補充で追加のAPIは呼ばない',async()=>{const f=vi.fn(async(_url:string,options:RequestInit)=>{const c=JSON.parse(options.body as string).locationRestriction.circle.center;return Response.json({places:[{id:c.latitude+':'+c.longitude,location:c}]});});vi.stubGlobal('fetch',f);const provider=new GoogleProvider('test');await provider.discover(origin,input);expect(f).toHaveBeenCalledTimes(4);await provider.fallback(origin,input);expect(f).toHaveBeenCalledTimes(5);const requests=f.mock.calls.map(c=>JSON.parse(c[1].body as string));expect(requests[4].locationRestriction.circle.center).toEqual({latitude:origin.lat,longitude:origin.lng});for(const r of requests)expect(r.locationRestriction.circle.radius).toBeLessThanOrEqual(50000);await provider.fallback(origin,input);expect(f).toHaveBeenCalledTimes(5);expect(explorationAreas(origin,input).every(a=>a.radius>distance(origin,a.center)*0.9)).toBe(true);});

it.each([60,180])('実測%s分から第五探索の距離を調整し二回目以降は再取得しない',async cost=>{
 const p=make('sample',0,20);const fallback=vi.fn(async(_origin:typeof origin,_input:SearchInput,_area?:{center:typeof origin;radius:number})=>[]);
 const result=await search(input,{resolve:async()=>({point:origin,label:'起点'}),discover:async()=>[p,make('second',2,20)],nearby:async()=>[],fallback,route:async()=>({seconds:cost*30,meters:20000})});
 expect(fallback).toHaveBeenCalledTimes(1);
 const area=fallback.mock.calls[0][2];expect(area).toBeDefined();
 expect(distance(origin,area!.center)).toBeCloseTo(Math.min(47500,distance(origin,p.point)*120*.95/cost),0);
 expect(area!.radius).toBe(10000);
 expect(result.destinations.every(d=>d.seconds<=7200)).toBe(true);
});
