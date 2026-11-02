import {afterEach,expect,it,vi} from 'vitest';
import {newSearchAudit} from '../lib/search-audit';
const state=vi.hoisted(()=>({owner:false}));
vi.mock('next/server',()=>({NextResponse:{json:(value:unknown,init:ResponseInit)=>Response.json(value,init)}}));
vi.mock('../lib/access',()=>({requestAccess:()=>({signedIn:true,canSearch:true,isOwner:state.owner}),liveEnabled:()=>true}));
vi.mock('../lib/runtime-config',()=>({googleConfig:()=>({serverKey:'test-server',browserKey:'test-browser'})}));
vi.mock('../lib/google',()=>({GoogleProvider:class {}}));
vi.mock('../lib/search',()=>({search:async(input:unknown,_provider:unknown,_excluded:unknown,onAudit:(a:unknown)=>void)=>{onAudit(newSearchAudit());return {input,source:'google',destinations:[],notices:[]};}}));
import {POST} from '../app/api/search/route';
afterEach(()=>vi.restoreAllMocks());
it.each([true,false])('探索履歴は管理者だけへ返す（管理者=%s）',async owner=>{
 state.owner=owner;const log=vi.spyOn(console,'info').mockImplementation(()=>{});
 const response=await POST(new Request('https://example.test/api/search',{method:'POST',headers:{'x-kyou-budget-approved':'true'},body:JSON.stringify({source:'google',origin:'東京駅',mode:'DRIVE',metric:'time',budget:120,roundTrip:true})}));
 expect(response.status).toBe(200);const body=await response.json() as {auditHistory?:unknown};
 expect(body.auditHistory!==undefined).toBe(owner);expect(log).toHaveBeenCalledWith('SEARCH_AUDIT',expect.any(String));
 expect(log.mock.calls[0][1]).not.toContain('東京駅');
});
