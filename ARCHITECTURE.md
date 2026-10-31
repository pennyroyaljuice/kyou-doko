# アーキテクチャ

Next.js App Router + React + TypeScript。検索をNodeサーバーへ分離して秘密キーを隠し、ブラウザーは表示とGPSを担うため、指定の第一候補を採用。

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
