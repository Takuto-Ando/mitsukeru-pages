# ズーケッチ

現在は、子どもが1〜3分程度で形や模様を描き足すことを目指した、シンプルでかわいいSVGイラストを使用しています。細密な画像は参照用として保管しています。所要時間は目安で、時間制限は設けません。

動物の身体の一部分を観察し、描き足して発見するスマートフォン向けプロトタイプです。

写真を撮る → 特徴を描く → お手本と見くらべる → 解説を読む、の4段階です。16グループ・20課題を登録しています。模様や輪郭の課題は自己確認を標準とし、自動判定の正解と本人による確認を内部データで区別します。

公開先：[GitHub Pages](https://takuto-ando.github.io/mitsukeru-pages/)

## Macで起動

Node.js 24とnpmを使います。

```sh
npm ci
npm run dev
```

表示されたローカルURLを開きます。React / TypeScript / Vite / Motion / Canvas APIを使用します。バックエンド・APIキーは不要です。

## iPhoneで確認

公開URLをSafariで開き、カメラを許可します。「識別モデルを先にダウンロード」で準備してから撮影すると、候補が絞れた場合は自動で描画へ進みます。初回モデル約150MB以上、Wi-Fi推奨。写真は端末内で処理します。識別不能・権限拒否時も下の手動選択で進めます。

同じWi-FiでMacの `http://MacのIP:5175/` に接続してレイアウトと描画を確認できます。ただしライブカメラにはHTTPSが必要です。Macのスリープ、VPN、Wi-Fiの端末間通信制限にも注意してください。対象はiPhone Safari 16.4以降です。WebKitでの自動テストと実機テストは区別します。

## 検証

```sh
npm test
npx playwright install chromium webkit
npm run build
npm run test:e2e:preview
```

20課題をChromium／WebKitで操作し、画像・描画・比較・自己確認・解説・再観察を確認します。タッチ注入とカメラモックはChromiumのみです。撮影からの自動遷移テストは推論Workerをモックしています。実モデルによる検証範囲は [RECOGNITION.md](RECOGNITION.md) に記載しています。スクリーンショットは `test-results/` に出力します。

## Figmaへ合わせて編集する場所

| 内容 | ファイル |
| --- | --- |
| 4ステップ・見出し・操作 | `src/App.tsx` |
| 色・余白・文字・ボタン | `src/styles/figma.css`, `src/styles/tokens.css` |
| 20課題の問い・解説・判定方式・校正済みマスク | `src/content/tasks.ts` |
| イラストの登録・差し替え | `src/content/artwork.ts` |
| 専用イラスト20枚 | `public/illustrations/simple/`（細密版は `public/illustrations/zooketch/` に保管） |
| 背景と空欄 | `src/components/ObservationScene.tsx` |
| タッチ入力・Undo・消去・拡大 | `src/SketchCanvas.tsx` |
| 自分の線とお手本の比較 | `src/components/SketchComparison.tsx` |
| ヤギの判定／他の特徴判定 | `src/evaluator.ts`, `src/profileEvaluator.ts` |

現段階のUIは既存の配色・マスコットを継承しています。新しいFigmaファイルを読み取った、あるいは正式UIに一致したという扱いにはしていません。

## 素材・出典・研究記録

- [ASSETS.md](ASSETS.md)：20課題の素材・判定・確認状況と差し替え仕様。
- [docs/CONTENT_SOURCES.md](docs/CONTENT_SOURCES.md)：公式資料で確認した内容と未確認の働き。
- [docs/ILLUSTRATION_PROMPTS.json](docs/ILLUSTRATION_PROMPTS.json)：画像生成に使ったプロンプト。素材は本制作のための生成画像で、専門家監修済みではありません。
- [RESEARCH.md](RESEARCH.md)：説明・同意後に限り有効化する、初期状態で無効の研究記録。
- [COLLECTION.md](COLLECTION.md)：以前の依頼で追加した端末内の絵の保存。Safariとアプリは別領域です。新たな収集ゲームやポイントは追加していません。

## GitHub Pagesで公開

mainへのpushで `.github/workflows/` の既存ワークフローがビルド・テスト・公開します。GitHub Settings → Pages → SourceをGitHub Actionsに設定してください。

リポジトリ名からViteのbaseを設定するため、公開URLをUIコードへ固定しません。独自ドメインではRepository variable `PAGES_BASE_PATH=/` とPagesのCustom domainを設定します。

## iPhoneアプリへ反映

```sh
npm run ios:sync
npm run ios:open
```

このフォルダの `ios/App/App.xcodeproj` を使用します。Xcodeで接続したiPhoneを選びRunしてください。アプリ名はズーケッチ、bundle IDは維持しています。Web公開だけではインストール済みのアプリは更新されません。今回の同期・ビルドと、実機転送・実機動作確認は別です。

## VS Code

このフォルダを開き、F5で「Webアプリをデバッグ（Chrome）」を選ぶと、5180番で開きます。通常の5175番とは別です。ブレークポイントは `src/App.tsx`、`src/SketchCanvas.tsx`、判定モジュールに設定できます。
