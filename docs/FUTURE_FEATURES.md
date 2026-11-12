# 後から呼び出す機能（未接続）

現行アプリの画面・保存・研究ログ・認識モデルには接続していません。公開、iOS同期も行っていません。`src/future/` を本体からimportしない限り、本番バンドルに含まれず、カメラ・通信・DBの処理も実行されません。URLパラメータや隠しボタンで起動する仕組みは設けていません。

## 1. 写真入り観察カード

実装：`src/future/photoCard.ts`

```ts
const { composePhotoCard } = await import('./future/photoCard');
const card = await composePhotoCard({
  photo: capturedPhotoBlob,
  sketch: observation.ownPng,
  animalName: observation.animalName,
  featureName: observation.taskName,
  discovery: observation.discovery,
});
// card は image/png の Blob。ここでは保存・送信しない。
// 利用者が保存を選んだ時だけ既存の savePng(card, filename) へ渡す。
```

写真を上、スケッチを下に配置し、双方を切り取らず比率を維持。描画済みの動物画像をそのまま使用します。気づきは200文字まで、PNGでは改行を空白にまとめて折り返します。画像入力はJPEG/PNG/WebP、各12MB以下、読み込み後2400万画素以下。出力幅1000px。壊れた画像はエラー。デコード用URLは成功・失敗とも解放します。撮影写真の位置情報等はPNGへ引き継ぎません。

未接続事項：写真保存の任意選択UI、IndexedDBへの写真追加、既存バックアップへの写真統合、カードの図鑑表示。返されるカードを現在の画像フィールドに無条件で上書きしないでください。写真読み込み時の最大メモリはブラウザのデコード実装に依存し、画素数のチェックはデコード後です。

## 2. 描く前・後の気づき比較

実装：`src/future/observationComparison.ts`、`src/future/NoticingComparison.tsx`

```tsx
const { observationMoment, compareObservations } =
  await import('./future/observationComparison');
const before = observationMoment(task.id, '描く前の気づき');
// 後で回答を受け取ったときに作成する
const after = observationMoment(task.id, '描いた後の気づき');
const comparison = compareObservations(before, after, true);
// 表示する場合：
// const { NoticingComparison } = await import('./future/NoticingComparison');
// <NoticingComparison value={comparison} />
```

空欄でも利用できます。同じ課題・日時順を検証し、入力オブジェクトとは独立したコピーを返します。点数、学習効果、実際の観察時間は算出しません。`revisitedSelfReport` は本人の申告です。自由記述や日時を自動記録・送信しません。研究利用時の説明・同意、保存先、撤回時の削除、分析用エクスポートへの接続は、実際に採用するときに設計してください。

## 共通の呼び出し口

`src/future/index.ts` の `futureFeatures.photoCard()` / `observationComparison()` / `noticingComparisonView()` でも必要なモジュールだけ遅延ロードできます。各関数を呼ぶだけでは写真生成やデータ保存は始まりません。

## 確認方法

- `npm test`：任意入力、課題・日時の整合性、文字数・画像形式・容量の制約
- `npx playwright test tests/e2e/future.spec.ts`：Chromium / WebKitで実際のCanvas生成、画像位置・縦横比、壊れた画像のエラーを確認
- `npm run build`：TypeScript検査、本体へ未接続のままビルド

ブラウザテストでは一時ページへテスト対象を注入するだけです。本番にテスト画面を追加しません。実機Safariの写真撮影から保存・共有までの検証は、画面に接続する段階で必要です。

## 3. 利用後の短いアンケート（研究用の質問案）

実装：`src/future/postUseSurvey.ts`、`src/future/SurveyQuestionnaire.tsx`

- 描き始めやすさ、負担感、楽しさ、特徴への気づきの4問。各3択、未回答・スキップ可。
- 質問文は検証前の案です。妥当性が検証済みの尺度ではなく、合計点・学習効果の自動判定を作りません。
- `burden` は数値が大きいほど負担の自己申告が大きい項目です。他項目とそのまま足し合わせないでください。
- `consent={false}` では質問を表示せず、回答を生成しません。同意撤回や課題変更でフォームが外れると、一時回答を破棄し、処理中の `AbortSignal` を中断します。
- 記録を保存するコールバックは呼び出し側が提供します。再試行では同じIDを再利用するので、そのIDで重複保存を防いでください。
- `exportSurveyResponses(rows, currentConsent, 'json' | 'csv')` は文字列を返すだけです。未回答は欠測のまま保持。JSONには質問文・選択肢も含み、CSVには値を含めます。氏名、メール、写真、自由記述は含めません。

```tsx
import { PostUseSurvey } from './future/SurveyQuestionnaire';
// 実際に採用するときはReact.lazy等で、この補助画面を必要時だけロード。
<PostUseSurvey
  key={consentSessionId}
  consent={currentConsent}
  taskId={task.id}
  onSave={async (response, signal) => {
    // await処理の後やDB確定の直前にも現在の同意を確認する。
    if (signal.aborted || !getCurrentConsent()) throw new Error('cancelled');
    // 呼出側で同意トークンの確認と同じトランザクション内に保存。
    // 未接続：保存先・撤回削除・研究ログとの関連付けはここで実装する。
  }}
  onSkip={closeQuestionnaire}
/>
```

呼び出し口：`futureFeatures.postUseSurvey()`、`futureFeatures.postUseSurveyView()`。
既存の研究データにはまだ保存しません。採用時は説明文、保護者等への説明手順、撤回後の削除、課題・参加者コードの関連付けを含めて接続してください。コンポーネントに `true` を固定指定して同意を省略しないでください。

## 4. 保存状態チェック

実装：`src/future/storageCheck.ts`

```ts
const { inspectStorage, probeStorage } = await futureFeatures.storageCheck();
const status = await inspectStorage(); // 容量の概算・永続化状態・API有無を読むだけ
// 以下は利用者が「保存を確認」を押した場合だけ実行
const probe = await probeStorage();
```

`inspectStorage` は永続化の許可を要求しません。容量や永続化情報が取得できなければ不明のまま返します。`probeStorage` は毎回一意の `zooketch-probe-*` 一時DBに一つの文字列を書き、読めることとトランザクション完了を確認してから削除します。既存のノートDB、設定、研究記録は読み書きしません。

- `writable`：今回の小さなテスト書き込みに成功したか
- `reason`：失敗の場合 `unavailable` / `failed` / `timeout`
- `cleanup`：一時DB削除の結果 `complete` / `pending` / `not-needed`

削除がブロックされたり待ち時間を超えた場合は `pending` を返し、削除済みと偽りません。既定は書き込み確認と削除それぞれ最大3秒、指定可能範囲は100〜10000msです。容量概算・テスト成功は、大きな写真の保存や将来のデータ保持を保証しません。実保存時には既存のエラー処理を維持してください。定期実行・自動起動する処理はありません。

## 追加検証

アンケートの同意なし・任意回答・再試行・同意撤回時の処理中断・JSON/CSVを検証します。保存チェックは並行実行、一時DB削除、既存データ維持、拒否、タイムアウトを検証します。本番画面への接続、実機Safariでの通し検証、アンケートの研究手法としての妥当性評価は未実施です。
