# 今日どこいく？ — Cloudflare単独公開版

このブランチはご自身のCloudflareアカウントへ配置するための版です。ChatGPT Sitesへの依存を外しています。既存Sites版は別ブランチsitesで維持します。

## 構成

- `/`：一般公開デモ。Googleの有料APIを呼ばず、地図用キーも送信しません。
- `/admin/`：本人用。Cloudflare Accessの署名済みJWTを検証し、本人のみ実検索を許可。
- `/admin/api/search`：本人用の実検索。一般向け`/api/search`から実検索することはできません。
- 認証・Googleキー・有効化設定が揃うまで実検索は停止。新規公開時はデモだけで動作します。

## ローカル確認

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

39件のテストに、偽造JWT・有効期限・発行元・対象アプリ・本人以外・偽の認証ヘッダーの拒否を含みます。ローカルの管理画面は実Access認証がないので403です。

## 自分のCloudflareへ公開

```sh
pnpm exec wrangler login
pnpm exec wrangler whoami
pnpm build
pnpm deploy
```

初回にアカウント選択が必要な場合は自分のアカウントを指定します。既存のkyou-doko Workerがある場合は上書きせず名前を変更してください。URLはデプロイ成功時に表示される `https://kyou-doko.<自分のサブドメイン>.workers.dev` です。まだデプロイしていない段階でURLを推測して公開済みと扱わないでください。

有料プランへの変更は自動で行いません。現在の設定は実検索停止・プレビューURL無効です。Googleキーもデプロイ内容に含めません。

## 本人限定の実検索を有効にする

1. Cloudflare Zero Trustを開き、AccessにSelf-hostedアプリケーションを作成します。対象は新しいホスト名の `/admin/*`。一般デモのルート `/` 全体は保護しません。
2. Allowポリシーで自分のメールアドレスだけを許可します。Everyoneは選ばないでください。ログイン方法はメールのワンタイムPIN等を設定できます。プラン・利用規約・請求条件は画面で確認し、不要な有料契約はしないでください。
3. Accessのチームドメイン（`https://<team>.cloudflareaccess.com`）とアプリケーションAUDタグを確認します。
4. Workerの環境変数・Secretsへ以下を設定します。

| 名前 | 内容 |
|---|---|
| CF_ACCESS_TEAM_DOMAIN | Accessのチームドメイン |
| CF_ACCESS_AUD | AccessアプリのAUD |
| LIVE_SEARCH_OWNER_EMAIL | 本人のメールアドレス |
| LIVE_SEARCH_OWNER_USER_ID | 任意：Accessのsub。SitesのIDとは異なるのでコピーしない |
| GOOGLE_MAPS_API_KEY | Places/Routes用の秘密キー |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | 制限済み地図表示キー |

キーはチャット・GitHubに貼らずSecretsへ登録します。Codexによる登録時は標準入力だけで渡し、キーの値をログや引数へ出しません。

5. Google Cloudの地図表示キーのウェブサイト制限に、新URLの `https://kyou-doko.<自分のサブドメイン>.workers.dev/*` を追加します。旧URLを使う間は旧リファラーも残します。
6. 認証・キー設定の確認後だけ `wrangler.jsonc` のLIVE_SEARCH_ENABLEDをtrueへ変えて再ビルド・再デプロイ。ダッシュボードだけで値を変えると次のWranglerデプロイでfalseへ戻るため、意図して設定を同期してください。

Cloudflare Accessのゲートを通らず管理エンドポイントへ直接到達しても、Worker自身がJWTの署名・発行元・対象アプリ・期限・本人を検証して拒否します。外部からの認証ヘッダーは毎回削除し、検証後にだけ内部用の本人情報を設定します。

## 移行状況

ご自身のCloudflareアカウントへデモ版を配置済みです。

URL：https://kyou-doko.pennyroyal-juice.workers.dev/

デモ検索8件、ホーム・CSSの200応答、未認証管理画面の403を確認。39件のテスト・型チェック・ビルド・アップロード検証成功。本人用実検索はCloudflare AccessとGoogleの新URL制限の設定待ちで、Googleキーは移行先へ登録していません。旧Sites公開URLと本人用実検索は継続稼働しています。

公式資料：[Workers URL](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)、[Access設定](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)、[JWTの検証](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)。
