import type {Point} from '@/lib/domain';
import {yahooUrl,yahooRouteUrl} from '@/lib/navigation';
export default function YahooNavigation({origin,originLabel,destination,name,roundTrip,avoidHighways,demo}:{origin:Point;originLabel:string;destination:Point;name:string;roundTrip:boolean;avoidHighways?:boolean;demo:boolean}) {
 return <div className="yahoo-navigation" aria-label="Yahoo!カーナビへの転送">
  <a className="nav-link yahoo-nav-link" href={yahooUrl(destination,name)}>Yahoo!カーナビで目的地を開く ↗</a>
  <p className="nav-note">端末の現在地 → {name}。Yahoo!カーナビのインストールが必要です。{demo&&'デモの目的地を転送します。'}</p>
  <details><summary>出発地点・復路を指定する</summary><div className="yahoo-options">
   <a href={yahooRouteUrl(origin,destination,name,originLabel)}>検索の出発地点から往路を開く ↗</a>
   <small>{originLabel} → {name}</small>
   {roundTrip&&<><a href={yahooUrl(origin,originLabel)}>現在地から出発地点へ戻る ↗</a><small>現在地 → {originLabel}（復路用）</small></>}
  </div></details>
  <p className="nav-note">目的地・地点情報を渡し、経路と所要時間はYahoo!側で再計算します。{avoidHighways?'高速道路を避ける設定は引き継げません。Yahoo!側でも設定してください。':'高速・有料道路の利用設定はYahoo!側で確認してください。'}開かない場合はSafariなどのブラウザーでお試しください。</p>
  <a className="yahoo-install" href="https://carnavi.yahoo.co.jp/" target="_blank" rel="noopener noreferrer">アプリの案内・インストール ↗</a>
 </div>;
}
