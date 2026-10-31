import { SignJWT, jwtVerify } from 'jose';
export type PasswordEnvironment = { ADMIN_PASSWORD_HASH?:string; ADMIN_SESSION_SECRET?:string; LIVE_SEARCH_OWNER_EMAIL?:string; LOGIN_LIMITER?:{limit(input:{key:string}):Promise<{success:boolean}>} };
const name='__Host-kyou-admin', encoder=new TextEncoder();
export async function passwordHash(password:string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(password)))].map(v=>v.toString(16).padStart(2,'0')).join(''); }
export function configured(env:PasswordEnvironment) { return Boolean(env.ADMIN_PASSWORD_HASH?.match(/^[a-f0-9]{64}$/)&&env.ADMIN_SESSION_SECRET&&env.ADMIN_SESSION_SECRET.length>=32&&env.LIVE_SEARCH_OWNER_EMAIL); }
export async function passwordMatches(password:string,env:PasswordEnvironment) {
 if(!configured(env)||password.length>256)return false;
 const actual=await passwordHash(password);let diff=0;
 for(let i=0;i<64;i++)diff|=actual.charCodeAt(i)^env.ADMIN_PASSWORD_HASH!.charCodeAt(i);
 return diff===0;
}
export async function sessionCookie(env:PasswordEnvironment,origin:string) {
 const token=await new SignJWT({version:env.ADMIN_PASSWORD_HASH}).setProtectedHeader({alg:'HS256'}).setSubject('password-owner').setIssuer(origin).setAudience('kyou-admin').setIssuedAt().setExpirationTime('8h').sign(encoder.encode(env.ADMIN_SESSION_SECRET));
 return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}
export const expiredCookie=`${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function authenticated(request:Request,env:PasswordEnvironment) {
 if(!configured(env))return false;
 const token=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
 if(!token)return false;
 try {const {payload}=await jwtVerify(token,encoder.encode(env.ADMIN_SESSION_SECRET),{issuer:new URL(request.url).origin,audience:'kyou-admin',algorithms:['HS256'],requiredClaims:['exp','iat','sub']});return payload.sub==='password-owner'&&payload.version===env.ADMIN_PASSWORD_HASH;}catch{return false;}
}
export function sameOrigin(request:Request){return request.headers.get('Origin')===new URL(request.url).origin;}
export function authPage(message='',logout=false,google=false,publicLogin=false) {
 // Only fixed application strings may be interpolated, never request input.
 return new Response(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${publicLogin?'Googleログイン':'管理者ログイン'} | 今日どこ行く？</title><style>body{font:16px system-ui;background:#f5f7f6;color:#18392e;margin:0;padding:24px}main{max-width:360px;margin:12vh auto;background:white;padding:28px;border-radius:16px}h1{font-size:23px}label,input,button{display:block;box-sizing:border-box;width:100%;margin:16px 0}input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #b7c9bf}button{background:#176b51;color:white;cursor:pointer}a{color:#176b51}p{line-height:1.7}</style><main><a href="/">今日どこ行く？</a><h1>${logout?'ログアウト':publicLogin?'Googleログイン':'管理者ログイン'}</h1><p>${message||(logout?'この端末のログイン状態を解除します。':(google?publicLogin?'無料版は1日5回まで検索できます（日本時間0時更新）。利用規約・プライバシーポリシーをご確認のうえGoogleアカウントでログインしてください。':'許可されたGoogleアカウントでログインしてください。':'実検索を利用するには管理者パスワードを入力してください。'))}</p><form method="post" action="/admin/${logout?'logout':google?'google/start':'login'}">${logout||google?'':'<label for="password">パスワード</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256">'}<button>${logout?'ログアウトする':google?'Googleでログイン':'ログイン'}</button></form><a href="/">公開デモに戻る</a><p><a href="/terms">利用規約</a> · <a href="/privacy">プライバシーポリシー</a></p></main></html>`,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'",'Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'}});
}

