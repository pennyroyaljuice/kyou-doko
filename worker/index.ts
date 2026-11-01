import {excludedIds,type Preferences} from '../lib/preferences';
export { UsageBudget } from './usage';
import {checkUsage,resetBudget,resetKeyRequest,preferenceStore,type UsageEnvironment} from './usage';
import {parseInput} from '../lib/domain';
import { servePhoto, type PhotoEnvironment } from '../lib/photos';
import { beginGoogleLogin, finishGoogleLogin, googleAuthenticated, googleSessionIdentity, googleConfigured, clearGoogleFlow, clearGoogleSession, type GoogleAuthEnvironment } from '../lib/google-auth';
import handler from 'vinext/server/fetch-handler';
import { sanitizedHeaders } from '../lib/cloudflare-auth';
import { authenticated, authPage, configured, expiredCookie, passwordMatches, sameOrigin, sessionCookie, type PasswordEnvironment } from '../lib/password-auth';
const redirect=(location:string,cookie?:string)=>new Response(null,{status:303,headers:{Location:location,'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export default {
 async fetch(request:Request,env:Cloudflare.Env&PasswordEnvironment&GoogleAuthEnvironment&PhotoEnvironment&UsageEnvironment&{NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?:string},ctx:ExecutionContext) {
  const url=new URL(request.url),path=url.pathname,headers=sanitizedHeaders(request),googleMode=env.ADMIN_AUTH_MODE==='google';
  const identity=googleMode?await googleSessionIdentity(request,env):null;
  const searchAccess=!!identity&&(identity.isOwner||env.PUBLIC_SEARCH_ENABLED==='true');
  if(searchAccess){headers.set('oai-authenticated-user-id',identity!.isOwner?'password-owner':identity!.sub);headers.set('oai-authenticated-user-email',identity!.email);}
  const usageError=()=>Response.json({error:'利用回数を確認できないため検索を停止しています。時間をおいてお試しください。'},{status:503,headers:{'Cache-Control':'no-store'}});
  if(path==='/api/preferences'){
   if(!searchAccess)return Response.json({error:'Googleログインが必要です。'},{status:401});
   if(!['GET','POST'].includes(request.method))return new Response(null,{status:405});
   if(request.method==='POST'&&!sameOrigin(request))return new Response(null,{status:403});
   try{const raw=request.method==='POST'?await request.text():undefined;if(raw&&raw.length>1024)return new Response(null,{status:413});const store=await preferenceStore(env,identity!.sub);const response=await store.fetch('https://usage.internal/preferences',{method:request.method,...(raw?{body:raw}:{})});return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});}catch{return Response.json({error:'除外設定を読み込めませんでした。時間をおいてお試しください。'},{status:503});}
  }
  if(path==='/admin/api/reset-keys'||path==='/api/usage/redeem'){
   if(!searchAccess)return Response.json({error:'Googleログインが必要です。'},{status:401});
   const issue=path==='/admin/api/reset-keys';if(issue&&!identity!.isOwner)return new Response(null,{status:403});
   if(request.method!=='POST')return new Response(null,{status:405});if(!sameOrigin(request))return new Response(null,{status:403});
   try{const raw=await request.text();if(raw.length>512)return new Response(null,{status:413});const body=JSON.parse(raw);if(!issue&&typeof body.code!=='string')return new Response(null,{status:400});const response=await resetKeyRequest(env,identity!.sub,issue,body.code);return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});}catch{return Response.json({error:'キーを処理できませんでした。'},{status:503});}
  }
  if(path==='/admin/api/usage/reset'){

   if(!identity)return Response.json({error:'管理者ログインが必要です。'},{status:401});
   if(!identity.isOwner)return new Response(null,{status:403});
   if(request.method!=='POST')return new Response(null,{status:405});
   if(!sameOrigin(request))return new Response(null,{status:403});
   try{const raw=await request.text();if(raw.length>1024)return new Response(null,{status:413});const body=JSON.parse(raw);if(body.confirm!==true)return Response.json({error:'リセット内容を確認してください。'},{status:400});const response=await resetBudget(env,identity.sub,body.scope,body.subject);return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});}catch{return Response.json({error:'リセットできませんでした。時間をおいてお試しください。'},{status:503});}
  }
  if(path==='/login')return env.PUBLIC_SEARCH_ENABLED==='true'?authPage('',false,true,true):redirect('/admin/login');
  if(path==='/logout')return redirect('/admin/logout');
  if(path==='/api/usage'||path==='/admin/api/usage'){
   if(!searchAccess)return Response.json({error:'Googleログインが必要です。'},{status:401});
   if(path.startsWith('/admin/')&&!identity!.isOwner)return new Response(null,{status:403});
   if(request.method!=='GET')return new Response(null,{status:405});
   try{const usage=await checkUsage(env,identity!.sub,'search',false,identity!.isOwner);return Response.json(identity!.isOwner?usage:{remaining:usage.remaining,resetAt:usage.resetAt,limits:{userDaily:usage.limits.userDaily},allowed:usage.allowed,reason:usage.reason},{headers:{'Cache-Control':'no-store'}});}catch{return usageError();}
  }
  if(path==='/api/maps-key')return Response.json({error:'地図はEmbed版に移行しました。画面を再読み込みしてください。'},{status:410,headers:{'Cache-Control':'no-store'}});
  if(path==='/api/embed-key'){
   if(request.method!=='POST')return new Response(null,{status:405});
   if(!sameOrigin(request))return new Response(null,{status:403});
   if(!searchAccess)return Response.json({error:'Googleログインが必要です。'},{status:401});
   if(env.LIVE_SEARCH_ENABLED!=='true')return new Response(null,{status:503});
   if(!env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)return Response.json({error:'地図は準備中です。Google Mapsでご確認ください。'},{status:503});
   return Response.json({key:env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY},{headers:{'Cache-Control':'private, no-store'}});
  }
  if(path==='/api/photo'||path==='/admin/api/photo'){
   if(!searchAccess)return new Response(null,{status:401});
   if(path.startsWith('/admin/')&&!identity!.isOwner)return new Response(null,{status:403});
   return servePhoto(request,env,fetch,async()=>{try{return (await checkUsage(env,identity!.sub,'photo',true,identity!.isOwner)).allowed;}catch{return identity!.isOwner;}},identity!.isOwner);
  }
  if((path==='/api/search'||path==='/admin/api/search')&&request.method==='POST'){
   if(!sameOrigin(request))return Response.json({error:'このサイトの画面から検索してください。'},{status:403});
   try{
    if(Number(request.headers.get('Content-Length')??0)>4096)return new Response(null,{status:413});
    const raw=await request.clone().text();if(raw.length>4096)return new Response(null,{status:413});
    const input=parseInput(JSON.parse(raw));
    if(input.source!=='google')return Response.json({error:'デモ検索は終了しました。Googleログイン後に検索してください。'},{status:410});
    if(input.source==='google'){
     if(!searchAccess)return Response.json({error:'Googleログインが必要です。'},{status:401});
     if(path.startsWith('/admin/')&&!identity!.isOwner)return new Response(null,{status:403});
     if(env.LIVE_SEARCH_ENABLED!=='true')return Response.json({error:'検索は現在停止中です。'},{status:503});
     const store=await preferenceStore(env,identity!.sub);const prefsResponse=await store.fetch('https://usage.internal/preferences');if(!prefsResponse.ok)throw Error('Preferences unavailable');
     headers.set('x-kyou-excluded-places',JSON.stringify(excludedIds(await prefsResponse.json() as Preferences)));
     let usage=await checkUsage(env,identity!.sub,'search',true,identity!.isOwner,true);
     let ratingsApproved=usage.allowed;
     if(input.theme!=='highrated'&&!usage.allowed&&usage.reason==='評価付き検索の全体上限に達しました。条件に近い順で検索してください。'){usage=await checkUsage(env,identity!.sub,'search',true,identity!.isOwner,false);ratingsApproved=false;}
     headers.set('x-kyou-ratings-approved',ratingsApproved?'true':'false');
     if(!usage.allowed)return Response.json({error:usage.reason,remaining:usage.remaining,resetAt:usage.resetAt},{status:429,headers:{'Cache-Control':'no-store'}});
     headers.set('x-kyou-budget-approved','true');
    }
   }catch(error){if(error instanceof SyntaxError)return Response.json({error:'入力形式が正しくありません。'},{status:400});if(error instanceof Error&&'status' in error)return Response.json({error:error.message},{status:Number(error.status)});return usageError();}
  }
  if(path==='/admin/')return redirect('/admin');
  if(path==='/admin'||path.startsWith('/admin/')) {
   if(request.method!=='GET'&&request.method!=='HEAD'&&!sameOrigin(request))return new Response('送信元を確認できません。',{status:403});
   if(googleMode&&path==='/admin/google/start') {
    if(request.method!=='POST')return new Response(null,{status:405});
    if(!googleConfigured(env)||!env.LOGIN_LIMITER)return new Response('Googleログインは準備中です。',{status:503});
    if(!(await env.LOGIN_LIMITER.limit({key:'google-login:'+(request.headers.get('CF-Connecting-IP')??'unknown')})).success)return new Response('1分後に再度お試しください。',{status:429,headers:{'Retry-After':'60'}});
    const flow=await beginGoogleLogin(env,url.origin);return redirect(flow.url,flow.cookie);
   }
   if(googleMode&&path==='/admin/google/callback') {
    if(request.method!=='GET')return new Response(null,{status:405});
    try{const cookie=await finishGoogleLogin(request,env);const landing=env.PUBLIC_SEARCH_ENABLED==='true'?'/':'/admin';const response=new Response('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url='+landing+'"><title>ログイン完了</title><p>ログインしました。<a href="'+landing+'">アプリへ進む</a></p></html>',{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Set-Cookie':cookie,'Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'"}});response.headers.append('Set-Cookie',clearGoogleFlow);response.headers.set('Referrer-Policy','no-referrer');return response;}
    catch{const response=authPage('Google認証に失敗したか、現在許可されていないアカウントです。再度ログインしてください。',false,true,env.PUBLIC_SEARCH_ENABLED==='true');response.headers.append('Set-Cookie',clearGoogleFlow);return response;}
   }
   if(path==='/admin/login') {
    if(googleMode)return request.method==='GET'?authPage(googleConfigured(env)?'':'Googleログインは準備中です。',false,true,env.PUBLIC_SEARCH_ENABLED==='true'):new Response(null,{status:405});
    if(request.method==='GET')return authPage(configured(env)?'':'管理者パスワードは未設定です。');
    if(request.method!=='POST')return new Response(null,{status:405});
    if(!configured(env)||!env.LOGIN_LIMITER)return new Response('管理者認証は準備中です。',{status:503});
    const allowed=await env.LOGIN_LIMITER.limit({key:'login:'+(request.headers.get('CF-Connecting-IP')??'unknown')});
    if(!allowed.success)return new Response('試行回数が多すぎます。1分後に再度お試しください。',{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
    if(Number(request.headers.get('Content-Length')??0)>2048)return new Response(null,{status:413});
    const body=await request.text();if(body.length>2048)return new Response(null,{status:413});
    if(!await passwordMatches(new URLSearchParams(body).get('password')??'',env))return authPage('パスワードが違います。');
    return redirect('/admin',await sessionCookie(env,url.origin));
   }
   if(path==='/admin/logout') {
    if(request.method==='GET')return authPage('',true,googleMode);
    if(request.method==='POST')return redirect('/',googleMode?clearGoogleSession:expiredCookie);
    return new Response(null,{status:405});
   }
   if(!(googleMode?await googleAuthenticated(request,env):await authenticated(request,env)))return path.startsWith('/admin/api/')?new Response('管理者ログインが必要です。',{status:401,headers:{'Cache-Control':'no-store'}}):redirect('/admin/login');

   headers.set('oai-authenticated-user-id','password-owner');headers.set('oai-authenticated-user-email',env.LIVE_SEARCH_OWNER_EMAIL!);
  }
  const response=await handler.fetch(new Request(request,{headers}),env,ctx);
  if(!path.startsWith('/_next/')){const guarded=new Response(response.body,response);guarded.headers.set('Cache-Control','private, no-store');guarded.headers.append('Vary','Cookie');return guarded;}
  return response;
 }
};
