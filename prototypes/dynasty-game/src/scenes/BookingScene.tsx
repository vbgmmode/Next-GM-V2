import type { GameScreen } from "@game/migration";
import type { GameState } from "@game/types";
import { getCurrentCalendarWeek, isValidSegment } from "@game/scoring";
import { DynastyMetricGrid, DynastyPanel, DynastyPrimaryAction, DynastyScrollList } from "../components/DynastyPanel";
import { DynastyPortrait } from "../components/DynastyPortrait";
import { IntensityMeter } from "@dynasty/components/IntensityMeter";

type Props = {
  game: GameState;
  onNavigate: (screen: GameScreen) => void;
  onRunShow: () => void;
  onOpenProfile: (wrestlerId: string) => void;
};

export function BookingScene({ game, onNavigate, onRunShow, onOpenProfile }: Props) {
  const calendarWeek = getCurrentCalendarWeek(game);
  const validCount = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers)).length;
  const selectedSegment = game.currentShow[0];

  return (
    <section className="dynasty-booking-grid dynasty-page-grid">
      <DynastyPanel kicker="Production Rundown" title={calendarWeek.showName} badge={`${validCount}/${game.currentShow.length} Valid`}>
        <DynastyMetricGrid
          items={[
            { label: "Card Status", value: validCount >= 2 ? "Runnable" : "Needs Work" },
            { label: "Runtime", value: `${game.currentShow.length * 8} min`, detail: "planned" },
            { label: "Title Scenes", value: String(game.currentShow.filter((s) => s.championshipId).length) },
            { label: "Rivalry Beats", value: String(game.currentShow.filter((s) => s.rivalryId).length) },
          ]}
        />
        <DynastyScrollList className="show-card-list">
          {game.currentShow.map((segment, index) => {
            const names = segment.participantIds
              .map((id) => game.wrestlers.find((w) => w.id === id)?.name ?? "TBD")
              .join(" vs ");
            return (
              <div className={isValidSegment(segment, game.wrestlers) ? "show-card-row" : "show-card-row is-invalid"} key={segment.id}>
                <span>{index + 1}</span>
                <strong>{names || "Unassigned"}</strong>
                <em>{segment.type}</em>
              </div>
            );
          })}
        </DynastyScrollList>
        <DynastyPrimaryAction
          actions={[
            { label: "Add Segment" },
            { label: "Clear Card" },
            { label: "Run Show", primary: true, onClick: onRunShow },
          ]}
        />
      </DynastyPanel>

      <DynastyPanel kicker="Segment Composer" title="Active Slot" badge={selectedSegment?.type ?? "—"}>
        <p className="dynasty-copy">Assign participants, stipulation, and story context for the selected segment.</p>
        <div className="dynasty-chip-row">
          {["Match", "Promo", "Backstage Angle", "Title Scene"].map((type) => (
            <span className={type === "Match" ? "filter-chip is-active" : "filter-chip"} key={type}>
              {type}
            </span>
          ))}
        </div>
        <DynastyPrimaryAction actions={[{ label: "Save Segment", primary: true }, { label: "Back to Board", onClick: () => onNavigate("dashboard") }]} />
      </DynastyPanel>

      <DynastyPanel kicker="Roster Desk" title="Available Tonight" badge={`${game.wrestlers.length} Active`}>
        <DynastyScrollList className="dynasty-roster-pick-list">
          {game.wrestlers.slice(0, 8).map((wrestler) => (
            <button className="dynasty-roster-pick" key={wrestler.id} type="button" onClick={() => onOpenProfile(wrestler.id)}>
              <DynastyPortrait wrestler={wrestler} size="sm" />
              <span>
                <strong>{wrestler.name}</strong>
                <em>Pop {wrestler.popularity} · Fatigue {wrestler.fatigue}</em>
              </span>
            </button>
          ))}
        </DynastyScrollList>
      </DynastyPanel>

      <DynastyPanel kicker="Story Pressure" title="Rivalry Intensity" badge="Live">
        {game.rivalries.slice(0, 2).map((rivalry) => {
          const [leftId, rightId] = rivalry.participantIds;
          const left = game.wrestlers.find((w) => w.id === leftId);
          const right = game.wrestlers.find((w) => w.id === rightId);
          return (
            <div className="rivalry-row" key={rivalry.id}>
              <div className="rivalry-matchup">
                {left ? <DynastyPortrait wrestler={left} size="sm" /> : null}
                <strong>{rivalry.name}</strong>
                {right ? <DynastyPortrait wrestler={right} size="sm" /> : null}
              </div>
              <div className="rivalry-meter-line">
                <em>Heat</em>
                <IntensityMeter value={rivalry.heat} />
                <b>{rivalry.heat}</b>
              </div>
            </div>
          );
        })}
      </DynastyPanel>
    </section>
  );
}
