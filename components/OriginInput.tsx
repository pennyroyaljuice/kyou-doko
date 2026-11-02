'use client';
import {useEffect,useRef,useState} from 'react';
import type {OriginPrediction,OriginSelection} from '@/lib/origin-places';
export default function OriginInput({value,enabled,resolved,onChange,onSelect,onResolving}:{value:string;enabled:boolean;resolved:boolean;onChange:(value:string)=>void;onSelect:(place:OriginSelection)=>void;onResolving:(busy:boolean)=>void}){
 const [items,setItems]=useState<OriginPrediction[]>([]),[focused,setFocused]=useState(false),[composing,setComposing]=useState(false),[active,setActive]=useState(-1),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const session=useRef(''),version=useRef(0),selectionVersion=useRef(0);
 useEffect(()=>{
  const current=++version.current,controller=new AbortController();setItems([]);setActive(-1);setError('');setLoading(false);
  if(!enabled||!focused||resolved||composing||value.trim().length<2||/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(value))return;
  const timer=setTimeout(()=>{
   session.current||=crypto.randomUUID();setLoading(true);
   void fetch('/api/origin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'suggest',input:value,sessionToken:session.current}),signal:controller.signal}).then(async response=>{const data=await response.json() as {error?:string;suggestions?:OriginPrediction[]} & Partial<OriginSelection>;if(!response.ok)throw Error(data.error??'候補を取得できませんでした。');if(version.current===current){setItems(data.suggestions??[]);setError(data.suggestions?.length?'':'候補が見つかりません。手入力でも検索できます。');}}).catch(e=>{if(!controller.signal.aborted&&version.current===current)setError(e instanceof Error?e.message:'候補を取得できませんでした。');}).finally(()=>{if(version.current===current)setLoading(false);});
  },450);
  return()=>{clearTimeout(timer);controller.abort();};
 },[value,enabled,focused,resolved,composing]);
 async function choose(item:OriginPrediction){
  const current=++selectionVersion.current;version.current++;setFocused(false);setItems([]);setError('');setLoading(false);onResolving(true);
  try{const response=await fetch('/api/origin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'select',...item,sessionToken:session.current}),signal:AbortSignal.timeout(15000)});const data=await response.json() as {error?:string;suggestions?:OriginPrediction[]} & Partial<OriginSelection>;if(!response.ok)throw Error(data.error??'地点を確認できませんでした。');if(selectionVersion.current===current)onSelect(data as OriginSelection);}
  catch(e){if(selectionVersion.current===current)setError(e instanceof Error?e.message:'地点を確認できませんでした。');}
  finally{if(selectionVersion.current===current){session.current='';onResolving(false);}}
 }
 const open=focused&&!resolved&&(items.length>0||loading||!!error);
 return <div className="origin-autocomplete">
  <input id="origin" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="origin-options" aria-activedescendant={active>=0?'origin-option-'+active:undefined} aria-describedby={error?'origin-input-error':undefined} autoComplete="off" value={value} placeholder="駅名・住所（空欄なら現在地）" maxLength={200} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onCompositionStart={()=>setComposing(true)} onCompositionEnd={()=>setComposing(false)} onChange={e=>{version.current++;selectionVersion.current++;setFocused(true);if(!e.target.value)session.current='';onChange(e.target.value);}} onKeyDown={e=>{
   if(composing||e.nativeEvent.isComposing)return;
   if(e.key==='ArrowDown'&&items.length){e.preventDefault();setFocused(true);setActive(i=>(i+1)%items.length);}
   if(e.key==='ArrowUp'&&items.length){e.preventDefault();setFocused(true);setActive(i=>i<0?items.length-1:(i-1+items.length)%items.length);}
   if(e.key==='Escape'){e.preventDefault();setFocused(false);setActive(-1);}
   if(e.key==='Enter'&&open&&active>=0){e.preventDefault();void choose(items[active]);}
  }}/>
  {open&&<div className="origin-menu"><div id="origin-options" role="listbox" aria-label="出発地点の候補">{items.map((p,i)=><button key={p.id} id={'origin-option-'+i} type="button" role="option" tabIndex={-1} aria-selected={active===i} onPointerDown={e=>e.preventDefault()} onClick={()=>void choose(p)}><strong>{p.name}</strong><span>{p.address}</span></button>)}</div>{loading&&<p role="status">候補を探しています…</p>}{error&&<p id="origin-input-error" role="status">{error}</p>}<div className="origin-attribution">Google Maps</div></div>}
  {!open&&error&&<span id="origin-input-error" className="origin-inline-error" role="status">{error}</span>}
 </div>;
}
