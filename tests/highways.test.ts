import { afterEach,describe,it,expect,vi } from 'vitest';
import { parseInput,type SearchInput } from '../lib/domain';
import { GoogleProvider } from '../lib/google';
import { search } from '../lib/search';
import { googleMapsUrl } from '../lib/navigation';
import type { DiscoveryProvider } from '../lib/providers';
const input:SearchInput={source:'google',origin:'東京駅',mode:'DRIVE',metric:'time',budget:30,roundTrip:true,avoidHighways:true};
const point={lat:35.68,lng:139.76},place={id:'p',name:'公園',category:'公園',description:'公園',point:{lat:35.69,lng:139.77}};
afterEach(()=>vi.unstubAllGlobals());
describe('高速道路の利用設定',()=>{
 it('未指定は高速利用可、不正値は拒否、車以外では無効',()=>{expect(parseInput({...input,avoidHighways:undefined}).avoidHighways).toBe(false);expect(()=>parseInput({...input,avoidHighways:'true'})).toThrow();expect(parseInput({...input,mode:'WALK'}).avoidHighways).toBe(false);});
 it.each([true,false])('Googleの車経路に回避設定=%sを渡す',async avoidHighways=>{const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({routes:[{duration:'60s',distanceMeters:500}]})));vi.stubGlobal('fetch',mock);await new GoogleProvider('test').route(point,place.point,'DRIVE',new Date(),{avoidHighways});expect(JSON.parse(mock.mock.calls[0][1].body).routeModifiers).toEqual({avoidHighways});});
 it.each(['WALK','BICYCLE','TRANSIT'] as const)('車以外の%sには回避条件を送らない',async mode=>{const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({routes:[{duration:'60s',distanceMeters:500}]})));vi.stubGlobal('fetch',mock);await new GoogleProvider('test').route(point,place.point,mode,new Date(),{avoidHighways:true});expect(JSON.parse(mock.mock.calls[0][1].body).routeModifiers).toBeUndefined();});
 it.each(['time','distance'] as const)('往復に設定を渡し、条件付き経路の%sで候補を絞る',async metric=>{const route=vi.fn(async(_a,_b,_mode,_departure,options)=>({seconds:options?.avoidHighways?1200:600,meters:options?.avoidHighways?12000:6000}));const provider:DiscoveryProvider={resolve:async()=>({point,label:'東京駅'}),nearby:async()=>[place],route};const budget=metric==='time'?30:20;expect((await search({...input,metric,budget,avoidHighways:false},provider)).destinations).toHaveLength(1);expect((await search({...input,metric,budget},provider)).destinations).toHaveLength(0);expect(route.mock.calls.slice(-2).map(call=>call[4])).toEqual([{avoidHighways:true},{avoidHighways:true}]);});
 it('Google Mapsへの往復リンクに回避条件を引き継ぐ',()=>{for(const [from,to] of [[point,place.point],[place.point,point]])expect(new URL(googleMapsUrl(from,to,'DRIVE',[],true)).searchParams.get('avoid')).toBe('highways');expect(new URL(googleMapsUrl(point,place.point,'WALK',[],true)).searchParams.has('avoid')).toBe(false);});
});
