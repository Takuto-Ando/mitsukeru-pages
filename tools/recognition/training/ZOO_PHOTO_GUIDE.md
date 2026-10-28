# 動物園の写真が届いたら

写真のフォルダをこのチャットで指定すれば、以下の準備済みツールで取り込みから候補比較まで進められます。写真の内容や枚数によって適切なモデルは変わるため、「受け取れば必ず最適になる」という保証ではありません。アプリの現行認識はそのまま維持します。

## 写真と一緒にあると助かる情報

- 動物名（現在は18種。ヤギとヒツジは別ラベル）
- 同じ個体かどうか分かる匿名の識別名。名前が不明なら、区別できない群れ全体に共通IDを付ける
- 撮影セッション（同じ連写・同じ場所/時間帯の撮影は共通ID）
- 学習・評価に使用できるという提供元の利用条件。写真やモデルの一般公開の可否は別に確認する
- 正面、横、遠景、柵越し、逆光など。連写を大量に増やすより個体・日・条件の種類を増やす
- 対象外の動物、空の展示、草木、柵などの写真も `unknown` として用意

まずは1種100〜300枚程度を収集計画の目安にできますが、必要枚数や精度の保証ではありません。少なくても不足の診断は可能です。個体が1頭しかいない種類では「未知個体へ一般化できる精度」を検証できません。分割の制約を緩めてよく見せず、追加収集や評価目的の再検討が必要です。

## 1. 写真の一覧を作る

JPEG / PNG / WebPに対応。HEIC・動画・RAWは一覧のunsupportedへ表示し、勝手に無視して学習しません。HEICは元を残してJPEG等へ書き出してください。可能なら `photos/goat/`、`photos/sheep/` など、[種ID一覧](../species.json)のフォルダへ配置します。フォルダ名はラベルの候補に使うだけで、承認はしません。

リポジトリ直下で実行します。既存のPython仮想環境を使用し、新しい依存は不要です。

```sh
work/recognition-venv/bin/python tools/recognition/training/zoo_dataset.py inventory \
  --photos /絶対パス/受け取った写真 --out work/zoo-review.csv
```

生成したCSVはUTF-8 BOM付きです。`file,speciesId,individualId,sessionId,usagePermission,reviewStatus`の列を維持して編集します。

例：`goat/a.jpg,goat,goat-A,day1-pen1,提供元がローカル学習と評価を許可,approved`

- `pending`：未確認。学習に入れない
- `approved`：種名・画質・利用条件を確認済み
- `rejected`：重複、別種、図版、判断不能など。元写真は削除しない
- `individualId`は同じ個体の別日写真でも同一にする。`sessionId`だけ変えて独立した評価写真として扱わない
- `unknown`のみ個体IDを省略可能。セッションと利用条件は必須
- 人物が主役の写真や個人情報を含む写真を不用意に承認しない。研究参加者の撮影写真を自動転用する機能ではない

## 2. 不足を確認し、分割を固定

```sh
work/recognition-venv/bin/python tools/recognition/training/zoo_dataset.py check \
  --photos /絶対パス/受け取った写真 --review work/zoo-review.csv
work/recognition-venv/bin/python tools/recognition/training/zoo_dataset.py prepare \
  --photos /絶対パス/受け取った写真 --review work/zoo-review.csv --out work/zoo-dataset-v1
```

同じ個体**または**同じ撮影セッションでつながる写真をまとめ、グループ単位でtrain/validation/testへ分割します。既知種は最低3つ、対象外は最低2つの独立グループが必要です。これは分割可能性の最低条件であり、統計的に十分な枚数ではありません。横断するグループが多いと分割できず停止します。

コピー先でEXIF回転を反映し、長辺最大1600pxのJPEGへ変換、EXIF/GPS等を除去します。元写真は変更・送信しません。完全に同じファイルと、EXIF等だけ違う同一画素の画像を拒否。似た構図・切り抜き・連写の自動検出は未実装なので、目視と個体/セッション管理が必要です。出力済みフォルダは上書きしません。

