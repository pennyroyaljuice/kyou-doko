import { createRemoteJWKSet, EncryptJWT, jwtDecrypt, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose';
export type GoogleAuthEnvironment={GOOGLE_OAUTH_CLIENT_ID?:string;GOOGLE_OAUTH_CLIENT_SECRET?:string;ADMIN_SESSION_SECRET?:string;LIVE_SEARCH_OWNER_EMAIL?:string;GOOGLE_OWNER_SUB?:string;PUBLIC_SEARCH_ENABLED?:string;ADMIN_AUTH_MODE?:string};
const encoder=new TextEncoder(),sessionName='__Host-kyou-google',flowName='__Host-kyou-oauth';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const cookie=(name:string,value:string,age:number,lax=false)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${lax?'Lax':'Strict'}; Max-Age=${age}`;
export const clearGoogleSession=cookie(sessionName,'',0);
export const clearGoogleFlow=cookie(flowName,'',0,true);
const readCookie=(request:Request,name:string)=>request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const key=async(env:GoogleAuthEnvironment)=>new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(env.ADMIN_SESSION_SECRET)));
const random=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');};
export const googleConfigured=(env:GoogleAuthEnvironment)=>Boolean(env.GOOGLE_OAUTH_CLIENT_ID?.endsWith('.apps.googleusercontent.com')&&env.GOOGLE_OAUTH_CLIENT_SECRET&&env.ADMIN_SESSION_SECRET&&env.ADMIN_SESSION_SECRET.length>=32&&env.LIVE_SEARCH_OWNER_EMAIL);
const version=(env:GoogleAuthEnvironment)=>[env.GOOGLE_OAUTH_CLIENT_ID,env.LIVE_SEARCH_OWNER_EMAIL?.toLowerCase(),env.GOOGLE_OWNER_SUB??''].join('|');
export async function beginGoogleLogin(env:GoogleAuthEnvironment,origin:string){
 if(!googleConfigured(env))throw Error('Google login not configured');
 const state=random(),nonce=random(),verifier=random();
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
 const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
 const token=await new EncryptJWT({state,nonce,verifier}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuer(origin).setAudience('kyou-oauth-flow').setIssuedAt().setExpirationTime('10m').encrypt(await key(env));
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:env.GOOGLE_OAUTH_CLIENT_ID!,redirect_uri:origin+'/admin/google/callback',response_type:'code',scope:'openid email',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
 return {url:url.toString(),cookie:cookie(flowName,token,600,true)};
}
export async function validateGoogleIdentity(token:string,nonce:string,env:GoogleAuthEnvironment,keys:JWTVerifyGetKey=jwks){
 const {payload}=await jwtVerify(token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_OAUTH_CLIENT_ID,algorithms:['RS256'],requiredClaims:['sub','email','email_verified','exp','iat','nonce']});
 if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.sub!=='string'||typeof payload.email!=='string'||(env.PUBLIC_SEARCH_ENABLED!=='true'&&payload.email.toLowerCase()!==env.LIVE_SEARCH_OWNER_EMAIL?.trim().toLowerCase())||(payload.email.toLowerCase()===env.LIVE_SEARCH_OWNER_EMAIL?.trim().toLowerCase()&&env.GOOGLE_OWNER_SUB&&payload.sub!==env.GOOGLE_OWNER_SUB)||(payload.azp&&payload.azp!==env.GOOGLE_OAUTH_CLIENT_ID))throw Error('Owner identity mismatch');
 return {sub:payload.sub,email:payload.email};
}
export async function finishGoogleLogin(request:Request,env:GoogleAuthEnvironment,fetcher:typeof fetch=fetch,keys?:JWTVerifyGetKey){
 if(!googleConfigured(env))throw Error('Google login not configured');
 const url=new URL(request.url),token=readCookie(request,flowName);if(!token||url.searchParams.has('error'))throw Error('Missing login flow');
 const {payload}=await jwtDecrypt(token,await key(env),{issuer:url.origin,audience:'kyou-oauth-flow',requiredClaims:['exp','iat']});
 if(typeof payload.state!=='string'||payload.state!==url.searchParams.get('state')||typeof payload.nonce!=='string'||typeof payload.verifier!=='string')throw Error('Login state mismatch');
 const code=url.searchParams.get('code');if(!code||code.length>4096)throw Error('Missing authorization code');
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_OAUTH_CLIENT_ID!,client_secret:env.GOOGLE_OAUTH_CLIENT_SECRET!,code,code_verifier:payload.verifier,grant_type:'authorization_code',redirect_uri:url.origin+'/admin/google/callback'}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Google token exchange failed');
 const data=await response.json() as {id_token?:string};if(!data.id_token)throw Error('Missing identity token');
 const identity=await validateGoogleIdentity(data.id_token,payload.nonce,env,keys);
 // Access/refresh tokens are never retained. Only the app's own short-lived session is issued.
 const session=await new SignJWT({email:identity.email,version:version(env)}).setProtectedHeader({alg:'HS256'}).setSubject(identity.sub).setIssuer(url.origin).setAudience('kyou-google-admin').setIssuedAt().setExpirationTime('8h').sign(await key(env));
 return cookie(sessionName,session,28800);
}
export async function googleSessionIdentity(request:Request,env:GoogleAuthEnvironment){
 if(!googleConfigured(env))return null;
 const token=readCookie(request,sessionName);if(!token)return null;
 try{const {payload}=await jwtVerify(token,await key(env),{issuer:new URL(request.url).origin,audience:'kyou-google-admin',algorithms:['HS256'],requiredClaims:['exp','iat','sub','email']});if(payload.version!==version(env)||typeof payload.sub!=='string'||typeof payload.email!=='string')return null;const owner=payload.email.toLowerCase()===env.LIVE_SEARCH_OWNER_EMAIL?.trim().toLowerCase()&&(!env.GOOGLE_OWNER_SUB||payload.sub===env.GOOGLE_OWNER_SUB);return owner||env.PUBLIC_SEARCH_ENABLED==='true'?{sub:payload.sub,email:payload.email,isOwner:owner}:null;}catch{return null;}
}

export async function googleAuthenticated(request:Request,env:GoogleAuthEnvironment){return (await googleSessionIdentity(request,env))?.isOwner===true;}
