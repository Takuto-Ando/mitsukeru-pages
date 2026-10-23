import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, closeSync } from "node:fs";
import { resolve } from "node:path";

const env = {
  ...process.env,
  DEVELOPER_DIR:
    process.env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer",
};
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      result.error?.message ||
        result.stderr ||
        `${command} failed; see build log.`,
    );
  return result.stdout;
}
try {
  if (!existsSync(env.DEVELOPER_DIR))
    throw new Error("Xcodeを導入し、初回設定を完了してください。");
  run("xcodebuild", ["-checkFirstLaunchStatus"]);
  const runtimes = JSON.parse(
    run("xcrun", ["simctl", "list", "runtimes", "--json"]),
  ).runtimes;
  const phoneType = "com.apple.CoreSimulator.SimDeviceType.iPhone-16";
  const deviceName = "みつけるスケッチ iPhone 16";
  const runtime = runtimes
    .filter(
      (r) =>
        r.isAvailable &&
        r.identifier.includes("SimRuntime.iOS-") &&
        r.supportedDeviceTypes?.some((d) => d.identifier === phoneType),
    )
    .sort((a, b) =>
      a.version.localeCompare(b.version, undefined, { numeric: true }),
    )
    .at(-1);
  if (!runtime)
    throw new Error(
      "通常のiPhone 16に対応するSimulatorがありません。XcodeのSettings → ComponentsでiOS 27.0等を追加してください。",
    );
  const devices =
    JSON.parse(
      run("xcrun", ["simctl", "list", "devices", "available", "--json"]),
    ).devices[runtime.identifier] || [];
  let device = devices.find(
    (d) => d.name === deviceName && d.deviceTypeIdentifier === phoneType,
  );
  if (!device) {
    const phone = runtime.supportedDeviceTypes?.find(
      (d) => d.identifier === phoneType,
    );
    if (!phone) throw new Error("iPhone Simulatorの機種情報がありません。");
    device = {
      udid: run("xcrun", [
        "simctl",
        "create",
        deviceName,
        phone.identifier,
        runtime.identifier,
      ]).trim(),
      state: "Shutdown",
    };
  }
  const derived = resolve(
    process.env.MITSUKERU_DERIVED_DATA || "ios/App/build/DerivedData",
  );
  const buildLog = resolve("ios/App/build/simulator-build.log");
  mkdirSync(resolve("ios/App/build"), { recursive: true });
  console.log(`iPhone Simulator向けビルド中。ログ: ${buildLog}`);
  const fd = openSync(buildLog, "w");
  try {
    run(
      "xcodebuild",
      [
        "-project",
        "ios/App/App.xcodeproj",
        "-scheme",
        "App",
        "-configuration",
        "Debug",
        "-sdk",
        "iphonesimulator",
        "-destination",
        `id=${device.udid}`,
        "-derivedDataPath",
        derived,
        "CODE_SIGNING_ALLOWED=NO",
        "build",
      ],
      { stdio: ["ignore", fd, fd] },
    );
  } finally {
    closeSync(fd);
  }
  if (device.state !== "Booted") run("xcrun", ["simctl", "boot", device.udid]);
  run("xcrun", ["simctl", "bootstatus", device.udid, "-b"], {
    stdio: "inherit",
  });
  run("xcrun", [
    "simctl",
    "install",
    device.udid,
    resolve(derived, "Build/Products/Debug-iphonesimulator/App.app"),
  ]);
  const launch = run("xcrun", [
    "simctl",
    "launch",
    "--terminate-running-process",
    device.udid,
    "jp.mitsukerusketch.demo",
  ]);
  console.log(launch.trim());
  console.log(
    "起動しました。Xcode 27のDevice Hub（旧版はSimulator）で画面が表示されます。",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
