'use client';
import { useEffect, useRef, useState } from 'react';
import type { SearchResult, Destination, Point } from '@/lib/domain';
let load:Promise<void>|undefined;
function loadMaps(apiKey:string) {
  if (load) return load;
  load = new Promise((resolve,reject)=>{
    const w = window as typeof window & { initKyouMaps?:()=>void; gm_authFailure?:()=>void };
    w.initKyouMaps=()=>resolve(); w.gm_authFailure=()=>{window.dispatchEvent(new Event('kyou-maps-auth-error'));reject(new Error('地図の認証に失敗しました。キーの制限・課金設定を確認してください。'));};
    const script=document.createElement('script');
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry&callback=initKyouMaps&loading=async&language=ja&v=quarterly`;
    script.async=true; script.onerror=()=>reject(new Error('地図を読み込めませんでした。通信・ブラウザーキーを確認してください。'));
    document.head.appendChild(script);
  });
  return load;
}
export default function MapView({result,selected,onSelect,mapsApiKey,showDemo}:{result:SearchResult|null;selected:Destination|undefined;onSelect:(id:string)=>void;mapsApiKey:string;showDemo:boolean}) {
  const root=useRef<HTMLDivElement>(null), map=useRef<google.maps.Map|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    if (result?.source!=='google') {map.current=null;return;}
    let disposed=false; const overlays:(google.maps.Marker|google.maps.Polyline)[]=[];
    const authFailure=()=>{if(!disposed)setError('地図の認証に失敗しました。キーの制限・課金設定を確認してください。');};
    window.addEventListener('kyou-maps-auth-error',authFailure);
    const timeout=setTimeout(()=>{if(!disposed)setError('地図の読み込みに時間がかかっています。通信・キー設定を確認してください。');},15000);
    loadMaps(mapsApiKey).then(()=>{
      if(disposed||!root.current) return;
      clearTimeout(timeout); setError('');
      // Reuse the map across selections to avoid additional map loads.
      const instance=map.current?.getDiv()===root.current?map.current:new google.maps.Map(root.current,{center:result.origin,zoom:11,mapTypeControl:false,streetViewControl:false,fullscreenControl:false}); map.current=instance;
      const bounds=new google.maps.LatLngBounds();
      const marker=(p:Point,label:string,title:string,id?:string)=>{
        const m=new google.maps.Marker({map:instance,position:p,label,title}); overlays.push(m); bounds.extend(p);
        if(id)m.addListener('click',()=>onSelect(id));
      };
      marker(result.origin,'S',result.originLabel);
      result.destinations.forEach((p,i)=>marker(p.point,String(i+1),p.name,p.id));
      if(selected) [selected.outbound,selected.inbound].forEach((leg,i)=>{
        if(!leg?.polyline)return;
        const path=google.maps.geometry.encoding.decodePath(leg.polyline);
        const line=new google.maps.Polyline({map:instance,path,strokeColor:i?'#e49a52':'#197364',strokeOpacity:0.85,strokeWeight:i?4:6}); overlays.push(line);path.forEach(p=>bounds.extend(p));
      });
      instance.fitBounds(bounds,60);
    }).catch((e:Error)=>{if(!disposed){clearTimeout(timeout);setError(e.message);}});
    return ()=>{disposed=true;clearTimeout(timeout);overlays.forEach(o=>o.setMap(null));window.removeEventListener('kyou-maps-auth-error',authFailure);};
  },[result,selected,onSelect,mapsApiKey]);
  if(result?.source==='google') return <div className="real-map"><div ref={root} className="google-canvas" aria-label="Google Mapsの目的地と推奨ルート"/>{error&&<div className="map-error" role="alert">{error}</div>}</div>;
  if(!showDemo) return <div className="map-waiting">検索後に目的地と経路を表示します。</div>;
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
