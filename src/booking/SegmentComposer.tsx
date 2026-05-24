import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import { getCatalogOptionsForType, getSegmentCatalogOption, getSegmentParticipantRange, type SegmentCatalogOption } from "../game/matchFormatCatalog";
import { getInjuryStatusLabel } from "../game/rosterContextReads";
import { getStipulationById } from "../game/stipulationCatalog";
import { isValidSegment } from "../game/scoring";
import type { Championship, GameState, Rivalry, Segment, Wrestler } from "../game/types";
import {
  canSegmentAttachChampionship,
  canSegmentAttachRivalry,
  getInjuryDetail,
  getSegmentDurationMinutes,
  getSegmentIdentityBadges,
  getSegmentPickerLabel,
  getSegmentRequirementForSegment,
  getStipulationsForSegmentId,
  getWrestlerNames,
  isVacantSinglesChampionship,
  wouldCreateIntergenderMatch,
} from "./bookingUtils";

export type SegmentComposerProps = {
  championships: Championship[];
  game: GameState;
  onApplyCatalogOption: (option: SegmentCatalogOption) => void;
  onBuildTitleMatch: (segmentId: string, championshipId: string) => void;
  onCancel?: () => void;
  onClose: () => void;
  onOpenProfile: (wrestlerId: string) => void;
  onRemoveSegment: () => void;
  onSetDuration: (durationMinutes: number) => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  onSetSegmentStipulation: (segmentId: string, stipulationId: string) => void;
  onSetSegmentRivalry: (rivalryId: string) => void;
  onToggleParticipant: (segmentId: string, wrestlerId: string) => void;
  rivalries: Rivalry[];
  saveLabel?: string;
  segment: Segment;
  wrestlers: Wrestler[];
};

