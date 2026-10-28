# 軽量な18種分類モデルの学習・変換・検証

公開アプリへ自動導入しない、Mac用の開発ツールです。学習用ライブラリ、写真、候補重みは `work/` に置き、通常のWebビルドへ含めません。公開モデルのCLIP・ラベル・しきい値は維持します。

## 候補と目標

- 第一候補：`mobilenetv3_small_100.lamb_in1k`。容量・処理量を優先。
- 比較候補：`mobilenetv3_large_100.ra_in1k`。Smallで似た種の区別が難しい場合の精度とのバランスを比較。
- 同じ18種・データ分割でFP32と静的INT8（QDQ）を比較。INT8は常に速い／常に同じ精度とは限らない。
- 当面の開発目標：配布モデル5MiB程度以下、準備後のiPhone推論p95が500ms以下。**実測結果・保証ではない**。速度が達成できても、種別成績と対象外の誤確定が悪ければ採用しない。
- 自動確定の仮基準は検証データで選ぶ。適合率のWilson 95%区間の下限が0.95以上、対象外の誤受理率の上限が0.05以下を探索条件とする。少数の写真で「誤りゼロ」でも自動採用しない。繰り返し探索による選択の偏りがあるため、独立した最終テストと実機確認は必須。

モデルの公開ImageNet成績を、このアプリの18種の識別精度として扱わない。Small／Largeはアーキテクチャ比較であり、精度改善が実証済みという意味ではない。写真の質・枚数・撮影条件が不十分なら追加収集する。

## 環境

既存のNode環境に加えて、学習用Python環境だけを作る。

```sh
python3 -m venv work/recognition-venv
work/recognition-venv/bin/python -m pip install -r tools/recognition/training/requirements.txt
```

本アプリのnpm依存は増やさない。M2では学習にMPSを利用可能なら使用するが、測定の比較はCPU／ブラウザそれぞれ条件を固定する。メモリが厳しい場合はbatch-sizeを下げる。

## 実写データの準備

[親ディレクトリの手順](../README.md)で、利用許可のある写真と `work/model-evaluation/dataset.json` を用意する。既存の動物イラストや、ユーザーの研究・撮影データを無断で学習に転用しない。

- train：18種の追加学習、INT8のキャリブレーション。
- validation：18種の成績でチェックポイントを選び、対象外写真を含めて自動確定しきい値を選ぶ。
- test：モデル／量子化／しきい値を固定した後の最終評価。学習やしきい値探索には使用しない。
- 同じ個体・連写をsplitにまたがせない。train／validationに18種が揃うまで学習を開始しない。
- データセットJSONと全画像のハッシュを記録し、変換・評価時に変更を検出する。データを増やす場合は分割を確認して新しいrunを作る。

## ネット上の写真候補を集める

ユーザーの許可を得て、Wikimedia Commonsから実写候補を収集するツールを追加した。公式動物園サイトの画像を無断で再利用しない。

```sh
work/recognition-venv/bin/python tools/recognition/training/collect_commons.py \
  --out work/commons-photo-candidates --per-species 12
work/recognition-venv/bin/python tools/recognition/training/photo_review.py \
  work/commons-photo-candidates/review-queue.json
```

出典ページ・撮影者・ライセンス・元画像のSHA-1・取得画像のSHA-256を記録し、JPEGのみを収集する。対象外のトラ・ライオン・猫・犬も少数集める。収集物は公開アプリへ配信しない。検索結果は動物名や実写を保証しないので `reviewStatus: pending` の確認待ちキューに置き、学習用manifestを自動生成しない。`review/index.html` と種別一覧画像で目視確認し、個々のファイルページで利用条件と帰属表示を確認する。[Commonsの再利用案内](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)を参照。

写真・種ラベル・利用条件を確認したものだけ `reviewStatus: approved` とし、親ディレクトリのmanifest形式へ移す。未確認・除外済みの行は検査で拒否する。撮影者ごとの共通captureGroupを初期値とするが、同じ個体・撮影場所・連写の追加確認も必要。別splitへ分散させて枚数を水増ししない。画像の完全重複も検査する。少数のネット写真はパイロット用であり、園内の実運用精度の根拠にはならない。

