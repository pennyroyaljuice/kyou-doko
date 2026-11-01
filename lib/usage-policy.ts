export type UsageKind='search'|'photo'|'map';
export const usagePolicy={plan:'free',userDaily:5,searchDaily:40,searchRolling:400,ratingRolling:160,photoRolling:500,mapRolling:1000,windowDays:32} as const;
export type UsageDay={ratingSearch?:number;adminRatingSearch?:number;search:number;photo:number;map:number;users:Record<string,number>;reset?:{dailySearch?:number;rollingSearch?:number;photo?:number;users?:Record<string,number>};admin?:{search:number;photo:number;map:number}};
export type UsageState={days:Record<string,UsageDay>;adminSubjects?:string[];resetLog?:{at:number;actor:string;scope:string;subject?:string}[]};
export function usageDate(now:number){return new Date(now+9*3600000).toISOString().slice(0,10);}
export function decideUsage(state:UsageState,subject:string,kind:UsageKind,now:number,reserve:boolean,unlimited=false,includeRatings=false){
 const today=usageDate(now),cutoff=usageDate(now-(usagePolicy.windowDays-1)*86400000);
 for(const day of Object.keys(state.days))if(day<cutoff)delete state.days[day];
 // Existing search counts can be identified by account; split them once on owner access.
 if(unlimited&&!state.adminSubjects?.includes(subject)){
  for(const d of Object.values(state.days)){const previous=d.users[subject]??0;d.admin??={search:0,photo:0,map:0};d.admin.search+=previous;d.search=Math.max(0,d.search-previous);delete d.users[subject];}
  (state.adminSubjects??=[]).push(subject);
 }
 const day=state.days[today]??{search:0,photo:0,map:0,users:{}};
 const totals=Object.values(state.days).reduce((a,d)=>({search:a.search+d.search,photo:a.photo+d.photo,map:a.map+d.map}),{search:0,photo:0,map:0});
 const budgetUsage={dailySearch:Math.max(0,day.search-(day.reset?.dailySearch??0)),rollingSearch:Object.values(state.days).reduce((n,d)=>n+Math.max(0,d.search-(d.reset?.rollingSearch??0)),0),photo:Object.values(state.days).reduce((n,d)=>n+Math.max(0,d.photo-(d.reset?.photo??0)),0)};
 const userUsed=Math.max(0,(day.users[subject]??0)-(day.reset?.users?.[subject]??0));
 const ratingSearches=Object.values(state.days).reduce((n,d)=>n+(d.ratingSearch??0),0);
 const adminRatingSearches=Object.values(state.days).reduce((n,d)=>n+(d.adminRatingSearch??0),0);
 let reason='';
 if(!unlimited){
 if(kind==='search'&&userUsed>=usagePolicy.userDaily)reason=`本日の検索は${usagePolicy.userDaily}回までです。日本時間の0時に更新されます。`;
 else if(kind==='search'&&(budgetUsage.dailySearch>=usagePolicy.searchDaily||budgetUsage.rollingSearch>=usagePolicy.searchRolling))reason='サービス全体の無料利用上限に達しました。時間をおいてご利用ください。';
 else if(kind==='search'&&includeRatings&&ratingSearches>=usagePolicy.ratingRolling)reason='評価付き検索の全体上限に達しました。条件に近い順で検索してください。';
 else if(kind==='photo'&&budgetUsage.photo>=usagePolicy.photoRolling)reason='写真の利用上限に達しました。';
 else if(kind==='map'&&totals.map>=usagePolicy.mapRolling)reason='地図の利用上限に達しました。外部ナビをご利用ください。';
 }
 if(reserve&&!reason){if(kind==='search'&&includeRatings){if(unlimited)day.adminRatingSearch=(day.adminRatingSearch??0)+1;else day.ratingSearch=(day.ratingSearch??0)+1;}if(unlimited){day.admin??={search:0,photo:0,map:0};day.admin[kind]++;}else{day[kind]++;if(kind==='search')day.users[subject]=(day.users[subject]??0)+1;totals[kind]++;if(kind==='search'){budgetUsage.dailySearch++;budgetUsage.rollingSearch++;}if(kind==='photo')budgetUsage.photo++;}state.days[today]=day;}
 const adminRolling=Object.values(state.days).reduce((a,d)=>({search:a.search+(d.admin?.search??0),photo:a.photo+(d.admin?.photo??0),map:a.map+(d.admin?.map??0)}),{search:0,photo:0,map:0});
 return {ratingSearches:ratingSearches+(reserve&&!reason&&kind==='search'&&includeRatings&&!unlimited?1:0),adminRatingSearches:adminRatingSearches+(reserve&&!reason&&kind==='search'&&includeRatings&&unlimited?1:0),budgetUsage,accounts:unlimited?Object.entries(day.users).map(([id,searches])=>({id,searches,used:Math.max(0,searches-(day.reset?.users?.[id]??0))})):undefined,lastReset:unlimited?state.resetLog?.at(-1):undefined,unlimited,allowed:!reason,reason,date:today,resetAt:new Date(Date.parse(today+'T00:00:00+09:00')+86400000).toISOString(),remaining:unlimited?null:Math.max(0,usagePolicy.userDaily-Math.max(0,(day.users[subject]??0)-(day.reset?.users?.[subject]??0))),dailySearches:day.search,dailyAdminSearches:day.admin?.search??0,adminRolling,rolling:totals,limits:usagePolicy};
}

export type ResetScope='search'|'photo'|'account'|'accounts';
export function resetUsage(state:UsageState,scope:ResetScope,actor:string,now:number,subject?:string){
 if(!['search','photo','account','accounts'].includes(scope))throw Error('リセット対象が正しくありません。');
 const today=usageDate(now);
 if(scope==='account'&&(!subject||!state.days[today]?.users[subject]))throw Error('当日の利用があるアカウントを選んでください。');
 const cutoff=usageDate(now-(usagePolicy.windowDays-1)*86400000);
 for(const [date,day] of Object.entries(state.days)){
  if(date<cutoff)continue;
  day.reset??={};
  if(scope==='search'){day.reset.rollingSearch=day.search;if(date===today)day.reset.dailySearch=day.search;}
  if(scope==='photo')day.reset.photo=day.photo;
  if(date===today&&scope==='accounts')day.reset.users={...day.users};
  if(date===today&&scope==='account'){day.reset.users??={};day.reset.users[subject!]=day.users[subject!];}
 }
 state.resetLog=[...(state.resetLog??[]),{at:now,actor,scope,...(subject?{subject}:{})}].slice(-50);
}
