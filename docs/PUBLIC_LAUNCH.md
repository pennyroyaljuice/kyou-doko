# 一般公開の準備と運用

更新: 2026-11-01。Google OAuthを本番公開に変更し、PUBLIC_SEARCH_ENABLED=trueで一般アカウント向けの実検索を開放しました。

## 実装済み

- Google OIDCの署名・audience・issuer・nonce・email_verifiedを検証。Google subでアカウントを区別。Gmail/Drive権限や更新トークンは取得しない。
- 公開スイッチONで一般ユーザーを許可するが、管理者画面・設定・全体利用状況は従来の所有者だけ。
- 全員無料プラン。1アカウント1日3回、日本時間0時更新。管理者も同じ枠。ログアウト・端末変更では回避できない。
- SQLite-backed Durable Objectの単一共有インスタンスでトランザクションを使い、同時リクエストと複数拠点間の競合を抑止。
- 全体は1日10検索・直近32日100検索。カレンダー月リセットの境界集中を避けるため32日を採用。
- 写真500取得／地図キー発行1000回まで、いずれも直近32日。写真は有効チケット検証後に予約。地図は新しい地図を作る前にキー発行を要求。
- 検索回数は外部API開始前に予約。開始後の失敗・0件・アプリ側の短時間制限による失敗でも返却しない。デモと候補選択は消費しない。
- 保存先が使えない・公開停止・未ログインは外部検索前に停止。
- 管理者画面に残数と全体集計、写真・地図カウントを表示。
- カウンターにはハッシュ化したGoogle sub・日次回数のみ保存。位置・メール・検索結果は保存しない。日次alarmで32日より古い記録を削除（バックアップの取扱いはCloudflareの仕様に従う）。
- プライバシー／利用規約を更新。問い合わせはpennyroyal.juice@gmail.com。

## 無料枠との関係

Googleの現行グローバル公示値: Nearby Search ProとText Search Proは各月5,000、Compute Routes Essentialsは月10,000、Dynamic Mapsは月10,000、Place Details Photosは月1,000無料イベント。

現行検索の最大はNearby 4＋起点Text 1＋Routes 16。100検索ならNearby 400、Text 100、Routes 1,600。写真上限500、地図キー発行上限1000で余裕を持たせる。ただし実際の請求はSKU判定・同じ請求先の他プロジェクト利用・既存利用・Google側の集計で決まる。アプリの計数はGoogle請求イベントの実測ではない。

ブラウザー向け地図キーは公開情報であり、キー取得後の再利用・改変クライアントの地図ロードをサーバーで完全には阻止できない。地図キーの発行上限はGoogle側の地図ロード数の厳密な上限ではない。Google Cloudのリファラー/API制限・利用可能な割当上限を必ず併用し、請求ゼロを保証すると案内しない。

## 公開切替前に必要な作業

1. Google Auth Platformのブランディングを完成（アプリ名・ホームページ・privacy/terms URL・サポートメール）。ロゴ追加は確認要件が変わるため今回は行わない。
2. OAuthの対象が現在テスト中であることを確認済み。一般Googleアカウント向けの本番公開へ切り替える。必要なGoogleの確認・ドメイン所有確認が出たら完了する。現在のリダイレクトURIは/admin/google/callbackを再利用し、秘密情報は公開しない。
3. Google Cloudで実際の残無料枠、対象キーのAPI制限、ブラウザーキーの本番ドメイン制限を確認。利用可能な日次割当を無料枠に十分余裕を持つ値まで引き下げる（APIにより日次割当がない場合があり、できることを確認して記録する）。メール通知は上限停止ではない。
4. 管理者とは異なるGoogleアカウントでログイン・1～3回・4回目拒否・管理画面拒否・ログアウトを確認（Googleテストユーザーを使う場合もよい）。実検索3回の利用分が発生する。
5. 上記完了後、wrangler.jsoncのPUBLIC_SEARCH_ENABLEDをtrueにしビルド・デプロイ。匿名はデモ、ログイン済みは実検索。
6. 停止時はPUBLIC_SEARCH_ENABLED=falseで一般利用を止める。LIVE_SEARCH_ENABLED=falseは管理者を含め検索と写真・地図を停止。カウンターは削除・リセットしない。

## 有料化への拡張

利用権限と利用量カウンターを分離。将来は決済サービスの署名検証済み通知から契約状態を管理し、サーバーがプラン別の回数上限を決定する。クライアントからのpaid=trueやメールだけで有料判定しない。有料ユーザーにも全体予算・濫用防止上限を残す。「無制限」はAPI費用を見てから判断。現在は決済契約・課金処理・自動請求を実装していない。

## 公式資料

- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

## 公開先での確認結果

2026-11-01: 管理者実検索1回で残り3→2、共有検索1、写真1、地図1を確認。一般ユーザー開放OFFを維持。Google Auth Platformのアプリ名・ホームページ・privacy/terms URLを保存済み。Google側の公開ステータスはテスト中のまま。Maps JavaScript APIの割当画面ではMap loads per dayが無制限・調整不可と表示されたため、日次ハード上限を設定済みとは扱わない。公開前に地図表示の費用対策（現行キーの制限確認や無料のEmbed方式など）を確定する。


## 一般公開の切替結果（2026-11-01）

Google Auth Platformの公開ステータス「本番環境」を画面で確認。アプリのPUBLIC_SEARCH_ENABLED=trueをデプロイ。/loginが200でGoogleログインと1日3回の案内を表示し、匿名検索は401のまま。実Google OAuthでログインし、コールバックからルート画面へ戻ることを管理者アカウントで確認。一般アカウントの権限・3回制限・4回目拒否・管理者画面拒否は署名済みテスト用IDで検証済み。管理者以外の実Googleアカウントを用いた端末確認は利用者に依頼する。地図キーのAPI制限はMaps JavaScript APIのみ、許可リファラーに本番workers.devと旧Sitesドメインを確認。Google側の変更できない日次地図割当はそのままで、キー発行と写真・検索の共有上限を維持。請求ゼロの保証はしない。


## Embed移行（2026-11-01）

地図を無料・回数上限なしのMaps Embed API place表示へ変更。ブラウザーキーのMaps JavaScript API許可を外し、Maps Embed APIだけに限定。リファラー制限は維持。/api/maps-keyは410、/api/embed-keyは認証・同一オリジンを検証して返す。地図の共有カウンターは過去値を保持するが新規加算・上限判定はしない。検索と写真の共有上限は継続。[料金比較](EMBED_COST_REVIEW.md)参照。
