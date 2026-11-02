import {afterEach,expect,it,vi} from 'vitest';
import {SignJWT} from 'jose';
vi.mock('vinext/server/fetch-handler',()=>({default:{fetch:vi.fn(async()=>new Response('app'))}}));
import worker from '../worker/index';
import {UsageBudget} from '../worker/usage';
const base='https://example.test',env={ADMIN_AUTH_MODE:'google',PUBLIC_SEARCH_ENABLED:'true',LIVE_SEARCH_ENABLED:'true',GOOGLE_MAPS_API_KEY:'server-only-key',GOOGLE_OAUTH_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_OAUTH_CLIENT_SECRET:'secret',ADMIN_SESSION_SECRET:'s'.repeat(64),LIVE_SEARCH_OWNER_EMAIL:'owner@gmail.com'};
async function cookie(){const key=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.ADMIN_SESSION_SECRET)));return '__Host-kyou-google='+await new SignJWT({email:'member@gmail.com',version:env.GOOGLE_OAUTH_CLIENT_ID+'|'+env.LIVE_SEARCH_OWNER_EMAIL+'|'}).setSubject('member').setProtectedHeader({alg:'HS256'}).setIssuer(base).setAudience('kyou-google-admin').setIssuedAt().setExpirationTime('1h').sign(key);}
function budget(){const data=new Map<string,unknown>();let lock=Promise.resolve();const storage={get:async(k:string)=>structuredClone(data.get(k)),getAlarm:async()=>1,setAlarm:async()=>{},transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{const prev=lock;let release!:()=>void;lock=new Promise<void>(r=>release=r);await prev;try{return await fn({get:async(k:string)=>structuredClone(data.get(k)),put:async(k:string,v:unknown)=>{data.set(k,structuredClone(v));}});}finally{release();}}};const object=new UsageBudget({storage} as unknown as DurableObjectState);return {idFromName:()=>({}),get:()=>({fetch:async(url:string,init:RequestInit)=>object.fetch(new Request(url,init))})} as unknown as DurableObjectNamespace;}
const body={action:'suggest',input:'東京',sessionToken:'12345678-1234-1234-1234-123456789abc'};
function originRequest(session?:string,origin=base,data:unknown=body){return new Request(base+'/api/origin',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session}:{})},body:JSON.stringify(data)});}
afterEach(()=>vi.unstubAllGlobals());
it('未ログインのトップはログインへ、規約・プライバシーは公開したまま',async()=>{
 for(const method of ['GET','HEAD']){const r=await worker.fetch(new Request(base,{method}),env,{} as ExecutionContext);expect(r.status).toBe(303);expect(r.headers.get('Location')).toBe('/login');expect(r.headers.get('Cache-Control')).toBe('no-store');}
 for(const path of ['/privacy','/terms'])expect((await worker.fetch(new Request(base+path),env,{} as ExecutionContext)).status).toBe(200);
 const login=await worker.fetch(new Request(base+'/login'),env,{} as ExecutionContext);expect(await login.text()).toContain('Googleでログイン');
});
it('ログイン済みならトップへ進み、ログインページへ戻ってもループしない',async()=>{const session=await cookie();expect((await worker.fetch(new Request(base,{headers:{Cookie:session}}),env,{} as ExecutionContext)).status).toBe(200);expect((await worker.fetch(new Request(base+'/login',{headers:{Cookie:session}}),env,{} as ExecutionContext)).headers.get('Location')).toBe('/');});
it('匿名・別サイト・GETでは候補APIを使えずGoogleを呼ばない',async()=>{
 const f=vi.fn();vi.stubGlobal('fetch',f);expect((await worker.fetch(originRequest(),env,{} as ExecutionContext)).status).toBe(401);expect((await worker.fetch(originRequest(await cookie(),'https://other.test'),env,{} as ExecutionContext)).status).toBe(403);expect((await worker.fetch(new Request(base+'/api/origin'),env,{} as ExecutionContext)).status).toBe(405);expect(f).not.toHaveBeenCalled();
});
it('候補表示と地点確定は検索回数を消費せず、ブラウザへAPIキーを返さない',async()=>{
 const session=await cookie(),configuration={...env,USAGE_BUDGET:budget()};
 const f=vi.fn(async(url:string)=>url.includes('autocomplete')?Response.json({suggestions:[{placePrediction:{placeId:'place1',structuredFormat:{mainText:{text:'東京駅'},secondaryText:{text:'東京都'}}}}]}):Response.json({id:'place1',location:{latitude:35.68,longitude:139.76}}));vi.stubGlobal('fetch',f);
 const suggest=await worker.fetch(originRequest(session),configuration,{} as ExecutionContext);expect(suggest.status).toBe(200);expect(JSON.stringify(await suggest.json())).not.toContain(env.GOOGLE_MAPS_API_KEY);
 const selected=await worker.fetch(originRequest(session,base,{action:'select',id:'place1',name:'東京駅',address:'東京都',sessionToken:body.sessionToken}),configuration,{} as ExecutionContext);expect(selected.status).toBe(200);
 const usage=await worker.fetch(new Request(base+'/api/usage',{headers:{Cookie:session}}),configuration,{} as ExecutionContext);expect((await usage.json() as {remaining:number}).remaining).toBe(5);expect(f).toHaveBeenCalledTimes(2);
});
it('短時間の並列入力も共有ストレージで12回に制限し、利用量確認失敗時は課金APIを呼ばない',async()=>{
 const session=await cookie(),configuration={...env,USAGE_BUDGET:budget()},f=vi.fn(async()=>Response.json({suggestions:[]}));vi.stubGlobal('fetch',f);
 const responses=await Promise.all(Array.from({length:20},()=>worker.fetch(originRequest(session),configuration,{} as ExecutionContext)));expect(responses.filter((r:Response)=>r.status===200)).toHaveLength(12);expect(responses.filter((r:Response)=>r.status===429)).toHaveLength(8);expect(f).toHaveBeenCalledTimes(12);
 const unavailable=await worker.fetch(originRequest(session),env,{} as ExecutionContext);expect(unavailable.status).toBe(503);expect(f).toHaveBeenCalledTimes(12);
});
it('不正入力は候補用枠も消費せずGoogleも呼ばない',async()=>{const session=await cookie(),configuration={...env,USAGE_BUDGET:budget()},f=vi.fn();vi.stubGlobal('fetch',f);expect((await worker.fetch(originRequest(session,base,{...body,input:'東'}),configuration,{} as ExecutionContext)).status).toBe(400);expect((await worker.fetch(new Request(base+'/api/origin',{method:'POST',headers:{Cookie:session,Origin:base},body:'{'}),configuration,{} as ExecutionContext)).status).toBe(400);expect(f).not.toHaveBeenCalled();});
