import {afterEach,expect,it,vi} from 'vitest';
import {GoogleProvider} from '../lib/google';
import {search} from '../lib/search';
import {distance,type SearchInput,type Point,type Place} from '../lib/domain';
import {directionSector,pointAlongBearing} from '../lib/exploration';
const origin={lat:35.6812,lng:139.7671};
afterEach(()=>vi.unstubAllGlobals());
const inputs:SearchInput[]=[];
for(const theme of ['all','nature','tourism','highrated','reviews'] as const)for(const metric of ['time','distance'] as const)for(const roundTrip of [true,false])for(const explorationPage of [0,1])inputs.push({source:'google',origin,mode:'DRIVE',metric,budget:120,roundTrip,theme,explorationPage});
async function radialSearch(input:SearchInput){
 const requests:{center:Point;rank:string}[]=[];let routeCalls=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
  const body=JSON.parse(options.body as string);
  if(url.includes('searchNearby')){
   const c=body.locationRestriction.circle.center,center={lat:c.latitude,lng:c.longitude};
   requests.push({center,rank:body.rankPreference});
   const sector=directionSector(origin,center);
   return Response.json({places:Array.from({length:20},(_,i)=>({id:`tile-${requests.length}-${i}`,displayName:{text:'合成スポット'},location:{latitude:center.lat+(i-9.5)*0.0003,longitude:center.lng},types:['park','tourist_attraction'],primaryType:'park',rating:sector===1?5:3.5,userRatingCount:sector===1?10000:0}))});
  }
  routeCalls++;const a=body.origin.location.latLng,b=body.destination.location.latLng;
  const meters=distance({lat:a.latitude,lng:a.longitude},{lat:b.latitude,lng:b.longitude})*1.3;
  return Response.json({routes:[{duration:`${meters/50000*3600}s`,distanceMeters:meters}]});
 }));
 const result=await search(input,new GoogleProvider('test',true));
 return {result,requests,routeCalls};
}
it.each(inputs)('$theme / $metric / 往復=$roundTrip / 追加=$explorationPage でも人気の一地域へ偏らず起点の四方を探索',async input=>{
 const {result,requests,routeCalls}=await radialSearch(input);
 expect(requests).toHaveLength(5);expect(requests.every(r=>r.rank==='DISTANCE')).toBe(true);
 expect(new Set(requests.slice(0,4).map(r=>directionSector(origin,r.center))).size).toBe(4);
 expect(routeCalls).toBeLessThanOrEqual(24);
 const values=result.destinations.map(d=>input.metric==='time'?d.seconds/60:d.meters/1000);
 expect(values.length).toBeGreaterThan(0);expect(Math.max(...values)).toBeLessThanOrEqual(120);expect(Math.max(...values)).toBeGreaterThanOrEqual(108);
 expect(values).toEqual([...values].sort((a,b)=>b-a));
});
it('すべて・高評価・レビュー数は同じ地理範囲と候補母集団で近さを優先する',async()=>{
 const results=[];for(const theme of ['all','highrated','reviews'] as const)results.push(await radialSearch({source:'google',origin,mode:'DRIVE',metric:'time',budget:120,roundTrip:true,theme}));
 const base=results[0];for(const r of results.slice(1)){expect(r.requests).toEqual(base.requests);expect(r.result.destinations.map(d=>d.id)).toEqual(base.result.destinations.map(d=>d.id));}
 expect(base.result.destinations.some(d=>(d.rating??0)<4&&d.userRatingCount===0)).toBe(true);
});
it.each(['highrated','reviews'] as const)('%sでも低評価・レビューなしの近い候補を高評価の遠い候補より優先',async theme=>{
 const near:Place={id:'near',name:'near',point:pointAlongBearing(origin,{lat:36,lng:139.7},39000),category:'公園',description:'',rating:3,userRatingCount:0};
 const rated:Place={...near,id:'rated',name:'rated',point:pointAlongBearing(origin,{lat:36,lng:139.7},33000),rating:5,userRatingCount:100000};
 const found=await search({source:'google',origin,mode:'DRIVE',metric:'time',budget:120,roundTrip:true,theme},{resolve:async()=>({point:origin,label:'起点'}),nearby:async()=>[rated,near],route:async(from,to)=>({seconds:(to===near.point||from===near.point?119:100)*30,meters:40000})});
 expect(found.destinations.map(d=>d.id)).toEqual(['near','rated']);
});
