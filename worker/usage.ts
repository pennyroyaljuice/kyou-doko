import {emptyPreferences,updatePreferences,type Preferences} from '../lib/preferences';
import {decideUsage,resetUsage,type ResetScope,type UsageKind,type UsageState} from '../lib/usage-policy';
export class UsageBudget {
 constructor(private state:DurableObjectState){}
 async fetch(request:Request){
  if(new URL(request.url).pathname==='/reset'){
   if(request.method!=='POST')return new Response(null,{status:405});
   try{const body=await request.json() as {scope:ResetScope;actor:string;subject?:string};if(!/^[a-f0-9]{64}$/.test(body.actor)||body.subject&&!/^[a-f0-9]{64}$/.test(body.subject))return new Response(null,{status:400});await this.state.storage.transaction(async tx=>{const state=await tx.get<UsageState>('usage')??{days:{}};resetUsage(state,body.scope,body.actor,Date.now(),body.subject);await tx.put('usage',state);});return Response.json({ok:true});}catch(e){return Response.json({error:e instanceof Error?e.message:'リセットできませんでした。'},{status:400});}
  }
  if(new URL(request.url).pathname==='/preferences'){
   if(request.method==='GET')return Response.json(await this.state.storage.get<Preferences>('preferences')??emptyPreferences());
   if(request.method!=='POST')return new Response(null,{status:405});
   try{const body=await request.json();const result=await this.state.storage.transaction(async tx=>{const next=updatePreferences(await tx.get<Preferences>('preferences')??emptyPreferences(),body);await tx.put('preferences',next);return next;});return Response.json(result);}catch(e){return Response.json({error:e instanceof Error?e.message:'保存できませんでした。'},{status:400});}
  }
  const body=await request.json() as {subject:string;kind:UsageKind;reserve:boolean;unlimited?:boolean};
  if(!/^[a-f0-9]{64}$/.test(body.subject)||!['search','photo','map'].includes(body.kind)||typeof body.reserve!=='boolean')return new Response(null,{status:400});
  const result=await this.state.storage.transaction(async tx=>{const state=await tx.get<UsageState>('usage')??{days:{}};const result=decideUsage(state,body.subject,body.kind,Date.now(),body.reserve,body.unlimited===true);await tx.put('usage',state);return result;});
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
export async function checkUsage(env:UsageEnvironment,sub:string,kind:UsageKind,reserve:boolean,unlimited=false){
 if(!env.USAGE_BUDGET)throw Error('Usage budget unavailable');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('google:'+sub));const subject=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const response=await env.USAGE_BUDGET.get(env.USAGE_BUDGET.idFromName('global-v1')).fetch('https://usage.internal/',{method:'POST',body:JSON.stringify({subject,kind,reserve,unlimited})});
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
