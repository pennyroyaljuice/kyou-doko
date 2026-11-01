import {distance,radius,type Point,type SearchInput,type Place} from './domain';
export function explorationFraction(input:SearchInput){return input.metric==='distance'?(input.mode==='DRIVE'?0.6:0.65):0.78;}
// Offset searches prevent a city's most popular central attractions taking every slot.
export function explorationAreas(origin:Point,input:SearchInput) {
 const page=input.explorationPage??0,rotation=page*Math.PI*(3-Math.sqrt(5));
 const reach=radius(input),lat=origin.lat*Math.PI/180,lng=origin.lng*Math.PI/180;
 return [0,Math.PI/2,Math.PI,Math.PI*1.5].map((baseBearing,index)=>{
 const bearing=baseBearing+Math.PI/4+rotation;
 const fraction=(input.mode==='DRIVE'?explorationFraction(input)*(index%2===0?0.78:1):index%2===0?Math.min(0.6,explorationFraction(input)):0.3)*(page%3===1?0.85:page%3===2?0.95:1);
 const angular=reach*fraction/6371000;
 const phi=Math.asin(Math.sin(lat)*Math.cos(angular)+Math.cos(lat)*Math.sin(angular)*Math.cos(bearing));
 const lambda=lng+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(lat),Math.cos(angular)-Math.sin(lat)*Math.sin(phi));
 return {center:{lat:phi*180/Math.PI,lng:((lambda*180/Math.PI+540)%360)-180},radius:Math.max(100,Math.min(50000,reach*0.75))};
 });
}
export function explorationCandidates(groups:Place[][],origin:Point,input:SearchInput,limit=8):Place[] {
 const reach=radius(input),target=reach*explorationFraction(input);
 const lists=groups.map(group=>group.filter(p=>distance(origin,p.point)<=reach && (input.metric!=='distance'||distance(origin,p.point)*(input.roundTrip?2:1)<=input.budget*1000)).sort((a,b)=>Math.abs(distance(origin,a.point)-target)-Math.abs(distance(origin,b.point)-target)));
 const selected:Place[]=[],seen=new Set<string>();
 while(selected.length<limit){let added=false;for(const list of lists){let p:Place|undefined;while((p=list.shift())&&seen.has(p.id)){}if(p){seen.add(p.id);selected.push(p);added=true;if(selected.length===limit)break;}}if(!added)break;}
 return selected;
}

// Bearings are grouped around the actual origin, independent of discovery query tiles.
export function directionSector(origin:Point,point:Point){
 if(distance(origin,point)<100)return 8;
 const rad=Math.PI/180,dl=(point.lng-origin.lng)*rad;
 const y=Math.sin(dl)*Math.cos(point.lat*rad),x=Math.cos(origin.lat*rad)*Math.sin(point.lat*rad)-Math.sin(origin.lat*rad)*Math.cos(point.lat*rad)*Math.cos(dl);
 return Math.floor(((Math.atan2(y,x)*180/Math.PI+382.5)%360)/45);
}
export function geographicOrder<T extends Place>(places:T[],origin:Point,compare:(a:T,b:T)=>number,selected:Place[]=[],attempts:number[]=[],quality?:(p:T)=>number):T[]{
 const groups=Array.from({length:9},()=>[] as T[]),counts=Array(9).fill(0) as number[],tried=Array.from({length:9},(_,i)=>attempts[i]??0);
 for(const p of selected)counts[directionSector(origin,p.point)]++;
 for(const p of places)groups[directionSector(origin,p.point)].push(p);
 for(const group of groups)group.sort((a,b)=>(quality?quality(a)-quality(b):0)||compare(a,b));
 const result:T[]=[];
 while(result.length<places.length){const available=groups.map((g,i)=>g.length?i:-1).filter(i=>i>=0);if(!available.length)break;
  available.sort((a,b)=>(quality?quality(groups[a][0])-quality(groups[b][0]):0)||counts[a]-counts[b]||tried[a]-tried[b]||compare(groups[a][0],groups[b][0])||a-b);
  const sector=available[0];result.push(groups[sector].shift()!);counts[sector]++;tried[sector]++;
 }
 return result;
}

export function pointAlongBearing(origin:Point,toward:Point,meters:number):Point{
 const rad=Math.PI/180,lat=origin.lat*rad,lng=origin.lng*rad,other=toward.lat*rad,dl=(toward.lng-origin.lng)*rad;
 const bearing=Math.atan2(Math.sin(dl)*Math.cos(other),Math.cos(lat)*Math.sin(other)-Math.sin(lat)*Math.cos(other)*Math.cos(dl)),angular=meters/6371000;
 const phi=Math.asin(Math.sin(lat)*Math.cos(angular)+Math.cos(lat)*Math.sin(angular)*Math.cos(bearing));
 const lambda=lng+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(lat),Math.cos(angular)-Math.sin(lat)*Math.sin(phi));
 return {lat:phi/rad,lng:((lambda/rad+540)%360)-180};
}
