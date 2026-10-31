import {it,expect} from 'vitest';
import {decideUsage,type UsageState} from '../lib/usage-policy';
const now=Date.parse('2026-11-01T10:00:00+09:00');
it('同じアカウントの4回目を拒否、別アカウントは別枠',()=>{const s:UsageState={days:{}};for(let i=0;i<3;i++)expect(decideUsage(s,'a','search',now,true).allowed).toBe(true);expect(decideUsage(s,'a','search',now,true).allowed).toBe(false);expect(decideUsage(s,'b','search',now,true).remaining).toBe(2);});
it('日本時間0時に更新し、ブラウザーの時刻は使わない',()=>{const s:UsageState={days:{}};const before=Date.parse('2026-11-01T23:59:59+09:00');for(let i=0;i<3;i++)decideUsage(s,'a','search',before,true);expect(decideUsage(s,'a','search',before+1000,false).remaining).toBe(3);});
it('日次の全体上限10回をアカウント追加でも超えない',()=>{const s:UsageState={days:{}};for(let i=0;i<10;i++)expect(decideUsage(s,String(i),'search',now,true).allowed).toBe(true);expect(decideUsage(s,'new','search',now,true).allowed).toBe(false);});
it('月境界を跨いでも直近32日の全体100回を維持',()=>{const s:UsageState={days:{}};for(let day=0;day<10;day++)for(let i=0;i<10;i++)decideUsage(s,String(i),'search',now+day*86400000,true);expect(decideUsage(s,'another','search',now+11*86400000,true).allowed).toBe(false);expect(decideUsage(s,'another','search',now+32*86400000,true).allowed).toBe(true);});
it.each([['photo',500],['map',1000]] as const)('%sの再読込でも独立した全体上限で停止', (kind,limit)=>{const s:UsageState={days:{}};for(let i=0;i<limit;i++)expect(decideUsage(s,'a',kind,now,true).allowed).toBe(true);expect(decideUsage(s,'b',kind,now,true).allowed).toBe(false);expect(decideUsage(s,'a','search',now,false).remaining).toBe(3);});
it('残数表示は検索を消費しない',()=>{const s:UsageState={days:{}};for(let i=0;i<20;i++)expect(decideUsage(s,'a','search',now,false).remaining).toBe(3);expect(s.days).toEqual({});});
