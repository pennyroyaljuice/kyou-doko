# アーキテクチャ

Next.js App Router形式 + React + TypeScript。公開版はSites提供のVinext互換ビルドでCloudflare Workersへ配置します。検索はWorker側へ分離して秘密キーを隠し、ブラウザーは表示とGPSを担います。既存のNext.jsローカル版は隣の`kyou-doko`に維持しました。

公開時点ではGoogleキーを設定せずデモのみ提供。Sitesの所有者限定アクセスで、同じアカウントのスマートフォンから利用します。Sites管理のGitリポジトリと、ユーザーのGitHubリポジトリは別物です。

```text
app/page.tsx → POST /api/search → application search service
                                      ↓ DiscoveryProvider
                                  GoogleProvider / DemoProvider
browser MapView → Maps JavaScript API（公開・制限キー）
```

`lib/domain.ts`が入力検証・型・ランキング、`lib/providers.ts`がプロバイダー契約、`lib/google.ts`がGoogle HTTPアクセス、`lib/demo.ts`が完全分離した固定体験データ。`lib/search.ts`が起点解決・候補探索・往復計算を統合。外部ナビURLは`lib/navigation.ts`。将来データソースを変える際は提供元情報を維持しGoogleデータとOSM表示を混ぜない。

Googleデータの永続保存・キャッシュを行わない。fetchはno-store、API応答もCache-Control: no-store。検索内容は開いている画面のメモリーのみ、ログに起点やGoogleレスポンス・キーを記録しない。GPS取得はクリック時のみ。リアル検索開始時にGoogleへの位置送信を説明。

PlacesはNearby Search 1件、手入力の起点はText Search最大1件、経路は8件×片道1/往復2。直線距離が上限超過の候補は経路リクエスト前に除外。最大並列2、HTTPタイムアウト10秒。サーバー内で検索同時実行1、10秒間隔、1時間最大30回。プロセス再起動・複数プロセスでリセットされるため、本番は認証と共有ストア制限へ置換。

一部の経路が存在しない場合は除外して件数を通知。Googleの認証・課金・割当・通信障害は検索失敗として扱い、0件と混同しない。APIのエラー詳細をクライアントへ転送しない。

探索半径は移動手段別の仮速度から上限を推定し、最大50km。経路時間の近さで事後ランキングする有限探索であり、指定時間ちょうどの目的地や全スポット網羅を保証しない。滞在ゼロの往復は実際の帰宅時刻予測ではない。


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
