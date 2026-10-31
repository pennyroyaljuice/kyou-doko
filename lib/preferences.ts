export type PlacePreference='visited'|'uninterested';
export type Preferences={excludeVisited:boolean;places:Record<string,PlacePreference>};
export const emptyPreferences=():Preferences=>({excludeVisited:true,places:{}});
export function excludedIds(p:Preferences){return Object.keys(p.places).filter(id=>p.places[id]==='uninterested'||p.excludeVisited);}
export function updatePreferences(current:Preferences,body:unknown):Preferences{
 const b=body as {id?:unknown;kind?:unknown;excludeVisited?:unknown};
 if(!b||typeof b!=='object')throw Error('入力が正しくありません。');
 const next={excludeVisited:current.excludeVisited,places:{...current.places}};
 if(typeof b.excludeVisited==='boolean'){next.excludeVisited=b.excludeVisited;return next;}
 if(typeof b.id!=='string'||! /^[A-Za-z0-9_-]{10,200}$/.test(b.id)||!['visited','uninterested','remove'].includes(String(b.kind)))throw Error('入力が正しくありません。');
 if(b.kind==='remove')delete next.places[b.id];else {if(!next.places[b.id]&&Object.keys(next.places).length>=500)throw Error('保存は500件までです。不要な記録を解除してください。');next.places[b.id]=b.kind as PlacePreference;}
 return next;
}
