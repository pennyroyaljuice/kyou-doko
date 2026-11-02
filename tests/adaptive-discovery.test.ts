import {afterEach,expect,it,vi} from 'vitest';
import {GoogleProvider} from '../lib/google';
import {search} from '../lib/search';
import {distance,radius,type SearchInput,type Point} from '../lib/domain';
import {directionSector} from '../lib/exploration';
// Synthetic road networks and Nearby responses, never recorded Google place data.
const regions=[{name:'fast-city',point:{lat:35.68,lng:139.76},factors:[1.2,1.4,1.8,1.3,1.2,1.6,1.3,1.5]}, {name:'detours',point:{lat:34.70,lng:135.50},factors:[2.2,1.5,1.2,2.8,1.6,1.2,2.4,1.3]}, {name:'slow-access',point:{lat:38.26,lng:140.88},factors:[1.6,2.5,1.3,1.8,1.2,2.1,1.2,1.5]}];
const cases:{input:SearchInput;region:typeof regions[number]}[]=[];
for(const region of regions)for(const mode of ['DRIVE','WALK','BICYCLE'] as const)for(const metric of ['time','distance'] as const)for(const roundTrip of [false,true])for(const ranged of [false,true])for(const theme of ['all','nature','tourism','highrated','reviews'] as const)for(const avoidHighways of [false,true])for(const page of [0,1]){const budget=metric==='time'?120:mode==='DRIVE'?120:10;cases.push({region,input:{source:'google',origin:region.point,mode,metric,roundTrip,budget,...(ranged?{minBudget:budget*5/6}:{}),theme,avoidHighways,explorationPage:page}});}
for(const mode of ['DRIVE','WALK','BICYCLE'] as const)for(const metric of ['time','distance'] as const)for(const roundTrip of [true,false])for(const ranged of [true,false])for(const budget of metric==='time'?[5,30,240,480]:[1,10,50,300]){cases.push({region:regions[0],input:{source:'google',origin:regions[0].point,mode,metric,roundTrip,budget,...(ranged?{minBudget:budget*5/6}:{}),theme:'all',avoidHighways:false}});}
afterEach(()=>vi.unstubAllGlobals());
it.each(cases)('$region.name / $input.mode / $input.metric / 往復=$input.roundTrip / 下限=$input.minBudget / $input.theme / 高速回避=$input.avoidHighways / 追加=$input.explorationPage',async({region,input})=>{
 let nearby=0,routes=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
  const b=JSON.parse(options.body as string);
  if(url.includes('searchNearby')){
   nearby++;const c=b.locationRestriction.circle.center;const step=radius(input)*0.018;
   return Response.json({places:Array.from({length:20},(_,i)=>{const p={latitude:c.latitude+(i-9.5)*step/111200,longitude:c.longitude};return {id:`synthetic-${nearby}-${i}`,location:p,displayName:{text:'合成スポット'},types:['park','tourist_attraction'],primaryType:'park',rating:4.1+i/100,userRatingCount:20+i};})});
  }
  routes++;const a=b.origin.location.latLng,z=b.destination.location.latLng;
  const from:Point={lat:a.latitude,lng:a.longitude},to:Point={lat:z.latitude,lng:z.longitude};
  const outbound=distance(region.point,from)<1,p=outbound?to:from;
  const factor=region.factors[directionSector(region.point,p)%8];
  const meters=Math.round(distance(region.point,p)*factor*(outbound?1:1.04));
  const speed=input.mode==='DRIVE'?(input.avoidHighways?28:70):4;
  const seconds=meters/(speed/3.6)+(input.mode==='DRIVE'?360:0);
  return Response.json({routes:[{distanceMeters:meters,duration:`${seconds}s`}]});
 }));
 const found=await search(input,new GoogleProvider('test',true));
 expect(nearby).toBeLessThanOrEqual(5);expect(routes).toBeLessThanOrEqual(24);
 if(input.mode==='DRIVE'&&input.metric==='time'&&input.budget<=6*(input.roundTrip?2:1)){expect(found.destinations).toHaveLength(0);return;}
 expect(found.destinations.length).toBeGreaterThan(0);
 const values=found.destinations.map(d=>input.metric==='time'?d.seconds/60:d.meters/1000);
 expect(Math.max(...values)).toBeLessThanOrEqual(input.budget);
 // This catches the reported 80/120 failure, unlike a count-only test.
 expect(Math.max(...values)).toBeGreaterThanOrEqual(input.budget*0.9);
 expect(new Set(found.destinations.map(d=>d.id)).size).toBe(found.destinations.length);
});
