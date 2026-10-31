import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseInput, totals, rank, type SearchInput, type Place } from '../lib/domain';
import { search } from '../lib/search';
import { demoSearch } from '../lib/demo';
import { GoogleProvider } from '../lib/google';
import { googleMapsUrl, yahooUrl } from '../lib/navigation';
import type { DiscoveryProvider } from '../lib/providers';
const input:SearchInput={source:'google',origin:'東京駅',mode:'DRIVE',metric:'time',budget:60,roundTrip:true};
const place:Place={id:'1',name:'公園',description:'テスト',category:'公園',point:{lat:35.69,lng:139.78}};
afterEach(()=>vi.unstubAllGlobals());
describe('入力と上限判定',()=>{
 it.each([{}, {...input,mode:'FLY'}, {...input,budget:NaN}, {...input,origin:{lat:91,lng:0}}, {...input,roundTrip:'true'}, {...input,budget:481}, {...input,origin:''}])('不正入力を拒否する: %j',data=>expect(()=>parseInput(data)).toThrow());
 it('往復の時間と距離を足して上限を適用する',()=>{
  const a=totals(place,{seconds:1800,meters:10000},{seconds:2100,meters:11000});
  expect(a.seconds).toBe(3900);expect(a.meters).toBe(21000);expect(rank([a],input)).toEqual([]);
  expect(rank([a],{...input,metric:'distance',budget:21})).toHaveLength(1);
 });
 it('上限を超えず条件に近い順にする',()=>{
  const items=[20,60,61,45].map((m,i)=>totals({...place,id:String(i)},{seconds:m*60,meters:m*1000}));
  expect(rank(items,input).map(x=>x.seconds/60)).toEqual([60,45,20]);
 });
});
describe('実APIオーケストレーション',()=>{
 it('復路の起点終点を反転し、往路到着後の時刻を渡す',async()=>{
  const origin={lat:35.68,lng:139.76};
  const route=vi.fn().mockResolvedValueOnce({seconds:1200,meters:9000}).mockResolvedValueOnce({seconds:1500,meters:11000});
  const provider:DiscoveryProvider={resolve:vi.fn().mockResolvedValue({point:origin,label:'出発'}),nearby:vi.fn().mockResolvedValue([place]),route};
  const result=await search({...input,mode:'TRANSIT'},provider);
  expect(route.mock.calls[1].slice(0,3)).toEqual([place.point,origin,'TRANSIT']);
  expect(route.mock.calls[1][3].getTime()-route.mock.calls[0][3].getTime()).toBe(1200000);
  expect(result.destinations[0].seconds).toBe(2700);
 });
 it('復路がない候補は架空の復路で補わない',async()=>{
  const provider:DiscoveryProvider={resolve:async()=>({point:place.point,label:'起点'}),nearby:async()=>[place],route:vi.fn().mockResolvedValueOnce({seconds:60,meters:100}).mockResolvedValueOnce(null)};
  const result=await search(input,provider);expect(result.destinations).toEqual([]);expect(result.notices.join('')).toContain('1件');
 });
 it('通信障害は0件扱いにしない',async()=>{
  const provider:DiscoveryProvider={resolve:async()=>({point:place.point,label:'起点'}),nearby:async()=>[place],route:async()=>{throw new Error('通信障害');}};
  await expect(search(input,provider)).rejects.toThrow('通信障害');
 });
 it('Googleの認証エラーの詳細・キーを露出しない',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('secret upstream body',{status:403})));
  await expect(new GoogleProvider('secret').route(place.point,place.point,'WALK',new Date())).rejects.toThrow('認証');
 });
 it('指定移動手段とno-storeと最小フィールドをGoogleへ送る',async()=>{
  const f=vi.fn().mockResolvedValue(new Response(JSON.stringify({routes:[{duration:'120s',distanceMeters:500,polyline:{encodedPolyline:'abc'}}]}),{status:200}));vi.stubGlobal('fetch',f);
  expect(await new GoogleProvider('test-key').route(place.point,place.point,'BICYCLE',new Date())).toEqual({seconds:120,meters:500,polyline:'abc'});
  expect(JSON.parse(f.mock.calls[0][1].body).travelMode).toBe('BICYCLE');expect(f.mock.calls[0][1].cache).toBe('no-store');
 });
});
describe('デモとナビ',()=>{
 it('デモを明示し、任意の起点の架空結果を返さない',()=>{
  const result=demoSearch({...input,source:'demo',budget:120});expect(result.source).toBe('demo');expect(result.destinations.length).toBeGreaterThan(1);
  expect(()=>demoSearch({...input,source:'demo',origin:'大阪駅'})).toThrow('東京駅固定');
 });
 it('外部URLをエンコードして正しい手段を指定する',()=>{
  const url=new URL(googleMapsUrl(place.point,{lat:36,lng:140},'WALK',[place.point]));
  expect(url.searchParams.get('travelmode')).toBe('walking');expect(url.searchParams.get('api')).toBe('1');expect(url.searchParams.has('waypoints')).toBe(true);
  expect(new URL(googleMapsUrl(place.point,place.point,'TRANSIT',[place.point])).searchParams.has('waypoints')).toBe(false);
  expect(new URL(yahooUrl(place.point,'公園 & 海')).searchParams.get('name')).toBe('公園 & 海');
 });
});
