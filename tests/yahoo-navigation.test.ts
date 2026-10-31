import {it,expect} from 'vitest';
import {yahooUrl,yahooRouteUrl} from '../lib/navigation';
const origin={lat:35.6812,lng:139.7671},destination={lat:35.2,lng:140.1};
it('現在地からの転送は緯度・経度・名称を保持し特殊文字をエンコードする',()=>{const url=new URL(yahooUrl(destination,'海 & 山,公園#1'));expect(url.protocol).toBe('yjcarnavi:');expect(url.host).toBe('navi');expect(url.pathname).toBe('/select');expect(url.searchParams.get('lat')).toBe('35.2');expect(url.searchParams.get('lon')).toBe('140.1');expect(url.searchParams.get('name')).toBe('海 & 山,公園#1');expect(url.hash).toBe('');});
it('検索出発地と目的地をpointの順番通り渡す',()=>{const q=new URL(yahooRouteUrl(origin,destination,'海,公園','東京駅')).searchParams;expect(q.getAll('point')).toEqual(['35.6812,139.7671,東京駅','35.2,140.1,海,公園']);expect(q.has('lat')).toBe(false);});
it('currentと最大3経由地に対応し、4件は黙って削らない',()=>{const vias=Array.from({length:3},(_,i)=>({point:origin,name:'経由'+i}));expect(new URL(yahooRouteUrl('current',destination,'目的地','',vias)).searchParams.getAll('point')).toEqual(['current',...vias.map(v=>'35.6812,139.7671,'+v.name),'35.2,140.1,目的地']);expect(()=>yahooRouteUrl('current',destination,'目的地','',[...vias,vias[0]])).toThrow('3件');});
it('復路は元の検索出発地を目的地として渡す',()=>{const q=new URL(yahooUrl(origin,'東京駅')).searchParams;expect(q.get('lat')).toBe('35.6812');expect(q.get('lon')).toBe('139.7671');expect(q.get('name')).toBe('東京駅');});
