import { beginGoogleLogin, finishGoogleLogin, googleAuthenticated, googleConfigured, clearGoogleFlow, clearGoogleSession, type GoogleAuthEnvironment } from '../lib/google-auth';
import handler from 'vinext/server/fetch-handler';
import { sanitizedHeaders } from '../lib/cloudflare-auth';
import { authenticated, authPage, configured, expiredCookie, passwordMatches, sameOrigin, sessionCookie, type PasswordEnvironment } from '../lib/password-auth';
const redirect=(location:string,cookie?:string)=>new Response(null,{status:303,headers:{Location:location,'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export default {
 async fetch(request:Request,env:Cloudflare.Env&PasswordEnvironment&GoogleAuthEnvironment,ctx:ExecutionContext) {
  const url=new URL(request.url),path=url.pathname,headers=sanitizedHeaders(request),googleMode=env.ADMIN_AUTH_MODE==='google';
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
    try{const cookie=await finishGoogleLogin(request,env);const response=redirect('/admin',cookie);response.headers.append('Set-Cookie',clearGoogleFlow);response.headers.set('Referrer-Policy','no-referrer');return response;}
    catch{const response=authPage('Google認証に失敗したか、管理者として許可されていないアカウントです。再度ログインしてください。',false,true);response.headers.append('Set-Cookie',clearGoogleFlow);return response;}
   }
   if(path==='/admin/login') {
    if(googleMode)return request.method==='GET'?authPage(googleConfigured(env)?'':'Googleログインは準備中です。',false,true):new Response(null,{status:405});
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