`dataset.json`、`intake-summary.json`が生成されます。後日写真を追加するときは、新しい版としてまとめ直し、同じ個体・セッションのIDを引き継いでください。旧版のテスト成績を見てモデルを変更した場合は、新しい未使用の最終評価写真も必要です。

## 3. 候補を一括学習・比較

```sh
# 実行計画とデータ不足の確認。重みはダウンロードしない
work/recognition-venv/bin/python tools/recognition/training/experiment.py \
  --dataset work/zoo-dataset-v1/dataset.json --out work/zoo-run-v1
# 実際の学習・ONNX変換・重み圧縮・検証・WebKit測定
work/recognition-venv/bin/python tools/recognition/training/experiment.py \
  --dataset work/zoo-dataset-v1/dataset.json --out work/zoo-run-v1 --execute
```

既定はMobileNetV4 Smallの分類層学習・全体微調整、MobileNetV3 Largeの分類層学習の3候補です。M2のMPSが使えれば利用し、候補は逐次実行してメモリの同時使用を抑えます。学習時間は写真枚数に依存します。事前学習重みの初回取得にはネット接続が必要ですが、写真を外部へ送る処理はありません。

[設定ファイル](zoo_experiment.json)のコピーを`--config`で指定すると候補・epoch・バッチサイズを調整できます。バッチサイズ8から開始し、メモリ不足なら下げて新しい実行フォルダでやり直します。中断時のログは保存しますが、途中epochからの再開は未実装です。既存/途中フォルダの自動削除・上書きは行いません。

生成物：

- `comparison.md/json`：検証成績・モデル容量・WebKit p95の比較
- 各候補の`export/`：FP32、静的INT8、重みのみINT8。比較表は重みのみINT8を使用
- 各候補の`policy.json`：検証データだけで調整した保留基準
- `plan.json`：設定・データのハッシュ・実行コマンド
- ステップごとのログ。失敗時は`failure.json`

容量8MB・計算p95 50ms・検証macro recall 0.7は**調整可能な計画上の目安**です。予算内でも採用可とは表示しません。精度・容量・速度のトレードオフがある候補を残し、一つの得点で「最適」と断定しません。速度はMac WebKitの模擬入力であり、実機やカメラ前処理込みの時間ではありません。

## 4. 候補を決めた後だけ最終評価

候補選択はvalidationで行い、testを使って選び直しません。選んだ候補の名前を下記に入れます。

```sh
work/recognition-venv/bin/python tools/recognition/training/pipeline.py predict \
  --dataset work/zoo-dataset-v1/dataset.json \
  --model-file work/zoo-run-v1/v4-head/export/model.weight-int8.onnx \
  --policy work/zoo-run-v1/v4-head/policy.json --split test \
  --out work/zoo-run-v1/final-test.json
npm run recognition:lab -- evaluate work/zoo-dataset-v1/dataset.json \
  work/zoo-run-v1/final-test.json work/zoo-run-v1/final-report.json
```

種別の誤り・対象外の誤確定・自動確定の適合率を確認します。テストが不十分なら採用せず、変更した候補には別の未使用テストを用意。iPhone Safariで実写の前処理一致、撮影から結果までの時間、メモリ、オフラインを確認してからアプリへ組み込みます。モデルの自動公開・現行認識の自動置換はしません。

## 実装確認

`npm run recognition:training:test`で取り込み条件、個体/セッション結合、設定と検証専用コマンドを確認。`work/recognition-venv/bin/python tools/recognition/training/check_zoo_intake.py`で57枚の合成画像を使った分割・EXIF除去・元写真維持・重複画素拒否を検証します。一括実行も既存の小規模データで1epoch実行し、ONNX変換・圧縮・推論・WebKit測定・比較表生成まで確認しました。これらは、今後提供される動物園写真での精度を保証するテストではありません。
