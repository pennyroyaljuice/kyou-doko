# 公開状況

2026-10-31：自身のCloudflareアカウントへの移行と動作確認を完了。

- 公開URL：https://kyou-doko.pennyroyal-juice.workers.dev/
- 一般公開：デモ検索のみ。Googleの検索・地図APIを呼びません。
- 管理者：https://kyou-doko.pennyroyal-juice.workers.dev/admin/login
- 専用パスワードで本人のみ実検索。ログイン期限8時間。Zero Trust契約は不要です。
- 本人ログイン、実検索8件、Google地図・推奨ルート、匿名拒否、偽ヘッダー拒否、連続ログイン制限を確認済み。43件のテスト、型チェック、ビルド成功。
- Google API利用分は本人の実検索・地図利用時に発生します。検索制限は厳密な全体課金上限ではありません。

## ソースと更新

GitHub：https://github.com/pennyroyaljuice/kyou-doko （公開）。

- main：ローカル向けNext.js MVP
- cloudflare：現在の公開元。構成・秘密設定・運用方法は同ブランチのREADMEを参照。
- sites：旧ChatGPT Sites版（旧URLは移行期間中のため維持）

Cloudflare版はpnpm buildとpnpm deployで公開します。GitHub pushのみの自動更新は未設定です。APIキー・パスワード・秘密鍵・生成物はGitに含めません。
