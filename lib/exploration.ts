import {distance,radius,type Point,type SearchInput,type Place} from './domain';
export function explorationFraction(input:SearchInput){return input.metric==='distance'?(input.mode==='DRIVE'?0.6:0.65):0.78;}
// Offset searches prevent a city's most popular central attractions taking every slot.
export function explorationAreas(origin:Point,input:SearchInput) {
 const page=input.explorationPage??0,rotation=page*Math.PI*(3-Math.sqrt(5));
 const reach=radius(input),lat=origin.lat*Math.PI/180,lng=origin.lng*Math.PI/180;
 return [0,Math.PI/2,Math.PI,Math.PI*1.5].map((baseBearing,index)=>{
 const bearing=baseBearing+rotation;
 const fraction=(input.mode==='DRIVE'?explorationFraction(input):index%2===0?Math.min(0.6,explorationFraction(input)):0.3)*(page%3===1?0.85:page%3===2?0.95:1);
 const angular=reach*fraction/6371000;
 const phi=Math.asin(Math.sin(lat)*Math.cos(angular)+Math.cos(lat)*Math.sin(angular)*Math.cos(bearing));
 const lambda=lng+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(lat),Math.cos(angular)-Math.sin(lat)*Math.sin(phi));
 return {center:{lat:phi*180/Math.PI,lng:((lambda*180/Math.PI+540)%360)-180},radius:Math.max(100,Math.min(50000,reach*(input.mode==='DRIVE'?0.3:0.35)))};
 });
}
export function explorationCandidates(groups:Place[][],origin:Point,input:SearchInput,limit=8):Place[] {
 const reach=radius(input),target=reach*explorationFraction(input);
 const lists=groups.map(group=>group.filter(p=>distance(origin,p.point)<=reach && (input.metric!=='distance'||distance(origin,p.point)*(input.roundTrip?2:1)<=input.budget*1000)).sort((a,b)=>Math.abs(distance(origin,a.point)-target)-Math.abs(distance(origin,b.point)-target)));
 const selected:Place[]=[],seen=new Set<string>();
 while(selected.length<limit){let added=false;for(const list of lists){let p:Place|undefined;while((p=list.shift())&&seen.has(p.id)){}if(p){seen.add(p.id);selected.push(p);added=true;if(selected.length===limit)break;}}if(!added)break;}
 return selected;
}
