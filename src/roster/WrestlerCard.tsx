import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import type { GameState, Wrestler, WrestlerAffiliation } from "../game/types";
import { formatAffiliationKind } from "./rosterDisplayUtils";
import {
  getMoraleEmoji,
  getMoraleTone,
  getRosterAlignmentLabel,
  getRosterContractWeeksLabel,
  getWrestlerIdentitySnapshot,
  getWrestlerMatchRecord,
  getWrestlerOverall,
  getWrestlerStatus,
  getWrestlerTitleLine,
} from "./rosterReads";
import { getWrestlerValueProfile } from "./rosterValueReads";

export function WrestlerCard({
  game,
  isSelected,
  onSelectWrestler,
  rosterAffiliations,
  wrestler,
}: {
  game: GameState;
  isSelected: boolean;
  onSelectWrestler: (wrestlerId: string) => void;
  rosterAffiliations: WrestlerAffiliation[];
  wrestler: Wrestler;
}) {
  const status = getWrestlerStatus(wrestler);
  const affiliations = rosterAffiliations.filter((affiliation) => affiliation.memberWrestlerIds.includes(wrestler.id));
  const valueProfile = getWrestlerValueProfile(wrestler);
  const identitySnapshot = getWrestlerIdentitySnapshot(wrestler, game);
  const overall = getWrestlerOverall(wrestler);
  const stamina = Math.max(0, 100 - wrestler.fatigue);
  const showValueTierChip = valueProfile.valueTierLabel.toLowerCase() !== "protected star";
  const record = getWrestlerMatchRecord(wrestler.id, game.showHistory);
  const titleLine = getWrestlerTitleLine(wrestler.id, game.championships);
  const contractWeeksLabel = getRosterContractWeeksLabel(game);

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectWrestler(wrestler.id);
    }
  }

  return (
    <article
      aria-label={`Select ${wrestler.name}`}
      aria-pressed={isSelected}
      className={`wrestler-card status-${status.toLowerCase()} ${isSelected ? "selected" : ""}`}
      onClick={() => onSelectWrestler(wrestler.id)}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="wrestler-card-head">
        <div className="wrestler-card-select" aria-hidden="true">
          <span className="wrestler-card-overall">{overall}</span>
          <WrestlerPortrait className="wrestler-card-portrait" wrestler={wrestler} />
        </div>
        <div>
          {titleLine ? <p className="roster-card-kicker">{titleLine}</p> : null}
          <h3>{wrestler.name}</h3>
          <small className="wrestler-card-meta-line">
            <span>{getRosterAlignmentLabel(wrestler)}</span>
            <span>Pop {wrestler.popularity}</span>
          </small>
        </div>
      </div>
      <div className="pressure-tags">
        {identitySnapshot.labels
          .filter((label) => {
            const normalizedLabel = label.toLowerCase();
            return normalizedLabel !== "protected star" && normalizedLabel !== "champion";
          })
          .slice(0, 2)
          .map((label) => (
            <span className="identity-chip" key={label}>
              {label}
            </span>
          ))}
        {showValueTierChip ? (
          <span className={`value-tier-chip ${valueProfile.contextMode === "missing" ? "value-tier-chip-missing" : ""}`}>
            {valueProfile.valueTierLabel}
          </span>
        ) : null}
      </div>
      {affiliations.length ? (
        <div className="affiliation-strip compact-affiliation-strip" aria-label={`${wrestler.name} affiliation context`}>
          {affiliations.slice(0, 1).map((affiliation) => (
            <span key={affiliation.id}>
              {affiliation.name} · {formatAffiliationKind(affiliation.kind)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="wrestler-card-readouts" aria-label={`${wrestler.name} compact stats`}>
        <div className="wrestler-card-stamina">
          <span>Stamina</span>
          <b style={{ width: `${stamina}%` }} />
          <strong>{stamina}</strong>
        </div>
        <div className={`wrestler-card-morale morale-${getMoraleTone(wrestler.morale)}`}>
          <span>Morale</span>
          <strong aria-label={`Morale ${wrestler.morale}`}>
            {getMoraleEmoji(wrestler.morale)}
            <em>{wrestler.morale}</em>
          </strong>
        </div>
      </div>
      <div className="wrestler-card-foot">
        <span>{contractWeeksLabel}</span>
        <span>{`W: ${record.wins} | L: ${record.losses}`}</span>
      </div>
    </article>
  );
}
