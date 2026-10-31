import type { Mode, Point } from './domain';
const coord = (p:Point)=>`${p.lat},${p.lng}`;
export function googleMapsUrl(origin:Point,destination:Point,mode:Mode,waypoints:Point[]=[]) {
  const q = new URLSearchParams({api:'1',origin:coord(origin),destination:coord(destination),travelmode:{DRIVE:'driving',TRANSIT:'transit',BICYCLE:'bicycling',WALK:'walking'}[mode]});
  if (waypoints.length && mode !== 'TRANSIT') q.set('waypoints',waypoints.slice(0,3).map(coord).join('|'));
  return `https://www.google.com/maps/dir/?${q}`;
}
export function yahooUrl(destination:Point,name:string) {
  return `yjcarnavi://navi/select?${new URLSearchParams({lat:String(destination.lat),lon:String(destination.lng),name})}`;
}