## 2026-10-27の速度測定

Apple M2上のPlaywright WebKit、WASM 1スレッド、224×224の模擬入力、準備後10回。乱数初期化モデルでの演算試験で、動物識別精度・iPhone実機の測定ではない。前処理は含まない。

| 候補 | 容量（10進MB） | 中央値 | p95 |
| --- | ---: | ---: | ---: |
| Small FP32 | 6.15 MB | 8.5 ms | 9 ms |
| Small INT8 | 1.86 MB | 11 ms | 12 ms |
| Large FP32 | 16.89 MB | 21 ms | 22 ms |
| Large INT8 | 4.71 MB | 28.5 ms | 30 ms |

**INT8は小さいが、今回のブラウザ条件では遅かった。** Small FP32も候補として残す。Chromiumでも同傾向。生データは [測定JSON](benchmarks/2026-10-27-mac-arm64.json)。この表は模擬入力のみ。後続の実写パイロット結果は下記を参照。公開アプリの現行CLIPは変更していない。

## 追加学習

```sh
work/recognition-venv/bin/python tools/recognition/training/pipeline.py train \
  --dataset work/model-evaluation/dataset.json --model small \
  --out work/model-small-v1 --epochs 10 --warmup-epochs 2 --batch-size 16
```

ImageNetの事前学習重みを取得し、出力を18種へ変更。最初に分類層を学習し、その後全体を微調整する。控えめな切り出し・色変化とクラス頻度補正を使い、検証種別再現率の平均が最も高い重みを保存する。未知種は18種のラベルへ押し込んで学習しない。自動確定の保留は別工程で検証する。

Largeは `--model large --out work/model-large-v1` として同じ写真分割で比較する。epochや枚数の設定は初期値であり、10epochで精度が足りるという意味ではない。既存runは上書きしない。

## ONNX／INT8へ変換

```sh
work/recognition-venv/bin/python tools/recognition/training/pipeline.py export \
  --run work/model-small-v1 --quantize --dataset work/model-evaluation/dataset.json
```

`export/` にFP32／INT8のONNX、前処理・ラベル情報、キャリブレーションに使用したtrain画像IDを保存する。最大128枚をクラス順に偏りなく選択し、validation／test写真は使わない。ONNX checkerで形式を確認し、ブラウザで演算が動くことも別途測定する。正規化・リサイズ・中央切り出しはtimmのモデル設定に従う。将来の本番入力処理でも同じ設定を実装し、一致検証してから採用する。

## しきい値の探索と最終評価

まずvalidationの候補スコアを生成。ポリシー未指定では自動確定せずuncertainを出す。

```sh
work/recognition-venv/bin/python tools/recognition/training/pipeline.py predict \
  --dataset work/model-evaluation/dataset.json \
  --model-file work/model-small-v1/export/model.int8.onnx --split validation \
  --out work/model-small-v1/validation.json
work/recognition-venv/bin/python tools/recognition/training/selection.py \
  --dataset work/model-evaluation/dataset.json --predictions work/model-small-v1/validation.json \
  --out work/model-small-v1/policy.json
```

証拠が足りない場合は `acceptanceEnabled: false`。対象外写真の不足、過度な誤確定、少なすぎる検証枚数では自動確定を有効にしない。候補スコアのsoftmax値は、正解確率として校正済みではない。

```sh
work/recognition-venv/bin/python tools/recognition/training/pipeline.py predict \
  --dataset work/model-evaluation/dataset.json \
  --model-file work/model-small-v1/export/model.int8.onnx --split test \
  --policy work/model-small-v1/policy.json --out work/model-small-v1/test.json
npm run recognition:lab -- evaluate work/model-evaluation/dataset.json \
  work/model-small-v1/test.json work/model-small-v1/report.json
```

