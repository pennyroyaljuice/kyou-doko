import {expect,it,vi} from 'vitest';
import {DirectionalRouteBudget} from '../lib/route-budget';
import {geographicOrder,directionSector} from '../lib/exploration';
import {search} from '../lib/search';
import type {Place,SearchInput} from '../lib/domain';
import type {SearchAudit} from '../lib/search-audit';
import {newSearchAudit} from '../lib/search-audit';
import {mergeResults} from '../lib/merge-results';
import type {SearchResult} from '../lib/domain';
const origin={lat:35,lng:139};
const point=(sector:number,km:number)=>{const angle=sector*Math.PI/4;return {lat:origin.lat+Math.cos(angle)*km/111.2,lng:origin.lng+Math.sin(angle)*km/(111.2*Math.cos(origin.lat*Math.PI/180))};};
const place=(id:string,sector:number,km=30):Place=>({id,name:id,point:point(sector,km),category:'公園',description:''});
it('他方向と今後の方向確認の枠を、一方向の繰り返しに使わせない',()=>{
 const budget=new DirectionalRouteBudget(10,2);
 const first=budget.reserve(0,[0,2,4],2)!;expect(first).not.toBeNull();first.leg();first.leg();first.close();
 const repeat=budget.reserve(0,[0,2,4],2)!;repeat.leg();repeat.leg();repeat.close();
 expect(budget.reserve(0,[0,2,4],2)).toBeNull();
 for(const sector of [2,4]){const permit=budget.reserve(sector,[2,4],2)!;expect(permit).not.toBeNull();permit.leg();permit.leg();permit.close();}
 expect(budget.probe()).toBe(true);expect(budget.probe()).toBe(true);expect(budget.probe()).toBe(false);expect(budget.used).toBe(10);
});
it('並列の往復を両脚まとめて確保し、未使用の復路は解放する',()=>{
 const budget=new DirectionalRouteBudget(3,2),first=budget.reserve(0,[0])!;
 expect(budget.reserve(0,[0])).toBeNull();first.leg();first.close();
 const second=budget.reserve(0,[0])!;expect(second).not.toBeNull();second.leg();second.leg();second.close();expect(budget.used).toBe(3);
});
it('同程度なら同じ方位でも隣接公園より離れた候補を先にする',()=>{
 const a=place('a',2,30),adjacent=place('adjacent',2,30.1),separated=place('separated',2,40);
 const costs=new Map([['a',119],['adjacent',118.9],['separated',118]]);
 const ordered=geographicOrder([a,adjacent,separated],origin,(a,b)=>costs.get(b.id)!-costs.get(a.id)!,[],[],()=>0);
 expect(ordered.map(p=>p.id)).toEqual(['a','separated','adjacent']);
});
it('離れていても明らかに短い候補へ置換しない',()=>{
 const places=[place('149',2,30),place('148',2,30.1),place('130',2,40)],cost=(p:Place)=>Number(p.id);
 expect(geographicOrder(places,origin,(a,b)=>cost(b)-cost(a),[],[],p=>Math.floor((150-cost(p))/4.5)).map(p=>p.id)).toEqual(['149','148','130']);
});
it.each([false,true])('密集した失敗方向があっても他の候補方位を確認し、監査を集計する（往復=%s）',async roundTrip=>{
 const places=[...Array.from({length:30},(_,i)=>place('bad'+i,2)),...Array.from({length:8},(_,i)=>place('good'+i,i))];let audit:SearchAudit|undefined;
 const route=vi.fn(async(_from,to)=>({seconds:(directionSector(origin,to)===2?200:119)*60/(roundTrip?2:1),meters:30000}));
 const input:SearchInput={source:'google',origin,mode:'DRIVE',metric:'time',budget:150,roundTrip};
 const found=await search(input,{resolve:async()=>({point:origin,label:'private-origin'}),nearby:async()=>places,route},new Set(),value=>{audit=value;});
 expect(audit).toBeDefined();expect(audit!.sectors.slice(0,8).every(s=>s.attempted>0)).toBe(true);
 expect(audit!.routeCalls).toBe(route.mock.calls.length);expect(audit!.routeCalls).toBeLessThanOrEqual(24);
 expect(audit!.sectors.reduce((n,s)=>n+s.selected,0)).toBe(found.destinations.length);
 expect(JSON.stringify(audit)).not.toMatch(/private-origin|good|bad|lat|lng/);
});
it('追加検索の探索履歴は最新10回を保持し、結果カードの内容と順序を保つ',()=>{
 const input:SearchInput={source:'google',origin,mode:'DRIVE',metric:'time',budget:120,roundTrip:false};
 const card={...place('old',1),outbound:{seconds:6000,meters:30000},seconds:6000,meters:30000};
 const first:SearchResult={source:'google',origin,originLabel:'起点',input,destinations:[card],notices:[],auditHistory:Array.from({length:10},()=>newSearchAudit())};
 const next={...first,destinations:[],input:{...input,explorationPage:1},auditHistory:[{...newSearchAudit(),routeCalls:23}]};
 const merged=mergeResults(first,next);expect(merged.destinations).toEqual([card]);expect(merged.auditHistory).toHaveLength(10);expect(merged.auditHistory?.at(-1)?.routeCalls).toBe(23);
});
