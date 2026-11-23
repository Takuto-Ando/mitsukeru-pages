import {
  speciesRecognizer,
  type SpeciesImageFit,
  type SpeciesPhoto,
} from "./species";
import type { Candidate } from "./labels";

type PhotoSource = string | (() => Promise<SpeciesPhoto | undefined>);
type SpeciesView = {
  photo: PhotoSource;
  fit?: SpeciesImageFit;
  source?: "focus";
};

type Vote = {
  candidate: Candidate;
  view: SpeciesView;
  strong: boolean;
  margin: number;
};
const key = (candidate: Candidate) => candidate.speciesId ?? candidate.groupId;

export async function recognizePhotoSpecies(
  { full, crop }: { full: PhotoSource; crop?: PhotoSource },
  active: () => boolean,
  progress?: (message: string) => void,
) {
  const views: SpeciesView[] = [
    ...(crop
      ? [
          { photo: crop, source: "focus" as const },
          { photo: crop, source: "focus" as const, fit: "contain" as const },
        ]
      : []),
    { photo: full },
    { photo: full, fit: "contain" },
  ];
  const candidates = new Map<string, Candidate>();
  const votes: Vote[] = [];
  const hasFocus = !!crop;
  let supported: Candidate | undefined;
  let provisional: Candidate | undefined;
  let unavailable = false;

  for (const view of views) {
    if (!active()) break;
    const photo =
      typeof view.photo === "string" ? view.photo : await view.photo();
    if (!active()) break;
    if (!photo) continue;
    const result = await speciesRecognizer.recognize(photo, progress, view.fit);
    if (result.status === "unavailable") {
      unavailable = true;
      break;
    }
    if (!active()) break;
    if (result.status !== "candidates") continue;
    for (const candidate of result.candidates) {
      if (!candidates.has(key(candidate)))
        candidates.set(key(candidate), candidate);
    }

    const [first, runner] = result.candidates;
    const margin = first ? first.score - (runner?.score ?? 0) : 0;
    const strong = result.recognition?.status === "identified";
    const minimum = hasFocus ? 0.4 : 0.6;
    if (!first || first.score < minimum || margin < 0.07) continue;
    const agree = votes.filter(
      ({ candidate }) => key(candidate) === key(first),
    );
    votes.push({ candidate: first, view, strong, margin });

    // A pair of consistent views of the subject outranks incidental details
    // elsewhere in the enclosure. Without localization, only whole-frame
    // evidence counts so searching smaller regions cannot label a background.
    if (
      agree.some(
        ({ view: earlier }) =>
          earlier.source === "focus" && view.source === "focus",
      ) ||
      (!hasFocus && !view.source && (strong || agree.length > 0)) ||
      !result.recognition
    ) {
      supported = first;
      break;
    }
  }

  if (!supported && hasFocus) {
    const frame = votes.filter(({ view }) => !view.source);
    const pairs = new Map<string, Vote[]>();
    for (const vote of votes) {
      const id = key(vote.candidate);
      const group = pairs.get(id) ?? [];
      group.push(vote);
      pairs.set(id, group);
    }
    const ranked = [...pairs.values()].sort((a, b) => b.length - a.length);
    if (ranked[0]?.length >= 2 && ranked[0].length > (ranked[1]?.length ?? 0))
      supported = ranked[0][0].candidate;
    if (ranked.length === 1) {
      const clearFocus = votes.find(
        ({ view, strong }) => view.source === "focus" && !view.fit && strong,
      );
      supported ??= clearFocus?.candidate;
    }
    // Repeat only convincing local evidence when the full frame offers no
    // competing name. The camera requires it again before using it as a label.
    if (!supported && !frame.some(({ candidate }) => candidate.score >= 0.55)) {
      const [first, second] = votes
        .filter(
          ({ view, candidate, margin }) =>
            view.source &&
            (candidate.score >= 0.65 ||
              (view.source === "focus" &&
                candidate.score >= 0.5 &&
                margin >= 0.12)),
        )
        .sort((a, b) => b.candidate.score - a.candidate.score);
      if (first && (!second || key(first.candidate) === key(second.candidate)))
        provisional = first.candidate;
    }
  }

  const ranked = [...candidates.values()];
  if (supported) {
    const winner = supported;
    ranked.splice(
      ranked.findIndex((candidate) => key(candidate) === key(winner)),
      1,
    );
    ranked.unshift(winner);
  }
  // An undecided reading may be shown as tentative only when its votes agree
  // and its name is also the first candidate the review would offer.
  const first = ranked[0];
  const suggestion =
    first &&
    votes.length > 0 &&
    votes.every(({ candidate }) => key(candidate) === key(first))
      ? first
      : undefined;
  return {
    primary: supported ?? provisional,
    supported,
    suggestion,
    candidates: ranked.slice(0, 3),
    unavailable,
  };
}
