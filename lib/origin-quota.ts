import {usageDate} from './usage-policy';
export type OriginQuotaState={days:Record<string,{used:number;admin:number;users:Record<string,number>;minutes:Record<string,{bucket:number;count:number}>}>};
export const originQuota={userDaily:30,daily:100,rolling:1000,perMinute:12,windowDays:32} as const;
export function reserveOrigin(state:OriginQuotaState,subject:string,now:number,owner=false){
 const today=usageDate(now),cutoff=usageDate(now-(originQuota.windowDays-1)*86400000);
 for(const d of Object.keys(state.days))if(d<cutoff)delete state.days[d];
 const day=state.days[today]??{used:0,admin:0,users:{},minutes:{}};
 const rolling=Object.values(state.days).reduce((n,d)=>n+d.used,0),minute=Math.floor(now/60000),burst=day.minutes[subject];
 if(!owner&&((day.users[subject]??0)>=originQuota.userDaily||day.used>=originQuota.daily||rolling>=originQuota.rolling||burst?.bucket===minute&&burst.count>=originQuota.perMinute))return {allowed:false};
 if(owner)day.admin++;else{day.used++;day.users[subject]=(day.users[subject]??0)+1;day.minutes[subject]={bucket:minute,count:burst?.bucket===minute?burst.count+1:1};}
 state.days[today]=day;return {allowed:true};
}
