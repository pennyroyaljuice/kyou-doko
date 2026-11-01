export type DestinationTheme = 'all' | 'tourism' | 'nature' | 'highrated' | 'reviews';
export const themeLabels: Record<DestinationTheme,string> = {all:'すべて',tourism:'観光・レジャー',nature:'自然・景色',highrated:'高評価',reviews:'レビュー数'};
const nature = ['park','national_park','beach','hiking_area','garden','botanical_garden','state_park','mountain_peak','scenic_spot','nature_preserve'];
const tourism = ['observation_deck','tourist_attraction','amusement_park','aquarium','zoo','museum','historical_landmark','cultural_landmark','shinto_shrine','buddhist_temple'];
const excludedNature = ['amusement_park','amusement_center','water_park','aquarium','zoo','museum'];
export function themeFilter(theme:DestinationTheme = 'all') {
  return theme === 'nature' ? {includedPrimaryTypes:nature,excludedTypes:excludedNature} : {includedTypes:theme === 'tourism' ? tourism : [...new Set([...nature,...tourism])]};
}
export function matchesTheme(types:string[]|undefined,theme:DestinationTheme = 'all',primaryType?:string) {
  if(theme === 'all'||theme==='highrated'||theme==='reviews') return true;
  if(!types) return false;
  return theme === 'nature' ? !!primaryType && nature.includes(primaryType) && !types.some(t=>excludedNature.includes(t)) : types.some(t=>tourism.includes(t));
}

export function highlyRated(place:{rating?:number;userRatingCount?:number}){return (place.rating??0)>=4&&(place.userRatingCount??0)>=10;}
