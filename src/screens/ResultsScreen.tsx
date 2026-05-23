import { useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SuperstarPortrait } from "../components/SuperstarPortrait";
import type { GameScreen } from "../game/migration";
import type { GameState, ShowResult, Wrestler } from "../game/types";
import { buildResultsViewModel, type SegmentBroadcastRead, type SegmentParticipantRead } from "./resultsScreenReads";
import "./ResultsScreen.css";

function getReelTypeLabel(type: SegmentBroadcastRead["type"]) {
  switch (type) {
    case "Backstage Angle":
      return "Angle";
    case "Contract Signing":
      return "Signing";
    case "Open Challenge":
      return "Open";
    default:
      return type;
  }
}

function RsMetric({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <div className="rs-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function ParticipantSlot({
  participant,
  wrestler,
}: {
  participant: SegmentParticipantRead;
  wrestler?: Wrestler;
}) {
  const isWinner = participant.role === "winner" || participant.role === "team-winner";
  const isLoser = participant.role === "loser" || participant.role === "team-loser";

  return (
    <div className={`rs-participant${isWinner ? " is-winner" : ""}${isLoser ? " is-loser" : ""}`}>
      {wrestler ? <SuperstarPortrait className="rs-participant-portrait" wrestler={wrestler} /> : null}
      <div className="rs-participant-copy">
        <strong>{participant.name}</strong>
        {isWinner ? <em>Winner</em> : isLoser ? <em>Loss</em> : null}
      </div>
    </div>
  );
}

