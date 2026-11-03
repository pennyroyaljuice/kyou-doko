import {afterEach,expect,it,vi} from 'vitest';
import {GoogleProvider} from '../lib/google';
import {search} from '../lib/search';
import {distance,type Point,type SearchInput} from '../lib/domain';
import {directionSector} from '../lib/exploration';

afterEach(()=>vi.unstubAllGlobals());
// Deliberately unequal travel costs in four directions; every Nearby response
// is a dense local cluster, unlike a fixture containing perfectly spaced POIs.
it.each(['nature','all','highrated','reviews'] as const)('%s: independent direction probes precede local place discovery within the same 24-call budget',async theme=>{
 const origin={lat:34.680,lng:135.545};
 const input:SearchInput={source:'google',origin,mode:'DRIVE',metric:'time',budget:150,minBudget:120,roundTrip:false,avoidHighways:true,theme};
 const probes:Point[]=[],centers:Point[]=[];let routes=0;
 const minutes=(p:Point)=>distance(origin,p)/1000*[2,1.6,2,3.2,2,3.8,2,2.8][directionSector(origin,p)%8];
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
  const body=JSON.parse(options.body as string);
  if(url.includes('searchNearby')){
   const c=body.locationRestriction.circle.center,center={lat:c.latitude,lng:c.longitude};centers.push(center);
   return Response.json({places:Array.from({length:20},(_,i)=>({id:`${centers.length}-${i}`,location:{latitude:center.lat+i*.0001,longitude:center.lng},displayName:{text:'Synthetic local park'},types:['park'],primaryType:'park',rating:centers.length===1?5:3,userRatingCount:centers.length===1?100000:1}))});
  }
  routes++;const b=body.destination.location.latLng,p={lat:b.latitude,lng:b.longitude};
  if(!centers.some(c=>distance(c,p)<1000))probes.push(p);
  return Response.json({routes:[{duration:`${minutes(p)*60}s`,distanceMeters:distance(origin,p)*1.3}]});
 }));
 const found=await search(input,new GoogleProvider('test',true));
 expect(centers).toHaveLength(5);expect(routes).toBeLessThanOrEqual(24);
 expect(new Set(probes.slice(0,4).map(p=>directionSector(origin,p))).size).toBe(4);
 expect(centers.slice(0,4).every(c=>minutes(c)>=140&&minutes(c)<=145)).toBe(true);
 expect(found.destinations).toHaveLength(8);
 expect(found.destinations.every(p=>p.seconds/60>=120&&p.seconds/60<=150)).toBe(true);
 expect(new Set(found.destinations.map(p=>directionSector(origin,p.point))).size).toBeGreaterThanOrEqual(3);
});
