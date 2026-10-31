# 公開状況

2026-10-31：Web版のデプロイ完了。

- URL：https://kyou-doko-outing.radical-steamer.chatgpt.site
- 閲覧範囲：所有者本人のみ。同じChatGPTアカウントでログインして利用。
- Googleキー未設定のためデモモードのみ。
- 未ログインのブラウザーではサインイン要求が表示されることを確認。
- 公開前のWorkerでホーム、規約、プライバシー、デモ検索が200。テスト16件・型チェック・公開ビルド成功。

## ソース

GitHubリポジトリ： https://github.com/pennyroyaljuice/kyou-doko （非公開）。Next.js版は`main`ブランチ、Sites公開版は`sites`ブランチで管理します。

Sites公開版のローカルコードは隣の`kyou-doko-site`。Sites管理のGitソースとGitHubの`sites`ブランチの両方へ同期します。GitHubへのpushだけでWebアプリが自動更新される設定にはしていません。Web更新はSitesのビルド・保存・デプロイ手順で行います。

- Site ID：`appgprj_6ae5b65bb77c81918af7418dad6366f2`
- 公開元コミット：`a3469f9454a53b0f5f09af457fd8664175c6beb2`
- デプロイID：`appgdep_6ae5b76f52a88191ad58e5baf5d652fb`

APIキー、node_modules、ビルド生成物はGitに含めていません。
