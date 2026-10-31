'use client';
import { useCallback, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bike, Car, Check, Clock3, Compass, Footprints, Leaf, LocateFixed, Map, MapPin, Mountain, Navigation, RefreshCw, Route, SlidersHorizontal, TrainFront, Waves, X } from 'lucide-react';
import type { Mode, Point, SearchInput, SearchResult } from '@/lib/domain';
import { googleMapsUrl, yahooUrl } from '@/lib/navigation';
import MapView from './MapView';
import { getCurrentLocation } from '@/lib/location';
const modes = [{id:'DRIVE',name:'車',icon:Car},{id:'TRANSIT',name:'電車',icon:TrainFront},{id:'BICYCLE',name:'自転車',icon:Bike},{id:'WALK',name:'徒歩',icon:Footprints}] as const;
const minutes=(s:number)=>`${Math.ceil(s/60)}分`;
const km=(m:number)=>`${(m/1000).toFixed(1)} km`;
export default function Explorer({liveAvailable,mapsApiKey,liveAccess,signedIn}:{liveAvailable:boolean;mapsApiKey:string;liveAccess:boolean;signedIn:boolean}) {
  const [source,setSource]=useState<'demo'|'google'>(liveAvailable?'google':'demo'), [origin,setOrigin]=useState(liveAvailable?'':'東京駅'),[gps,setGps]=useState<Point|null>(null);
  const [gpsAccuracy,setGpsAccuracy]=useState<number|null>(null);
  const [mode,setMode]=useState<Mode>('DRIVE'),[metric,setMetric]=useState<'time'|'distance'>('time'),[budget,setBudget]=useState('120'),[roundTrip,setRoundTrip]=useState(true);
  const [avoidHighways,setAvoidHighways]=useState(false);
  const [result,setResult]=useState<SearchResult|null>(null),[selectedId,setSelectedId]=useState(''),[view,setView]=useState<'list'|'map'>('list'),[busy,setBusy]=useState(false),[locating,setLocating]=useState(false),[error,setError]=useState('');
  const selected=result?.destinations.find(d=>d.id===selectedId);
  const onSelect=useCallback((id:string)=>setSelectedId(id),[]);
  const reset=()=>{setResult(null);setSelectedId('');setError('');};
  async function locate() {
    if(!liveAccess)return;
    reset();setLocating(true);setSource('google');
    if(source==='demo'||gps)setOrigin('');
    setGps(null);setGpsAccuracy(null);
    try {
      const location=await getCurrentLocation(navigator.geolocation,window.isSecureContext);
      setGps(location.point);setGpsAccuracy(location.accuracy);
      setOrigin(location.point.lat.toFixed(5)+', '+location.point.lng.toFixed(5));
    } catch(e) {setError(e instanceof Error?e.message:'現在地を取得できませんでした。出発地点を手入力してください。');}
    finally {setLocating(false);}
  }
  async function submit() {
    if(source==='google'&&!liveAccess){setError('実検索は管理者のみ利用できます。公開デモをご利用ください。');return;}
    if(source==='google'&&!liveAvailable){setError('通常検索の設定が必要です。設定手順を確認してください。');return;}
    setBusy(true);setError('');setResult(null);
    const input:SearchInput={source,origin:gps??origin,mode,metric,budget:Number(budget),roundTrip,avoidHighways:mode==='DRIVE'&&avoidHighways};
    try {
      const response=await fetch(liveAccess?'/admin/api/search':'/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(120000)});
      const data=await response.json() as SearchResult & {error?:string};
      if(!response.ok)throw new Error(data.error??'検索に失敗しました。');
      setResult(data);setSelectedId(data.destinations[0]?.id??'');
    } catch(e) {setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'検索がタイムアウトしました。時間をあけて再試行してください。');}
    finally {setBusy(false);}
  }
  function shuffle() {
    if(!result||result.destinations.length<2)return;
    const destinations=[...result.destinations.slice(1),result.destinations[0]];
    setResult({...result,destinations});setSelectedId(destinations[0].id);
  }
  const changeSource=(s:'demo'|'google')=>{if(s==='google'&&!liveAccess)return;reset();setSource(s);setGps(null);setGpsAccuracy(null);setOrigin(s==='demo'?'東京駅':'');};
  return <>
    <header className="site-header"><a className="brand" href="/"><span className="brand-mark"><Compass size={23}/></span>今日どこいく<span className="brand-question">？</span></a><div className="header-right"><span className="edition">{liveAccess?'管理者':'公開デモ'}</span>{signedIn?<a className="account-link" href="/admin/logout" target="_top">ログアウト</a>:<a className="account-link" href="/admin/" target="_top">管理者ログイン</a>}</div></header>
    <main>
      <section className="search-panel" aria-labelledby="search-heading">
        <div className="panel-top"><h1 id="search-heading"><SlidersHorizontal size={17}/>検索条件</h1><div className="source-switch" aria-label="データモード"><button aria-pressed={source==='demo'} onClick={()=>changeSource('demo')} disabled={busy||locating}>デモ</button><button aria-pressed={source==='google'} onClick={()=>changeSource('google')} disabled={!liveAccess||busy||locating} title={!liveAccess?'実検索は管理者のみ利用できます':!liveAvailable?'実API利用には環境変数の設定が必要です':undefined}>通常検索</button></div></div>
        <form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy||locating}><div className="conditions">
          <div className="condition origin-condition"><label htmlFor="origin"><span className="step">01</span>出発地点</label><div className="input-box"><MapPin size={18}/><input id="origin" value={origin} placeholder="駅名・住所・緯度,経度" readOnly={source==='demo'} onChange={e=>{reset();setGps(null);setGpsAccuracy(null);setOrigin(e.target.value);}} required maxLength={200}/><button type="button" className="gps" onClick={()=>void locate()} disabled={!liveAccess} aria-label="現在地を取得" title={liveAccess?'位置情報を許可して現在地を取得':'公開デモの出発地点は東京駅固定です'}><LocateFixed size={18}/><span>現在地</span></button></div><small>{locating?'現在地を取得しています…':gps?'現在地を取得済み'+(gpsAccuracy!==null&&Number.isFinite(gpsAccuracy)?'（精度目安 ±'+Math.ceil(gpsAccuracy)+'m）':''):source==='demo'?liveAccess?'デモは東京駅固定。現在地ボタンで通常検索へ切替':'公開デモの出発地点は東京駅固定です':'位置情報が使えない場合は手入力できます'}</small></div>
          <div className="condition"><label><span className="step">02</span>移動手段</label><div className="transport">{modes.map(m=><button key={m.id} type="button" aria-pressed={mode===m.id} onClick={()=>{reset();setMode(m.id);}}><m.icon size={23}/><span>{m.name}</span></button>)}</div>{mode==='DRIVE'&&<div className="highway-option"><label htmlFor="use-highways"><input id="use-highways" type="checkbox" checked={!avoidHighways} onChange={e=>{reset();setAvoidHighways(!e.target.checked);}}/>高速道路を利用する</label><small>{avoidHighways?'高速道路をなるべく避けて計算':'高速道路も候補に含めて計算'}</small></div>}</div>
          <div className="condition budget-condition"><div className="label-line"><label htmlFor="budget"><span className="step">03</span>移動時間・距離</label><div className="metric-switch"><button type="button" aria-pressed={metric==='time'} onClick={()=>{reset();setMetric('time');setBudget('120');}}>時間</button><button type="button" aria-pressed={metric==='distance'} onClick={()=>{reset();setMetric('distance');setBudget('50');}}>距離</button></div></div><div className="budget-line"><input id="budget" type="number" min={metric==='time'?5:1} max={metric==='time'?480:300} step="any" value={budget} onChange={e=>{reset();setBudget(e.target.value);}} required/><span>{metric==='time'?'分':'km'}以内</span></div><small>移動のみ・滞在時間は含みません</small></div>
          <div className="condition trip-condition"><label><span className="step">04</span>移動区分</label><div className="trip-switch"><button type="button" aria-pressed={!roundTrip} onClick={()=>{reset();setRoundTrip(false);}}>片道 <ArrowRight size={15}/></button><button type="button" aria-pressed={roundTrip} onClick={()=>{reset();setRoundTrip(true);}}>往復 <RefreshCw size={14}/></button></div><small>{roundTrip?'行き＋帰りの合計で計算':'行きの移動だけで計算'}</small></div>
        </div><div className="search-bottom">{source==='google'&&<p>検索時、出発地点と条件をGoogleに送信します。</p>}<button className="search-button" type="submit" disabled={source==='google'&&!liveAvailable}>{busy?<><RefreshCw size={19} className="spin"/>探しています…</>:<>どこいく？ <ArrowRight size={19}/></>}</button></div></fieldset></form>
      </section>
      {liveAccess&&source==='google'&&!liveAvailable&&<div className="setup-banner" role="status"><span>通常検索は準備中です。現在地の取得・手入力はできますが、候補・経路検索には設定が必要です。</span><a href="/admin/setup">設定手順</a></div>}
      <div className="mode-notice"><span className={source==='demo'?'demo-badge':'live-badge'}>{source==='demo'?'DEMO':liveAvailable?'LIVE':'準備中'}</span><span>{source==='demo'?'表示される時間・距離はサンプルです。実際の検索結果ではありません。':liveAvailable?'現在地は検索ボタンを押したときにGoogleへ送信します。':'位置情報はブラウザー内だけで保持し、現在は検索サービスへ送信しません。'}</span></div>
      {error&&<div className="error-banner" role="alert"><span>{error}</span><button aria-label="エラーを閉じる" onClick={()=>setError('')}><X size={18}/></button></div>}
      <section className="results-section" aria-labelledby="results-heading" aria-busy={busy}>
        <div className="results-header"><div><h2 id="results-heading">{result?'検索結果':'目的地候補'}{result&&<span className="count">{result.destinations.length}件</span>}</h2></div><div className="result-tools">{result&&<button className="reshuffle" disabled={busy||result.destinations.length<2} onClick={shuffle}><RefreshCw size={15}/>再抽選</button>}<div className="view-switch"><button aria-pressed={view==='list'} onClick={()=>setView('list')}><Route size={16}/>一覧</button><button aria-pressed={view==='map'} onClick={()=>setView('map')}><Map size={16}/>地図</button></div></div></div>
        {result&&<div className="result-summary"><MapPin size={13}/>{result.originLabel}発 <span>·</span>{modes.find(m=>m.id===result.input.mode)?.name}{result.input.mode==='DRIVE'&&<> / {result.input.avoidHighways?'高速回避':'高速利用可'}</>} <span>·</span>{result.input.roundTrip?'往復':'片道'} {result.input.budget}{result.input.metric==='time'?'分':'km'}以内 <span>·</span>滞在時間を除く</div>}
        <div className={`results-grid view-${view}`}>
          <div className="destination-list">
            {!result?<div className="empty-state"><h3>{busy?'検索中…':'検索結果はここに表示されます'}</h3><p>{busy?'経路と移動時間を確認しています。':'条件を指定して「どこいく？」を押してください。'}</p></div>:result.destinations.length===0?<div className="empty-state"><Compass size={35}/><h3>条件内の候補が見つかりませんでした</h3><p>時間・距離を広げるか、別の移動手段をお試しください。<br/>未対応の地域・交通手段では結果が出ない場合があります。</p></div>:result.destinations.map((d,i)=><button className={`destination-card ${selectedId===d.id?'selected':''}`} key={d.id} onClick={()=>setSelectedId(d.id)} aria-pressed={selectedId===d.id}><span className={`spot-art art-${i%3}`} aria-hidden="true">{d.category.includes('海')?<Waves size={34}/>:d.category.includes('渓')?<Mountain size={34}/>:<Leaf size={34}/>}<span className="spot-number">{String(i+1).padStart(2,'0')}</span></span><span className="spot-info"><span className="spot-category">{d.category}</span><strong>{d.name}</strong><span className="spot-description">{d.description}</span><span className="spot-stats"><span><Clock3 size={14}/>{minutes(d.seconds)}</span><span><Route size={14}/>{km(d.meters)}</span><span className="trip-tag">{result.input.roundTrip?'往復':'片道'}</span></span></span><span className="selected-indicator">{selectedId===d.id?<Check size={16}/>:<ArrowUpRight size={17}/>}</span></button>)}
          </div>
          <div className="map-and-detail"><div className="map-container"><MapView result={result} selected={selected} onSelect={onSelect} mapsApiKey={mapsApiKey} showDemo={source==='demo'}/><div className="map-top-label"><MapPin size={13}/>{result?.source==='google'?'Google Maps':source==='demo'?'東京周辺 · デモ概念図':'経路表示'}</div></div>
            {selected&&result?<div className="route-detail"><div className="detail-heading"><div><span className="spot-category">{result.source==='demo'?'サンプルルート':'推奨ルート'}</span><h3>{selected.name}</h3></div><Navigation size={22}/></div><div className="route-stats"><div><Clock3 size={17}/><strong>{minutes(selected.seconds)}</strong><small>{result.input.roundTrip?'往復合計':'片道'}</small></div><div><Route size={17}/><strong>{km(selected.meters)}</strong></div></div>{selected.inbound&&<p className="leg-summary">往路 {minutes(selected.outbound.seconds)} / {km(selected.outbound.meters)} <ArrowRight size={12}/> 復路 {minutes(selected.inbound.seconds)} / {km(selected.inbound.meters)}</p>}<a className="nav-link" href={googleMapsUrl(result.origin,selected.point,result.input.mode,[],result.input.avoidHighways)} target="_blank" rel="noopener noreferrer">Google Mapsで往路を開く <ArrowUpRight size={17}/></a><div className="secondary-nav">{selected.inbound&&<a href={googleMapsUrl(selected.point,result.origin,result.input.mode,[],result.input.avoidHighways)} target="_blank" rel="noopener noreferrer">Google Mapsで復路 ↗</a>}{result.input.mode==='DRIVE'&&<a href={yahooUrl(selected.point,selected.name)}>Yahoo!カーナビ ↗</a>}</div><p className="nav-note">外部ナビではルート・所要時間が再計算されます。{result.input.mode==='DRIVE'&&'高速道路の設定は外部ナビでも確認してください。Yahoo!連携はアプリ必須・試験対応で、端末の現在地から出発します。'}</p>{selected.attributions?.map(a=><p key={a.name} className="attribution"><a href={/^https?:/.test(a.uri)?a.uri:undefined} target="_blank" rel="noopener noreferrer">{a.name}</a></p>)}</div>:<div className="map-placeholder-note"><p>候補を選ぶと経路の詳細を表示します。</p></div>}
          </div>
        </div>
        {result&&<div className="result-notices" aria-live="polite">{result.notices.map(n=><p key={n}>{n}</p>)}{(result.input.mode==='WALK'||result.input.mode==='BICYCLE')&&<p>徒歩・自転車の経路はベータ版です。歩道・自転車道の情報が不完全な場合があります。現地の交通規制と安全を確認してください。</p>}{result.source==='google'&&<div className="google-attribution"><img src="https://maps.gstatic.com/mapfiles/api-3/images/google_gray.svg" alt="Google Maps" width="80" height="26"/><span>目的地・経路情報提供</span></div>}<button className="text-button" onClick={()=>void submit()} disabled={busy}>同じ条件で再検索（実APIでは新たに利用量が発生） <RefreshCw size={13}/></button></div>}
      </section>
    </main><footer><span className="footer-brand">今日どこいく？</span><div><a href="/terms">利用規約</a><a href="/privacy">プライバシー</a><span>© {new Date().getFullYear()} 今日どこいく？</span></div></footer>
  </>;
}
