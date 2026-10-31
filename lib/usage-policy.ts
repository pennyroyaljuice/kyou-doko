export type UsageKind='search'|'photo'|'map';
export const usagePolicy={plan:'free',userDaily:5,searchDaily:20,searchRolling:200,photoRolling:500,mapRolling:1000,windowDays:32} as const;
export type UsageDay={search:number;photo:number;map:number;users:Record<string,number>};
export type UsageState={days:Record<string,UsageDay>};
export function usageDate(now:number){return new Date(now+9*3600000).toISOString().slice(0,10);}
export function decideUsage(state:UsageState,subject:string,kind:UsageKind,now:number,reserve:boolean,unlimited=false){
 const today=usageDate(now),cutoff=usageDate(now-(usagePolicy.windowDays-1)*86400000);
 for(const day of Object.keys(state.days))if(day<cutoff)delete state.days[day];
 const day=state.days[today]??{search:0,photo:0,map:0,users:{}};
 const totals=Object.values(state.days).reduce((a,d)=>({search:a.search+d.search,photo:a.photo+d.photo,map:a.map+d.map}),{search:0,photo:0,map:0});
 let reason='';
 if(!unlimited){
 if(kind==='search'&&(day.users[subject]??0)>=usagePolicy.userDaily)reason=`本日の検索は${usagePolicy.userDaily}回までです。日本時間の0時に更新されます。`;
 else if(kind==='search'&&(day.search>=usagePolicy.searchDaily||totals.search>=usagePolicy.searchRolling))reason='サービス全体の無料利用上限に達しました。時間をおいてご利用ください。';
 else if(kind==='photo'&&totals.photo>=usagePolicy.photoRolling)reason='写真の利用上限に達しました。';
 else if(kind==='map'&&totals.map>=usagePolicy.mapRolling)reason='地図の利用上限に達しました。外部ナビをご利用ください。';
 }
 if(reserve&&!reason){day[kind]++;if(kind==='search')day.users[subject]=(day.users[subject]??0)+1;state.days[today]=day;totals[kind]++;}
 return {unlimited,allowed:!reason,reason,date:today,resetAt:new Date(Date.parse(today+'T00:00:00+09:00')+86400000).toISOString(),remaining:unlimited?null:Math.max(0,usagePolicy.userDaily-(day.users[subject]??0)),dailySearches:day.search,rolling:totals,limits:usagePolicy};
}
