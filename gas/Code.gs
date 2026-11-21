/**
 * ズーケッチ 絵の自動送信 受け口（Google Apps Script）
 *
 * 設置手順は docs/gdrive-share-setup.md を参照。
 * 1. TOKEN を好きな文字列に変える（アプリ側の設定と一致させる）
 * 2. ウェブアプリとしてデプロイ（実行ユーザー: 自分 / アクセス: 全員）
 *
 * 受け取った絵は Googleドライブの「ズーケッチ提出」フォルダに PNG で保存され、
 * 一覧がスプレッドシート「ズーケッチ提出一覧」に追記されます。
 * 線データ（strokes）は PNG と同じ名前の .json として隣に保存されます
 * （アプリのバックアップ形式に近い形で復元できます）。
 */

var TOKEN = "zooketch-2026"; // ← 必ず変更。アプリの設定画面のトークンと一致させる
var FOLDER_NAME = "ズーケッチ提出";
var SHEET_NAME = "ズーケッチ提出一覧";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) return json_({ ok: false, error: "token" });
    if (!data.id || !data.pngBase64) return json_({ ok: false, error: "payload" });

    var folder = getFolder_();
    var stamp = Utilities.formatDate(
      data.createdAt ? new Date(data.createdAt) : new Date(),
      "Asia/Tokyo",
      "yyyyMMdd-HHmmss",
    );
    var base =
      stamp + "_" + safe_(data.animalName || "どうぶつ") + "_" + String(data.id).slice(0, 8);

    // 同じ記録IDが既にあれば二重登録しない（アプリ側の再送対策）
    var existing = folder.getFilesByName(base + ".png");
    if (existing.hasNext()) return json_({ ok: true, duplicated: true });

    var png = Utilities.newBlob(
      Utilities.base64Decode(data.pngBase64),
      "image/png",
      base + ".png",
    );
    var file = folder.createFile(png);

    if (data.strokes) {
      folder.createFile(
        base + ".json",
        JSON.stringify({
          id: data.id,
          createdAt: data.createdAt,
          animalName: data.animalName,
          taskName: data.taskName,
          groupId: data.groupId,
          profileId: data.profileId,
          strokes: data.strokes,
        }),
        "application/json",
      );
    }

    var sheet = getSheet_();
    sheet.appendRow([
      new Date(),
      data.createdAt || "",
      data.animalName || "",
      data.taskName || "",
      data.profileId || "",
      data.discovery || "",
      file.getUrl(),
      data.id,
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: "zooketch-share" });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getFolder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function getSheet_() {
  var it = DriveApp.getFilesByName(SHEET_NAME);
  var ss;
  if (it.hasNext()) {
    ss = SpreadsheetApp.open(it.next());
  } else {
    ss = SpreadsheetApp.create(SHEET_NAME);
    ss
      .getActiveSheet()
      .appendRow([
        "受信日時",
        "描いた日時",
        "動物",
        "課題",
        "プロフィール",
        "気づいたこと",
        "絵（Drive）",
        "記録ID",
      ]);
  }
  return ss.getActiveSheet();
}

function safe_(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, "_");
}
