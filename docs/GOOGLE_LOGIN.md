# Googleアカウント認証への切り替え

Google Cloud ConsoleのGoogle Auth Platformで設定します。地図APIキーとは別のOAuthクライアントが必要です。

1. 同意画面：対象は外部、テスト段階では本人のGoogleアカウントをテストユーザーに追加します。利用目的は管理者の本人確認だけです。
2. クライアント：アプリケーションの種類「ウェブアプリケーション」で作成。
3. 承認済みJavaScript生成元（設定する場合）：`https://kyou-doko.pennyroyal-juice.workers.dev`
4. 承認済みリダイレクトURI：`https://kyou-doko.pennyroyal-juice.workers.dev/admin/google/callback`
5. 作成後のクライアント設定JSONを安全なローカルファイルへ保存します。チャット・Gitへ貼り付けません。

Googleアカウントのパスワードをアプリへ渡すことはありません。要求する権限はopenidとemailのみで、GmailやDriveへのアクセスは要求しません。

## Cloudflare設定

| 名前 | 値 |
|---|---|
| GOOGLE_OAUTH_CLIENT_ID | 作成したクライアントID |
| GOOGLE_OAUTH_CLIENT_SECRET | クライアントシークレット（必ずSecret） |
| LIVE_SEARCH_OWNER_EMAIL | 許可する本人のGoogleメール |
| GOOGLE_OWNER_SUB | 任意：本人のGoogle subを固定する場合 |
| ADMIN_SESSION_SECRET | 既存のセッション署名用Secretを利用 |
| ADMIN_AUTH_MODE | Googleの設定が揃った後でwrangler.jsoncのvarsにgoogleを指定 |

JSONからキーを標準入力だけで登録する補助コマンド：

```sh
node scripts/configure-google-auth.mjs /absolute/path/to/client.json
```

このコマンドはクライアント情報を登録するだけです。設定の検証後、ADMIN_AUTH_MODEをgoogleにしてビルド・デプロイします。Googleが未設定の状態でgoogleへ変更すると認証は停止します。Googleモードではパスワードログインを受け付けません。以前のパスワードCookieも管理者権限を与えません。

## 認証設計

認可コード方式＋PKCE（S256）。10分期限の暗号化HttpOnly/Secure/Lax Cookieでstate・nonce・verifierをブラウザに結び付けます。GoogleのIDトークンの署名・発行元・対象アプリ・期限・nonce・メール検証済み・本人メールを検証。Googleのアクセストークンやリフレッシュトークンは保存しません。アプリ独自の8時間のHttpOnly/Secure/Strict Cookieでログインを維持します。

Google認証を使う場合もアプリのログアウトはアプリのセッションだけを解除し、Googleアカウント自体からはログアウトしません。Googleの同意画面・ブラウザ制限があるため、スマホのSafari/Chrome等の通常ブラウザで確認します。

公開デモのGoogle API非利用・実検索の本人制限は維持します。Google本番認証の確認前に切り替え完了とは扱いません。

公式資料：https://developers.google.com/identity/openid-connect/openid-connect

## 公開先の確認結果（2026-10-31）

OAuth設定をSecretsへ登録し、Google認証モードで公開済み。実際のGoogle本人アカウントからのログイン、自動復帰、ログアウト、再ログインを確認。旧パスワードPOSTは405、匿名管理者APIは401です。Strict Cookieを維持するためコールバックは200の同一サイトページを挟み管理画面へ進みます。
