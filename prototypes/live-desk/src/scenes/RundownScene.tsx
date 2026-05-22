import { useState } from "react";
import { ActionBar, CommandPanel } from "@components/broadcast";
import { getPleBuildPressureSnapshot } from "@game/gameContextReads";
import type { GameState, Segment } from "@game/types";
import { isValidSegment } from "@game/scoring";
import { wrestlerInitials } from "../fixtures/shared";
import { SupportDrawer } from "../shell/SupportDrawer";

type RundownSceneProps = {
  game: GameState;
  selectedSegmentId?: string;
  onSelectSegment: (segmentId: string) => void;
  onRunShow: () => void;
};

function segmentLaneClass(type: Segment["type"]) {
  switch (type) {
    case "Match":
      return "ld-lane-match";
    case "Promo":
      return "ld-lane-promo";
    case "Open Challenge":
      return "ld-lane-open";
    case "Backstage Angle":
      return "ld-lane-angle";
    case "Contract Signing":
      return "ld-lane-contract";
    default:
      return "";
  }
}

function getParticipantLabel(game: GameState, segment: Segment) {
  if (!segment.participantIds.length) return "Unassigned";
  return segment.participantIds
    .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "Unknown")
    .join(" vs ");
}

function getSegmentWarnings(game: GameState, segment: Segment) {
  const warnings: string[] = [];
  for (const id of segment.participantIds) {
    const wrestler = game.wrestlers.find((item) => item.id === id);
    if (!wrestler) continue;
    if (wrestler.injuryStatus === "major") warnings.push(`${wrestler.name} is out with a major injury.`);
    if (wrestler.injuryStatus === "minor") warnings.push(`${wrestler.name} is working through a minor injury.`);
    if (wrestler.fatigue >= 70) warnings.push(`${wrestler.name} fatigue is at ${wrestler.fatigue}.`);
  }
  if (segment.type === "Open Challenge") warnings.push("Opponent stays hidden until the broadcast runs.");
  if (!isValidSegment(segment, game.wrestlers)) warnings.push("Segment is not valid yet.");
  return warnings;
}

export function RundownScene({ game, selectedSegmentId, onSelectSegment, onRunShow }: RundownSceneProps) {
  const [producerOpen, setProducerOpen] = useState(false);
  const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers));
  const plePressure = getPleBuildPressureSnapshot(game, validSegments);
  const selected =
    game.currentShow.find((segment) => segment.id === selectedSegmentId) ?? game.currentShow[0] ?? null;
  const warnings = selected ? getSegmentWarnings(game, selected) : [];

  return (
    <div className="ld-rundown ld-rundown--calm">
      <div className="ld-rundown-grid">
        <section className="ld-slot-board ld-panel--secondary" aria-label="Show rundown board">
          {game.currentShow.map((segment, index) => {
            const valid = isValidSegment(segment, game.wrestlers);
            const isSelected = selected?.id === segment.id;
            return (
              <button
                type="button"
                key={segment.id}
                className={`ld-slot-row ${segmentLaneClass(segment.type)}${isSelected ? " is-selected" : ""}${valid ? " is-valid" : " is-invalid"}`}
                onClick={() => onSelectSegment(segment.id)}
              >
                <span className="ld-slot-number">{index + 1}</span>
                <span className="ld-slot-type">{segment.type}</span>
                <strong className="ld-slot-copy">{getParticipantLabel(game, segment)}</strong>
                <span className="ld-slot-tags">
                  {segment.championshipId ? <em>Title</em> : null}
                  {segment.rivalryId ? <em>Rivalry</em> : null}
                  {!valid ? <em>Invalid</em> : null}
                </span>
              </button>
            );
          })}
        </section>

        <section className="ld-focus-panel">
          {selected ? (
            <>
              <div className="ld-titantron ld-panel--primary">
                <div className="ld-titantron-plate">{wrestlerInitials(getParticipantLabel(game, selected))}</div>
                <div>
                  <span className="ld-kicker ld-kicker--quiet">Focused Segment</span>
                  <h2>{selected.type}</h2>
                  <p>{getParticipantLabel(game, selected)}</p>
                </div>
              </div>
              <CommandPanel className="ld-panel--secondary" title="Operational Warnings" tone={warnings.length ? "warning" : "neutral"}>
                {warnings.length ? (
                  <ul className="ld-warning-list">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="ld-support-copy">No operational warnings on this segment.</p>
                )}
              </CommandPanel>
            </>
          ) : (
            <CommandPanel className="ld-panel--secondary" title="No Segments Booked" tone="neutral">
              <p className="ld-support-copy">Fixtures ship with sample cards for this prototype.</p>
            </CommandPanel>
          )}
        </section>
      </div>

      <SupportDrawer
        label="Producer Note"
        summary={plePressure.headline}
        open={producerOpen}
        onToggle={() => setProducerOpen((open) => !open)}
      >
        <p>{plePressure.detail}</p>
        <div className="ld-producer-items">
          {plePressure.items.slice(0, 4).map((item) => (
            <article key={item.id} data-tone={item.tone}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </SupportDrawer>

      <ActionBar trailing={<span>{validSegments.length} valid</span>}>
        <button type="button" className="ld-secondary" disabled>
          Generate Smart Rundown
        </button>
        <button type="button" className="ld-primary" disabled={validSegments.length < 2} onClick={onRunShow}>
          Run Show
        </button>
      </ActionBar>
    </div>
  );
}
