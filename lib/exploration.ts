import {distance,radius,type Point,type SearchInput,type Place} from './domain';
// Offset searches prevent a city's most popular central attractions taking every slot.
export function explorationAreas(origin:Point,input:SearchInput) {
 const reach=radius(input),offset=reach*0.78,angular=offset/6371000,lat=origin.lat*Math.PI/180,lng=origin.lng*Math.PI/180;
 return [0,Math.PI/2,Math.PI,Math.PI*1.5].map(bearing=>{
 const phi=Math.asin(Math.sin(lat)*Math.cos(angular)+Math.cos(lat)*Math.sin(angular)*Math.cos(bearing));
 const lambda=lng+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(lat),Math.cos(angular)-Math.sin(lat)*Math.sin(phi));
 return {center:{lat:phi*180/Math.PI,lng:((lambda*180/Math.PI+540)%360)-180},radius:Math.max(100,Math.min(50000,reach*0.3))};
 });
}
export function explorationCandidates(groups:Place[][],origin:Point,input:SearchInput):Place[] {
 const reach=radius(input),target=reach*0.78;
 const lists=groups.map(group=>group.filter(p=>distance(origin,p.point)<=reach && (input.metric!=='distance'||distance(origin,p.point)*(input.roundTrip?2:1)<=input.budget*1000)).sort((a,b)=>Math.abs(distance(origin,a.point)-target)-Math.abs(distance(origin,b.point)-target)));
 const selected:Place[]=[],seen=new Set<string>();
 while(selected.length<8){let added=false;for(const list of lists){let p:Place|undefined;while((p=list.shift())&&seen.has(p.id)){}if(p){seen.add(p.id);selected.push(p);added=true;if(selected.length===8)break;}}if(!added)break;}
 return selected;
}
