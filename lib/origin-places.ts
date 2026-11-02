import {AppError,isPoint,type Point} from './domain';
export type OriginPrediction={id:string;name:string;address:string};
export type OriginSelection={point:Point;label:string;address:string};
export function parseOriginRequest(raw:unknown){
 if(!raw||typeof raw!=='object')throw new AppError('入力内容を確認してください。');
 const x=raw as Record<string,unknown>;
 if(typeof x.sessionToken!=='string'||!/^[-a-zA-Z0-9_]{16,36}$/.test(x.sessionToken))throw new AppError('入力候補のセッションが無効です。入力し直してください。');
 if(x.action==='suggest'&&typeof x.input==='string'&&x.input.trim().length>=2&&x.input.length<=200)return {action:'suggest' as const,input:x.input.trim(),sessionToken:x.sessionToken};
 if(x.action==='select'&&typeof x.id==='string'&&/^[-a-zA-Z0-9_]{5,256}$/.test(x.id)&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=200&&typeof x.address==='string'&&x.address.length<=500)return {action:'select' as const,id:x.id,name:x.name,address:x.address,sessionToken:x.sessionToken};
 throw new AppError('入力候補の内容を確認してください。');
}
export async function originPlaces(raw:ReturnType<typeof parseOriginRequest>,key:string,fetcher:typeof fetch=fetch):Promise<{suggestions:OriginPrediction[]}|OriginSelection>{
 const base='https://places.googleapis.com/v1/places';
 const response=await fetcher(raw.action==='suggest'?base+':autocomplete':base+'/'+encodeURIComponent(raw.id)+'?sessionToken='+encodeURIComponent(raw.sessionToken),{
  method:raw.action==='suggest'?'POST':'GET',headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':raw.action==='suggest'?'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat':'id,location',...(raw.action==='suggest'?{'Content-Type':'application/json'}:{})},
  ...(raw.action==='suggest'?{body:JSON.stringify({input:raw.input,sessionToken:raw.sessionToken,languageCode:'ja',regionCode:'jp',includedRegionCodes:['jp'],locationBias:{rectangle:{low:{latitude:20,longitude:122},high:{latitude:46,longitude:154}}},includeQueryPredictions:false})}:{}),cache:'no-store',signal:AbortSignal.timeout(10000)
 }).catch(()=>{throw new AppError('入力候補を取得できませんでした。手入力でも検索できます。',502);});
 if(!response.ok)throw new AppError(response.status===429?'入力候補の利用上限に達しました。手入力でも検索できます。':'入力候補を取得できませんでした。手入力でも検索できます。',response.status===429?429:502);
 if(raw.action==='suggest'){
  const data=await response.json() as {suggestions?:{placePrediction?:{placeId?:string;structuredFormat?:{mainText?:{text?:string};secondaryText?:{text?:string}}}}[]};
  return {suggestions:(data.suggestions??[]).flatMap(s=>{const p=s.placePrediction,name=p?.structuredFormat?.mainText?.text;return p?.placeId&&name?[{id:p.placeId,name,address:p.structuredFormat?.secondaryText?.text??''}]:[]}).slice(0,5)};
 }
 const data=await response.json() as {id?:string;location?:{latitude:number;longitude:number}};
 const point={lat:data.location?.latitude,lng:data.location?.longitude};
 if(data.id!==raw.id||!isPoint(point))throw new AppError('選択した地点の位置を確認できませんでした。別の候補を選んでください。',422);
 return {point,label:raw.name,address:raw.address};
}
