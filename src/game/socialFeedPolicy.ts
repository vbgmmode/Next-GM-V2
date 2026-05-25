import { getStipulationById, getStipulationCostForShow } from "./stipulationCatalog";
import type { SegmentResult, ShowResult, SocialCategory, SocialTone } from "./types";

export type SocialPolicyPostDraft = {
  category: SocialCategory;
  author: string;
  tone: SocialTone;
  priority: number;
  text: string;
  relatedWrestlerIds: string[];
  relatedRivalryIds?: string[];
  relatedChampionshipIds?: string[];
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function pickLine(seed: string, lines: string[]) {
  return lines[hashString(seed) % lines.length];
}

function getLargestFatigueGain(segment: SegmentResult) {
  return Math.max(0, ...Object.values(segment.fatigueChanges));
}

export function buildStipulationSocialPostDraft(result: ShowResult, segment: SegmentResult): SocialPolicyPostDraft | undefined {
  const stipulation = getStipulationById(segment.stipulationId);

  if (!stipulation) {
    return undefined;
  }

  const participantLabel = segment.participantNames.join(" / ");
  const stipulationCost = getStipulationCostForShow(stipulation.id, result.showType);
  const largestFatigueGain = getLargestFatigueGain(segment);
  const basePriority = 18 + stipulation.socialPriorityBonus + Math.round(stipulationCost / 10000);

  if (segment.score < 60) {
    return {
      category: "push_complaint",
      author: "@BookerBrain",
      tone: "angry",
      priority: basePriority + 18,
      text: pickLine(`${result.id}-stipulation-weak-${segment.segmentId}`, [
        `${participantLabel} got ${stipulation.label} production and the spot still felt flat. That is premium money for a segment the timeline is already clipping sideways.`,
        `${stipulation.label} should feel like escalation. ${participantLabel} landing soft has fans asking why the office paid for the chaos.`,
      ]),
      relatedWrestlerIds: segment.participantIds,
      relatedRivalryIds: segment.rivalryId ? [segment.rivalryId] : [],
      relatedChampionshipIds: segment.championshipId ? [segment.championshipId] : [],
    };
  }

  if (largestFatigueGain >= 12 || (stipulation.fatigueBonus >= 3 && segment.score < 82)) {
    return {
      category: "fatigue_concern",
      author: "Tape Traders Weekly",
      tone: "skeptical",
      priority: basePriority + 12,
      text: pickLine(`${result.id}-stipulation-fatigue-${segment.segmentId}`, [
        `${participantLabel} took the ${stipulation.label} route and the body-load discourse got loud fast. They looked spent by the end.`,
        `${stipulation.label} gave ${participantLabel} a bigger spotlight, but the workload receipt is sitting right there in the post-show clips.`,
      ]),
      relatedWrestlerIds: segment.participantIds,
      relatedRivalryIds: segment.rivalryId ? [segment.rivalryId] : [],
      relatedChampionshipIds: segment.championshipId ? [segment.championshipId] : [],
    };
  }

  if (segment.score >= 84) {
    return {
      category: segment.rivalryId ? "rivalry_heat" : "viral_moment",
      author: segment.rivalryId ? "IWC Story Desk" : "@ClipMachine",
      tone: segment.score >= 90 ? "chaotic" : "impressed",
      priority: basePriority + 20,
      text: pickLine(`${result.id}-stipulation-hit-${segment.segmentId}`, [
        `${participantLabel} made ${stipulation.label} feel worth the specialty production bill. That spot is exactly how the feed starts rewriting the whole night.`,
        `${stipulation.label} gave ${participantLabel} the kind of replay hook fans turn into a week-long argument.`,
      ]),
      relatedWrestlerIds: segment.participantIds,
      relatedRivalryIds: segment.rivalryId ? [segment.rivalryId] : [],
      relatedChampionshipIds: segment.championshipId ? [segment.championshipId] : [],
    };
  }

  return {
    category: segment.rivalryId ? "rivalry_heat" : "analyst_take",
    author: segment.rivalryId ? "IWC Story Desk" : "Gorilla Position Analytics",
    tone: "analytical",
    priority: basePriority,
    text: `${participantLabel} worked ${stipulation.label} into ${result.showName}. The specialty production changed the feel of the match without inventing any offscreen fallout.`,
    relatedWrestlerIds: segment.participantIds,
    relatedRivalryIds: segment.rivalryId ? [segment.rivalryId] : [],
    relatedChampionshipIds: segment.championshipId ? [segment.championshipId] : [],
  };
}
