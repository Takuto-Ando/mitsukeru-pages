# 端末内の種識別モデル

京都市動物園の公式図鑑98種と、既存課題のシマウマを BioCLIP ViT-B/16 で候補にします。撮影画像とプレビューのフレームはブラウザの Worker 内で処理し、推論時に外部へ送信しません。配信サーバーから取得するのは重みファイルです。初回に約87.4 MBをダウンロードして端末にキャッシュします。デザイン用のプレビューや図鑑画像はモデルの学習やベクトル生成に使用していません。

候補には英語名を使います。屋外の景色、柵、人、図鑑にない動物のラベルも比較し、図鑑の候補と点差が小さい場合は判定を控えます。似た種の比較に使うスコアは、候補集合の中での相対値です。

## モデルとラベルベクトルの出典

- [Imageomics BioCLIP](https://huggingface.co/imageomics/bioclip)。Stevens et al., _BioCLIP: A Vision Foundation Model for the Tree of Life_, CVPR 2024
- [ブラウザ向けint8画像エンコーダー](https://huggingface.co/Virien/naturdex-bioclip-onnx/tree/fa3c062ea31a6e1881b1977fe555b2d481dca730)。実行時に使用
- [テキストエンコーダー・トークナイザー](https://huggingface.co/jsteinshouer/trail-bingo-bioclip-onnx/tree/25d50dd481d6a748ce78c8bc513a420bf7d3d279)。ラベル埋め込みの生成時のみ使用

候補を追加・変更した場合は、上記固定リビジョンの `text_encoder_fp16.onnx` と `tokenizer.json` を取得し、`numpy`、`onnxruntime`、`tokenizers` を入れたPython環境で次を実行します。アプリの依存関係には不要です。

```sh
python tools/recognition/export-bioclip-labels.py text_encoder_fp16.onnx tokenizer.json
npm test
```

埋め込みは種ごとに512要素をint8に量子化します。カメラの位置検出とは別の処理です。

## 認識の確認

WebKitの同じ計測環境で、各画像を1回ずつ種識別Workerに渡しました。初回のモデル転送時間は含みません。

| 試験                                        | 旧CLIP | BioCLIP |
| ------------------------------------------- | -----: | ------: |
| 公式図鑑98種の写真で1位が正しい             |  38/98 |   78/98 |
| 公式図鑑98種の写真で表示候補の3位以内       |  55/98 |   86/98 |
| 別写真セットの対象内86枚で1位が正しい       |  41/86 |   62/86 |
| 別写真セットの対象内86枚で表示候補の3位以内 |  44/86 |   73/86 |
| 別写真セットの対象外17枚で候補を返した      |   6/17 |    0/17 |
| 公式図鑑写真の推論中央値                    | 247 ms |  860 ms |
| モデルを端末に保存済みのときのWorker準備    | 5.25 s |  0.27 s |

別写真セットは既存の Commons 評価データです。公式図鑑写真は1種1枚で、別写真セットも図鑑の一部の種が中心です。実機カメラでの種ごとの精度は別途検証が必要です。

撮影後の処理と同様に、白枠の位置から切り出し、判定が曖昧な場合に写真全体を照合する追加比較も行いました。公式図鑑の写真は1位79/98、3位以内87/98でした。検出と最大2回の推論を含む中央値は923 ms、95パーセンタイルは1.8秒です。コールダックは切り出しでマガモと判定した例がありました。

| 位置検出Workerの試験                  | 変更前 | 変更後 |
| ------------------------------------- | -----: | -----: |
| 公式図鑑98種の写真で枠を返した        |  77/98 |  83/98 |
| 被写体を60%に縮小した写真で枠を返した |  75/98 |  85/98 |
| 公式図鑑写真の推論中央値              |  45 ms |  46 ms |

位置検出の数字は、枠を返した写真の数です。枠の位置の正確さを示す数字ではありません。変更後もは虫類・両生類は13/25、魚は0/1でした。実際のカメラでは低いスコアの枠を連続する2フレームで確認します。

## BioCLIP ライセンス

```text
Copyright (c) 2023-2024 Imageomics Institute

Copyright (c) 2012-2021 Gabriel Ilharco, Mitchell Wortsman,
Nicholas Carlini, Rohan Taori, Achal Dave, Vaishaal Shankar,
John Miller, Hongseok Namkoong, Hannaneh Hajishirzi, Ali Farhadi,
Ludwig Schmidt

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

```
