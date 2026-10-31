import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
export type AccessEnvironment = { CF_ACCESS_TEAM_DOMAIN?:string; CF_ACCESS_AUD?:string; LIVE_SEARCH_OWNER_EMAIL?:string; LIVE_SEARCH_OWNER_USER_ID?:string };
const keysets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export async function validateAccessToken(token:string|undefined,env:AccessEnvironment,keys?:JWTVerifyGetKey) {
  const issuer=env.CF_ACCESS_TEAM_DOMAIN?.replace(/\/$/,'');
  if(!token||!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!env.CF_ACCESS_AUD||!env.LIVE_SEARCH_OWNER_EMAIL)return null;
  try {
    if(!keys){if(!keysets.has(issuer))keysets.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'),{timeoutDuration:5000}));keys=keysets.get(issuer)!;}
    const {payload}=await jwtVerify(token,keys,{issuer,audience:env.CF_ACCESS_AUD,algorithms:['RS256'],requiredClaims:['sub','email','exp','iss','aud']});
    if(typeof payload.sub!=='string'||typeof payload.email!=='string')return null;
    if(payload.email.toLowerCase()!==env.LIVE_SEARCH_OWNER_EMAIL.trim().toLowerCase())return null;
    if(env.LIVE_SEARCH_OWNER_USER_ID&&payload.sub!==env.LIVE_SEARCH_OWNER_USER_ID)return null;
    return {id:payload.sub,email:payload.email};
  }catch{return null;}
}
export function sanitizedHeaders(request:Request) {
  const headers=new Headers(request.headers);
  for(const name of [...headers.keys()])if(name.startsWith('oai-authenticated-user-')||name.startsWith('x-kyou-'))headers.delete(name);
  return headers;
}
