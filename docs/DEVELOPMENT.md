# 別のパソコンで開発する

ソース：<https://github.com/Takuto-Ando/mitsukeru-pages/tree/zooketch-dev>

現在の開発用ブランチは **zooketch-dev** です。`main` は公開用で、更新するとGitHub Pagesが自動公開されます。Cloudflare Pagesは既存の手動公開手順を使います。開発用ブランチへのpushだけでは公開しません。

## 最初の1回（Mac・Windows・Linux）

Git、Node.js **24系**、VS Codeをインストールします。Nodeの版は `.nvmrc` / `.node-version` とGitHub Actionsに指定しています。nvm利用者は `nvm install` → `nvm use`、それ以外はNode.js 24を導入し `node --version` で確認します。追加のAPIキーや有料サービスへの登録は、通常のWeb開発には必要ありません。

ターミナル（WindowsはPowerShell）で実行：

```sh
git clone --branch zooketch-dev https://github.com/Takuto-Ando/mitsukeru-pages.git zooketch
cd zooketch
npm ci
npm run dev
```

<http://localhost:5175/> を開きます。`npm ci` はコミットされた `package-lock.json` の版を再現します。`node_modules` をPC間でコピーする必要はありません。

VS Codeは「フォルダーを開く」で `zooketch` を選択します。`code .` が使えるPCではそれでも開けます。Chromeが導入済みなら、F5の「Webアプリをデバッグ（Chrome）」で専用サーバー（5180）を起動しブレークポイントを使えます。

## パソコンを切り替えるとき

作業開始前（未コミットの変更がない状態）：

```sh
git switch zooketch-dev
git pull --ff-only
npm ci
npm run dev
```

作業終了時：

```sh
git status
git add src docs tests
# package.json等を編集した場合は、そのファイルも明示的にaddする
git commit -m "変更内容を短く書く"
git push
```

初めてコミットするPCはGitの `user.name` / `user.email` を設定してください。pushにはGitHubの本人アカウントでの認証が必要です。GitHub CLIを使う場合は `gh auth login` で画面の案内に従います。認証情報はチャットやリポジトリに保存しません。

2台で同時に変更したとき、pullに失敗したら強制上書きせず、先に変更をコミットして競合を解決します。同じブランチを順番に使うなら、**作業終了時push → 次のPCでpull** が基本です。

## 確認と公開

```sh
npm test
npm run build
```

ブラウザの自動テストも行うPCのみ：

```sh
npx playwright install chromium webkit
npm run test:e2e
```

LinuxでブラウザのOS依存ライブラリが足りない場合は `npx playwright install --with-deps chromium webkit` を使います。GitHub Actionsは開発ブランチのpush時にWindows / Linuxで依存導入・単体テスト・ビルドを行います。公開処理は含みません。

実機Safariでカメラを使うにはHTTPSが必要です。Macの `http://192.168...` を開くだけではカメラが使えない場合があります。検証済みの公開URLかHTTPSの開発接続を使用してください。 公開前後のスマートフォン確認は [実機チェックリスト](DEVICE_CHECKLIST.md) に沿って行います。

公開すると決めた場合だけ、変更をレビューしてmainへ取り込みます。Cloudflareへの公開は [CLOUDFLARE_PAGES.md](CLOUDFLARE_PAGES.md) を参照してください。

## iOSアプリ（Macのみ）

Xcodeを導入し、クローンした同じフォルダーで実行します：

```sh
npm ci
npm run ios:sync
npm run ios:open
```

Xcodeで対象iPhoneと自分のSigning Teamを選んでRunします。証明書・Appleアカウント・実機の信頼はPCごとに設定します。生成されるWeb素材は `ios:sync` で作るためGitに入れません。Windows / LinuxではWeb部分を開発できますが、XcodeでのiOSビルドはできません。

## Gitで移るもの・移らないもの

- コード、SVG等の同梱素材、課題・解説、テスト、iOSプロジェクト、開発手順はGitで移ります。
- 将来機能は `src/future/` に保存。呼び出し方は [FUTURE_FEATURES.md](FUTURE_FEATURES.md)。本体画面には未接続です。
- 観察ノート・研究ログ・ブラウザの識別モデルキャッシュは各端末に保存され、Gitには入りません。ノートはアプリのバックアップ機能で個別に移せます。研究データは同意と運用手順に沿って別途管理します。
- 認識モデルは起動後に各端末で取得します。写真、秘密鍵、ローカル設定、参考資料PDF/PPTX、実験データは共有リポジトリに追加しません。
- Capacitorで作ったアプリとSafariの保存領域は別です。

