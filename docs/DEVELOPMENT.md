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

実機Safariでカメラを使うにはHTTPSが必要です。Macの `http://192.168...` を開くだけではカメラが使えない場合があります。検証済みの公開URLかHTTPSの開発接続を使用してください。

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
