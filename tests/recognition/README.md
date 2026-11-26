# ズーケッチ第12弾の認識評価

2026年11月26日。比較元は main の `835816f`。採用動物30グループを対象に、公開中の BioCLIP INT8 画像エンコーダーをそのまま使った。新しいラベルは1グループ1本で、30本の動物ベクトルと9本の非動物棄却ベクトル。ヤギ・ヒツジとフラミンゴは、アプリの採用グループ単位で採点する。

## 評価セット

既存の `work/zoo-reference-v1/dataset-release.json` の validation 92枚で設定を選び、test 122枚で固定した設定を確認した。どちらにも採用30グループすべてが含まれる。参照バンク用の train、他の動物、対象外・不明の写真は対象外とした。元の分割における撮影者グループの交差とファイルの重複を検査した。

[写真の固定一覧](roster-fixtures.json)に出典、条件、ファイルの SHA-256 を記録した。画像は同梱していない。一部の写真の種ラベルは公開元の記載に基づく。公開済みの参照バンクが以前にも比較された写真セットなので、初見の写真による独立検証や京都市動物園での実機検証は別途必要。

## 正答率と誤認

全体画像の crop → contain を撮影後の既存コードで判定した。Top-1 は最初の候補、Top-3 は表示候補のいずれかに正解が入った写真の数。候補なしも分母に含めた。自動確定は既存の複数ビューの判定を通過した件数。

| 122枚の test | 変更前 | 30グループ版 |
| --- | ---: | ---: |
| Top-1 | 93/122（76.2%） | 101/122（82.8%） |
| Top-3 | 97/122（79.5%） | 108/122（88.5%） |
| 先頭候補が誤り | 14 | 11 |
| 候補なし | 15 | 10 |
| 自動確定 | 83（68.0%） | 94（77.0%） |
| 自動確定で正解／誤り | 77／6 | 88／6 |

| 混同が見られたグループ | 変更前の Top-1 | 変更後の Top-1 | 混同の変化 |
| --- | ---: | ---: | --- |
| シロテテナガザル・ナマケモノ | 3/8 | 5/8 | テナガザル→ナマケモノ 3→1 |
| ロバ・ヤギ／ヒツジ | 6/12 | 10/12 | ロバ→ヤギ／ヒツジ 2→1 |
| フサオマキザル・マンドリル | 4/6 | 4/6 | フサオマキザル→マンドリル 1→0。マンドリル→アカゲザル 0→1 |
| オオヤマネコ・ツシマヤマネコ・サーバル | 5/9 | 6/9 | ツシマヤマネコの保留 3→1、サーバルとの混同 0→1 |

レッサーパンダは4/4を維持。ヤギの写真は4/4→4/4、ヒツジの写真は2/4→3/4。どちらも「ヤギ・ヒツジ」を正解とした。ヤブイヌ、マンドリル、ナマケモノは各1枚分悪化。オオヤマネコは1枚のみで両版とも正答なし。全グループの内訳と誤認先は [集計](roster-results.json) の `compare` に収録した。

## 採用した設定

- プロンプトは英語名、写真の言い回し、学名、学名と英語名の組み合わせ。混同しやすいサル、クマとレッサーパンダ、ネコ類には見た目の特徴の文も試した。同じ重み0.60、再比較する点差0.040で、validation の Top-1／Top-3 は1文が70／77、複数文が74／79、特徴を加えた複数文が75／80。各文の正規化済みベクトルを平均し、1本に量子化した最後の構成を採用した。
- 写真参照の重みは0・0.20・0.40・0.60・0.80・1.00などを比較した。特徴を加えたバンクで標準の再比較範囲を使った場合、重み0の Top-1／Top-3 は71／77。採用構成の重み0.60と再比較範囲0.040で75／80。旧版で使っていた参照を採用動物分に限定し、写真自体の追加は行っていない。
- 写真参照が無いグループは0。各グループで代表ベクトルが1本のものは、キリン、タテガミヤマアラシ、ホオアカトキ、ホロホロチョウ、カバ、アジアゾウ、ケープハイラックス、マンドリル、シロテテナガザル、ワオキツネザル、ニシゴリラ、フサオマキザル、ニホンアナグマ、ニホンジカ、ヤブイヌ、ショウガラゴ、オオヤマネコ、ツシマヤマネコ、インドオオコウモリ。ベクトルの本数は表現の幅の目安で、元写真の枚数や参照の精度ではない。
- 前処理は crop、contain、横または縦の辺を1.25倍まで残す wide と、それぞれの順番を比較した。validation で採用構成の crop 単体は71／77（正しい自動確定48枚）、crop → contain は73／77（同63枚）。test のwide → containは89／94、crop → containは101／108。既存の順番を維持した。YOLOXの白枠および切り出した枠を使うライブ認識の精度は今回の集計に含めていない。
- 現行 Worker の候補下限はコサイン0.24、明瞭と扱う点差は0.040。0.30／0.07と0.12は旧スコアの候補関数にも残る別の設定である。候補下限0.20／0.22／0.24／0.25では validation の自動誤確定が3件、0.26で2件。点差を0.030に下げても3件に増え、0.035では正しい自動確定が増えなかった。そこで候補下限0.26、点差0.040とした。撮影フロー側の複数ビューの判定は既存どおり。