## 検証用のチュートリアル後アンケート

公開用ビルドの環境変数 `VITE_STUDY_FORM_URL` に、Googleフォームの**回答者向けURL**を設定します。 `https://forms.gle/…` または `https://docs.google.com/forms/…/viewform` が使えます。リンクのクエリやフラグメントは除去して開きます。GitHub Pagesで利用する場合は同名のActionsリポジトリ変数を設定してください。

- Figma v2を公開する場合、検証用の入口は `/?study=1` です。
- Figma v2では、チュートリアルの終了画面にある「アンケートを開く」を押すとGoogleフォームが開きます。
- オフライン時やアプリに戻ったときは、終了画面に「アンケートを開く」のリンクが残ります。
- 研究ログの記録開始には引き続き別途同意が必要です。フォームURLに氏名、参加者コード、観察データを付加しません。
- URLを設定していないビルドや通常の入口では、終了画面から撮影に戻ります。

ブラウザテストでは、設定したURLへの通信をモックして実際のフォームに回答せずに遷移を検証できます。`VITE_STUDY_FORM_URL` をビルド時とPlaywright実行時に同じ値で指定し、`npm run test:e2e -- -g 'Googleフォーム'` を実行します。

## Figma v2 と以前の版のテスト

Figma v2の通常ビルドは本体1つです。旧入口の `/plus/`、`/figma/`、`/replica/`、`/dopa/` は同じ画面を表示します。旧版のコードとデータは保持しています。

```sh
npm run build
npm run test:e2e
# 旧版の開発用構成で、引き継いだE2Eを確認するとき
E2E_LEGACY=1 npm run test:e2e
# 旧版の開発用構成をローカルでビルドするとき
VITE_LEGACY_EDITIONS=1 npm run build
```

Figma書き出しで確認した画面接続と削除候補は [FIGMA_V2_SCOPE.md](FIGMA_V2_SCOPE.md) に記載しています。

## スケッチイラストの追加・差し替え

1. `public/illustrations/` に未完成・完成イラストを同じ座標系で配置する。
2. `src/content/sketchPresentation.ts` の `designs` に課題 ID を追加する。`artwork` で各画像を指定し、必要に応じて `geometry` で座標枠 `frameHeight`、正規化した描画領域 `regions` とマスク `maskHoles`、お手本 `answerAsset` を上書きし、`viewport` でカード表示範囲を指定する。既存課題の座標を変える場合は、保存済みの線と新素材が合うか確認する。
3. 完成時の動きは `motion.kind` に既存のアニメーション、`motion.origin` にシーン上の支点を指定する。省略時は `src/content/celebrations.ts` の課題別設定を使用する。ペン色は `sketchPresentation.ts` の `colors` で動物グループごとに設定する。

撮影した写真は撮影時に IndexedDB へ保存される。マイギャラリーではスケッチ完了後に同じ記録が写真タブとスケッチタブの同じ位置に並ぶ。

Zen Maru Gothic（Medium・Bold）は [Google Fonts の公式ソース](https://github.com/google/fonts/tree/main/ofl/zenmarugothic) を WOFF2 に変換して配信しています。ライセンスは `public/fonts/OFL.txt` を参照してください。

## Figma 指定の Web フォント

DNP 秀英丸ゴシック Std B を公開する場合は、サイト管理者自身の [Adobe Fonts の Web プロジェクト](https://fonts.adobe.com/fonts/dnp-shuei-mgothic-std) に B のみを追加します。B の Web での指定は `dnp-shuei-mgothic-std` のウェイト600です。発行された JavaScript 埋め込みコードのプロジェクト ID を `VITE_ADOBE_FONTS_KIT_ID` としてビルドに渡します。GitHub Pages では同名のリポジトリ変数を設定し、Cloudflare Pages では公開 ZIP の生成時に設定します。対象サイトのドメインと動的サブセットを Web プロジェクトで確認します。

有効な埋め込みが未設定の環境は、現在の Zen Maru Gothic 表示を維持します。Adobe Fonts から取得した書体ファイルのコピーを同梱しません。
