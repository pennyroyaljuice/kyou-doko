'use client';
import { useEffect, useState } from 'react';
import type { SearchResult, Destination } from '@/lib/domain';
import {embedPlaceUrl} from '@/lib/embed-map';
export default function MapView({result,selected,onSelect}:{result:SearchResult|null;selected:Destination|undefined;onSelect:(id:string)=>void}) {
 const [key,setKey]=useState(''),[error,setError]=useState('');
 const live=result?.source==='google'&&!!selected;
 useEffect(()=>{
  if(!live||key)return;
  const controller=new AbortController();
  setError('');
  void fetch('/api/embed-key',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal}).then(async response=>{const data=await response.json() as {key?:string;error?:string};if(!response.ok||!data.key)throw Error(data.error??'地図を読み込めませんでした。Google Mapsでご確認ください。');setKey(data.key);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'地図を読み込めませんでした。');});
  return()=>controller.abort();
 },[live,key]);
 if(result?.source==='google')return !selected?<div className="map-waiting">候補を選ぶと目的地の位置を表示します。</div>:<div className="real-map embed-map">{key?<iframe title={selected.name+'の位置（Google Maps）'} src={embedPlaceUrl(key,selected)} width="100%" height="100%" style={{border:0}} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<div className="map-waiting" role="status">{error||'地図を読み込んでいます…'}</div>}<div className="embed-map-note">目的地の位置を表示しています。詳しい場所情報は外部地図でご確認ください。</div></div>;
 return <div className="map-waiting">検索後に目的地の位置を表示します。</div>;
}
