import {expect,it,vi} from 'vitest';
import {search} from '../lib/search';
import {sortDestinations,type Place,type SearchInput} from '../lib/domain';
const origin={lat:35,lng:139};
const input:SearchInput={source:'google',origin,mode:'DRIVE',metric:'time',budget:120,roundTrip:false};
const make=(id:string,rating?:number,userRatingCount?:number):Place=>({id,name:id,point:{lat:35.1,lng:139},rating,userRatingCount,category:'公園',description:''});
it.each(['time','distance'] as const)('%s: 同じ近さの帯で星とレビュー数が異なる候補選びに効く',async metric=>{
 const places=Array.from({length:12},(_,i)=>make(String(i),i<6?5:3.5,i<6?10:1000));
 const results=[];
 for(const theme of ['highrated','reviews'] as const){
  const route=vi.fn(async(_a,to)=>{const i=places.findIndex(p=>p.point===to);const value=119.8-i*.1;return {seconds:value*60,meters:value*1000};});
  results.push(await search({...input,metric,theme},{resolve:async()=>({point:origin,label:'起点'}),nearby:async()=>places,route}));
  expect(route.mock.calls.length).toBeLessThanOrEqual(24);
 }
 const high=results[0].destinations,reviews=results[1].destinations;
 expect(high).toHaveLength(8);expect(reviews).toHaveLength(8);
 expect(high.filter(p=>p.rating===5)).toHaveLength(6);expect(reviews.filter(p=>p.userRatingCount===1000)).toHaveLength(6);
 expect(new Set(high.map(p=>p.id))).not.toEqual(new Set(reviews.map(p=>p.id)));
 for(const result of results){const values=result.destinations.map(p=>metric==='time'?p.seconds/60:p.meters/1000);expect(values).toEqual([...values].sort((a,b)=>b-a));for(const sort of ['rating','reviews'] as const)expect(new Set(sortDestinations(result.destinations,result.input,sort).map(p=>p.id))).toEqual(new Set(result.destinations.map(p=>p.id)));}
});
it.each(['highrated','reviews'] as const)('%s: 初回と補充でも欠落・0件・不正な評価は除外し経路枠を使わない',async theme=>{
 const valid=make('valid',4.2,1),missing=[make('missing'),make('zero',5,0),make('no-rating',undefined,100),make('nan',NaN,100)];
 const route=vi.fn(async()=>({seconds:6000,meters:30000}));
 const found=await search({...input,theme},{resolve:async()=>({point:origin,label:'起点'}),nearby:async()=>[...missing,valid],fallback:async()=>[...missing,make('extra',4.4,3)],route});
 expect(found.destinations.map(p=>p.id).sort()).toEqual(['extra','valid']);expect(route).toHaveBeenCalledTimes(2);
});
it('すべてでは評価なしを除外しない',async()=>{
 const found=await search(input,{resolve:async()=>({point:origin,label:'起点'}),nearby:async()=>[make('no-rating')],route:async()=>({seconds:6000,meters:30000})});expect(found.destinations.map(p=>p.id)).toEqual(['no-rating']);
});

it.each(['time','distance'] as const)('%s: rating preferences include shorter strong places only without a lower bound',async metric=>{
 for(const roundTrip of [false,true])for(const theme of ['highrated','reviews'] as const){
 const places=Array.from({length:16},(_,i)=>make(String(i),i<8?4:5,i<8?20:1000));
 const run=(minBudget?:number)=>search({...input,metric,roundTrip,theme,minBudget},{resolve:async()=>({point:origin,label:'origin'}),nearby:async()=>places,route:async(a,b)=>{const i=places.findIndex(p=>p.point===b||p.point===a);const value=i<8?115:60;return {seconds:value*60/(roundTrip?2:1),meters:value*1000/(roundTrip?2:1)};}});
 const broad=await run(),bounded=await run(100);
 expect(broad.destinations).toHaveLength(8);expect(broad.destinations.every(p=>p.rating===5)).toBe(true);
 expect(bounded.destinations.every(p=>(metric==='time'?p.seconds/60:p.meters/1000)>=100)).toBe(true);
 expect(bounded.destinations.every(p=>p.rating===4)).toBe(true);
 }
});
it('rating lower bound never fills with out-of-range places',async()=>{
 const found=await search({...input,theme:'reviews',minBudget:100},{resolve:async()=>({point:origin,label:'origin'}),nearby:async()=>[make('short',5,1000)],route:async()=>({seconds:60*60,meters:20000})});
 expect(found.destinations).toHaveLength(0);
});
