import { headers } from 'next/headers';
import { requestAccess } from '@/lib/access';
export const dynamic='force-dynamic';
export default async function Setup() {
  const access=requestAccess(await headers());
  if(!access.isOwner)return <main className="legal"><a href="/">← 公開デモに戻る</a><h1>管理者専用の設定</h1><p>Google APIの実検索は管理者だけが利用できます。一般公開ではデモ検索をお試しください。</p><a href="/admin/setup" target="_top">管理者ログイン</a></main>;
  return <main className="legal"><a href="/">← 検索に戻る</a><h1>現在地検索の設定</h1><p>現在地の取得はブラウザーの位置情報機能を使います。そこから目的地・経路を検索するには、Google MapsのAPI設定が必要です。</p><ol>
    <li><a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer">Google Cloudでプロジェクトを作成</a>し、請求先アカウントを関連付けます。支払い情報はGoogleの画面で登録してください。</li>
    <li><a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer">APIライブラリ</a>で「Places API (New)」「Routes API」「Maps JavaScript API」を有効にします。</li>
    <li><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">認証情報</a>でキーを2本作成します。地図表示用はウェブサイト制限とMaps JavaScript APIのみに限定。検索用はPlaces API (New)・Routes APIのみに限定します。</li>
    <li>地図表示用キーのウェブサイト制限に <code>https://kyou-doko.pennyroyal-juice.workers.dev/*</code> を登録します。検索用の秘密キーにはウェブサイト制限を付けません。サーバー側から利用するキーだからです。</li>
    <li>キーはチャットやGitHubに貼らず、ローカルの <code>.env.local</code> に保存してください。<code>GOOGLE_MAPS_API_KEY</code> に検索用、<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> に地図表示用を設定します。保存後にCodexへ「設定ファイルを保存した」と伝えると、公開環境の秘密設定へ登録・反映できます。</li>
  </ol><p>Googleの予算通知とAPIの利用上限を設定してください。予算通知だけでは課金は自動停止しません。まずはご本人限定のまま、少量の検索で確認します。</p><p><a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer">Google公式の設定手順</a> ／ <a href="https://developers.google.com/maps/billing-and-pricing/manage-costs" target="_blank" rel="noopener noreferrer">利用量・費用の管理</a></p></main>;
}
