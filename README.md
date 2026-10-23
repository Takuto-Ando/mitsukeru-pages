# みつけるスケッチ

**Figma反映版の現状・変更箇所・未対応は [CURRENT_WORK.md](CURRENT_WORK.md) を参照してください。以下の過去版の機能説明より同文書を優先します。現在は4ステップをApp.tsxで管理し、ファイル選択は廃止しました。ヤギ以外15グループの専用提案テンプレートと比較は追加済みですが、自動判定は未検証で自己確認に進みます。**

「動物を見つける」から「動物の中にある発見を見つける」へ。動物を選び、特徴を指で描き、自分の線とお手本を比較して、生態の手がかりを知るスマートフォン向けWebアプリです。提供モックの色と画面を引き継いでいます。正式UIは今後Figmaから反映します。

React / TypeScript / Vite / Motion / Canvas API。バックエンド・APIキー不要。iOS Safari 16.4以降を対象とします。ログイン、ポイント、ランキング、収集機能はありません。

## 実装と確認状況

| 項目 | 現在の状態 |
| --- | --- |
| 16グループ選択・観察課題 | 実装済み。提供資料画像からの暫定組み合わせ。正式30カードとの一致は未確認 |
| Canvas | 指・ペン・マウス、Undo、ひと筆単位の消しゴム、全消去 |
| ヤギの形状判定 | 横長を優先する寛容な判定。横長楕円・開いた輪郭・歪み・重ね描きに対応 |
| ヤギの答え合わせ | 正解演出、線の保持、半透明お手本が0.8秒で出現、自分の絵／重ねる／お手本切替 |
| その他15グループ | 描画→自分の線と実物を見比べる→解説。自動判定・お手本は未実装と表示。仮の正解演出は出さない |
| ヒツジ | ヤギと同じ選択グループ。現在はヤギの体験へ案内。ヒツジ個別課題は未実装 |
| 解説 | 京都市動物園の図鑑の確認済み事項＋未確認事項を明示。ヤギの瞳孔の働きは研究論文に基づく説明 |
| 写真 | 全動物は仮素材。カメラ撮影・端末画像の読込に対応。自動分類なし |
| GitHub Pages | main更新で公開するActionsを作成済み。公開先リポジトリ未設定のため実際の公開は未実施 |
| iOSデモ | Capacitorプロジェクトあり。過去版のSimulator・実機インストールは確認済み。今回版の実機確認は未実施 |

参照箇所・16課題の状態は [CONTENT_STATUS.md](CONTENT_STATUS.md)、判定方針は [OBSERVATION_JUDGING.md](OBSERVATION_JUDGING.md) を参照してください。公式掲載は当日の展示・観察可能性を保証しません。

## Macで起動

このREADMEと同じフォルダで実行します。Node.js 24を使用します。作業MacはM2・macOS 27.0.1、既存のNode 24.22.0 / npm 11.19.1を使用し、NodeやHomebrewの再導入はしていません。

```sh
npm ci
npm run dev
```

http://localhost:5175/ を開きます。停止はControl+C。依存の追加・変更がなければ毎回の `npm ci` は不要です。既に5175が使用中なら既存サーバを終了するか `npm run dev -- --port 5176` にしてください。

```sh
npm run build
npm run preview
```

本番ファイルは `dist/`、プレビューは http://localhost:4175/ 。HTMLのダブルクリックでは動作しません。

## iPhoneで確認

1. MacとiPhoneを同じWi-Fiに接続し、Macで `npm run dev` を続けます。
2. ターミナルのNetwork欄のWi-Fi側URL（`http://MacのIP:5175/`）をiPhone Safariで開きます。iPhoneのlocalhostは使いません。
3. 動物を選択します。ヤギでは「見えたかたちを描く」→指で横長の輪郭→「これで答える」→表示切替→「どうして横長なの？」を試します。
4. 円・横線は「横長に見えた？」と確認します。縦長でも解説へ進めます。その他動物は未対応表示と自己確認を試します。
5. 回転、Undo、画面のスクロール、カメラ拒否後の手動選択も確認します。

LANのHTTPではライブカメラを利用できない場合があります。ライブカメラにはGitHub Pages等のHTTPSが必要です。写真選択は端末のファイル選択画面を使用します。撮影・写真ライブラリの選択肢や画像形式の対応は端末によります。読み込めない形式はJPEG/PNGへ変換してください。

接続できない場合はWi-Fiの端末間通信制限、VPN、Macのスリープ、ファイアウォールのNode受信許可を確認してください。動物画像と描画はメモリ内だけで扱い、アップロードしません。再読込で消えます。効果音の設定だけlocalStorageに保存します。

WebKit自動テストはiPhone実機Safariの代用ではありません。今回の更新の実機タッチ・カメラ・画面回転は、上記手順で最終確認が必要です。

## GitHub Pagesへ公開

このフォルダの**中身（package.json、src、.github等）をリポジトリのルート**に配置します。`node_modules/`、`dist/`、署名・証明書はコミットしません。

