# API調査・設計判断

確認日：2026-10-31。公式ドキュメントによる調査。料金・地域提供状況は変更されるのでキー設定時にも再確認する。

## 現行料金

グローバル従量料金、USD、無料枠超過後の最初の有料階層（10万イベントまで）・1,000イベント単価。請求先単位で合算。税・為替・地域契約・ボリューム割引は別。

| SKU | 月間無料イベント | 1,000イベント単価 |
|---|---:|---:|
| Dynamic Maps | 10,000 | $7 |
| Places Nearby Search Pro | 5,000 | $32 |
| Places Text Search Pro | 5,000 | $32 |
| Routes Compute Routes Essentials | 10,000 | $5 |
| Routes Compute Routes Pro | 5,000 | $10 |

出典：[公式価格表](https://developers.google.com/maps/billing-and-pricing/pricing)。旧$200/月クレジットではなくSKUごとの無料枠。[料金体系](https://developers.google.com/maps/billing-and-pricing/overview)。本実装は渋滞考慮なし・基本フィールドによるEssentials経路を意図するが、最終SKUはCloud Consoleで確認。

無料枠を使い切った状態で、住所起点・8候補の往復検索は Text Search×1 + Nearby×1 + Routes×16 = 約$0.144。初回地図ロードは別途約$0.007。緯度経度起点ならText Search不要。検索回数ではなく各SKUイベントが課金単位。地図インスタンスは候補切替で再利用するが、画面再読込・モード切替による新規ロードには注意。

## 規約と保存・表示

- [Google Maps Platform利用規約](https://cloud.google.com/maps-platform/terms)および[サービス固有規約](https://cloud.google.com/maps-platform/terms/maps-service-terms)に従う。EEA請求先には別契約・機能差がある。今回は日本でのローカル確認を想定。
- [Placesポリシー](https://developers.google.com/maps/documentation/places/web-service/policies)、[Routesポリシー](https://developers.google.com/maps/documentation/routes/policies)：先読み・保存・キャッシュは原則制限され、place IDは例外。本MVPでは例外に頼らず結果を永続保存しない。APIとfetchにno-storeを指定。
- Googleの結果を地図に表示する場合はGoogle地図を使う。独自概念図はGoogleデータから生成しない。地図なしの表示にもGoogleの帰属表示、提供された第三者帰属を表示。写真・レビューは取得しない。
- 利用規約・プライバシーポリシーの公開が必要。雛形ページを用意したが、公開前には運営者・連絡先等の確定と確認が必要。
- OSMを将来使う場合は独立プロバイダーとし、ODbL帰属・タイル提供元の利用ポリシーを別途確認。GoogleコンテンツをOSMへ転記しない。

## 移動手段と地域

[Routes車種一覧](https://developers.google.com/maps/documentation/routes/vehicles)にDRIVE・TRANSIT・BICYCLE・WALKがある。BICYCLEは人力自転車で、TWO_WHEELER（オートバイ）とは異なる。徒歩・自転車はベータ扱いで歩道等の不足に関する警告を画面に表示。

[地域カバレッジ](https://developers.google.com/maps/coverage)の国別情報は変動し、公共交通の網羅的カバレッジは公表されていない。日本のGoogle Mapsアプリで経路が表示されることからAPI対応を推定しない。指定modeをそのままRoutesへ渡し、空結果は非対応/経路なしとして明示。他モードへ置換しない。実キー・現地での対応範囲は未検証。

[公共交通](https://developers.google.com/maps/documentation/routes/transit-route)は中間経由地に非対応。鉄道優先の設定は鉄道だけを保証するものではない。MVPではサーバーの検索時刻に出発、往路到着直後の復路を取得し、滞在時間は含めない。滞在後の実際の帰宅時刻を保証しない。車は渋滞を考慮せずコストを抑える。

## 外部起動

[Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)：APIキー不要、`api=1`、origin/destination/travelmodeをURLエンコードして渡す。経由地は環境で上限が異なり、モバイルブラウザーは3件、その他は最大9件。関数は安全側で3件に制限。公共交通では経由地を送らない。ポリラインそのものは渡せず、外部側が再計算する。往復は往路/復路の別リンクで提供。

[Yahoo!カーナビ公式URLスキーム](https://note.com/yahoo_carnavi/n/n1d6b819a816c)：`yjcarnavi://navi/select?lat=...&lon=...&name=...`、アプリ導入済み端末が必要。公式記事は2020年時点の仕様なので現端末試験は別途必要。経由地最大3件の構文も紹介されているがMVPでは目的地のみ送る。端末現在地から再計算し、本アプリ起点を維持しないことを明示。アプリ導入有無をWebから確実に検出しようとしない。

## 課金抑制

必要フィールドだけのFieldMask、最大8候補、探索半径50km、並列2、直線距離による事前除外、明示送信のみ（入力ごとのAPI呼出なし）、課金なし再抽選。概要は住所/種別で構成し高価な要約・写真を不要にした。候補探索が人気順8件なので目的時間に近い場所の網羅性は限定される。

Cloud ConsoleでAPIごとの割当制限、予算通知、利用量監視を設定。予算通知は課金の強制停止ではない。Mapsブラウザーキーはリファラー/API制限、サーバーキーはAPI/IP制限、Git・ログへ出さない。現ローカルのプロセス内レート制限だけで公開しない。本番は認証、共有カウンター、異常検知、同一検索の実行重複抑制を追加する。
