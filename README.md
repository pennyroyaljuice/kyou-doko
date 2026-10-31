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


## 遠方候補の探索改善（2026-11-01）

中心から人気順8件を取得する方式では都心の近場ばかりが選ばれるため、探索半径の78%の位置に東西南北の4検索中心を配置し、各中心から近い順で候補を取得します。各検索円の半径は探索半径の30%。重複・元の探索範囲外・距離の物理下限超過を除外し、各方向から均等に最大8件を選びます。Nearby Searchは最大4回（従来1回）、同時実行2。Routesは最大16回のまま。追加の検索や自動再試行は行いません。時間・距離の推定は探索位置決定にのみ使い、最終表示と上限判定は実経路のみ。往復は合算。最大50km探索の制約は維持し、最長候補が上限の75%未満なら画面に探索の限界を通知します。

公式仕様: https://developers.google.com/maps/documentation/places/web-service/nearby-search


## 片道の探索範囲修正（2026-11-01）

上記の「出発地から最大50km」は撤廃。Google Nearby Searchの50km上限は各検索円の半径であり、出発地からの探索距離の制限ではありません。探索到達距離は指定距離または指定時間×移動手段別の目安速度（最大300km）、往復なら半分。中心はその78%、各検索円は30%かつ最大50km。120分・車なら片道は到達目安100km／中心78km、往復は50km／中心39km。実経路で上限判定する方式、4候補検索と最大8経路対象は維持。


## Yahoo!カーナビ連携の改善（2026-11-01）

現在地から目的地を開くlat/lon/nameに加え、検索出発地→目的地をpointを2つ指定して開けます。往復検索では現在地→元の出発地の復路リンクを表示。経由地は公式仕様の最大3件に対応する関数を用意（UIではまだ指定なし）。UTF-8名称・世界測地系の座標を渡し、経路形状や高速道路回避は渡しません。Yahoo!側で経路と時間が再計算され、検索時の経路は保証できません。アプリ必須。自動インストール遷移・起動成功の推測は行わず、公式アプリ案内リンクを表示。API利用量の追加なし。URL生成は自動テスト済み、iOS/Android実機での外部アプリ起動は要確認。

公式仕様: https://map.yahoo.co.jp/blog/archives/20150202_carnavischeme.html


## 一般公開の準備（2026-11-01）

Googleログイン・1日5回制限・共有の全体予算・写真の制限を実装。Durable ObjectのSQLite保存とトランザクションで管理。公開スイッチは2026-11-01にONへ切替済み。詳細・初期上限・無料枠との関係・公開前の残作業・将来の課金設計は[一般公開の運用手順](docs/PUBLIC_LAUNCH.md)を参照。従来の管理者限定説明は公開スイッチOFF時の運用に限る。


## 地図のEmbed移行（2026-11-01）

選択した目的地をMaps Embed APIのplaceモードで表示する。全候補の独自ピン・経路線は表示せず、時間・距離は従来どおりサーバーのRoutes結果を一覧に表示する。詳細はGoogle Maps/Yahoo!カーナビへ渡す。ブラウザーキーはEmbed APIだけに制限する。キーは認証後のPOST /api/embed-keyで取得し、旧/api/maps-keyは410。無料の埋め込み表示には検索回数を消費しない。Routesにはポリラインを要求しない。既存環境変数名NEXT_PUBLIC_GOOGLE_MAPS_API_KEYを継続使用する。

料金と検証の詳細：[Embed移行の費用比較](docs/EMBED_COST_REVIEW.md)。過去のJavaScript地図・地図発行上限に関する説明は移行前の記録。


## アカウント別の候補除外（2026-11-01）

Googleログイン後、訪問済み・興味なしを場所ID単位で記録。訪問済み除外は切替可能、興味なしは常に除外。設定欄からGoogle Mapsで場所を確認・解除できる。名称・住所・写真は永続保存しない。上限500件、解除まで保持。保存・解除は検索回数を消費しない。デモは保存対象外。

同じSQLite Durable Objectクラスを再利用し、Google subのSHA-256を含む専用インスタンス名preferences-v1にアカウントごとに分離。検索前にサーバーが取得し、偽装不可の内部ヘッダーで渡して経路計算前に除外。取得失敗時は検索を開始せず利用回数も消費しない。候補減少時の追加自動検索はしない。場所ID保存はPlacesのキャッシュ制限の例外を利用する（https://developers.google.com/maps/documentation/places/web-service/policies）。


## 保存した場所の表示改善（2026-11-01）

各検索候補のカード内に訪問済み・興味なしのチェックを配置。登録直後の結果は残し、次回の検索から除外する。同じチェックを外すと解除、区分は排他。ヘッダーの「保存した場所」から検索前でも保存一覧を開ける。出発地点・距離や検索結果のクリアに影響されず、解除までアカウントで保持する。訪問済み・興味なしで一覧を切替。各場所の確認に無料Embedを遅延読込し、Places詳細APIは追加しない。名称等はGoogle埋め込み側で最新表示し、アプリには場所ID・区分のみ保存する。
