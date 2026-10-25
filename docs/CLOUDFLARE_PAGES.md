# Cloudflare Pagesでの無料URL公開

公開URLは https://zooketch.pages.dev/ 。2026-10-26、ユーザーのCloudflareアカウントにプロジェクトzooketchを作成し、直接アップロード方式で公開。HTTPSでアプリ表示と大容量WASMの元バイト列一致を確認した。既存GitHub Pagesは維持する。

## ビルド

```sh
npm ci
npm run build:cloudflare
```

出力先は `dist`、baseは `/`。現在のアプリ・認識処理・モデル・ラベル・しきい値は維持する。Cloudflareには1ファイル25MiBの制限があるため、このビルドだけ大きなWASMをHTTP gzip形式で保存し、`_headers` と対象WASMのURLだけに限定した小さな配信Workerで `Content-Encoding: gzip` と `Content-Type: application/wasm` を付ける。`encodeBody: manual` により二重圧縮を防ぐ。ブラウザが受け取る解凍後のWASMは元ファイルと同じ。圧縮後に制限を超える場合や、対象外の大容量ファイルがある場合はビルドを失敗させる。モデル重みは今までどおり初回に取得する。

`dist`のファイルをそのままVite previewや別サーバーへ置くと `_headers` が無視される場合がある。圧縮ファイルはCloudflare Pages（または同等のHTTPヘッダー設定）で配信する。ローカル確認は次のコマンド。

```sh
npx wrangler@4 pages dev dist --ip 127.0.0.1 --port 4177 --compatibility-date=2026-10-19
```

GitHub Pagesには従来どおり `VITE_BASE_PATH=/mitsukeru-pages/ npm run build` を使う。Cloudflare用ビルドをGitHub PagesやiOSへコピーしない。iOSは `npm run ios:sync` で通常ビルドを使用する。

## Cloudflareでの作成

Cloudflareにログインし、Workers & PagesからPagesのプロジェクトを作成する。

- 直接アップロード：プロジェクト名 `zooketch`。上記ビルドの `dist` をアップロード。
- Git連携の場合：既存リポジトリのmain、ビルドコマンド `npm run build:cloudflare`、出力先 `dist`。GitHubアクセスの承認は利用者が必要な範囲で行う。
- Freeプランを利用し、有料契約・ドメイン購入・R2は不要。大容量WASMの配信だけはPages Functionsの無料枠に含まれる。通常のページ・画像・小さいWASMは静的配信し、写真やノートはサーバーへ送らない。
- 名前が取得済みなら、利用者と別名を決めてから作成する。勝手に別名へ変更しない。
- 作成後、実際の配信URLでカメラ・手動選択・描画・比較・保存・オフライン準備を確認する。大きなWASMの解凍後のバイト列とContent-Typeも確認する。

直接アップロードとGit連携はCloudflareのプロジェクト種別の選択になるため、変更可否を最新の公式手順で確認する。手動公開の場合、以後のmain更新だけではCloudflareの内容は更新されない。同じプロジェクトへの再アップロードが必要。

## 端末内データの引き継ぎ

GitHub Pagesとpages.devは別オリジン。観察ノート・研究同意・研究ログ・モデルキャッシュは自動で引き継がれない。既存URLの「観察ノート」からJSONバックアップを取り、新URLで内容確認後に復元する。研究ログは旧URLで別途エクスポートする。研究同意は新URLで改めて行う。旧URLの保存データは削除しない。

出典：[Cloudflare Pagesの制限](https://developers.cloudflare.com/pages/platform/limits/)、[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)、[レスポンスヘッダー](https://developers.cloudflare.com/pages/configuration/headers/)。

ローカル配信の操作テスト：`E2E_PREVIEW=1 E2E_BASE_URL=http://127.0.0.1:4177/ npm run test:e2e`。圧縮WASMはHTTPで取得した解凍後のバイト列が元の26,861,777バイトと一致することを確認済み。

Cloudflareは `/index.html` をルートURLへ転送するため、オフラインナビゲーション時はキャッシュしたHTMLから新しいResponseを作り、転送状態を引き継がず返す。ローカルCloudflare環境で全20課題を含む操作78件に成功し、修正後に失敗していたオフライン2件も両ブラウザで成功（合計80件成功・2件スキップ）。単体149件、通常のGitHub Pages用baseでのビルドも成功。
