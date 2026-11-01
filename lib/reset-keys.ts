import {resetUsage,type UsageState,usageDate} from './usage-policy';
export type ResetKeys={keys:Record<string,{expires:number;created:number;used?:number}>;attempts:Record<string,{date:string;count:number}>};
export async function keyHash(key:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key.trim().toUpperCase().replace(/-/g,'')));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function cleanKeys(store:ResetKeys,now:number){for(const [k,v] of Object.entries(store.keys))if(v.expires<=now)delete store.keys[k];for(const [k,v] of Object.entries(store.attempts))if(v.date!==usageDate(now))delete store.attempts[k];}
export function redeemKey(store:ResetKeys,usage:UsageState,hash:string,subject:string,now:number){
 cleanKeys(store,now);const attempt=store.attempts[subject]??={date:usageDate(now),count:0};if(attempt.count>=10)return {ok:false,error:'本日のキー入力上限に達しました。'};attempt.count++;
 const key=store.keys[hash];if(!key||key.used!==undefined)return {ok:false,error:'キーが無効、使用済み、または期限切れです。'};
 if(usage.days[usageDate(now)]?.users[subject])resetUsage(usage,'account',subject,now,subject);key.used=now;return {ok:true};
}
