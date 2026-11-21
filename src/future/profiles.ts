// きょうだいプロフィール：観察カードを子どもごとに分けて持つ。
// 既定プロフィールは「みんな」。古いカード（profileId なし）は「みんな」扱い。
export type Profile = { id: string; name: string };

export const DEFAULT_PROFILE: Profile = { id: "minna", name: "みんな" };

const KEY = "zooketch-profiles-v1";

type Stored = { list: Profile[]; currentId: string };

function load(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as
      | Stored
      | null;
    if (raw && Array.isArray(raw.list) && raw.list.length) return raw;
  } catch {
    // 壊れていたら既定に戻す
  }
  return { list: [DEFAULT_PROFILE], currentId: DEFAULT_PROFILE.id };
}

function save(stored: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // 保存できなくてもアプリは動く
  }
}

export function loadProfiles(): Profile[] {
  return load().list;
}

export function currentProfileId(): string {
  return load().currentId;
}

export function setCurrentProfile(id: string) {
  const stored = load();
  if (stored.list.some((p) => p.id === id)) {
    stored.currentId = id;
    save(stored);
  }
}

export function addProfile(name: string): Profile {
  const stored = load();
  const profile: Profile = {
    id: `p-${Date.now().toString(36)}`,
    name: name.trim() || "なまえなし",
  };
  stored.list.push(profile);
  stored.currentId = profile.id;
  save(stored);
  return profile;
}

export function recordProfileId(record: { profileId?: string }): string {
  return record.profileId ?? DEFAULT_PROFILE.id;
}
