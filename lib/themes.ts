export type DestinationTheme = 'all' | 'tourism' | 'nature' | 'highrated' | 'reviews';
export const themeLabels: Record<DestinationTheme,string> = {all:'すべて',tourism:'観光・レジャー',nature:'自然・景色',highrated:'高評価',reviews:'レビュー数'};
const nature = ['park','national_park','beach','hiking_area','garden','botanical_garden','state_park','mountain_peak','scenic_spot','nature_preserve','observation_deck'];
const tourism = ['observation_deck','tourist_attraction','amusement_park','aquarium','zoo','museum','historical_landmark','cultural_landmark','shinto_shrine','buddhist_temple'];
const excludedNature = ['amusement_park','amusement_center','water_park','aquarium','zoo','museum'];
export type DiscoveryScope='focused'|'full';
export function discoveryTheme(theme:DestinationTheme='all',slot:number,page=0):DestinationTheme{
 return theme==='nature'||theme==='tourism'?theme:(Math.floor(slot/2)+page)%2===0?'nature':'tourism';
}
function canonical(type:string){return type.endsWith('_museum')?'museum':type;}
export function themeTypes(theme:DestinationTheme='all',scope:DiscoveryScope='full'){
 const types=theme==='nature'?nature:theme==='tourism'?tourism:[...new Set([...nature,...tourism])];
 // Dense everyday categories get a separate, bounded supplement query rather
 // than consuming the nearest 20 slots in all four discovery directions.
 return types.filter(t=>scope==='full'||!['park','garden','historical_landmark','shinto_shrine','buddhist_temple'].includes(t));
}
export function themeFilter(theme:DestinationTheme = 'all',scope:DiscoveryScope='full') {
  return {includedPrimaryTypes:themeTypes(theme,scope),...(theme==='nature'?{excludedTypes:excludedNature}:{})};
}
export function matchesTheme(types:string[]|undefined,theme:DestinationTheme = 'all',primaryType?:string) {
  if(theme === 'all'||theme==='highrated'||theme==='reviews') return true;
  if(!types) return false;
  if(primaryType){const primary=canonical(primaryType);return theme==='nature'?nature.includes(primary)&&!types.some(t=>excludedNature.includes(t)):tourism.includes(primary);}
  return theme==='tourism'&&!types.includes('park')&&types.some(t=>tourism.includes(t)&&t!=='tourist_attraction');
}
export function matchesDiscovery(types:string[]|undefined,theme:DestinationTheme,primaryType:string|undefined,scope:DiscoveryScope){
 return matchesTheme(types,theme,primaryType)&&(!primaryType||themeTypes(theme,scope).includes(canonical(primaryType)));
}
export function placeKind(place:{primaryType?:string}){
 const type=place.primaryType?canonical(place.primaryType):'';
 if(['park','state_park'].includes(type))return 'park';
 if(['garden','botanical_garden'].includes(type))return 'garden';
 if(['amusement_park','aquarium','zoo'].includes(type))return 'leisure';
 if(['museum','cultural_landmark'].includes(type))return 'culture';
 if(type==='historical_landmark')return 'heritage';
 if(['shinto_shrine','buddhist_temple'].includes(type))return 'worship';
 if(type==='tourist_attraction')return 'attraction';
 return nature.includes(type)?'landscape':'other';
}
export const kindLabels:Record<ReturnType<typeof placeKind>,string>={landscape:'海・山・景色',garden:'庭園',park:'公園',leisure:'レジャー',culture:'文化施設',heritage:'史跡',worship:'寺社',attraction:'観光名所',other:'その他'};

export function highlyRated(place:{rating?:number;userRatingCount?:number}){return (place.rating??0)>=4&&(place.userRatingCount??0)>=10;}
