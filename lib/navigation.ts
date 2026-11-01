import type { Mode, Point, Place } from './domain';
const coord = (p:Point)=>`${p.lat},${p.lng}`;
export function googleMapsUrl(origin:Point,destination:Point,mode:Mode,waypoints:Point[]=[],avoidHighways=false) {
  const q = new URLSearchParams({api:'1',origin:coord(origin),destination:coord(destination),travelmode:{DRIVE:'driving',TRANSIT:'transit',BICYCLE:'bicycling',WALK:'walking'}[mode]});
  if (mode === 'DRIVE' && avoidHighways) q.set('avoid','highways');
  if (waypoints.length && mode !== 'TRANSIT') q.set('waypoints',waypoints.slice(0,3).map(coord).join('|'));
  return `https://www.google.com/maps/dir/?${q}`;
}
export function yahooUrl(destination:Point,name:string) {
  return `yjcarnavi://navi/select?${new URLSearchParams({lat:String(destination.lat),lon:String(destination.lng),name})}`;
}

export function yahooRouteUrl(origin:Point|'current',destination:Point,name:string,originName='出発地点',waypoints:{point:Point;name:string}[]=[]) {
  if(waypoints.length>3) throw new Error('Yahoo!カーナビの経由地は3件までです。');
  const q=new URLSearchParams();
  q.append('point',origin==='current'?'current':coord(origin)+','+originName);
  for(const via of waypoints)q.append('point',coord(via.point)+','+via.name);
  q.append('point',coord(destination)+','+name);
  return 'yjcarnavi://navi/select?'+q;
}

export function googlePlaceUrl(place:Pick<Place,'id'|'name'|'description'>){
 const q=new URLSearchParams({api:'1',query:[place.name,place.description].filter(Boolean).join(' ')});if(place.id)q.set('query_place_id',place.id);return 'https://www.google.com/maps/search/?'+q;
}
export function yahooPlaceUrl(place:Pick<Place,'name'|'description'>){return 'https://map.yahoo.co.jp/search?'+new URLSearchParams({q:[place.name,place.description].filter(Boolean).join(' ')});}
