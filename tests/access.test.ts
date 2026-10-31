import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestAccess } from '../lib/access';
import { POST } from '../app/api/search/route';
import Page from '../app/page';
import { headers } from 'next/headers';
vi.mock('next/headers',()=>({headers:vi.fn()}));
const body={source:'google',origin:{lat:35,lng:139},mode:'DRIVE',metric:'time',budget:60,roundTrip:false};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('公開デモと実検索の権限分離',()=>{
  it('設定がない場合は署名済みユーザーでも許可しない',()=>{vi.stubEnv('LIVE_SEARCH_OWNER_EMAIL','');vi.stubEnv('LIVE_SEARCH_OWNER_USER_ID','');expect(requestAccess(new Headers({'oai-authenticated-user-id':'user','oai-authenticated-user-email':'owner@example.test'})).isOwner).toBe(false);});
  it('安定IDを設定した場合はメールの一致だけでは許可しない',()=>{vi.stubEnv('LIVE_SEARCH_OWNER_USER_ID','owner-id');vi.stubEnv('LIVE_SEARCH_OWNER_EMAIL','owner@example.test');expect(requestAccess(new Headers({'oai-authenticated-user-id':'other-id','oai-authenticated-user-email':'owner@example.test'})).isOwner).toBe(false);});
  it('メールだけ・bodyだけでは本人と認定しない',()=>{vi.stubEnv('LIVE_SEARCH_OWNER_EMAIL','owner@example.test');expect(requestAccess(new Headers({'oai-authenticated-user-email':'owner@example.test'})).signedIn).toBe(false);});
  it.each([['anonymous',{},401],['other',{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.test'},403]])('%sの実検索はGoogleへ接続する前に拒否',async(_name,identity,status)=>{
    vi.stubEnv('LIVE_SEARCH_OWNER_EMAIL','owner@example.test');vi.stubEnv('LIVE_SEARCH_ENABLED','true');vi.stubEnv('GOOGLE_MAPS_API_KEY','server-test');vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY','browser-test');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const response=await POST(new Request('https://example.test/api/search',{method:'POST',headers:{'Content-Type':'application/json',...identity},body:JSON.stringify({...body,isOwner:true,userId:'owner'})}));expect(response.status).toBe(status);expect(fetcher).not.toHaveBeenCalled();
  });
  it('本人でも停止スイッチが無効ならGoogleへ接続しない',async()=>{
    vi.stubEnv('LIVE_SEARCH_OWNER_EMAIL','owner@example.test');vi.stubEnv('LIVE_SEARCH_ENABLED','false');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const response=await POST(new Request('https://example.test/api/search',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'},body:JSON.stringify(body)}));expect(response.status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
  });
  it('未ログインでもデモ検索でき、Googleを呼ばない',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const response=await POST(new Request('https://example.test/api/search',{method:'POST',body:JSON.stringify({...body,source:'demo',origin:'東京駅',budget:120})}));expect(response.status).toBe(200);expect((await response.json() as {source:string}).source).toBe('demo');expect(fetcher).not.toHaveBeenCalled();
  });
  it('匿名画面へ地図キーや実検索権限を送らない',async()=>{
    vi.stubEnv('GOOGLE_MAPS_API_KEY','server-secret');vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY','browser-key');vi.stubEnv('LIVE_SEARCH_ENABLED','true');
    vi.mocked(headers).mockResolvedValue(new Headers() as Awaited<ReturnType<typeof headers>>);
    const page=await Page();expect(page.props.liveAvailable).toBe(false);expect(JSON.stringify(page.props)).not.toContain('server-secret');
  });
  it('本人画面にもキーを埋め込まず、実検索権限だけを渡す',async()=>{
    vi.stubEnv('LIVE_SEARCH_OWNER_USER_ID','owner-id');vi.stubEnv('GOOGLE_MAPS_API_KEY','server-secret');vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY','browser-key');vi.stubEnv('LIVE_SEARCH_ENABLED','true');
    vi.mocked(headers).mockResolvedValue(new Headers({'oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.test'}) as Awaited<ReturnType<typeof headers>>);
    const page=await Page();expect(page.props.liveAvailable).toBe(true);expect(JSON.stringify(page.props)).not.toContain('server-secret');
  });
});