function TitleMatchControl({
  championships,
  onBuildTitleMatch,
  onSetSegmentChampionship,
  segment,
  wrestlers,
}: {
  championships: Championship[];
  onBuildTitleMatch: (segmentId: string, championshipId: string) => void;
  onSetSegmentChampionship: (segmentId: string, championshipId: string) => void;
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  if (segment.type !== "Match" && segment.type !== "Contract Signing" && segment.type !== "Open Challenge") {
    return null;
  }

  const eligibleChampionships = championships.filter((championship) => canSegmentAttachChampionship(segment, championship, wrestlers));
  const selectedChampionship = championships.find((championship) => championship.id === segment.championshipId);
  const buildableChampionships =
    segment.type === "Match" && !eligibleChampionships.length
      ? championships.filter((championship) => championship.championIds.length || isVacantSinglesChampionship(championship) || championship.eligibleMatchScope === "tag_team")
      : [];
  const clearLabel = segment.type === "Match" ? "Non-Title" : "No Title Context";

  return (
    <div className="title-match-control">
      <div>
        <span>{segment.type === "Match" ? "Title Match" : "Title Context"}</span>
        <strong>
          {selectedChampionship
            ? `${selectedChampionship.name} attached. Champion: ${getWrestlerNames(selectedChampionship.championIds, wrestlers)}.`
            : eligibleChampionships.length
              ? "Attach championship context from eligible current titles."
              : "Title option opens when current participants fit champion, title, and division rules."}
        </strong>
      </div>
      {eligibleChampionships.length || selectedChampionship || buildableChampionships.length ? (
        <div className="title-buttons">
          {eligibleChampionships.length || selectedChampionship ? (
            <button className={!segment.championshipId ? "active-filter" : ""} onClick={() => onSetSegmentChampionship(segment.id, "")} type="button">
              {clearLabel}
            </button>
          ) : null}
          {eligibleChampionships.map((championship) => (
            <button
              className={segment.championshipId === championship.id ? "active-filter" : ""}
              key={championship.id}
              onClick={() => onSetSegmentChampionship(segment.id, championship.id)}
              type="button"
            >
              {championship.name}
            </button>
          ))}
          {!eligibleChampionships.length
            ? buildableChampionships.slice(0, 4).map((championship) => (
                <button key={championship.id} onClick={() => onBuildTitleMatch(segment.id, championship.id)} type="button">
                  Build {championship.name}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

function RivalryControl({
  championships,
  game,
  onSetSegmentRivalry,
  rivalries,
  segment,
  wrestlers,
}: {
  championships: Championship[];
  game: GameState;
  onSetSegmentRivalry: (segmentId: string, rivalryId: string) => void;
  rivalries: Rivalry[];
  segment: Segment;
  wrestlers: Wrestler[];
}) {
  const eligibleRivalries = rivalries.filter((rivalry) => canSegmentAttachRivalry(segment, rivalry, wrestlers));
  const selectedRivalry = rivalries.find((rivalry) => rivalry.id === segment.rivalryId);
  const selectedChampionship = championships.find((championship) => championship.id === segment.championshipId);

  return (
    <div className="rivalry-control">
      <div>
        <span>Rivalry Context</span>
        <strong>
          {selectedRivalry
            ? `${selectedRivalry.name} attached. Heat ${selectedRivalry.heat}, freshness ${selectedRivalry.freshness}.`
            : eligibleRivalries.length
              ? "Attach an active rivalry when this segment advances a story."
              : selectedChampionship
                ? `${selectedChampionship.name} is current title context; no rivalry selected.`
                : "Select rivalry participants to attach story context."}
        </strong>
        <small>{game.currentWeek ? `Week ${game.currentWeek} current-card context only.` : "Current-card context only."}</small>
      </div>
      {eligibleRivalries.length || selectedRivalry ? (
        <div className="title-buttons">
          <button className={!segment.rivalryId ? "active-filter" : ""} onClick={() => onSetSegmentRivalry(segment.id, "")} type="button">
            No Rivalry
          </button>
          {eligibleRivalries.map((rivalry) => (
            <button className={segment.rivalryId === rivalry.id ? "active-filter" : ""} key={rivalry.id} onClick={() => onSetSegmentRivalry(segment.id, rivalry.id)} type="button">
              <span>Heat {rivalry.heat}</span>
              <strong>{rivalry.name}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SegmentComposer({
  championships,
  game,
  onApplyCatalogOption,
  onBuildTitleMatch,
  onCancel,
  onClose,
  onOpenProfile,
  onRemoveSegment,
  onSetDuration,
  onSetSegmentChampionship,
  onSetSegmentStipulation,
  onSetSegmentRivalry,
  onToggleParticipant,
  rivalries,
  saveLabel = "Set Rundown Slot",
  segment,
  wrestlers,
}: SegmentComposerProps) {
  const catalogOptions = getCatalogOptionsForType(segment.type);
  const selectedOption = getSegmentCatalogOption(segment);
  const range = getSegmentParticipantRange(segment);
  const durationMinutes = getSegmentDurationMinutes(segment);
  const durationMin = Math.max(3, selectedOption.defaultDurationMinutes - 4);
  const durationMax = 45;
  const availableStipulations = getStipulationsForSegmentId(segment);
  const selectedStipulation = getStipulationById(segment.stipulationId);
  const stipulationContextLines = selectedStipulation
    ? [selectedStipulation.riskContext, selectedStipulation.presentationalContext, selectedStipulation.rivalryTone]
    : [];

  return (
    <div className="segment-composer">
      <div className="composer-head">
        <div>
          <p className="eyebrow">Composer · {segment.type}</p>
          <h3>{segment.segmentDisplayName ?? selectedOption.label}</h3>
          <p>
            {selectedOption.variant} · {selectedOption.group}
          </p>
          <div className="segment-badges">
            {getSegmentIdentityBadges(segment).map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        </div>
        <button className="secondary-action" onClick={onCancel ?? onClose} type="button">
          Back
        </button>
      </div>

      <div className="composer-block">
        <div className="participant-label compact-label">
          <span>Format</span>
          <strong>{getSegmentRequirementForSegment(segment)}</strong>
        </div>
        <div className="catalog-grid">
          {catalogOptions.map((option) => (
            <button className={segment.segmentCatalogId === option.id ? "active-filter" : ""} key={option.id} onClick={() => onApplyCatalogOption(option)} type="button">
              <span>{option.label}</span>
              <small>
                {option.defaultDurationMinutes} min · {option.minParticipants}
                {option.minParticipants === option.maxParticipants ? "" : `-${option.maxParticipants}`} talent
              </small>
              <small>{option.productionCue}</small>
            </button>
          ))}
        </div>
      </div>

      {segment.type === "Match" ? (
        <div className="composer-block segment-stipulation">
          <div>
            <span>Match Stipulation</span>
            <strong>{selectedStipulation ? selectedStipulation.label : "Optional presentation context only"}</strong>
          </div>
          <>
            <p>{selectedStipulation ? selectedStipulation.description : "No stipulation keeps standard match behavior and title/fallout math unchanged."}</p>
            {selectedStipulation ? <p>{stipulationContextLines.join(" · ")}</p> : null}
            {availableStipulations.length ? (
              <div className="title-buttons">
                <button className={!segment.stipulationId ? "active-filter" : ""} onClick={() => onSetSegmentStipulation(segment.id, "")} type="button">
                  Standard Match
                </button>
                {availableStipulations.map((option) => (
                  <button className={segment.stipulationId === option.id ? "active-filter" : ""} key={option.id} onClick={() => onSetSegmentStipulation(segment.id, option.id)} type="button">
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        </div>
      ) : null}

      <div className="composer-block duration-editor">
        <div>
          <span>Runtime</span>
          <strong>{durationMinutes} minutes</strong>
        </div>
        <div className="duration-controls">
          <button className="secondary-action" disabled={durationMinutes <= durationMin} onClick={() => onSetDuration(Math.max(durationMin, durationMinutes - 1))} type="button">
            Shorter
          </button>
          <input max={durationMax} min={durationMin} onChange={(event) => onSetDuration(Number(event.target.value))} type="range" value={durationMinutes} />
          <button className="secondary-action" disabled={durationMinutes >= durationMax} onClick={() => onSetDuration(Math.min(durationMax, durationMinutes + 1))} type="button">
            Longer
          </button>
        </div>
      </div>

      <TitleMatchControl
        championships={championships}
        onBuildTitleMatch={onBuildTitleMatch}
        onSetSegmentChampionship={onSetSegmentChampionship}
        segment={segment}
        wrestlers={wrestlers}
      />
      <RivalryControl
        championships={championships}
        game={game}
        onSetSegmentRivalry={(segmentId, rivalryId) => {
          if (segmentId === segment.id) {
            onSetSegmentRivalry(rivalryId);
          }
        }}
        rivalries={rivalries}
        segment={segment}
        wrestlers={wrestlers}
      />

      <div className="participant-label">
        <span>
          {getSegmentPickerLabel(segment.type)} · {range.min === range.max ? `${range.min} required` : `${range.min}-${range.max} allowed`}
        </span>
        {segment.type === "Open Challenge" ? <strong>Opponent revealed after Run Show</strong> : null}
      </div>
      <div className="participant-grid composer-participant-grid">
        {wrestlers.map((wrestler) => {
          const checked = segment.participantIds.includes(wrestler.id);
          const isUnavailable = wrestler.injuryStatus === "major";
          const isDivisionBlocked = wouldCreateIntergenderMatch(segment, wrestler, wrestlers);
          const disabled = (!checked && segment.participantIds.length >= range.max) || (!checked && isUnavailable) || isDivisionBlocked;

          return (
            <div className={`participant-pick ${checked ? "selected" : ""} ${isUnavailable || isDivisionBlocked ? "unavailable" : ""}`} key={wrestler.id}>
              <label>
                <input checked={checked} disabled={disabled} onChange={() => onToggleParticipant(segment.id, wrestler.id)} type="checkbox" />
                <WrestlerPortrait className="participant-pick-portrait" wrestler={wrestler} />
                <span>
                  <strong>{wrestler.name}</strong>
                  <small>
                    Mom {wrestler.momentum} · Fat {wrestler.fatigue}
                    {wrestler.injuryStatus !== "healthy" ? ` · ${getInjuryStatusLabel(wrestler.injuryStatus)} · ${getInjuryDetail(wrestler)}` : ""}
                    {isDivisionBlocked ? " · Division mismatch" : ""}
                  </small>
                </span>
              </label>
              <button className="inline-action" onClick={() => onOpenProfile(wrestler.id)} type="button">
                Profile
              </button>
            </div>
          );
        })}
      </div>

      <div className="composer-foot">
        <button className="danger-action" onClick={onRemoveSegment} type="button">
          Remove Segment
        </button>
        <button className="primary-action" disabled={!isValidSegment(segment, wrestlers)} onClick={onClose} type="button">
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