ポリシーはモデルのSHA-256へ結び付ける。FP32とINT8は別々にしきい値を検証し、混用しない。集計では自動確定の適合率・再現率と、既知種の候補1位の正答率（`knownCandidateTop1Accuracy`）を分ける。候補1位が合っていても、自動確定した正解へ水増ししない。

## ブラウザでの容量・互換性・処理時間

```sh
node tools/recognition/training/browser-benchmark.mjs \
  work/model-small-v1/export work/model-small-v1/webkit.json webkit
node tools/recognition/training/browser-benchmark.mjs \
  work/model-small-v1/export work/model-small-v1/chromium.json chromium
```

127.0.0.1だけに一時サーバーを作り、既存ONNX RuntimeのWASMでFP32／INT8を順番に実行。外部ネットワークを遮断し、終了時にサーバー・ブラウザを閉じる。準備、初回、準備後10回の中央値・p95、モデルファイルサイズを出力する。前処理を除く模擬テンソルでの演算試験で、動物識別精度やiPhone実機の速度ではない。2モデル目はランタイムを再利用するので準備時間の単純比較には使わない。

アプリへの組み込み時は、写真のリサイズ等を含む時間もiPhone Safariで計測する。量子化が小さくても遅い端末ではFP32も候補に残す。

## 写真なしで実装のつながりだけを確認

```sh
work/recognition-venv/bin/python tools/recognition/training/pipeline.py smoke \
  --model small --out work/candidate-small-smoke
node tools/recognition/training/browser-benchmark.mjs \
  work/candidate-small-smoke work/candidate-small-smoke/webkit.json webkit
```

乱数で初期化したモデルを模擬テンソルで1回更新し、ONNX変換・静的量子化・CPU実行・ブラウザ実行を検証する。事前学習重みも写真も取得しない。生成物は**動物識別に使えるモデルではない**。メタデータと学習完了フラグがないため通常のpredictへ渡しても拒否する。

## 出典

