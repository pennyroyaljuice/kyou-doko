import {afterEach,expect,it,vi} from 'vitest';
import {originPlaces,parseOriginRequest} from '../lib/origin-places';
import {reserveOrigin,type OriginQuotaState} from '../lib/origin-quota';
import {parseInput} from '../lib/domain';
import {search} from '../lib/search';
const token='12345678-1234-1234-1234-123456789abc';
afterEach(()=>vi.unstubAllGlobals());
it('入力候補は国内・日本語・セッショントークン付きで最大5件、不要な評価や写真を要求しない',async()=>{
 const f=vi.fn(async()=>Response.json({suggestions:Array.from({length:8},(_,i)=>({placePrediction:{placeId:'place'+i,structuredFormat:{mainText:{text:'東京駅'+i},secondaryText:{text:'東京都千代田区'}}}}))}));
 const result=await originPlaces(parseOriginRequest({action:'suggest',input:'東京',sessionToken:token}),'secret',f);
 expect('suggestions' in result&&result.suggestions).toHaveLength(5);
 const options=f.mock.calls[0] as unknown as [string,RequestInit];const body=JSON.parse(options[1].body as string);expect(body).toMatchObject({includedRegionCodes:['jp'],sessionToken:token,languageCode:'ja',input:'東京',locationBias:{rectangle:{low:{latitude:20,longitude:122},high:{latitude:46,longitude:154}}}});
 expect(JSON.stringify(options[1].headers)).not.toContain('rating');expect(JSON.stringify(result)).not.toContain('secret');
});
it('選んだ場所だけ最小限のDetailsで座標を確定し名前と住所を保持',async()=>{
 const f=vi.fn(async()=>Response.json({id:'place1',location:{latitude:35.68,longitude:139.76}}));
 const result=await originPlaces(parseOriginRequest({action:'select',id:'place1',name:'東京駅',address:'東京都千代田区',sessionToken:token}),'secret',f);
 expect(result).toEqual({point:{lat:35.68,lng:139.76},label:'東京駅',address:'東京都千代田区'});
 const args=f.mock.calls[0] as unknown as [string,RequestInit];expect(args[0]).toContain('sessionToken=');expect(args[1].method).toBe('GET');expect((args[1].headers as Record<string,string>)['X-Goog-FieldMask']).toBe('id,location');
});
it.each([{id:'other',location:{latitude:35,longitude:139}},{id:'place1'},{id:'place1',location:{latitude:100,longitude:139}}])('座標のない候補や別の場所を選択済みにしない',async data=>{
 await expect(originPlaces(parseOriginRequest({action:'select',id:'place1',name:'東京駅',address:'東京都',sessionToken:token}),'key',async()=>Response.json(data))).rejects.toThrow();
});
it('不正なクエリ・トークン・場所IDはGoogleを呼ぶ前に拒否',()=>{for(const body of [{action:'suggest',input:'東',sessionToken:token},{action:'suggest',input:'東京',sessionToken:'x'},{action:'select',id:'../secret',name:'x',address:'',sessionToken:token}])expect(()=>parseOriginRequest(body)).toThrow();});
it('候補サービスが失敗しても架空の候補へ切り替えない',async()=>{await expect(originPlaces(parseOriginRequest({action:'suggest',input:'東京',sessionToken:token}),'key',async()=>new Response(null,{status:403}))).rejects.toThrow('手入力');});
it('候補表示の利用枠は個人・全体・短時間の別枠で、管理者は加算されない',()=>{
 const now=Date.parse('2026-11-02T01:00:00Z'),state:OriginQuotaState={days:{}};
 for(let i=0;i<12;i++)expect(reserveOrigin(state,'member',now).allowed).toBe(true);expect(reserveOrigin(state,'member',now).allowed).toBe(false);
 for(let i=0;i<50;i++)expect(reserveOrigin(state,'owner',now,true).allowed).toBe(true);expect(Object.values(state.days)[0].used).toBe(12);
 for(let i=12;i<30;i++)expect(reserveOrigin(state,'member',now+i*60000).allowed).toBe(true);expect(reserveOrigin(state,'member',now+31*60000).allowed).toBe(false);
});
it('全体1000回の32日枠は利用者を変えても超えず古い日付は除去',()=>{
 const now=Date.parse('2026-11-02T01:00:00Z'),state:OriginQuotaState={days:{}};
 for(let d=0;d<10;d++)for(let n=0;n<100;n++)expect(reserveOrigin(state,'user'+n,now+d*86400000).allowed).toBe(true);
 expect(reserveOrigin(state,'new',now+10*86400000).allowed).toBe(false);expect(reserveOrigin(state,'new',now+50*86400000).allowed).toBe(true);
});
it('候補選択の座標は再解釈せず使い、結果には選択した地名を表示する',async()=>{
 const point={lat:35.68,lng:139.76};const input=parseInput({source:'google',origin:point,originLabel:'東京駅',mode:'DRIVE',metric:'time',budget:120,roundTrip:true});
 const resolve=vi.fn(async p=>({point:p,label:'座標'}));const result=await search(input,{resolve,nearby:async()=>[],route:async()=>null});expect(resolve).toHaveBeenCalledWith(point);expect(result.originLabel).toBe('東京駅');
 expect(()=>parseInput({...input,origin:'東京',originLabel:'東京駅'})).toThrow();
});