## 再現手順

Node.js 24、Python環境に NumPy・Pillow・onnxruntime・tokenizers、Chromium/WebKit実行時は Playwright のブラウザーを使用する。測定環境は Apple M2。Python は onnxruntime 1.31.1、Pillow 12.3.0、NumPy 2.5.4、tokenizers 0.23.3。CPU 1スレッド。全画像をピン留めしたINT8 ONNXで実推論し、得られた512次元特徴をNodeからアプリのスコア計算と複数ビューの判定へ渡した。Pythonのリサイズにはbicubicを使用するため、ブラウザーCanvasとピクセル単位では差があり得る。配信用ブラウザーWorkerは別計測とした。

下記はリポジトリルートで実行する。元の写真セットを利用できる場合は `work/zoo-reference-v1/dataset-release.json` を指定する。固定一覧を使う場合は各 `downloadUrl` の元画像を `file` の相対パスに置き、SHA-256が一致することを確認する。

```sh
git worktree add --detach /tmp/zooketch-baseline 835816f
ln -s "$PWD/node_modules" /tmp/zooketch-baseline/node_modules
mkdir -p /tmp/zooketch-roster
python tests/recognition/embed_roster_photos.py \
  /path/bioclip-image-int8.onnx work/zoo-reference-v1/dataset-release.json \
  /tmp/zooketch-roster/features.jsonl
python tests/recognition/export_roster_bank.py \
  /path/text_encoder_fp16.onnx /path/tokenizer.json /tmp/zooketch-roster
git show fa9c13d:src/recognition/bioclip-labels-30.json | cmp /tmp/zooketch-roster/bioclip-labels-30-distinct.json -
cmp /tmp/zooketch-roster/bioclip-photo-references-30.json src/recognition/bioclip-photo-references-30.json
ZOOKETCH_ROSTER_BASELINE=/tmp/zooketch-baseline \
  node tests/recognition/score-roster.mjs /tmp/zooketch-roster/features.jsonl \
  /tmp/zooketch-roster/report.json src/recognition/bioclip-labels-30.json
```

設定を再比較する場合は `score-roster.mjs` に生成した全バンクを渡し、比較する設定を `ZOOKETCH_ROSTER_CASES` で JSON 配列として指定できる。ビルド済みの2版を比較する場合は次を実行する。

```sh
node tests/recognition/bench-roster-worker.mjs \
  /path/baseline-dist /path/roster-dist /path/bioclip-image-int8.onnx \
  work/zoo-reference-v1/dataset-release.json /tmp/zooketch-roster/report.json \
  /tmp/zooketch-roster/worker.json chromium
```