- [MobileNetV3 Small](https://huggingface.co/timm/mobilenetv3_small_100.lamb_in1k)、[Large](https://huggingface.co/timm/mobilenetv3_large_100.ra_in1k)：事前学習重みとモデル仕様。
- [ONNX Runtimeの量子化](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)：CNNでの静的量子化と精度低下の確認。
- [PyTorch公式導入方法](https://pytorch.org/get-started/locally/)と[timm学習スクリプト](https://huggingface.co/docs/timm/main/en/training_script)。

2026-10-27の初回収集は18ラベル214枚＋対象外20枚＝234枚。初回の部分確認では15枚を除外し、残りは未確認扱いとして記録した。その後の全候補確認・198枚の採用は下記パイロットに記載。元の候補キュー自体を学習用データとして扱わない。[収集・除外例の記録](benchmarks/2026-10-27-photo-collection.json)。ローカルの写真・帰属表示・確認一覧は `work/commons-photo-candidates-v3/` にある。

## 実写パイロット（2026-10-27・未公開モデル）

全候補の一覧画像と出典のタイトル・説明・利用条件メタデータを確認し、198枚を小規模試験に採用した。元の検索候補は残し、採用IDと追加の撮影グループ結合を `work/commons-photo-candidates-v3/pilot-review.json` に記録している。種の同定は専門家による独立検証ではない。

```sh
work/recognition-venv/bin/python tools/recognition/training/prepare_dataset.py \
  --queue work/commons-photo-candidates-v3/review-queue.json \
  --decisions work/commons-photo-candidates-v3/pilot-review.json \
  --out work/commons-pilot-new
```

このコマンドは明示された採用IDだけを使用する。撮影者グループに加え、同じ個体・場所と思われる写真のグループを結合する。分割の探索はラベル・グループの枚数だけを使用し、モデル結果は参照しない。分割を確定して学習を始めた後はmanifestを固定する。初回 `commons-pilot-v1` の分割は、後から追加したグループ単位のバランス修正を適用せず保存しているため、新規実行と同一になるとは限らない。

Small／Large × 全体微調整／分類層のみの4候補を比較した。分類層のみの実行は `--epochs 30 --warmup-epochs 30 --batch-size 8`。全体微調整は10epoch・最初2epoch分類層のみ。モデル選択に使う検証写真は既知39枚・対象外11枚で、独立した元のテスト側は既知47枚・対象外3枚。非常に小さく、種類によってはテストが1枚しかない。

| 候補 | 元のテスト写真での候補1位正答（47枚） |
| --- | ---: |
| Small 全体微調整 FP32 | 20 / 47 |
| Small 分類層のみ FP32 | 31 / 47 |
| Large 全体微調整 FP32 | 22 / 47 |
| Large 分類層のみ FP32 | 36 / 47 |

現行アプリのCLIPは、返された候補が正しかった写真25/47、自動確定した31件中正しかったもの21件。保留・対象外判定では種名を返さないため、これはCLIPの生のargmax正答率とは異なり、そのまま学習モデルの生の候補正答率と同等に扱わない。対象外のテストは3枚だけで、拒否精度の証明にはならない。園内・実機での精度、上流の事前学習データとの重複は未検証。

### 重みだけの圧縮

通常の静的INT8では成績の低下が大きい候補があったため、Conv/Gemm/MatMulの定数重みだけをチャンネルごとにINT8で保存し、`DequantizeLinear`でFP32へ戻して計算する方式を追加した。計算途中の値はFP32のまま。写真をキャリブレーションに使わない。これは**配布サイズの圧縮**であり、実行時メモリ削減を保証しない。[ONNX仕様](https://onnx.ai/onnx/operators/onnx__DequantizeLinear.html)に準拠する。

```sh
work/recognition-venv/bin/python tools/recognition/training/weight_only.py \
  work/model-large-head-pilot-v1/export/model.fp32.onnx \
  work/model-large-head-pilot-v1/export/model.weight-int8.onnx
```

Large分類層のみモデルで、16,887,538→4,414,708 bytes（約74%減）。既知の検証写真ではFP32と同じ24/39正答、種ごとの再現率平均65.3%。Mac WebKitの模擬入力は中央値22ms・p95 23ms。この方式は最初のテスト成績を見た後に追加したため、下記の新しい評価セットで追試した。元のテストを再利用して改善を証明したとは扱わない。WebKitの動作は確認したが、iPhone実機のメモリ・速度・写真前処理との統合は未検証。

全候補の自動確定ポリシーは `acceptanceEnabled: false`。検証枚数・精度とも採用条件に不足し、公開モデルの差し替えは行っていない。次に追加する写真はヤギ、フサオマキザル、ヤブイヌ、アカゲザル、ニホンジカなどを優先し、対象外も動物4種以外の風景・空の展示・柵などへ広げる。

[学習設定・種別集計・圧縮・ブラウザ測定の記録](benchmarks/2026-10-27-pilot.json)。ローカルの候補モデルは `work/model-large-head-pilot-v1/export/`、固定データは `work/commons-pilot-v1/`。写真・モデル重みはGitやWeb配信に含めていない。

検証：通常の単体テスト150件、Pythonの独立テスト13件。実ライブラリによる模擬学習→FP32/INT8/重み圧縮→推論→データ改変拒否の統合確認、および実写198枚での学習・評価を実行した。実写の成績とソフトウェアテストの成功は区別する。

## 固定モデルの新しい評価写真（2026-10-27）

元の198枚とその撮影者を除外して164枚を収集し、モデルの出力を見る前に103枚（既知86・対象外17）を採用した。同一撮影者・ラベルは最大2枚。写真ID、撮影者、captureGroup、ファイル内容が元データと重ならないことを検査する。異なる撮影者による同一個体や、事前学習画像との重複まで保証するものではない。

固定したLarge分類層のみモデルの候補1位は、FP32で54/86（62.8%）、重みINT8で52/86（60.5%）。全103枚中98枚で候補1位が一致。軽量化の効果はあるが、実用精度を満たしたとは扱わない。対象外17枚も全件保留であり、対象外を正しく識別できたという意味ではない。ヤギ1/6、ヒツジ0/2、フサオマキザル0/2、ニホンジカ0/2などは追加の学習写真が必要。今後これらの結果を踏まえて変更したモデルには、さらに別の最終評価写真を用意する。

新しいテストセットは以下のように作成・実行できる。出力先は未使用の名前にする。

```sh
work/recognition-venv/bin/python tools/recognition/training/prepare_dataset.py \
  --queue work/commons-fresh-test-candidates/review-queue.json \
  --decisions work/commons-fresh-test-candidates/review-decisions.json \
  --out work/fresh-test-new --test-only
work/recognition-venv/bin/python tools/recognition/training/pipeline.py predict \
  --dataset work/fresh-test-new/dataset.json \
  --reference-dataset work/commons-pilot-v1/dataset.json \
  --model-file work/model-large-head-pilot-v1/export/model.weight-int8.onnx \
  --policy work/model-large-head-pilot-v1/policy-weight-int8.json \
  --split test --out work/fresh-test-new/predictions.json
```

`--reference-dataset`には学習時の変更されていないデータを渡す。新規データのtrain/validation混在、元データの改変や写真・撮影者の重複を拒否する。[全種の成績と条件](benchmarks/2026-10-27-fresh-test.json)。公開モデルは変更していない。

### 現行モデルとの同一写真比較（完了：2026-10-28）

現行CLIPは返された候補の正答が52/86、自動確定54件中42件正答（77.8%）。対象外17枚は15枚を対象外とし、2枚は保留、誤った自動確定は0件だった。少数のネット写真での結果であり、園内での安全な自動遷移を保証しない。軽量候補も52/86だが全件に候補を返し、現行は候補を出さず保留・対象外にする場合があるため、同じ認識能力とは断定できない。現行の写真入力から結果までの中央値はMac Chromiumで約1,042ms。軽量候補の22msは模擬入力の計算だけなので、速度倍率として比較しない。

次の追加学習は、ヤギ・ヒツジ、フサオマキザル、ニホンジカ、ヤブイヌ、キリンを優先する。正面だけでなく横顔、遠景、柵、逆光、複数個体を含め、同じ連写を増やすより撮影者・個体・場所を分散させる。今回の103枚はテスト専用のまま固定し、学習には入れない。モデルを変更した後の最終評価には新しい未使用セットが必要。

## 追加候補：MobileNetV4 Small（2026-10-28）

[公式モデルカード](https://huggingface.co/timm/mobilenetv4_conv_small.e2400_r224_in1k)を確認し、`--model v4-small` を追加した。EfficientNet-Lite0も候補として確認したが、今回の実測はV4のみ。18クラスの分類層を30epoch、同じ固定データとseedで学習。今回も未知種の自動確定は無効。

| 同じ検証写真で比較 | 重み圧縮後の容量 | 正答 / 既知39枚 | Mac WebKit計算中央値 |
| --- | ---: | ---: | ---: |
| MobileNetV3 Large | 4.41MB | 24 / 39 | 22ms |
| MobileNetV4 Small | 2.64MB | 28 / 39 | 16ms |

V4のFP32は約10.04MBで27/39。僅差の変化から量子化で精度が上がるとは一般化しない。検証写真はcheckpoint選択に使用しており、この表は独立した最終精度ではない。過去のテストを繰り返して新モデルの優位性を主張せず、新しい未使用写真での評価を次の採用条件とする。速度は模擬テンソルによる計算のみで、撮影から結果までの時間・iPhone実測ではない。

[学習設定・全種の検証成績・速度測定](benchmarks/2026-10-28-v4-validation.json)。モデルは `work/model-v4-small-head-pilot-v1/export/` に保存し、Webアプリには同梱していない。

## 動物園から提供される写真の取り込み

ネット写真とは別に、[動物園写真の受け取りガイド](ZOO_PHOTO_GUIDE.md)と `zoo_dataset.py` / `experiment.py` を追加しました。CSVでの明示確認、個体と撮影セッションの結合、EXIF除去、3候補の逐次学習・比較表作成に対応。将来の写真の内容が未確認のため、最適モデルや精度は未確定です。
