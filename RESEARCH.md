# 研究用の観察記録（事前説明・同意式）

画面下部の「研究への参加・記録」（`src/components/StudyControls.tsx`）から、事前説明を確認してチェックボックスで同意した場合に限り、IndexedDB（`zooketch.observation-notebook` の `researchEvents` ストア）へ操作イベントを記録します。

- 初期状態（同意前）およびページ再読込時は `collecting: false` で開始し、同意前の操作は一切記録しません。
- 同意しなくても通常のアプリ機能はすべて利用できます。
- 「同意を撤回して研究ログを削除」を押すと、記録を停止してブラウザ内の研究ログを即時全消去します（観察ノートの絵は消えません）。

## 記録するイベント（`src/research/study.ts`）

- `session_started`
- `animal_photographed`
- `animal_identified`
- `challenge_opened`
- `hint_opened`
- `drawing_started` / `drawing_stopped`
- `drawing_submitted`
- `drawing_cleared`
- `drawing_undo` / `drawing_erased`
- `evaluation_completed`
- `comparison_opened`
- `comparison_slider_moved`
- `explanation_opened` / `explanation_closed`
- `observation_saved`
- `challenge_completed` / `challenge_left`
- `session_completed`

各イベントには `sessionId`、匿名の `participantCode`、`sequence`、`event`、`timestamp`、`animalId`、`taskId`、`attemptId`、およびホワイトリスト検証済みの `details`（`hintLevel`, `method`, `status`, `from`, `to`, `via`, `tool` 等）のみを記録します。

## 算出可能な分析項目（`src/research/analysis.ts`）

`analyzeStudy(events)` により、各試行（`attemptId`）ごとに以下の指標を算出します（JSON書き出し時にも `analysis` フィールドへ同梱されます）：

1. **課題開始から最初の描画までの経過時間**（`firstDrawingElapsedMs`）
2. **描画に要した時間**（`drawingMs`）
3. **回答回数**（`submissions`）
4. **描き直し回数**（`revisions`：`drawing_cleared` / `drawing_undo` / `drawing_erased` の合計）
5. **ヒント利用回数**（`hints`）
6. **正解判定までの試行回数**（`attemptsToSuccess`）
7. **比較スライダーの利用有無**（`sliderUsed`）
8. **比較スライダーの操作回数**（`sliderOperations`）
9. **解説画面の閲覧時間**（`explanationMs`）
10. **課題の完了率**（`completionRate`）

> **重要**：アプリを操作していない時間が、必ずしも動物を観察している時間とは限りません。「観察時間」と断定せず、「課題開始から最初の描画までの経過時間（`firstDrawingElapsedMs`）」など測定可能な名称を使用しています。実際の動物観察行動を評価するには、別途の行動観察調査やアンケート等を組み合わせる必要があります。

## プライバシーとデータ保護

- 通常の研究イベントログに、撮影画像・描画画像・筆跡座標は含めません。下記の追加同意がある2回描画モードだけは、別の研究記録として描画PNGを保存します。撮影画像はどちらにも保存しません。
- GPS位置情報、氏名、メールアドレス、端末固有IDは収集しません。
- 外部サーバーへの自動送信は行いません。
- 利用者・研究者の明示的なボタン操作によってのみ、JSONまたはCSV（UTF-8 BOM付き、数式インジェクション対策済み）として端末へ書き出せます。


## 2回描画の追加同意

「同じ課題を2回描く研究モードを使う」を選び、画像記録を含む説明に同意して開始した場合だけ有効です。開始前の絵を遡って記録しません。撮影から新しい課題を開始してください。

- `phase` は `before` / `after`、`pairId` は2回を結ぶ匿名ID。各回の `attemptId` は別です。CSVにも両項目を含めるため、ヒント数、回答数、描画の接触時間などを各回で算出できます。
- 1回目の解説後に「同じ特徴をもう一度描く」を押します。新しい描画は空欄から始まり、1回目を上書きしません。2回目の解説に到達した時点で比較を表示します。
- 画像ペアはIndexedDBのsettingsストアの `study-pair:` レコードに保存。PNGデータURL・判定・各回の操作指標を保存し、JSONの `pairs` に同梱します。筆跡座標や撮影写真は保存しません。1回目のみで終了した場合の画像はメモリから破棄され、永続化しません。
- 記録停止・再読込で研究モードは終了します。再開には明示操作が必要。同意撤回は研究画像ペアとイベントをすべて削除します。書き出し済みファイルは自動削除できません。
- 「描画時間」はペン接触中のイベント間隔の合計です。考えている時間や実物を見る時間全体ではありません。解説閲覧は可視状態の経過時間で、読み終えた証拠ではありません。
- 学習後の2回目には練習・記憶・お手本の影響も含まれます。描画の変化から観察能力全体の向上を断定できません。行動観察・アンケート・比較条件等を組み合わせて評価してください。
