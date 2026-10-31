# 今日どこいく？ — Cloudflare公開版

公開URL: https://kyou-doko.pennyroyal-juice.workers.dev/

## 利用範囲

- `/`: 匿名の公開デモ。Google APIの検索・地図を呼びません。
- `/admin/`: Googleアカウントで本人のみ実検索。Zero Trust契約不要。
- 管理者ログインの有効期限は8時間。HttpOnly/Secure/SameSite=Strict Cookieを使用。
- POSTは同一Originのみ。外部からの本人ヘッダーは削除します。
- ログインはIPごと5回/60秒（Cloudflare拠点ごとの近似制限。世界共通の厳密な上限ではありません）。
- ログアウトはCookieを削除します。盗難済みトークンは期限まで有効なので、漏洩時はセッション秘密鍵を変更します。

## 開発と公開

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm deploy
```

43件のテストで期限切れ・偽造・別Origin・パスワード変更・未設定拒否等を確認します。
秘密値はCloudflare Secretsに標準入力で登録します。Git、チャット、引数にキーやパスワードを載せないでください。

| Secret | 用途 |
|---|---|
| ADMIN_PASSWORD_HASH | ランダム24バイト以上の専用パスワードのSHA-256（16進数）。人が考えた短いパスワードは使用不可 |
| ADMIN_SESSION_SECRET | ランダム48バイトのセッション署名鍵 |
| LIVE_SEARCH_OWNER_USER_ID | password-owner |
| LIVE_SEARCH_OWNER_EMAIL | 本人のメール |
| GOOGLE_MAPS_API_KEY | サーバーのPlaces/Routes用キー |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | リファラー・API制限済みの地図表示キー |

パスワードはランダム生成した高エントロピー値のみを使う設計のためSHA-256照合を採用。一般利用者が選ぶパスワードには適用しません。パスワードハッシュ変更で既存セッションも失効します。`ADMIN_SESSION_SECRET`変更でも全端末を失効できます。

`wrangler.jsonc`のLIVE_SEARCH_ENABLEDがtrueで、本人認証とGoogle設定が揃った場合に実検索が有効になります。falseで停止できます。Googleキーは移行済みですが、地図表示キーのリファラーに `https://kyou-doko.pennyroyal-juice.workers.dev/*` の許可が必要です。旧URLを使う間は旧リファラーも残してください。

検索APIには従来の同時実行・10秒間隔・1時間30回の制限がありますが、Workerインスタンス単位なので厳密な全体課金上限ではありません。一般利用者への実検索開放前に共有ストレージによる予算管理が必要です。

## 運用状況

本人ログイン・実Google検索8件・未認証401・偽ヘッダー拒否・別Origin403・ログアウトを公開先で検証しました。一般公開はデモのままです。旧Sites版はsitesブランチで維持しています。

将来の課金会員はGoogle等のアカウント認証と会員・契約管理へ拡張します。現在の単一管理者パスワードを会員全員で共有する設計にはしません。

公式資料: [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)、[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)。

## Googleアカウント認証への移行

Google OAuth設定を登録し、Googleログイン版を公開済みです。[設定手順](docs/GOOGLE_LOGIN.md)に従ってOAuthクライアントを登録し、ADMIN_AUTH_MODE=googleへ切り替えます。現在はADMIN_AUTH_MODE=googleで稼働しています。Googleモードでは旧パスワード認証を受け付けません。

## 高速道路の設定

車では「高速道路を利用する」を切替できます（初期値ON）。OFFではGoogle RoutesのrouteModifiers.avoidHighways=trueを往路・復路へ渡し、取得した時間・距離で候補を絞ります。ONは高速の利用許可であり利用を強制しません。Googleの回避指定は完全な除外を保証せず、有料道路回避とは別条件です。探索は既存の最大50km・8候補の範囲内です。デモの数値は固定で設定による変化を模擬しません。Google Mapsリンクにもavoid=highwaysを渡します。Yahoo!連携は設定を引き継がないため外部側で確認します。

公式仕様: https://developers.google.com/maps/documentation/routes/route-modifiers

## 候補の参考写真

通常検索のみ、既存Nearby Searchで写真情報を取得し、画面に入ったカードだけ最初の1枚を最大240×180pxで読み込みます。追加のPlace Detailsは呼びません。再抽選・選択では同じDOM内の写真を維持。画像と写真名は永続保存・キャッシュせずno-storeで配信し、失敗時はアイコンに戻して自動リトライしません。撮影者の表示・リンクを画像のすぐ下に配置します。公開デモは写真APIを使いません。

写真取得経路は管理者認証と30分期限の署名済みチケットで制限し、任意URLを拒否。30回/分/IP（Cloudflare拠点単位）の制限を適用します。写真取得は追加のPlaces利用量となり、API別メール通知ではPlacesの合計に含まれます。


## 目的地の種類

「すべて」「観光・レジャー」「自然・景色」を指定可能。themeは省略時all。不正な値は拒否します。Nearby SearchのincludedTypes（自然側はincludedPrimaryTypes）で候補探索段階から絞り込み、自然では遊園地・水族館・動物園・博物館等をexcludedTypesで除外します。自然側は主分類を自然・公園に限定し、都市の展望施設は観光側へ。返却されたtypes・primaryTypeでも再確認し、対象外の経路計算を省きます。追加検索・Place Details・0件時の全種類への切替は行いません。既存の最大8件・50kmと利用制限を維持します。

自然には山頂・海岸・渓谷周辺の公園・展望地点等を含みます。Googleの分類は重複するため厳密な排他的分類ではありません。峠専用の検索タイプはなく、峠や走行する山道の網羅検索は未対応。将来は独自スポットデータや周遊経路で拡張します。デモの分類・数値は固定サンプルです。

公式分類: https://developers.google.com/maps/documentation/places/web-service/place-types


## 電車検索の提供停止（2026-11-01）

Googleの公式FAQではRoutes APIの公共交通対応から日本の事業者が除外されています。Google Maps製品の対応とAPIの対応は異なります。追加API・契約を増やさない方針により、電車を通常・デモ両方の選択肢から除外。古いTRANSIT入力は422で明示的に拒否し、出発地解決・Places候補探索・Routes呼出しより前に停止します。内部のMode型と外部ナビURLの変換は将来のプロバイダー追加用に保持します。

根拠: https://developers.google.com/maps/faq#transit_directions_countries
