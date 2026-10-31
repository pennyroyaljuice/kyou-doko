# Embed移行の料金リスク比較

確認日：2026-11-01。金額はGoogleのグローバル公示USD価格、税・為替・契約割引を除く。請求明細の実測ではない。

| 項目 | 従来版 | Embed版 |
|---|---|---|
| 地図表示 | Dynamic Maps、月10,000無料、以降最初の価格帯は1,000回あたり7 USD | Maps Embed API、無料・回数上限なし |
| 地図11,000回/月の例 | 7 USD | 0 USD |
| 地図20,000回/月の例 | 70 USD | 0 USD |
| キー再利用のリスク | 発行制限だけでは取得後の地図ロードを制限できない | ブラウザーキーをEmbed APIだけに限定し有料JavaScript地図で使えなくする |
| 表示機能 | 全候補ピン、往復経路線 | 選択した目的地の位置。経路の詳細は外部ナビ |
| 候補検索・経路・写真 | 無料枠超過で有料 | 変更なし |

例は同じ請求先で他の地図利用がない場合。価格帯を超える大量利用は別単価になる。

## 残るAPI費用

Nearby Search ProとText Search Proはそれぞれ月5,000無料、その後最初の価格帯は1,000件32 USD。Compute Routes Essentialsは月10,000無料、その後1,000件5 USD。Place Details Photosは月1,000無料、その後1,000件7 USD。

現在は1アカウント1日3検索、全体1日10検索・直近32日100検索、写真直近32日500件の上限をサーバーで維持。検索1回の最大はNearby 4回、起点Text 1回、Routes 16回。100検索なら各400・100・1,600回になる。地図の切替は検索回数を消費しない。

有料枠で全項目の上限呼出しが発生する場合、写真を除く検索原価の例は0.296 USD/回。地図1表示を含む旧版の0.303 USD/回から0.296 USD/回となる。主な効果は検索単価よりも地図表示の予期せぬ増加への対策である。

無料枠は請求先アカウント単位のSKU利用で集計される。同じ請求先の他アプリ、過去の利用、別キーの悪用、アプリ外の呼出しはアプリ上限の対象外。全Google請求が必ずゼロになるという保証ではない。Google Cloudのメール通知も停止上限ではない。試用クレジットの終了と月次無料枠は別扱い。

## 実装・検証

JavaScript APIローダーと経路描画を削除。iframeはplaceモードのみで目的地IDまたは座標を渡し、起点は渡さない。ブラウザーキーは従来と同じ環境変数名だがEmbed専用・既存リファラー制限を維持する。旧キー発行APIは410、新APIは同一オリジンとログインを検証。地図カウンターは過去値だけ保持し新規加算しない。

105件の自動テスト、型チェック、公開用ビルドを通過。実検索・公開画面の表示は下記の確認記録に追記する。Google請求明細の確定値や長期間の運用費は今回の検証対象外。

## 公式資料

- [Maps Embed API料金と割当](https://developers.google.com/maps/documentation/embed/usage-and-billing)
- [Google Maps Platform料金表](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Embedのモード・パラメーター](https://developers.google.com/maps/documentation/embed/embedding-map)
- [Embed APIキーと制限](https://developers.google.com/maps/documentation/embed/get-api-key)


### 公開先の確認記録

2026-11-01：Google Cloud画面でMapsキーの許可APIがMaps Embed APIの1件のみ、ウェブサイト制限と既存2リファラーを維持したことを保存後の再読込で確認。公開先で東京駅からの実検索を行い、目的地地図の正常描画、別候補への切替、切替前後で残検索1回が維持されることを確認。DOMでMaps JavaScript APIローダー0件、iframeが/maps/embed/v1/place、originパラメーターなしを確認。課金明細の実測ではなく、公式単価と呼出し構成による検証。