1. GitHubで公開先リポジトリを用意します。
2. このフォルダでGit管理を始め、リモートを設定してmainにpushします（既存Git管理があれば初期化は不要）。以下のURLは自分の公開先へ置換します。

```sh
git init -b main
git add .
git commit -m "Build observation sketch app"
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

3. GitHubのSettings → Pages → Build and deployment → Sourceを **GitHub Actions** に設定します。
4. Actionsの **Publish Web app** を実行します。以後mainへのpushでテスト・ビルド・公開が自動実行されます。

`.github/workflows/pages.yml` がリポジトリ名から `/REPOSITORY/` を設定してビルドします。画面遷移はhash方式なので直接アクセスで404になりません。素材URLは `import.meta.env.BASE_URL` を使っています。

ユーザーサイト（OWNER.github.ioというリポジトリ）や独自ドメインでルート公開する場合は、Settings → Secrets and variables → Actions → Variablesに **PAGES_BASE_PATH = /** を追加し、再実行します。独自ドメイン自体はSettings → Pagesで設定し、DNSを設定します。必要に応じて `public/CNAME` を追加します。コード内のURL置換は不要です。ドメイン名が決まるまではCNAMEを作成していません。

サブパスをローカルで試す場合：

```sh
VITE_BASE_PATH=/demo-repo/ npm run build
VITE_BASE_PATH=/demo-repo/ npm run preview
```

http://localhost:4175/demo-repo/ を開き、素材・選択・描画を確認します。自動テストは `VITE_BASE_PATH=/demo-repo/ E2E_BASE_PATH=/demo-repo/ npm run test:e2e:preview` で実行できます。通常版へ戻すには環境変数なしで再ビルドします。iOS同梱版ではbaseを `/` にしてください。

## Figmaの反映・コンテンツの差し替え

| 編集対象 | 主なファイル |
| --- | --- |
| 色・書体等のFigma変数 | `src/styles/tokens.css` |
| 余白・配置・レスポンシブ | `src/style.css` |
| 導入・観察・描画・正解・解説 | `src/screens/HomeScreen.tsx` / `ObserveScreen.tsx` / `DrawScreen.tsx` / `ResultScreen.tsx` / `LearnScreen.tsx` |
| 他動物の共通観察体験 | `src/screens/OtherObservation.tsx` |
| 動物選択部品 | `src/components/AnimalSelector.tsx` |
| 答え合わせ部品 | `src/components/SketchComparison.tsx` |
| タッチ入力、消しゴム、Undo | `src/SketchCanvas.tsx` |
| 16グループ・課題・出典・実装状態 | `src/content/groups.ts` |
| ヤギの判定パラメータ・解説 | `src/content/challenges.ts` |
| 判定アルゴリズム | `src/evaluator.ts` |
| ヤギの表示素材 | `src/content/media.ts` |
| カメラと画像読込 | `src/CameraView.tsx` |
| 画面遷移・状態管理 | `src/App.tsx` |

写真は `public/photos/` に配置し、ヤギは `media.ts` のsrc・alt・kind・credit、他動物は `groups.ts` の `groupPhotos` に登録します。例： `mandrill: { path: "photos/mandrill.jpg", alt: "マンドリルの顔", credit: "撮影者名" }`。baseを含まない相対パスにします。素材ごとの権利・クレジットも確認してください。

お手本は現在 `Illustrations.tsx` の `PupilShape` にある仮SVGです。正式素材は `groups.ts` の `answer.asset` に `answers/goat.svg` のようなパスを指定すると差し替わります。**600×400の論理座標と同じフレーム**で書き出してください。ユーザーの描画へ自動でフィットさせたり、一致率を採点したりしません。

`evaluation: "self"` と `answer.kind: "pending"` は未実装です。新しい判定を追加する際はデータだけ変更して対応済みにせず、判定関数・画面分岐・お手本・テストを追加してください。AI認識の入口はCameraViewですが、現在モデル・推論API・自動分類は存在しません。将来は分類結果を利用者に確認してからグループIDに変換する構造にします。

## テスト

```sh
npm test
npx playwright install chromium webkit
npm run build
npm run test:e2e:preview
```

単体テストは形状10パターン・外れ点・課題別閾値・音声設定を確認します。E2EはChromiumとWebKit、幅320〜1440pxで選択・タッチ型入力・描画・判定・正解演出・重ね合わせ・解説・写真読込・未実装表示を確認します。実ブラウザのタッチ注入はChromiumのみで、WebKitでは当該1件を意図的にスキップします。

## iOSデモ

[IOS_DEMO.md](IOS_DEMO.md) を参照してください。

```sh
npm run ios:sync
npm run ios:open
```

Webの変更を実機アプリへ反映するには毎回syncし、Xcodeで接続先iPhoneを選びRunします。Safari版は再ビルド・公開後に再読み込みします。

## この公開リポジトリ

公開先は https://takuto-ando.github.io/mitsukeru-pages/ 。mainの更新を自動公開します。iOSネイティブプロジェクトもこのリポジトリのios/で管理します。WebとiOSは同じsrc/を使います。
