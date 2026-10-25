# 観察ノート（IndexedDB保存とPNG書き出し）

比較画面または解説画面で「観察を保存する」を押すと、IndexedDB（`zooketch.observation-notebook` の `observations` ストア）へ観察カードを保存します。画面上部の「観察ノート」から一覧表示・再比較・PNG保存・個別削除ができます。

## 保存内容（`src/notebook/types.ts`）

- 記録ID（`id`）
- 課題ID（`taskId`）・グループID（`groupId`）
- 動物名（`animalName`）
- 観察課題名（`taskName`）
- 観察日時（`createdAt`）
- ユーザーが描いた線データ（`strokes`）と合成済みPNG（`ownPng`）
- お手本PNG（`answerPng`）および自分の絵と正解を並べた比較画像PNG（`comparisonPng`）
- 解説文章（`explanation`）と次の問い（`question`）
- 描画時のシーン構造スナップショット（`sceneSnapshot`）

撮影写真、認識スコア、個人情報、位置情報は保存しません。

## 旧データからの移行（`src/notebook/storage.ts`）

- 旧バージョンの `localStorage`（`mitsukeru.collection.v1`）に保存データがある場合、初回起動時にデータを消さずにIndexedDBへ自動移行します。
- 元の `localStorage` データはバックアップとして残しつつ、移行完了フラグをIndexedDBの `settings` ストアに記録するため、移行後に観察ノートから削除したカードが再読込で復活することはありません。
- 移行された旧データでPNGを開く際は、その場で背景・描画・お手本からPNGを合成して保存します。

## 画像の書き出し（`src/notebook/images.ts`）

- **自分の絵をPNGで保存**：動物の未完成背景とユーザーの描画線を合成した完成PNGを出力します。
- **比較画像をPNGで保存**：左に自分の絵、右にお手本（正解イラスト）を合成した比較PNGを出力します。
- iPhone/iPadではWeb Share APIが利用できれば共有を試し、それ以外は `<a download>` で保存します。実機の共有シートの挙動は未検証です。
- 書き出し時に動物名・特徴・観察日・短い解説を付けたカードにします。ノート内の合成済みPNGを変更しないため、過去の記録は保持します。
