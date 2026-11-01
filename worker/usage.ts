import {cleanKeys,keyHash,redeemKey,type ResetKeys} from '../lib/reset-keys';
import {emptyPreferences,updatePreferences,type Preferences} from '../lib/preferences';
import {decideUsage,resetUsage,type ResetScope,type UsageKind,type UsageState} from '../lib/usage-policy';
export class UsageBudget {
 constructor(private state:DurableObjectState){}
 async fetch(request:Request){
  if(['/keys/issue','/keys/redeem'].includes(new URL(request.url).pathname)){
   if(request.method!=='POST')return new Response(null,{status:405});
   try{const body=await request.json() as {subject:string;code?:string};if(!/^[a-f0-9]{64}$/.test(body.subject))return new Response(null,{status:400});const issue=new URL(request.url).pathname==='/keys/issue',now=Date.now();
    const code=issue?[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{8}/g)!.join('-'):body.code??'';
    if(!issue&&!/^[a-fA-F0-9-]{32,40}$/.test(code.trim()))return Response.json({error:'キーの形式が正しくありません。'},{status:400});
    const hash=await keyHash(code);const result=await this.state.storage.transaction(async tx=>{const store=await tx.get<ResetKeys>('reset-keys')??{keys:{},attempts:{}};cleanKeys(store,now);
     if(issue){if(Object.keys(store.keys).length>=200)return {ok:false,error:'発行上限に達しました。期限切れ後に再度お試しください。'};store.keys[hash]={created:now,expires:now+7*86400000};await tx.put('reset-keys',store);return {ok:true,code,expires:now+7*86400000};}
     const usage=await tx.get<UsageState>('usage')??{days:{}};const result=redeemKey(store,usage,hash,body.subject,now);await tx.put('reset-keys',store);await tx.put('usage',usage);return result;});return Response.json(result,{status:result.ok?200:400,headers:{'Cache-Control':'no-store'}});
   }catch{return Response.json({error:'キーを処理できませんでした。'},{status:400});}
  }
  if(new URL(request.url).pathname==='/reset'){

   if(request.method!=='POST')return new Response(null,{status:405});
   try{const body=await request.json() as {scope:ResetScope;actor:string;subject?:string};if(!/^[a-f0-9]{64}$/.test(body.actor)||body.subject&&!/^[a-f0-9]{64}$/.test(body.subject))return new Response(null,{status:400});await this.state.storage.transaction(async tx=>{const state=await tx.get<UsageState>('usage')??{days:{}};resetUsage(state,body.scope,body.actor,Date.now(),body.subject);await tx.put('usage',state);});return Response.json({ok:true});}catch(e){return Response.json({error:e instanceof Error?e.message:'リセットできませんでした。'},{status:400});}
  }
  if(new URL(request.url).pathname==='/preferences'){
   if(request.method==='GET')return Response.json(await this.state.storage.get<Preferences>('preferences')??emptyPreferences());
   if(request.method!=='POST')return new Response(null,{status:405});
   try{const body=await request.json();const result=await this.state.storage.transaction(async tx=>{const next=updatePreferences(await tx.get<Preferences>('preferences')??emptyPreferences(),body);await tx.put('preferences',next);return next;});return Response.json(result);}catch(e){return Response.json({error:e instanceof Error?e.message:'保存できませんでした。'},{status:400});}
  }
  const body=await request.json() as {subject:string;kind:UsageKind;reserve:boolean;unlimited?:boolean;includeRatings?:boolean};
  if(!/^[a-f0-9]{64}$/.test(body.subject)||!['search','photo','map'].includes(body.kind)||typeof body.reserve!=='boolean')return new Response(null,{status:400});
  const result=await this.state.storage.transaction(async tx=>{const state=await tx.get<UsageState>('usage')??{days:{}};const result=decideUsage(state,body.subject,body.kind,Date.now(),body.reserve,body.unlimited===true,body.includeRatings===true);await tx.put('usage',state);return result;});
  if(!await this.state.storage.getAlarm())await this.state.storage.setAlarm(Date.now()+86400000);
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }
 async alarm(){
  const state=await this.state.storage.get<UsageState>('usage');if(!state)return;
  decideUsage(state,'cleanup','search',Date.now(),false);
  if(Object.keys(state.days).length){await this.state.storage.put('usage',state);await this.state.storage.setAlarm(Date.now()+86400000);}else await this.state.storage.delete('usage');
 }
}
export type UsageEnvironment={USAGE_BUDGET?:DurableObjectNamespace};
export async function checkUsage(env:UsageEnvironment,sub:string,kind:UsageKind,reserve:boolean,unlimited=false,includeRatings=false){
 if(!env.USAGE_BUDGET)throw Error('Usage budget unavailable');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('google:'+sub));const subject=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const response=await env.USAGE_BUDGET.get(env.USAGE_BUDGET.idFromName('global-v1')).fetch('https://usage.internal/',{method:'POST',body:JSON.stringify({subject,kind,reserve,unlimited,includeRatings})});
 if(!response.ok)throw Error('Usage budget unavailable');
 return response.json() as Promise<ReturnType<typeof decideUsage>>;
}

export async function preferenceStore(env:UsageEnvironment,sub:string){
 if(!env.USAGE_BUDGET)throw Error('Preferences unavailable');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('google:'+sub));
 const id=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 return env.USAGE_BUDGET.get(env.USAGE_BUDGET.idFromName('preferences-v1:'+id));
}

export async function resetBudget(env:UsageEnvironment,sub:string,scope:ResetScope,subject?:string){
 if(!env.USAGE_BUDGET)throw Error('Usage budget unavailable');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('google:'+sub));const actor=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
 return env.USAGE_BUDGET.get(env.USAGE_BUDGET.idFromName('global-v1')).fetch('https://usage.internal/reset',{method:'POST',body:JSON.stringify({scope,subject,actor})});
}

export async function resetKeyRequest(env:UsageEnvironment,sub:string,issue:boolean,code?:string){if(!env.USAGE_BUDGET)throw Error('Usage budget unavailable');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('google:'+sub));const subject=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');return env.USAGE_BUDGET.get(env.USAGE_BUDGET.idFromName('global-v1')).fetch('https://usage.internal/keys/'+(issue?'issue':'redeem'),{method:'POST',body:JSON.stringify({subject,code})});}
