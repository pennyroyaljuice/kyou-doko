import { SignJWT, jwtVerify } from 'jose';
const encoder=new TextEncoder();
const validName=(name:string)=>/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)&&name.length<4096;
export async function photoTicket(name:string,secret:string){
 if(!validName(name)||secret.length<32)return undefined;
 return new SignJWT({photo:name}).setProtectedHeader({alg:'HS256'}).setAudience('kyou-place-photo').setIssuedAt().setExpirationTime('30m').sign(encoder.encode(secret));
}
export type PhotoEnvironment={ADMIN_SESSION_SECRET?:string;GOOGLE_MAPS_API_KEY?:string;LIVE_SEARCH_ENABLED?:string;PHOTO_LIMITER?:{limit(input:{key:string}):Promise<{success:boolean}>}};
const error=(status:number,reason="photo unavailable")=>new Response(reason+" ("+status+")",{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Called only after the Worker's owner authentication. Never accept arbitrary upstream URLs.
export async function servePhoto(request:Request,env:PhotoEnvironment,fetcher:typeof fetch=fetch){
 if(request.method!=='GET')return error(405);
 if(env.LIVE_SEARCH_ENABLED!=='true'||!env.GOOGLE_MAPS_API_KEY||!env.PHOTO_LIMITER)return error(503);
 const token=new URL(request.url).searchParams.get('ticket');if(!token||token.length>8192)return error(400);
 let name:string;
 try{const {payload}=await jwtVerify(token,encoder.encode(env.GOOGLE_MAPS_API_KEY),{audience:'kyou-place-photo',algorithms:['HS256'],requiredClaims:['exp','iat']});if(typeof payload.photo!=='string'||!validName(payload.photo))return error(400);name=payload.photo;}catch{return error(403);}
 if(!(await env.PHOTO_LIMITER.limit({key:'photo:'+(request.headers.get('CF-Connecting-IP')??'unknown')})).success)return error(429);
 try{
  const url=new URL('https://places.googleapis.com/v1/'+name+'/media');url.search=new URLSearchParams({maxWidthPx:'240',maxHeightPx:'180',skipHttpRedirect:'true'}).toString();
  const metadata=await fetcher(url,{headers:{'X-Goog-Api-Key':env.GOOGLE_MAPS_API_KEY},cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(!metadata.ok)return error(502,"photo metadata "+metadata.status);
  const data=await metadata.json() as {photoUri?:string};if(!data.photoUri)return error(502);
  const imageUrl=new URL(data.photoUri);
  if(imageUrl.protocol!=='https:'||!(imageUrl.hostname==='googleusercontent.com'||imageUrl.hostname.endsWith('.googleusercontent.com')))return error(502);
  const image=await fetcher(imageUrl,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(10000)});
  const type=image.headers.get('Content-Type')??'';
  if(!image.ok||!/^image\/(jpeg|png|webp|gif)(;|$)/i.test(type))return error(502,"photo image "+image.status+" "+type);
  return new Response(image.body,{headers:{'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }catch(e){return error(502,e instanceof Error ? 'photo transport '+e.name+' '+(/cache/i.test(e.message)?'cache':/request|scope/i.test(e.message)?'scope':/redirect/i.test(e.message)?'redirect':'unknown') : 'photo transport');}
}