function TeamBlock({
  label,
  participants,
  wrestlers,
  won,
}: {
  label: string;
  participants: SegmentParticipantRead[];
  wrestlers: Wrestler[];
  won: boolean;
}) {
  return (
    <div className={`rs-team-block${won ? " is-winner" : " is-loser"}`}>
      <span>{label}</span>
      <div className="rs-team-members">
        {participants.map((participant) => (
          <ParticipantSlot
            key={participant.id}
            participant={participant}
            wrestler={wrestlers.find((wrestler) => wrestler.id === participant.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SegmentBroadcastCard({
  focused = false,
  read,
  wrestlers,
}: {
  focused?: boolean;
  read: SegmentBroadcastRead;
  wrestlers: Wrestler[];
}) {
  const isTagMatch = read.participants.some((participant) => participant.role === "team-winner");
  const winners = read.participants.filter((participant) => participant.role === "winner" || participant.role === "team-winner");
  const losers = read.participants.filter((participant) => participant.role === "loser" || participant.role === "team-loser");
  const teamA = read.participants.slice(0, 2);
  const teamB = read.participants.slice(2, 4);
  const teamAWon = teamA.some((participant) => participant.role === "team-winner");
  const showBadge = read.badge !== "Spot" && read.badge !== read.type;

  return (
    <article
      className={`rs-segment-card tone-${read.scoreTone}${read.isCompetitive ? " is-competitive" : ""}${read.isNoContest ? " is-no-contest" : ""}${read.isTitleMatch ? " is-title" : ""}${focused ? " is-focused" : ""}`}
    >
      <header className="rs-segment-card-head">
        <div className="rs-segment-card-meta">
          <span className="rs-slot">{String(read.index).padStart(2, "0")}</span>
          <strong>{read.type}</strong>
          {showBadge ? <b>{read.badge}</b> : null}
          {read.isTitleMatch ? <i>Title</i> : null}
        </div>
        <div className="rs-segment-card-score">
          <span>Score</span>
          <strong>{read.score}</strong>
        </div>
      </header>

      <div className="rs-segment-card-body">
        {read.isCompetitive ? (
          <div className="rs-faceoff">
            {read.isNoContest ? (
              <>
                <p className="rs-faceoff-headline">No Contest</p>
                <div className="rs-faceoff-line">
                  {read.participants.map((participant) => (
                    <ParticipantSlot
                      key={participant.id}
                      participant={participant}
                      wrestler={wrestlers.find((wrestler) => wrestler.id === participant.id)}
                    />
                  ))}
                </div>
              </>
            ) : isTagMatch ? (
              <>
                <p className="rs-faceoff-headline">{read.headline}</p>
                <div className="rs-faceoff-grid">
                  <TeamBlock label="Team A" participants={teamA} wrestlers={wrestlers} won={teamAWon} />
                  <div className="rs-faceoff-divider">VS</div>
                  <TeamBlock label="Team B" participants={teamB} wrestlers={wrestlers} won={!teamAWon} />
                </div>
              </>
            ) : (
              <>
                <p className="rs-faceoff-headline">{read.headline}</p>
                <div className="rs-faceoff-grid rs-faceoff-grid-singles">
                  <ParticipantSlot participant={winners[0] ?? read.participants[0]} wrestler={wrestlers.find((w) => w.id === (winners[0]?.id ?? read.participants[0]?.id))} />
                  <div className="rs-faceoff-divider">DEF</div>
                  <div className="rs-faceoff-side">
                    {(losers.length ? losers : read.participants.slice(1)).map((participant) => (
                      <ParticipantSlot
                        key={participant.id}
                        participant={participant}
                        wrestler={wrestlers.find((wrestler) => wrestler.id === participant.id)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rs-spotlight-row">
            {read.participants.map((participant) => (
              <ParticipantSlot
                key={participant.id}
                participant={participant}
                wrestler={wrestlers.find((wrestler) => wrestler.id === participant.id)}
              />
            ))}
          </div>
        )}

        {(read.recapNote || read.stipulation || read.titleNote || read.rivalryNote) && (
          <div className="rs-segment-notes">
            {read.recapNote ? <p className="rs-segment-recap">{read.recapNote}</p> : null}
            {read.stipulation ? <p>Stipulation · {read.stipulation}</p> : null}
            {read.titleNote ? <p>{read.titleNote}</p> : null}
            {read.rivalryNote ? <p>{read.rivalryNote}</p> : null}
          </div>
        )}

        {read.falloutLine ? <footer className="rs-segment-foot">{read.falloutLine}</footer> : null}
      </div>
    </article>
  );
}

export function ResultsScreen({
  game,
  canContinueWeekReview,
  onContinueWeekReview,
  onNavigate,
  result,
}: {
  game: GameState;
  canContinueWeekReview: boolean;
  onContinueWeekReview: () => void;
  result: ShowResult;
  onNavigate: (screen: GameScreen) => void;
}) {
  const model = buildResultsViewModel(game, result);
  const [selectedSegmentId, setSelectedSegmentId] = useState(model.segmentReads[0]?.segmentId ?? "");
  const selectedIndex = model.segmentReads.findIndex((read) => read.segmentId === selectedSegmentId);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedRead = model.segmentReads[activeIndex] ?? model.segmentReads[0];
  const segmentPager = useMemo(
    () => ({
      current: activeIndex + 1,
      total: model.segmentReads.length,
      hasPrev: activeIndex > 0,
      hasNext: activeIndex < model.segmentReads.length - 1,
      prevId: model.segmentReads[activeIndex - 1]?.segmentId,
      nextId: model.segmentReads[activeIndex + 1]?.segmentId,
    }),
    [activeIndex, model.segmentReads],
  );

  const resultsCta: DynastyManagementCta = {
    disabled: !canContinueWeekReview,
    eyebrow: canContinueWeekReview ? "Fallout Ready" : "Reviewed",
    label: canContinueWeekReview ? "Continue to Week Review" : "Week Review Complete",
    onClick: onContinueWeekReview,
    tone: canContinueWeekReview ? "warning" : "neutral",
  };

  return (
    <DynastyManagementShell
      className="gameplay-command-shell results-command-shell"
      currentScreen="results"
      cta={resultsCta}
      game={game}
      latestResult={result}
      onNavigate={onNavigate}
    >
      <div className="rs-desk-body">
        <section className={`rs-hero rs-hero-compact${model.isPleResult ? " is-ple" : ""}`} aria-label="Broadcast recap">
          <div className="rs-score-plate">
            <span>
              S{model.seasonNumber} W{model.week} · {model.showTypeLabel}
            </span>
            <div className="rs-score-line">
              <h2>{model.totalScore}</h2>
              <strong>{model.grade}</strong>
            </div>
            <em>{model.showName}</em>
          </div>
          <div className="rs-hero-copy">
            <p className="eyebrow">Final Receipt</p>
            <h3>{model.recapTitle}</h3>
          </div>
          <div className="rs-hero-metrics rs-hero-metrics-inline">
            <RsMetric label="Net P/L" value={model.financeProfitLabel} detail={model.financeProfitDetail} />
            <RsMetric label="Peak Segment" value={`${model.bestSegmentScore}`} detail={model.bestSegmentDetail} />
            <RsMetric label="Runtime" value={model.runtimeLabel} detail={model.runtimeDetail} />
          </div>
        </section>

        <section className="rs-rundown" aria-label="Broadcast rundown">
          <header className="rs-rundown-head">
            <div>
              <span>Primary Readout</span>
              <strong>Broadcast Rundown</strong>
            </div>
            <b>{model.segmentReads.length} Segments</b>
          </header>

          <div
            className="rs-rundown-reel"
            aria-label="Segment score reel"
            style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(model.segmentReads.length, 1), 5)}, minmax(0, 1fr))` }}
          >
            {model.segmentReads.map((read) => (
              <button
                aria-current={read.segmentId === selectedRead?.segmentId ? "page" : undefined}
                className={`rs-reel-chip tone-${read.scoreTone}${read.isNoContest ? " is-no-contest" : ""}${read.isCompetitive ? " is-match" : ""}${read.segmentId === selectedRead?.segmentId ? " is-active" : ""}`}
                key={read.segmentId}
                onClick={() => setSelectedSegmentId(read.segmentId)}
                title={`${read.type} · ${read.score} · ${read.reelSummary}`}
                type="button"
              >
                <span className="rs-reel-chip-top">
                  <span className="rs-reel-slot">{String(read.index).padStart(2, "0")}</span>
                  <strong className="rs-reel-type">{getReelTypeLabel(read.type)}</strong>
                  <strong className="rs-reel-score">{read.score}</strong>
                </span>
                <em className="rs-reel-summary">{read.reelSummary}</em>
              </button>
            ))}
          </div>

          {selectedRead ? (
            <div className="rs-segment-focus">
              <div className="rs-segment-focus-head">
                <div>
                  <span>Segment Receipt</span>
                  <strong>
                    {String(selectedRead.index).padStart(2, "0")} · {selectedRead.type}
                  </strong>
                </div>
                <div className="rs-segment-pager">
                  <button
                    className="rs-segment-pager-btn"
                    disabled={!segmentPager.hasPrev}
                    onClick={() => segmentPager.prevId && setSelectedSegmentId(segmentPager.prevId)}
                    type="button"
                  >
                    Prev
                  </button>
                  <span>
                    {segmentPager.current} / {segmentPager.total}
                  </span>
                  <button
                    className="rs-segment-pager-btn"
                    disabled={!segmentPager.hasNext}
                    onClick={() => segmentPager.nextId && setSelectedSegmentId(segmentPager.nextId)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="rs-segment-focus-body">
                <SegmentBroadcastCard focused read={selectedRead} wrestlers={game.wrestlers} />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </DynastyManagementShell>
  );
}
