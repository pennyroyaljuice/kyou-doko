'use client';
import { useEffect, useState } from 'react';
import type { SearchResult, Destination } from '@/lib/domain';
import {embedPlaceUrl} from '@/lib/embed-map';
export default function MapView({result,selected,onSelect,showDemo}:{result:SearchResult|null;selected:Destination|undefined;onSelect:(id:string)=>void;showDemo:boolean}) {
 const [key,setKey]=useState(''),[error,setError]=useState('');
 const live=result?.source==='google'&&!!selected;
 useEffect(()=>{
  if(!live||key)return;
  const controller=new AbortController();
  setError('');
  void fetch('/api/embed-key',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal}).then(async response=>{const data=await response.json() as {key?:string;error?:string};if(!response.ok||!data.key)throw Error(data.error??'地図を読み込めませんでした。Google Mapsでご確認ください。');setKey(data.key);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'地図を読み込めませんでした。');});
  return()=>controller.abort();
 },[live,key]);
 if(result?.source==='google')return !selected?<div className="map-waiting">候補を選ぶと目的地の位置を表示します。</div>:<div className="real-map embed-map">{key?<iframe title={selected.name+'の位置（Google Maps）'} src={embedPlaceUrl(key,selected)} width="100%" height="100%" style={{border:0}} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<div className="map-waiting" role="status">{error||'地図を読み込んでいます…'}</div>}<div className="embed-map-note">目的地の位置を表示しています。詳しい経路は外部ナビでご確認ください。</div></div>;
 if(!showDemo)return <div className="map-waiting">検索後に目的地の位置を表示します。</div>;
  const destinations=result?.destinations??[];
  const slots:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[530,290],[470,400],[170,150],[260,370],[440,320],[340,230],[320,190],[400,140]];
  const target=selected?slots[Math.max(0,destinations.findIndex(p=>p.id===selected.id))%8]:slots[0];
  return <div className="demo-map"><svg viewBox="0 0 700 530" role="img" aria-label="操作確認用の概念図。実際の位置・道路・経路を表していません。">
    <defs><pattern id="blocks" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><rect width="48" height="48" fill="#f0f0e7"/><path d="M0 0H48V48" fill="none" stroke="#fff" strokeWidth="6"/></pattern></defs>
    <rect width="700" height="530" fill="url(#blocks)"/>
    <path d="M480 245L520 263 540 310 525 350 555 380 546 412 585 440 610 530H700V270L630 247 590 270 550 230Z" fill="#bcd8df"/>
    <path d="M10 70 Q170 180 160 280T270 530M300 0Q280 180 400 215T495 380" fill="none" stroke="#c7dddf" strokeWidth="15"/>
    <path d="M20 95L150 160 195 137 250 170 320 145 370 180 440 160 520 200 650 170M70 440L170 320 265 330 315 270 400 300 450 370 600 400M200 0L230 100 270 180 360 240 420 330 445 530" stroke="#d9d5bc" strokeWidth="10" fill="none"/>
    <path d="M20 95L150 160 195 137 250 170 320 145 370 180 440 160 520 200 650 170M70 440L170 320 265 330 315 270 400 300 450 370 600 400M200 0L230 100 270 180 360 240 420 330 445 530" stroke="#fffbed" strokeWidth="6" fill="none"/>
    <g fill="#d0dfbd"><path d="M50 20L170 30 185 85 130 110 60 80Z"/><path d="M150 170L210 175 220 220 165 242 135 210Z"/><path d="M310 190L350 182 365 215 330 230Z"/><path d="M480 270L525 290 520 320 480 325Z"/><path d="M90 350L140 350 158 395 108 430 75 395Z"/></g>
    <g fill="#8f9b91" fontSize="14" fontFamily="sans-serif"><text x="195" y="295">世田谷</text><text x="280" y="110">新宿</text><text x="390" y="90">上野</text><text x="450" y="225">江東</text><text x="570" y="360" fill="#6c9aa5" letterSpacing="5">東京湾</text><text x="75" y="485">デモ概念図</text></g>
    {selected&&<><path d={`M355 250 Q390 230 ${target[0]-55} ${target[1]-30} T${target[0]} ${target[1]}`} fill="none" stroke="white" strokeWidth="10"/><path d={`M355 250 Q390 230 ${target[0]-55} ${target[1]-30} T${target[0]} ${target[1]}`} fill="none" stroke="#277f6c" strokeWidth="5" strokeDasharray="9 5"/></>}
    <circle cx="355" cy="250" r="12" fill="#254f47" stroke="white" strokeWidth="5"/><text x="370" y="256" fontSize="13" fill="#304e47">出発</text>
    {destinations.map((d,i)=>{const [x,y]=slots[i%8];return <g key={d.id} className="map-pin" role="button" tabIndex={0} aria-label={d.name} onClick={()=>onSelect(d.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(d.id);}}}><circle cx={x} cy={y} r={selected?.id===d.id?20:16} fill={selected?.id===d.id?'#db794b':'#fff'} stroke={selected?.id===d.id?'#fff':'#277f6c'} strokeWidth="3"/><text x={x} y={y+5} textAnchor="middle" fill={selected?.id===d.id?'#fff':'#277f6c'} fontSize="14" fontWeight="700">{i+1}</text></g>;})}
  </svg><div className="map-caption">DEMO MAP <span>実地図・実経路ではありません</span></div></div>;
}
