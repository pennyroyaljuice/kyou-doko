# 現在地からの実検索を有効にする

2026-10-31確認。GPS自体にGoogle APIキーは不要です。候補の検索・経路計算・地図表示にGoogle Maps Platformを使用します。

1. [Google Cloudでプロジェクト作成](https://console.cloud.google.com/projectcreate)。名前は任意（例：kyou-doko）。請求先を関連付け、支払い情報はGoogle画面で入力します。
2. [APIライブラリ](https://console.cloud.google.com/apis/library)で **Places API (New)**、**Routes API**、**Maps JavaScript API** を有効化します。Geolocation APIやGeocoding APIは本アプリには不要です。
3. [認証情報](https://console.cloud.google.com/apis/credentials)からAPIキーを2本作成。名前を「kyou-doko-map」「kyou-doko-server」など区別します。

| 用途 | アプリケーション制限 | API制限 |
|---|---|---|
| 地図表示用 | ウェブサイト（HTTPリファラー） | Maps JavaScript APIのみ |
| 検索用・サーバー秘密キー | 固定送信元IPが使える環境ならIP制限。現在のWorkers構成は固定IPを前提にしないので、API制限＋所有者限定アクセス＋利用上限で運用 | Places API (New)、Routes APIのみ |

地図表示用の許可サイト：

```text
https://kyou-doko-outing.radical-steamer.chatgpt.site/*
```

ローカルでも実検索するなら、地図表示用キーに`http://localhost:3000/*`、`http://127.0.0.1:3000/*`、`http://localhost:8787/*`、`http://127.0.0.1:8787/*`を必要なものだけ追加します。サーバーキーにHTTPリファラー制限を設定するとサーバーからの検索が拒否されるため、2本を混同しないでください。

4. Googleの予算通知とAPIの利用上限を設定します。予算通知は課金の強制停止ではありません。無料枠を超えると課金されるので、最初は少量で試します。
5. 次のローカルファイルへ保存します。エクスプローラーで拡張子を表示し、`.env.local.txt`にしないでください。

`C:\Users\penny\Documents\Codex\2026-10-31\1-web-2-gps-gps-google\outputs\kyou-doko\.env.local`

`.env.example`をコピーして、検索用キーを`GOOGLE_MAPS_API_KEY`、地図表示用キーを`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`へ入力。チャット・GitHub・スクリーンショットにはキーを貼らず、保存後に「設定ファイルを保存した」とだけ伝えてください。Codexが値を表示せずSitesの秘密環境変数へ転送して再デプロイします。`.env.local`はGit対象外です。

## 設定後の利用

通常検索を選び、「現在地」→ブラウザーの位置情報を許可→時間・距離などを指定→「どこいく？」。取得した緯度経度と精度目安を表示し、検索ボタンを押すまでGoogleへ座標を送信しません。GPSの精度は端末・屋内外で変わります。拒否・非対応・タイムアウト時も手入力可能です。

画面ロード時にサーバー側で環境変数を読み、ブラウザーへは制限済み地図用キーだけを渡します。検索用秘密キーは渡しません。このため環境変数を変更した際はSitesの設定を反映して再デプロイすればよく、キーをソースやビルドへ埋め込む必要はありません。

公式資料：[キー設定](https://developers.google.com/maps/documentation/javascript/get-api-key)、[キーの制限](https://developers.google.com/maps/api-security-best-practices)、[費用の管理](https://developers.google.com/maps/billing-and-pricing/manage-costs)、[ブラウザーの位置情報](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition)。
