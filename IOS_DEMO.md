# iPhoneデモアプリ

通常運用はSafariのWeb版、デモはインストールするiOSアプリです。React画面・Canvas・判定を共有し、CapacitorのWKWebViewへ本番ビルドを同梱します。UI変更は `src/` に一度だけ行い、Web版とアプリ版へ反映します。

今回の16グループ対応版はWebKitで検証済みです。実機への最新更新とタッチ・カメラ操作の確認は未実施です。下記の過去のインストール成功と区別してください。

## できたことと残り

- Capacitor 8.4.3（core / ios / cli）を追加。依存監査で問題のないバージョンに揃えて固定。
- `ios/App/App.xcodeproj` を生成。Swift Package Managerで依存を解決するため、CocoaPodsは不要。
- アプリ名：みつけるスケッチ。開発用Bundle ID：`jp.mitsukerusketch.demo`。
- 対象：iPhone / iOS 16.4以降。縦向き・横向きを許可。
- `dist/` をアプリ内にコピー。開発サーバのURLを設定せず、手動選択のデモはMacのサーバやWi-Fi接続に依存しない構成。
- 任意のカメラ画面のため、カメラ利用目的を `Info.plist` に日本語で追加。
- アプリアイコンと起動画面はCapacitor標準の仮素材。Figmaに合わせた最終素材は未反映。

**Xcode 27.1を導入し、利用規約への同意・初期設定を完了しました。iPhone Simulator向けのネイティブビルドは成功しています。通常のiPhone 16 / iOS 27.0 Simulatorで起動し、初期画面とステータスバーを避けた表示を目視確認しました。iPhone 17 Proへの署名付きインストールと起動コマンドの成功も確認しました。配布用IPAは作成していません。**

## 1. Xcodeを用意する（別のMac・初回向け）

[Apple公式のXcode案内](https://developer.apple.com/xcode/resources/)からMac App StoreのXcodeを導入してください。Capacitor 8の要件は **Xcode 26.0以降** です。現在のCommand Line ToolsだけではiOSアプリはビルドできません。

Xcodeを一度開き、初回セットアップと必要なiOSプラットフォーム／Simulatorのダウンロードを完了します。XcodeのSettings → Locations → Command Line Toolsで、導入したXcodeを選びます。初回セットアップやApple Accountの認証はユーザー本人が行ってください。

ターミナルで確認：

```bash
xcodebuild -version
xcrun simctl list devices available
```

参考：[Capacitor公式の環境要件](https://capacitorjs.com/docs/getting-started/environment-setup)

## 2. アプリへ画面を反映する

このプロジェクトのフォルダで実行します。現在の作業用コピーでは依存は導入済みです。別のMacや再取得したソースでは初回に `npm ci` を実行してください。

```bash
npm run ios:sync
npm run ios:open
```

`ios:sync` はTypeScriptチェック・本番ビルド・iOSプロジェクトへのコピーを順に実行します。**画面を変更するたびに実行**してください。`ios:open` はXcodeを開きます。Web版の `npm run dev` は従来通り使えます。

## 3. Mac上のiPhone Simulatorでデモ

初回設定とiOS Simulatorの導入後は、プロジェクトフォルダで次のコマンドを実行できます。

```bash
npm run ios:demo
```

Webビルド・iOS資材同期・Simulator向けビルド・専用の「みつけるスケッチ iPhone 16」Simulatorへのインストール・アプリ起動を行います。Xcode 27ではDevice Hub（旧版XcodeではSimulator）を開くと表示されます。Apple Accountの署名は不要です。`scripts/ios-demo.mjs` 内でXcodeのパスを指定するため、このコマンドはシステム全体の `xcode-select` 設定を変更しません。


XcodeでプロジェクトのScheme **App** と通常のiPhone（例：iPhone 16）のSimulatorを選び、Run（▶）を押します。実機用の開発チーム署名は不要です。Simulatorではカメラ映像の実機確認はできないため、「ヤギを選んではじめる」から試します。

動作確認：手動選択 → 観察 → 横長の楕円や開いた輪郭を描く → 答え合わせ → 正解アニメーション → 解説。横線や円では本人の自己確認が表示され、縦長でも解説へ進めることを確認します。

## 4. 自分のiPhoneに入れてデモ

1. iPhoneをMacへケーブル接続し、必要に応じてMacを信頼します。
2. XcodeのSettings → AccountsでApple Accountを追加します。
3. AppターゲットのSigning & CapabilitiesでAutomatically manage signingを有効にし、自分のTeamを選びます。個人端末の開発テストにはPersonal Teamも利用できます。
4. Bundle Identifierが重複する場合は、自分の一意な開発用IDへ変更します。`capacitor.config.ts` の `appId` とXcode側のBundle Identifierの両方を揃えてください。生成後にconfigだけを変更してもXcode側へ自動反映されません。
5. iPhone側で、Xcodeの案内に従って「設定 → プライバシーとセキュリティ → デベロッパモード」を有効にします。再起動が必要な場合があります。
6. Xcodeの実行先に接続したiPhoneを選び、Run（▶）を押します。
7. ホーム画面からアプリを起動し、手動選択のデモを確認します。機内モードでも同じ流れを試し、Macのサーバへ依存していないことを実機で確認してください。

Apple公式：[署名とPersonal Team](https://help.apple.com/xcode/mac/current/en.lproj/dev60b6fbbc7.html)、[Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device/)

この手順は自分の端末での開発デモ用です。Personal Teamの署名には有効期限などの制約があり、恒久配布には向きません。他人への配布・TestFlight・App Store公開は今回実施していません。

## 編集するファイル

| 用途 | ファイル |
| --- | --- |
| Figmaの画面 | `src/screens/`、`src/CameraView.tsx` |
| 共通ヘッダーと状態 | `src/App.tsx` |
| 色・書体・余白 | `src/styles/tokens.css`、`src/style.css` |
| タッチ描画と判定 | `src/SketchCanvas.tsx`、`src/evaluator.ts` |
| Capacitor設定 | `capacitor.config.ts` |
| iPhone対象・署名・アプリID | `ios/App/App.xcodeproj` |
| アプリ名とカメラ利用目的 | `ios/App/App/Info.plist` |
| 仮アイコンと起動画面 | `ios/App/App/Assets.xcassets/` |

`ios/App/App/public/` は自動生成物です。直接編集せず `src/` を変更して `npm run ios:sync` で更新します。AI認識は追加していません。カメラ・音・指の操作・バックグラウンド復帰は、Xcode導入後にWKWebViewと実機で確認する必要があります。

### 通常のiPhoneで確認する設定

デモコマンドはiPhone 16を明示的に選び、Duoなどの折りたたみ機種を選びません。iPhone 16に対応するSimulatorランタイム（この環境ではiOS 27.0）を使用します。
iOS 27 SDKの起動要件に合わせ、`AppDelegate.swift` 内に `DemoSceneDelegate` を置き、`Info.plist` にscene構成を追加しました。画面は既存のReact UIを表示します。

今回のMacでは、Xcodeの「Open Developer Tool → Device Hub」で「みつけるスケッチ iPhone 16」を選ぶとデモを表示できます。初期画面はネイティブのWKWebViewで目視確認済みです。ネイティブ内の描画から正解までの連続操作は未検証で、WebKit/ChromiumのWeb版テストとは区別しています。

描画の失敗理由表示を改善した版は、実機iPhone 17 Proへ再インストールし、起動まで確認済みです。ネイティブ内の全描画パターンの操作確認は、Webの自動テストとは別途行ってください。
