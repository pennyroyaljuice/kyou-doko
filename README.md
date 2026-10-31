# 今日どこいく？

「目的地は決まっていない。でも、どこかへ行きたい。」時間・距離の上限から外出先を提案するWebアプリです。このディレクトリーはSites向けの公開版で、Next.js App Router互換のVinext + Cloudflare Workersを使用します。ローカルNext.js版は隣の`kyou-doko`です。

## スマートフォンからの利用

公開先はSitesで管理し、閲覧は所有者本人だけに制限します。スマートフォンで公開URLを開き、公開時と同じアカウントでログインしてください。APIキー未設定の現在はデモモードのみ利用できます。公開URLはデプロイ成功後にチャットへ記載します。

## 起動

Node.js 22以上とpnpmを使用します。

```sh
pnpm install
pnpm dev
# http://localhost:5173
```

APIキーなしでデモが動作します。東京駅を起点とした固定の体験データで、実際の経路・時刻・営業状況ではありません。任意の出発地点やGPSを試す場合は実APIモードを設定してください。

## 実APIの設定

`.env.example`を`.env.local`へコピーし、Google Cloudで請求先を設定。Places API (New)、Routes API、Maps JavaScript APIを有効化します。

- `GOOGLE_MAPS_API_KEY`: サーバー専用。Places / RoutesのAPI制限と、可能なら送信元IP制限を設定。
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: ブラウザー公開キー。Maps JavaScript APIだけにAPI制限し、HTTPリファラーをlocalhostと自分のドメインに制限。公開変数にサーバーキーを入れないこと。
- 両キーの設定時のみ実APIモードを選べます。地図の認証失敗や検索失敗をデモへ自動置換しません。
- 環境変数はリクエスト時に読み取ります。変更後は開発サーバーを再起動し、Sitesは環境設定を反映して再デプロイします。

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm start
# ビルド済みWorkerをlocalhost:8787で確認
```

## できることと制約

GPS（localhostまたはHTTPS）・住所/駅名/緯度経度、4移動手段、時間/距離、片道/往復、候補選択、再検索、地図、外部ナビ。往復は復路を別計算し合算、滞在時間はゼロとして扱います。公共交通は電車優先で徒歩・バスを含む場合があります。未提供地域・経路なしは結果を捏造せず通知します。

候補探索は半径最大50km・最大8候補に限定。網羅的な到達圏検索ではありません。峠などPlacesに登録されていないスポットも見つかりません。渋滞・料金・営業時間は保証しません。周遊自動生成、復路の好み指定は将来機能です。

Sitesの閲覧制限を維持してください。不特定多数へ公開する前には運営者情報と問い合わせ先の追加、規約・プライバシー文面の確認、認証・永続的レート制限・監視が必要です。プロセス内の制限は本番の課金防御には不十分です。APIキーのある状態での課金を伴う疎通試験は未実施です。キーはリポジトリに入れず、Sitesの環境変数へ設定します。キー変更時は環境設定を反映して再デプロイしてください。

詳細は[SPEC.md](SPEC.md)、[ARCHITECTURE.md](ARCHITECTURE.md)、[API調査](docs/API_RESEARCH.md)、[確認結果](docs/VALIDATION.md)を参照。

現在地の実検索を有効にする手順：[Google Mapsの設定](docs/GOOGLE_SETUP.md)。現在地ボタンはキー未設定でも利用可能ですが、実際の候補・経路検索は設定完了まで無効です。

## 公開デモへの変更

一般閲覧はデモのみ。本人はChatGPTログイン後に実検索可能です。Google API課金の対象は本人の実検索・実地図利用です。詳細は[PUBLIC_DEMO.md](docs/PUBLIC_DEMO.md)を参照してください。
