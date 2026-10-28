# 18種のモデル比較・評価ツール

アプリと独立した開発用ツールです。通常のビルドへ取り込まず、画面・モデル・しきい値は変更しません。学習写真やモデル重みをリポジトリへ追加するものでもありません。

## 対象と候補

`species.json` の18種が今回の対象です。ヤギとヒツジは種単位で別集計し、描画では既存のヤギ・ヒツジグループへ対応します。ヤブイヌは現在の認識ラベルに含まれますが描画課題は未対応です。

候補は現行CLIPを基準に、**MobileNetV3 Smallの追加学習**を第一候補、**EfficientNet-Lite0の追加学習**を比較候補とします。両候補の公開済み重みはImageNet用で、今回の18種専用モデルではありません。現段階で差し替えても精度を保証できないため、アプリへは導入していません。モデルカード・選定根拠は [検討資料](../../docs/MODEL_30_REVIEW.md) を参照してください。

データの検査・現行モデルの一括推論・集計は既存のNode.js／npm環境で実行します。追加した[学習・量子化・ブラウザ検証ツール](training/README.md)はMac内の専用Python環境で実行し、アプリの依存を増やしません。実写写真での追加学習と園内精度の検証は未実施です。

## 1. 写真を準備する

Git管理外の `work/model-evaluation/` に写真とデータセットJSONを置きます。提供者が利用を許可した写真を使用し、参加者の撮影写真を自動的に転用しないでください。ノート・研究記録から写真を取り出す処理はありません。

```sh
mkdir -p work/model-evaluation/photos
cp tools/recognition/dataset.example.json work/model-evaluation/dataset.json
npm run recognition:lab -- species
```

JSON例（写真を用意してからsamplesへ追加。下記は形式例で実際の写真ではありません）：

```json
{
  "version": 1,
  "samples": [
    {
      "id": "goat-test-001",
      "speciesId": "goat",
      "split": "test",
      "captureGroup": "goat-individual-a",
      "file": "photos/goat-test-001.jpg",
      "usagePermission": "撮影者自身が学習・評価への利用を許可"
    }
  ]
}
```

- 種IDは `species.json` にある18種、対象外・空の展示・人物などは `unknown`。
- splitは `train`（学習）、`validation`（しきい値調整）、`test`（最終評価）。テスト結果を見ながらモデルやしきい値を調整しない。
- captureGroupは同じ個体・連写など、分割をまたがせない写真に共通のID。同じ個体なら撮影日が異なっても同じグループへまとめる。IDの記述だけで実際の重複や個体の一致を自動確認することはできない。
- 相対パスのPNG/JPEG/WebPのみ。外部URL、フォルダ外のシンボリックリンク、同一バイナリの重複、種ID・画像ID・利用条件の不備を検出する。
- 遠景・横向き・柵・逆光・遮蔽を含める。1枚ずつ揃っても精度検証に十分とは言えない。画像の意味・画質・ラベルの正しさは人が確認する。

```sh
npm run recognition:lab -- check work/model-evaluation/dataset.json
```

全18種とunknownについてsplit別枚数と不足項目を出力します。終了コード0は全項目に画像あり、2は不足あり、1は不正データです。空の同梱テンプレートは**不足あり（2）**になります。学習写真がまだなくても、test写真だけで現行モデルの限定的な評価は実行できます。その際も未評価の種を明示します。

## 2. 現行CLIPを実際の写真で評価する

ローカルの公開用ビルドを使います。初回はモデル取得が必要で通信・容量を使用します。現在の `src/recognition/` は変更せず、そのビルド済みWorkerを呼び出します。18種を同時に推論するのではなく、同じWorkerで1枚ずつ処理します。写真はメモリ上のdata URLとして渡し、推論結果JSONに画像やパスは含めません。モデル配信元への通信はありますが、写真を送信するAPIは使用しません。

```sh
VITE_BASE_PATH=/mitsukeru-pages/ npm run build
VITE_BASE_PATH=/mitsukeru-pages/ npm run preview -- --host 127.0.0.1 --port 4176
# 別のターミナル
npm run recognition:current -- work/model-evaluation/dataset.json http://127.0.0.1:4176/mitsukeru-pages/ work/model-evaluation/clip-results.json
```

`test`が空ならモデルのダウンロード前に終了します。既存の出力ファイルへ上書きしません。タイムアウト・ブラウザ実行エラーの場合は結果を完成扱いせず終了します。推論器が返したunavailableは失敗として残します。実行はChromiumであり、iPhoneでの速度測定ではありません。

## 3. 成績を集計する

```sh
npm run recognition:lab -- evaluate work/model-evaluation/dataset.json work/model-evaluation/clip-results.json work/model-evaluation/clip-report.json
```

testの全画像に対して、ちょうど1件の結果が必要です。画像を除外して精度を高く見せることを防ぐため、結果の欠落・重複・余分なIDを拒否します。

- 自動確定率、自動確定したものの適合率、既知種の自動確定再現率
- 手動へ戻る割合、対象外の誤受理率、対象外として判別できた割合、実行失敗数
- 種別の評価枚数・適合率・再現率、未評価種、混同行列
- 準備後の写真入力から推論結果までの中央値・p95。結果ファイルには別途モデル準備時間も記録

`uncertain`は候補が正しくても自動確定の正解へ加えません。`unavailable`を対象外判定の成功として加えません。分母がない率は0ではなくnullとします。スコアを校正済み確率と表現したり、少数の試験から全18種対応と断定したりしません。

将来のモデルも次の形式で結果を出せば同じ集計器で比較できます。入力サイズ・前処理・モデル版、学習データ分割を揃えて記録し、比較条件を固定してください。

```json
{
  "version": 1,
  "model": "candidate-model-version",
  "results": [
    {"id":"goat-test-001","status":"identified","speciesId":"goat","elapsedMs":123}
  ]
}
```

statusはidentified／uncertain／unknown／unavailable、speciesIdは18種のIDまたはnull。対象外判定のspeciesIdはnullです。今後の候補モデルにも対象外や曖昧な画像を保留する仕組みが必要です。

## 現在の検証範囲

種の対応、分割の混入、画像重複・外部パス、評価の欠落、種別成績・誤受理率・保留・失敗の集計は自動テスト済みです。18種のネット実写198枚による試験学習と、新しい103枚による固定モデル評価を実施しました。園内精度とiPhone実測は未実施です。候補の変換・実行互換性は[学習ツール](training/README.md)で別途検証します。今回の模擬データによる集計テストは動物識別精度の証拠ではありません。
