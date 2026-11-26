import {
  speciesRecognizer,
  type SpeciesImageFit,
  type SpeciesPhoto,
} from "./species";
import type { Candidate } from "./labels";
import type { PhotoReferenceSuggestion } from "./contracts";

export type PhotoSource = string | (() => Promise<SpeciesPhoto | undefined>);
export type SpeciesView = {
  photo: PhotoSource;
  fit?: SpeciesImageFit;
  source?: "focus" | "tile";
};

export const photoViewQuality = { full: 0.8, crop: 0.85 };

export function photoFromCanvas(canvas: HTMLCanvasElement, quality: number) {
  let image: Promise<SpeciesPhoto | undefined> | undefined;
  return () =>
    (image ??= new Promise((resolve) =>
      canvas.toBlob(
        (blob) => resolve(blob ?? undefined),
        "image/jpeg",
        quality,
      ),
    ));
}

export function photoSpeciesViews(
  full: PhotoSource,
  crop?: PhotoSource,
  tiles: readonly PhotoSource[] = [],
): SpeciesView[] {
  return [
    ...(crop
      ? [
          { photo: crop, source: "focus" as const },
          { photo: crop, fit: "contain" as const, source: "focus" as const },
        ]
      : []),
    { photo: full },
    { photo: full, fit: "contain" },
    ...tiles.map((photo) => ({ photo, source: "tile" as const })),
  ];
}

type Vote = {
  candidate: Candidate;
  view: SpeciesView;
  strong: boolean;
  margin: number;
};
const key = (candidate: Candidate) => candidate.groupId;

function matchingPhotoReference(
  suggestions: readonly PhotoReferenceSuggestion[],
) {
  const [first] = suggestions;
  if (!first || !suggestions.every(({ groupId }) => groupId === first.groupId))
    return;
  if (
    suggestions.some(({ clear }) => clear) ||
    (suggestions.length >= 2 &&
      suggestions.some(({ similarity }) => similarity >= 0.5))
  )
    return first.groupId;
}

function supportedByViews(votes: readonly Vote[]) {
  const pairs = new Map<string, Vote[]>();
  for (const vote of votes) {
    const id = key(vote.candidate);
    const group = pairs.get(id) ?? [];
    group.push(vote);
    pairs.set(id, group);
  }
  const ranked = [...pairs.values()].sort((a, b) => b.length - a.length);
  if (ranked[0]?.length >= 2 && ranked[0].length > (ranked[1]?.length ?? 0))
    return ranked[0][0].candidate;
  if (ranked.length === 1) {
    const clearFocus = votes.find(
      ({ view, strong }) => view.source === "focus" && !view.fit && strong,
    );
    return clearFocus?.candidate;
  }
}

export async function recognizeSpeciesViews(
  views: readonly SpeciesView[],
  active: () => boolean,
  progress?: (message: string) => void,
  onSuggestion?: (candidate: Candidate) => void,
  recognize = speciesRecognizer.recognize,
) {
  const candidates = new Map<string, Candidate>();
  const votes: Vote[] = [];
  const hasFocus = views.some(({ source }) => source === "focus");
  let supported: Candidate | undefined;
  let provisional: Candidate | undefined;
  let suggestion: Candidate | undefined;
  const photoReferences: PhotoReferenceSuggestion[] = [];

  let unavailable = false;

  let triedTiles = false;
  for (const view of views) {
    if (view.source === "tile" && !triedTiles) {
      triedTiles = true;
      // Use the same result as photo review whenever its views agree.
      supported = supportedByViews(votes);
      if (supported) break;
    }
    if (!active()) break;
    const photo =
      typeof view.photo === "string" ? view.photo : await view.photo();
    if (!active()) break;
    if (!photo) continue;
    const result = await recognize(photo, progress, view.fit);
    if (result.status === "unavailable") {
      unavailable = true;
      break;
    }
    if (!active()) break;
    if (
      result.status === "unknown" &&
      result.referenceSuggestion &&
      !view.source
    )
      photoReferences.push(result.referenceSuggestion);
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

    // Two tighter views in the tracked frame can correct a tentative name
    // while the remaining votes are still running. One tile is insufficient.
    if (
      onSuggestion &&
      hasFocus &&
      view.source === "tile" &&
      first.score >= 0.65 &&
      (!suggestion || key(suggestion) !== key(first)) &&
      agree.some(
        ({ view, candidate }) =>
          view.source === "tile" && candidate.score >= 0.65,
      )
    ) {
      suggestion = first;
      onSuggestion(first);
    }

    // A pair of consistent views of the subject outranks incidental details
    // elsewhere in the enclosure. Without localization, only whole-frame
    // evidence counts so searching smaller regions cannot label a background.
    if (
      agree.some(
        ({ view: earlier }) =>
          earlier.source === "focus" && view.source === "focus",
      ) ||
      (!hasFocus && !view.source && (strong || agree.length > 0)) ||
      (!result.recognition && view.source !== "tile")
    ) {
      supported = first;
      break;
    }
  }

  if (!supported && hasFocus) {
    const frame = votes.filter(({ view }) => !view.source);
    supported = supportedByViews(votes);
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

  const direct = votes.find(({ view }) => view.source !== "tile")?.candidate;
  const tentative =
    direct && votes.every(({ candidate }) => key(direct) === key(candidate))
      ? direct
      : undefined;
  const ranked = [...candidates.values()];
  if (supported) {
    const winner = supported;
    ranked.splice(
      ranked.findIndex((candidate) => key(candidate) === key(winner)),
      1,
    );
    ranked.unshift(winner);
  }
  return {
    primary: supported ?? provisional,
    supported,
    suggestion: supported ?? suggestion ?? tentative,
    candidates: ranked.slice(0, 3),
    referenceGroupId:
      !ranked.length && !unavailable && active()
        ? matchingPhotoReference(photoReferences)
        : undefined,
    unavailable,
  };
}
