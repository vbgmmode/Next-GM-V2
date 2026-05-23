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