モデルと名称の出典。 [BioCLIP](https://huggingface.co/imageomics/bioclip)・[公開版の固定INT8画像エンコーダー](https://huggingface.co/Virien/naturdex-bioclip-onnx/tree/fa3c062ea31a6e1881b1977fe555b2d481dca730)・[生成用の固定テキストエンコーダーとトークナイザー](https://huggingface.co/jsteinshouer/trail-bingo-bioclip-onnx/tree/25d50dd481d6a748ce78c8bc513a420bf7d3d279)・[京都市動物園の動物図鑑](https://zoo.city.kyoto.lg.jp/zoo/animals/)。

## サイズと処理時間

実際の配信用 Worker を Apple M2 上で実行した。test から1グループ1枚で計30枚を使用し、2版の実行順を写真ごとに交互にした。ブラウザー測定はキャッシュ済みの同じモデルを使用し、画像取得後からWorkerの応答までを計測した。

| 指標 | 変更前 | 30グループ版 |
| --- | ---: | ---: |
| テキスト埋め込みバンク | 80,980 B | 27,220 B |
| 写真参照バンク | 97,359 B | 29,926 B |
| テキストバンクのJSON解析・復号・ノルム計算の中央値 | 2.88 ms | 0.91 ms |
| テキストとの照合1回の中央値 | 0.054 ms | 0.018 ms |
| Worker本体のgzipサイズ | 151,630 B | 69,332 B |
| Chromiumの1回の中央値／p95 | 849.6／867.9 ms | 847.7／912.8 ms |
| WebKitの1回の中央値／p95 | 854／876 ms | 837／890 ms |
| 画像エンコーダー | 87,384,964 B | 87,384,964 B |

ブラウザーでのTop-1／Top-3は Chromium 20／21→22／23、WebKit 20／21→23／23（各30枚）。1回あたりの中央値はほぼ同程度。p95は両ブラウザーで延びた。30枚の試行でばらつきの原因は確定していない。スマートフォン実機の時間は未測定。

## ヤブイヌ・マンドリル・ナマケモノの再調整

30グループ版 `fa9c13d` で個別に悪化した3グループを再調整した。ヤブイヌとナマケモノは旧ベクトルと簡潔な英語の写真表現を等分に混ぜた。マンドリルは旧ベクトルに、既存の写真参照ベクトルを重み0.075で混ぜた。変更した行はこの3本。テキストバンクの容量は27,220 Bで、参照写真バンク、公開モデル、キャッシュキー、前処理と判定基準は同一。

前回使用した全214枚をモデルで再推論し、写真ID・ラベル・SHA-256が固定一覧と一致することを確認した。前回の評価写真を再利用した回帰確認であり、初見写真に対する推定精度とは区別する。京都市動物園の図鑑に掲載された既存33枚も追加で比較した。

| 同じ test 122枚 | `fa9c13d` | 再調整版 |
| --- | ---: | ---: |
| ヤブイヌ Top-1 | 0/2 | 1/2 |
| マンドリル Top-1 | 0/2 | 1/2 |
| ナマケモノ Top-1 | 2/4 | 3/4 |
| 30グループ全体 Top-1 | 101/122（82.8%） | 104/122（85.2%） |
| 30グループ全体 Top-3 | 108/122（88.5%） | 109/122（89.3%） |
| 自動確定の正答／誤り | 88／6 | 90／5 |

Top-1とTop-3はどのグループも低下しなかった。validation 92枚ではTop-1が73→74、Top-3が77→78、自動確定の誤りは2件のまま。図鑑の33枚ではTop-1が31、Top-3が33で同数。自動確定の正答は28→30、誤りは1件のまま。固定セットに含まれるヤブイヌの足跡だけの写真などは引き続き識別できていない。 [全グループの比較結果](roster-targeted-results.json)

生成コマンドは上記と同じ。再調整版は `bioclip-labels-30-focused.json` に出力される。比較時は以下のように2版のバンクを渡す。

```sh
cmp /tmp/zooketch-roster/bioclip-labels-30-focused.json src/recognition/bioclip-labels-30.json
git show fa9c13d:src/recognition/bioclip-labels-30.json > /tmp/zooketch-roster/previous-bank.json
node tests/recognition/score-roster.mjs /tmp/zooketch-roster/features.jsonl \
  /tmp/zooketch-roster/targeted-report.json /tmp/zooketch-roster/previous-bank.json \
  src/recognition/bioclip-labels-30.json
```

## 写真確認で通常候補がないときの補完

`05e6389` までの画像エンコーダー、ラベル・写真参照バンク、入力サイズ、ライブ認識のしきい値を使用する。撮影した写真で通常候補が空のときに限り、名前との照合結果と既存の参照写真の両方を使って「修正」に候補を表示する。補完した候補は手動で選択する。

- 予備候補の名前とのコサイン類似度が0.20以上、かつ非動物ラベルより0.012以上高く、名前の1位と0.055以内にあること。参照写真との類似度は0.40以上、2位との差は0.03以上を条件とする。
- 名前と参照写真の照合で1位が一致し、名前との類似度が0.22以上、参照写真との類似度が0.50以上、その2位との差が0.07以上の場合は、1つの表示方法の結果から候補にできる。その他の場合は写真全体のcropとcontainで同じ動物になり、片方の参照写真との類似度が0.50以上の場合に候補にする。
- ライブ撮影のフレームには追加の参照照合を行わない。撮影後も通常候補と自動確定の処理を優先する。推論回数と配布するモデル・埋め込みファイルは同じ。

| 評価セット | Top-1 変更前→後 | Top-3 変更前→後 | 先頭候補の誤り | 自動確定の誤り |
| --- | ---: | ---: | ---: | ---: |
| 前回の確認用122枚・30グループ | 104→106 | 109→111 | 9→9 | 5→5 |
| 追加の70枚・22グループ | 59→60 | 61→62 | 7→7 | 2→2 |
| 前回の調整用92枚・30グループ | 74→74 | 78→78 | 10→10 | 2→2 |
| 京都市動物園の図鑑33枚・30グループ | 31→31 | 33→33 | 2→2 | 1→1 |

前回の固定写真ではショウガラゴとインドオオコウモリ、追加セットではフラミンゴが1枚ずつ正しく候補に戻った。追加70枚は既存の収集素材の `test-fresh` から選び、前回の評価・参照写真の作成に使った素材と撮影者グループおよび画像のSHA-256の重複がないことを確認した。設定検討でも同じ写真を比較している。ライブ映像と実機での精度はこの集計に含まれない。 [比較結果と追加写真の一覧](photo-suggestion-results.json)

同じ画像特徴を `score-roster.mjs` に渡し、`crop+contain` と `photo-review` を比較すると再集計できる。前者は通常候補、後者は撮影後の「修正」に表示される候補を含む。

Chromiumの配信用Workerにも、集計で候補が増えた3枚を入力した。ショウガラゴは新しく候補に出た。インドオオコウモリは両版でテナガザル、フラミンゴは両版でフラミンゴになった。ブラウザーCanvasと評価用のbicubicリサイズで結果が異なる写真があり、122枚と70枚の集計は固定したオフライン前処理の結果である。
