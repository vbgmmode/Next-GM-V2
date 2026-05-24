import type { AffiliationKind, Wrestler, WrestlerAffiliation } from "../game/types";

export function formatAffiliationKind(kind: AffiliationKind) {
  if (kind === "tag_team") {
    return "Tag Team";
  }

  if (kind === "faction") {
    return "Faction";
  }

  return "Affiliation";
}

export function getAffiliationMemberNames(affiliation: WrestlerAffiliation, wrestlers: Wrestler[]) {
  return affiliation.memberWrestlerIds
    .map((id) => wrestlers.find((wrestler) => wrestler.id === id)?.name)
    .filter(Boolean)
    .join(" / ");
}

export function getRosterCardChipDensityClass(labels: string[]) {
  if (!labels.length) {
    return "";
  }

  const totalChars = labels.reduce((sum, label) => sum + label.length, 0);
  const maxChars = Math.max(...labels.map((label) => label.length));

  if (totalChars >= 34 || maxChars >= 17) {
    return "roster-card-chips-tight";
  }

  if (totalChars >= 28 || maxChars >= 13) {
    return "roster-card-chips-compact";
  }

  if (totalChars >= 22 || maxChars >= 11) {
    return "roster-card-chips-dense";
  }

  return "";
}
