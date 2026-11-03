import {afterEach,expect,it,vi} from 'vitest';
import {GoogleProvider} from '../lib/google';
import {search} from '../lib/search';
import {geographicOrder} from '../lib/exploration';
import {discoveryTheme,matchesTheme,themeTypes,placeKind} from '../lib/themes';
import type {Place,SearchInput} from '../lib/domain';
const origin={lat:35,lng:139};
afterEach(()=>vi.unstubAllGlobals());
it('観光タグ付きの普通の公園を観光へ流用せず、自然の景勝地と文化施設を区別する',()=>{
 expect(matchesTheme(['park','tourist_attraction'],'tourism','park')).toBe(false);
 expect(matchesTheme(['museum','tourist_attraction'],'nature','museum')).toBe(false);
 expect(matchesTheme(['science_museum','tourist_attraction'],'tourism','science_museum')).toBe(true);
 for(const primary of ['national_park','hiking_area','mountain_peak','beach','observation_deck'])expect(matchesTheme([primary],'nature',primary)).toBe(true);
});
it('混合条件は対向二方向ずつ自然2・観光2へ分け、追加ページで割り当てを交替する',()=>{
 for(const theme of ['all','highrated','reviews'] as const){expect([0,1,2,3].map(s=>discoveryTheme(theme,s,0))).toEqual(['nature','nature','tourism','tourism']);expect([0,1,2,3].map(s=>discoveryTheme(theme,s,1))).toEqual(['tourism','tourism','nature','nature']);}
 for(const theme of ['nature','tourism'] as const)for(const s of [0,1,2,3])expect(discoveryTheme(theme,s)).toBe(theme);
});
it.each(['all','nature','tourism','highrated','reviews'] as const)('%s: 密集した公園・小寺社があっても主分類で別の収集枠を確保し最大5回',async theme=>{
 const requests:string[][]=[];let routes=0;
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
  const b=JSON.parse(options.body as string);
  if(url.includes('searchNearby')){
   const allowed=b.includedPrimaryTypes as string[];requests.push(allowed);
   const c=b.locationRestriction.circle.center;
   const types=[...Array(80).fill('park'),...Array(60).fill('shinto_shrine'),...Array(8).fill('mountain_peak'),...Array(8).fill('beach'),...Array(8).fill('botanical_garden'),...Array(8).fill('museum'),...Array(8).fill('amusement_park'),...Array(8).fill('historical_landmark')];
   return Response.json({places:types.filter(t=>allowed.includes(t)).slice(0,20).map((type,i)=>({id:`${requests.length}-${i}`,primaryType:type,types:[type,'tourist_attraction'],displayName:{text:'synthetic'},location:{latitude:c.latitude+i*.00001,longitude:c.longitude},rating:i%2?4.5:3.8,userRatingCount:i%2?10:1000}))});
  }
  routes++;return Response.json({routes:[{duration:'3540s',distanceMeters:30000}]});
 }));
 const input:SearchInput={source:'google',origin,mode:'DRIVE',metric:'time',budget:120,roundTrip:true,theme};
 const found=await search(input,new GoogleProvider('test',true));
 expect(requests).toHaveLength(5);expect(routes).toBeLessThanOrEqual(24);expect(found.destinations).toHaveLength(8);
 for(const types of requests.slice(0,4))for(const dense of ['park','garden','historical_landmark','shinto_shrine','buddhist_temple'])expect(types).not.toContain(dense);
 expect(requests[4]).toEqual(themeTypes(theme));
 if(theme==='tourism')expect(found.destinations.every(p=>matchesTheme([p.primaryType!],'tourism',p.primaryType))).toBe(true);
 if(theme==='nature')expect(found.destinations.every(p=>matchesTheme([p.primaryType!],'nature',p.primaryType))).toBe(true);
 if(theme==='all'){expect(found.destinations.some(p=>p.primaryType==='museum')).toBe(true);expect(found.destinations.some(p=>p.primaryType==='mountain_peak'||p.primaryType==='beach')).toBe(true);}
 expect(found.destinations.filter(p=>p.primaryType==='park').length).toBeLessThan(8);
});
it('同程度の候補で施設分類を分散し、大幅に短い博物館へは置き換えない',()=>{
 const places:Place[]=Array.from({length:12},(_,i)=>({id:String(i),name:'synthetic',point:{lat:35.1,lng:139},category:'',description:'',primaryType:i<10?'park':'museum'}));
 const costs=new Map(places.map((p,i)=>[p.id,i===11?100:119-i*.1]));
 const ordered=geographicOrder(places,origin,(a,b)=>costs.get(b.id)!-costs.get(a.id)!,[],[],p=>Math.floor((120-costs.get(p.id)!)/3.6),placeKind);
 expect(ordered.slice(0,8).some(p=>p.id==='10')).toBe(true);expect(ordered.slice(0,8).some(p=>p.id==='11')).toBe(false);
});
