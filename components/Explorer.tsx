'use client';
import ResetKey from './ResetKey';
import {mergeResults} from '@/lib/merge-results';
import { useCallback, useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, Bike, Car, Check, Clock3, Compass, Footprints, Leaf, LocateFixed, Map, MapPin, Mountain, Navigation, RefreshCw, Route, SlidersHorizontal, Waves, X } from 'lucide-react';
import {sortDestinations,type Mode,type Point,type SearchInput,type SearchResult } from '@/lib/domain';
import { themeLabels, type DestinationTheme } from '@/lib/themes';
import { googleMapsUrl } from '@/lib/navigation';
import PlacePreferences,{usePlacePreferences} from './PlacePreferences';
import AdminUsage from './AdminUsage';
import MapView from './MapView';
import DestinationCard from './DestinationCard';
import YahooNavigation from './YahooNavigation';
import { getCurrentLocation } from '@/lib/location';
const modes = [{id:'DRIVE',name:'車',icon:Car},{id:'BICYCLE',name:'自転車',icon:Bike},{id:'WALK',name:'徒歩',icon:Footprints}] as const;
const minutes=(s:number)=>`${Math.ceil(s/60)}分`;
const km=(m:number)=>`${(m/1000).toFixed(1)} km`;
export default function Explorer({liveAvailable,liveAccess,signedIn,isOwner=false,publicEnabled=false}:{liveAvailable:boolean;liveAccess:boolean;signedIn:boolean;isOwner?:boolean;publicEnabled?:boolean}) {
  const source:SearchInput['source']='google';
  const [origin,setOrigin]=useState(''),[gps,setGps]=useState<Point|null>(null);
  const [gpsAccuracy,setGpsAccuracy]=useState<number|null>(null);
  const [mode,setMode]=useState<Mode>('DRIVE'),[metric,setMetric]=useState<'time'|'distance'>('time'),[budget,setBudget]=useState('120'),[roundTrip,setRoundTrip]=useState(true);
  const listRef=useRef<HTMLDivElement>(null);
  const [resultSort,setResultSort]=useState<'budget'|'rating'>('budget');
  const [theme,setTheme]=useState<DestinationTheme>('all');
  const [avoidHighways,setAvoidHighways]=useState(false);
  const [adding,setAdding]=useState(false),[additionalMessage,setAdditionalMessage]=useState('');
  const [result,setResult]=useState<SearchResult|null>(null),[selectedId,setSelectedId]=useState(''),[view,setView]=useState<'list'|'map'>('list'),[busy,setBusy]=useState(false),[locating,setLocating]=useState(false),[error,setError]=useState('');
  const [usage,setUsage]=useState<{remaining:number|null;resetAt:string;allowed?:boolean;reason?:string;rolling?:{search:number;photo:number;map:number};dailySearches?:number;dailyAdminSearches?:number;adminRolling?:{search:number;photo:number;map:number}}|null>(null);
  const refreshUsage=useCallback(async()=>{if(!signedIn)return;try{const response=await fetch('/api/usage');if(response.ok)setUsage(await response.json());}catch{}},[signedIn]);
  useEffect(()=>{void refreshUsage();},[refreshUsage]);
  useEffect(()=>{if(!usage)return;const timer=setTimeout(()=>void refreshUsage(),Math.max(1000,Date.parse(usage.resetAt)-Date.now()+1000));return()=>clearTimeout(timer);},[usage,refreshUsage]);
  const {prefs,saving:prefSaving,error:prefError,save:savePreference}=usePlacePreferences(signedIn);
  const searchBlocked=source==='google'&&!isOwner&&!!usage&&(usage.remaining===0||usage.allowed===false);
  const blockedReason=usage?.reason||(usage?.remaining===0?'本日の検索上限に達しました。日本時間の0時に更新されます。':'サービス全体の利用上限に達しました。');
  const displayed=result?sortDestinations(result.destinations,result.input,resultSort):[];
  const selected=result?.destinations.find(d=>d.id===selectedId);
  const onSelect=useCallback((id:string)=>setSelectedId(id),[]);
  const reset=()=>{setResult(null);setSelectedId('');setError('');setAdditionalMessage('');};
  async function locate() {
    if(!liveAccess)return;
    reset();setLocating(true);
    if(gps)setOrigin('');
    setGps(null);setGpsAccuracy(null);
    try {
      const location=await getCurrentLocation(navigator.geolocation,window.isSecureContext);
      setGps(location.point);setGpsAccuracy(location.accuracy);
      setOrigin(location.point.lat.toFixed(5)+', '+location.point.lng.toFixed(5));
    } catch(e) {setError(e instanceof Error?e.message:'現在地を取得できませんでした。出発地点を手入力してください。');}
    finally {setLocating(false);}
  }
  async function submit(append=false) {
    if(busy)return;
    const previous=append?result:null;
    if(append&&!previous)return;
    if(source==='google'&&!liveAccess){setError('検索にはGoogleログインが必要です。');return;}
    if(source==='google'&&!liveAvailable){setError('通常検索の設定が必要です。設定手順を確認してください。');return;}
    setBusy(true);setAdding(append);setError('');setAdditionalMessage('');if(!append)setResult(null);
    const input:SearchInput=previous?{...previous.input,origin:previous.origin,seenPlaceIds:previous.destinations.map(d=>d.id),explorationPage:(previous.input.explorationPage??0)+1}:{theme,source,origin:gps??origin,mode,metric,budget:Number(budget),roundTrip,avoidHighways:mode==='DRIVE'&&avoidHighways};
    try {
      const response=await fetch(isOwner?'/admin/api/search':'/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(120000)});
      const data=await response.json() as SearchResult & {error?:string};
      if(!response.ok)throw new Error(data.error??'検索に失敗しました。');
      if(previous){const merged=mergeResults(previous,data);const added=merged.destinations.length-previous.destinations.length;setResult(merged);setSelectedId(current=>current||merged.destinations[0]?.id||'');setAdditionalMessage(added?added+'件追加しました。':'条件内の新しい候補は見つかりませんでした。');}
      else{setResult(data);setResultSort(data.input.theme==='highrated'?'rating':'budget');setSelectedId(data.destinations[0]?.id??'');}
    } catch(e) {setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'検索がタイムアウトしました。時間をあけて再試行してください。');}
    finally {setBusy(false);setAdding(false);void refreshUsage();}
  }
  function shuffle() {
    if(!result||result.destinations.length<2)return;
    const current=displayed.findIndex(d=>d.id===selectedId);
    setSelectedId(displayed[(current+1)%displayed.length].id);
  }
  return <>
    <header className="site-header"><a className="brand" href="/"><img className="brand-logo" src="/brand-logo.png" alt="ココからドコへ？" width="300" height="100"/></a><div className="header-right"><span className="edition">{isOwner?'管理者':signedIn?'無料アカウント':'未ログイン'}</span>{signedIn?<a className="account-link" href="/admin/logout" target="_top">ログアウト</a>:<a className="account-link" href={publicEnabled?'/login':'/admin/'} target="_top">{publicEnabled?'Googleでログイン':'管理者ログイン'}</a>}</div></header>
    <main>
      <section className="search-panel" aria-labelledby="search-heading">
        <div className="panel-top"><h1 id="search-heading"><SlidersHorizontal size={17}/>検索条件</h1></div>
        <form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy||locating}><div className="conditions">
          <div className="condition origin-condition"><label htmlFor="origin"><span className="step">01</span>出発地点</label><div className="input-box"><MapPin size={18}/><input id="origin" value={origin} placeholder="駅名・住所・緯度,経度" onChange={e=>{reset();setGps(null);setGpsAccuracy(null);setOrigin(e.target.value);}} required maxLength={200}/><button type="button" className="gps" onClick={()=>void locate()} disabled={!liveAccess} aria-label="現在地を取得" title={liveAccess?'位置情報を許可して現在地を取得':'Googleログインが必要です'}><LocateFixed size={18}/><span>現在地</span></button></div><small>{locating?'現在地を取得しています…':gps?'現在地を取得済み'+(gpsAccuracy!==null&&Number.isFinite(gpsAccuracy)?'（精度目安 ±'+Math.ceil(gpsAccuracy)+'m）':''):'位置情報が使えない場合は手入力できます'}</small></div>
          <div className="condition"><label><span className="step">02</span>移動手段</label><div className="transport">{modes.map(m=><button key={m.id} type="button" aria-pressed={mode===m.id} onClick={()=>{reset();setMode(m.id);}}><m.icon size={23}/><span>{m.name}</span></button>)}</div>{mode==='DRIVE'&&<div className="highway-option"><label htmlFor="use-highways"><input id="use-highways" type="checkbox" checked={!avoidHighways} onChange={e=>{reset();setAvoidHighways(!e.target.checked);}}/>高速道路を利用する</label></div>}</div>
          <div className="condition budget-condition"><div className="label-line"><label htmlFor="budget"><span className="step">03</span>移動時間・距離</label><div className="metric-switch"><button type="button" aria-pressed={metric==='time'} onClick={()=>{reset();setMetric('time');setBudget('120');}}>時間</button><button type="button" aria-pressed={metric==='distance'} onClick={()=>{reset();setMetric('distance');setBudget('50');}}>距離</button></div></div><div className="budget-line"><input id="budget" type="number" min={metric==='time'?5:1} max={metric==='time'?480:300} step="any" value={budget} onChange={e=>{reset();setBudget(e.target.value);}} required/><span>{metric==='time'?'分':'km'}以内</span></div></div>
          <div className="condition trip-condition"><label><span className="step">04</span>移動区分</label><div className="trip-switch"><button type="button" aria-pressed={!roundTrip} onClick={()=>{reset();setRoundTrip(false);}}>片道 <ArrowRight size={15}/></button><button type="button" aria-pressed={roundTrip} onClick={()=>{reset();setRoundTrip(true);}}>往復 <RefreshCw size={14}/></button></div></div>
        </div><div className="search-actions"><div className="destination-preference"><label><span className="step">05</span>目的地の種類</label><div className="theme-switch" role="group" aria-label="目的地の種類">{(Object.keys(themeLabels) as DestinationTheme[]).map(t=><button key={t} type="button" aria-pressed={theme===t} onClick={()=>{reset();setTheme(t);}}>{themeLabels[t]}</button>)}</div><small>{theme==='highrated'?'星4.0以上・口コミ10件以上':theme==='nature'?'山・海・渓谷・公園など':theme==='tourism'?'名所・テーマパーク・文化施設・寺社など':'種類を絞らずに探します'}</small></div><div className="search-bottom"><button className="search-button" type="submit" disabled={source==='google'&&(!liveAvailable||searchBlocked)} aria-describedby={searchBlocked?'search-blocked-reason':undefined}>{busy?<><RefreshCw size={19} className="spin"/>探しています…</>:searchBlocked?<>検索上限に達しました</>:<>調べる <ArrowRight size={19}/></>}</button></div></div></fieldset></form>
      </section>
      {searchBlocked&&<div id="search-blocked-reason" className="setup-banner" role="status"><span>{blockedReason}</span></div>}
      {publicEnabled&&!signedIn&&<div className="setup-banner"><span>Googleログインで1日5回まで検索できます（日本時間0時更新）。</span><a href="/login">Googleでログイン</a></div>}
      {signedIn&&<section className="usage-panel" aria-labelledby="usage-heading">
        <div className="usage-panel-header"><h2 id="usage-heading">利用状況</h2><span className="usage-status" role="status">{isOwner?'管理者 · 回数制限なし':usage?<>本日の検索 あと<strong>{usage.remaining}</strong>回 / 5回</>:'利用状況を確認中…'}</span><button className="text-button" onClick={()=>void refreshUsage()}>更新</button></div>
        {isOwner&&usage?.rolling?<div className="usage-statistics"><span>一般：本日{usage.dailySearches}回 · 直近32日{usage.rolling.search}回</span><span>管理者：本日{usage.dailyAdminSearches??0}回 · 直近32日{usage.adminRolling?.search??0}回</span></div>:!isOwner&&<p className="usage-reset-time">日本時間0時更新</p>}
        <div className="usage-panel-tools">{isOwner&&<AdminUsage refreshVersion={usage} onReset={()=>void refreshUsage()}/>}<ResetKey owner={isOwner} onReset={()=>void refreshUsage()}/></div>
      </section>}
      {liveAccess&&source==='google'&&!liveAvailable&&<div className="setup-banner" role="status"><span>通常検索は準備中です。現在地の取得・手入力はできますが、候補・経路検索には設定が必要です。</span><a href="/admin/setup">設定手順</a></div>}
      {signedIn&&<PlacePreferences prefs={prefs} saving={prefSaving} error={prefError} save={savePreference}/>}
      {error&&<div className="error-banner" role="alert"><span>{error}</span><button aria-label="エラーを閉じる" onClick={()=>setError('')}><X size={18}/></button></div>}
      <section className="results-section" aria-labelledby="results-heading" aria-busy={busy}>
        <div className="results-header"><div><h2 id="results-heading">{result?'検索結果':'目的地候補'}{result&&<span className="count">{result.destinations.length}件</span>}</h2></div><div className="result-tools">{result&&<label className="sort-control">並び順<select value={resultSort} onChange={e=>{setResultSort(e.target.value as 'budget'|'rating');if(listRef.current)listRef.current.scrollTop=0;}}><option value="budget">条件に近い順</option><option value="rating" disabled={!result.ratingsAvailable}>Google評価順</option></select></label>}{result&&<button className="reshuffle" disabled={busy||result.destinations.length<2} onClick={shuffle}><RefreshCw size={15}/>次の候補</button>}<div className="view-switch"><button aria-pressed={view==='list'} onClick={()=>setView('list')}><Route size={16}/>一覧</button><button aria-pressed={view==='map'} onClick={()=>setView('map')}><Map size={16}/>地図</button></div></div></div>
        {result&&<div className="result-summary"><MapPin size={13}/>{result.originLabel}発 <span>·</span>{modes.find(m=>m.id===result.input.mode)?.name}{result.input.mode==='DRIVE'&&<> / {result.input.avoidHighways?'高速回避':'高速利用可'}</>} <span>·</span>{result.input.roundTrip?'往復':'片道'} {result.input.budget}{result.input.metric==='time'?'分':'km'}以内 <span>·</span>{themeLabels[result.input.theme??'all']}</div>}
        <div className={`results-grid view-${view}`}>
          <div className="destination-list" ref={listRef}>
            {!result?<div className="empty-state"><h3>{busy?'検索中…':'検索結果はここに表示されます'}</h3><p>{busy?'経路と移動時間を確認しています。':'条件を指定して「調べる」を押してください。'}</p></div>:result.destinations.length===0?<div className="empty-state"><Compass size={35}/><h3>条件内の候補が見つかりませんでした</h3><p>時間・距離を広げるか、目的地の種類・移動手段を変更してください。<br/>未対応の地域・交通手段では結果が出ない場合があります。</p></div>:displayed.map((d,i)=><DestinationCard key={d.id} destination={d} showRating={d.ratingsAvailable??result.ratingsAvailable===true} index={i} selected={selectedId===d.id} onSelect={onSelect} roundTrip={result.input.roundTrip} estimated={result.source==='google'&&result.input.mode==='BICYCLE'} preference={prefs?.places[d.id]} preferenceDisabled={prefSaving||!prefs} onPreference={signedIn&&result.source==='google'?(kind)=>void savePreference({id:d.id,kind:prefs?.places[d.id]===kind?'remove':kind}):undefined}/>) }
            {result&&<div className="load-more"><button className="load-more-button" onClick={()=>void submit(true)} disabled={busy||searchBlocked||result.destinations.length>=500}>{adding?<><RefreshCw size={16} className="spin"/>追加で探しています…</>:<>さらに調べる <RefreshCw size={16}/></>}</button>{additionalMessage&&<p role="status">{additionalMessage}</p>}</div>}
          </div>
          <div className="map-and-detail"><div className="map-container"><MapView result={result} selected={selected} onSelect={onSelect}/><div className="map-top-label"><MapPin size={13}/>{result?'Google Maps':'目的地の位置'}</div></div>
            {selected&&result?<div className="route-detail"><div className="detail-heading"><div><span className="spot-category">{result.input.mode==='BICYCLE'?'自転車の推定値 · 徒歩経路ベース':'移動の目安'}</span><h3>{selected.name}</h3></div><Navigation size={22}/></div><div className="route-stats"><div><Clock3 size={17}/><strong>{minutes(selected.seconds)}</strong><small>{result.input.roundTrip?'往復合計':'片道'}</small></div><div><Route size={17}/><strong>{km(selected.meters)}</strong></div></div>{selected.inbound&&<p className="leg-summary">往路 {minutes(selected.outbound.seconds)} / {km(selected.outbound.meters)} <ArrowRight size={12}/> 復路 {minutes(selected.inbound.seconds)} / {km(selected.inbound.meters)}</p>}<a className="nav-link" href={googleMapsUrl(result.origin,selected.point,result.input.mode,[],result.input.avoidHighways)} target="_blank" rel="noopener noreferrer">Google Mapsで往路を開く <ArrowUpRight size={17}/></a><div className="secondary-nav">{selected.inbound&&<a href={googleMapsUrl(selected.point,result.origin,result.input.mode,[],result.input.avoidHighways)} target="_blank" rel="noopener noreferrer">Google Mapsで復路 ↗</a>}</div><p className="nav-note">外部ナビではルート・所要時間が再計算されます。{result.input.mode==='DRIVE'&&'高速道路の設定は外部ナビでも確認してください。'}</p>{result.input.mode==='DRIVE'&&<YahooNavigation origin={result.origin} originLabel={result.originLabel} destination={selected.point} name={selected.name} roundTrip={result.input.roundTrip} avoidHighways={result.input.avoidHighways} demo={false}/>} {selected.attributions?.map(a=><p key={a.name} className="attribution"><a href={/^https?:/.test(a.uri)?a.uri:undefined} target="_blank" rel="noopener noreferrer">{a.name}</a></p>)}</div>:<div className="map-placeholder-note"><p>候補を選ぶと移動時間・距離と外部ナビを表示します。</p></div>}
          </div>
        </div>

        {result&&<div className="result-notices" aria-live="polite">{result.notices.map(n=><p key={n}>{n}</p>)}{(result.input.mode==='WALK'||result.input.mode==='BICYCLE')&&<p>徒歩・自転車の経路はベータ版です。歩道・自転車道の情報が不完全な場合があります。現地の交通規制と安全を確認してください。</p>}{result.source==='google'&&<div className="google-attribution"><img src="https://maps.gstatic.com/mapfiles/api-3/images/google_gray.svg" alt="Google Maps" width="80" height="26"/><span>目的地・経路情報提供</span></div>}</div>}
      </section>
    </main><footer><span className="footer-brand">ココからドコへ？</span><div><a href="/terms">利用規約</a><a href="/privacy">プライバシー</a><span>© {new Date().getFullYear()} ココからドコへ？</span></div></footer>
  </>;
}
