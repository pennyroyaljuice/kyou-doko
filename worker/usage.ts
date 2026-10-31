import {decideUsage,type UsageKind,type UsageState} from '../lib/usage-policy';
export class UsageBudget {
 constructor(private state:DurableObjectState){}
 async fetch(request:Request){
  const body=await request.json() as {subject:string;kind:UsageKind;reserve:boolean};
  if(!/^[a-f0-9]{64}$/.test(body.subject)||!['search','photo','map'].includes(body.kind)||typeof body.reserve!=='boolean')return new Response(null,{status:400});
  const result=await this.state.storage.transaction(async tx=>{const state=await tx.get<UsageState>('usage')??{days:{}};const result=decideUsage(state,body.subject,body.kind,Date.now(),body.reserve);await tx.put('usage',state);return result;});
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
export async function checkUsage(env:UsageEnvironment,sub:string,kind:UsageKind,reserve:boolean){
 if(!env.USAGE_BUDGET)throw Error('Usage budget unavailable');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('google:'+sub));const subject=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const response=await env.USAGE_BUDGET.get(env.USAGE_BUDGET.idFromName('global-v1')).fetch('https://usage.internal/',{method:'POST',body:JSON.stringify({subject,kind,reserve})});
 if(!response.ok)throw Error('Usage budget unavailable');
 return response.json() as Promise<ReturnType<typeof decideUsage>>;
}
