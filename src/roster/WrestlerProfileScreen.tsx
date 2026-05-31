import { useEffect, useState } from "react";
import { isRivalryIntergenderBlocked } from "../booking/bookingUtils";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { DashboardDynastyAlignment } from "../components/dashboardDynasty";
import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import { MARKET_CONTRACT_MAX_WEEKS } from "../game/constants";
import { formatMoney } from "../game/formatters";
import { getContractForWrestler, getRenewalOffer } from "../game/market";
import { resolveWrestlerAlignment, WRESTLER_ALIGNMENT_OPTIONS } from "../game/wrestlerAlignment";
import { getWrestlerAffiliations } from "../game/affiliationCatalog";
import { formatAffiliationKind, getAffiliationMemberNames } from "./rosterDisplayUtils";
import { getInjuryStatusLabel, getRosterPressureTags, getWeeksSinceLastBooked } from "../game/rosterContextReads";
import { getRivalryRelationship, getRivalryStoryline } from "../game/rivalryCatalog";
import { RosterPanel } from "./RosterPanel";
import {
  formatChampionshipEventType,
  formatHistoryStamp,
  formatRivalryEventType,
  formatRivalryStatus,
  formatSocialCategory,
  getRecentWrestlerAppearances,
  getRecentWrestlerSocialPosts,
  getRivalryStageContext,
  getRivalryTitleRelevance,
  getWrestlerRivalryHistory,
  getWrestlerTitleHistory,
  getWrestlerTitleSceneRows,
} from "./profileReads";
import {
  getGMRead,
  getInjuryDetail,
  getWrestlerChampionships,
  getWrestlerIdentitySnapshot,
  getWrestlerLockerRoomRead,
  getWrestlerRivalries,
} from "./rosterReads";
import type { WrestlerProfileScreenProps } from "./rosterTypes";
import { getWrestlerValueProfile } from "./rosterValueReads";

type ProfileStatDeltaTone = "up" | "down" | "flat";
type ProfileReportId = "ratings" | "career" | "creative" | "office";
type ProfileReportTone = "watch" | "prestige" | "office" | "steady";

type ProfileStatRow = {
  label: string;
  value: string;
  note?: string;
  weeklyDelta?: number;
  weeklyDeltaLabel?: string;
};

type ProfileReportPressure = {
  id: ProfileReportId;
  label: string;
  reason: string;
  score: number;
  status: string;
  tone: ProfileReportTone;
};

function formatProfileStatDelta(delta = 0) {
  return `Wk ${delta > 0 ? "+" : ""}${delta}`;
}

function getProfileStatDeltaTone(delta = 0): ProfileStatDeltaTone {
  if (delta > 0) {
    return "up";
  }

  if (delta < 0) {
    return "down";
  }

  return "flat";
}

function getProfileWeeklyDeltas(game: WrestlerProfileScreenProps["game"], wrestler: WrestlerProfileScreenProps["wrestler"], latestResult: WrestlerProfileScreenProps["latestResult"]) {
  const segmentResults = latestResult?.segmentResults ?? [];
  const titleStatNotes = latestResult?.lockerRoomFallout?.titleStatNotes?.filter((note) => note.wrestlerId === wrestler.id) ?? [];
  const moraleMoves = [
    ...(latestResult?.lockerRoomFallout?.moraleBoosts ?? []),
    ...(latestResult?.lockerRoomFallout?.moraleDrops ?? []),
    ...(latestResult?.lockerRoomFallout?.overuseWarnings ?? []),
    ...(latestResult?.lockerRoomFallout?.underuseWarnings ?? []),
  ].filter((item) => item.wrestlerId === wrestler.id);
  const momentumFromSegments = segmentResults.reduce((total, segment) => total + (segment.momentumChanges?.[wrestler.id] ?? 0), 0);
  const fatigue = segmentResults.reduce((total, segment) => total + (segment.fatigueChanges?.[wrestler.id] ?? 0), 0);
  const titleMomentum = titleStatNotes.reduce((total, note) => total + note.momentumChange, 0);
  const popularity = titleStatNotes.reduce((total, note) => total + note.popularityChange, 0);
  const moraleFromResult = moraleMoves.reduce((total, item) => total + (item.moraleChange ?? 0), 0);
  const currentDecisionMoves = game.socialInbox.requests.filter(
    (request) =>
      request.wrestlerId === wrestler.id &&
      request.createdSeasonNumber === game.seasonNumber &&
      request.createdWeekNumber === game.currentWeek &&
      (request.status === "accepted" || request.status === "declined"),
  );
  const moraleFromDecisions = currentDecisionMoves.reduce((total, request) => total + (request.status === "accepted" ? 1 : -3), 0);
  const trustFromDecisions = currentDecisionMoves.reduce((total, request) => total + (request.status === "accepted" ? 2 : -2), 0);
  const protectedRestTrust = moraleMoves.some((item) => item.note.toLowerCase().includes("protected rest week")) ? 2 : 0;
  const trustFromResult =
    protectedRestTrust -
    (latestResult?.lockerRoomFallout?.overuseWarnings ?? []).filter((item) => item.wrestlerId === wrestler.id).length * 3 -
    (latestResult?.lockerRoomFallout?.underuseWarnings ?? []).filter((item) => item.wrestlerId === wrestler.id).length * 2;

  return {
    audienceHeat: momentumFromSegments > 0 ? Math.max(0, Math.round(momentumFromSegments / 2)) : 0,
    fatigue,
    morale: moraleFromResult + moraleFromDecisions,
    momentum: momentumFromSegments + titleMomentum,
    popularity,
    promoSkill: 0,
    ringSkill: 0,
    trust: trustFromResult + trustFromDecisions,
  };
}

function getProfileReportTitle(reportId: ProfileReportId) {
  switch (reportId) {
    case "ratings":
      return "Ratings Report";
    case "career":
      return "Career File";
    case "creative":
      return "Creative Context";
    case "office":
      return "Office File";
  }
}

function getProfileActionLabel(actionType: string) {
  switch (actionType) {
    case "rest":
      return "Rest request";
    case "tv_time":
      return "TV time promise";
    case "title_shot":
      return "Title-shot promise";
    case "story_spot":
      return "Story-spot promise";
    default:
      return "Office request";
  }
}

export function WrestlerProfileScreen({
  game,
  latestResult,
  onBackToBooking,
  onBackToDashboard,
  onBackToRoster,
  onNavigate,
  onReleaseWrestler,
  onRenewContract,
  onSetAlignment,
  returnScreen,
  wrestler,
}: WrestlerProfileScreenProps) {
  const currentAlignment = resolveWrestlerAlignment(wrestler.alignment, wrestler.id);
  const pressureTags = getRosterPressureTags(wrestler, game.currentWeek);
  const championships = getWrestlerChampionships(wrestler.id, game.championships);
  const titleSceneRows = getWrestlerTitleSceneRows(wrestler, game);
  const activeRivalries = getWrestlerRivalries(wrestler.id, game.rivalries);
  const recentTitleHistory = getWrestlerTitleHistory(game, wrestler.id);
  const recentRivalryHistory = getWrestlerRivalryHistory(game, wrestler.id);
  const recentAppearances = getRecentWrestlerAppearances(game, wrestler.id);
  const recentSocialPosts = getRecentWrestlerSocialPosts(game, wrestler.id);
  const affiliations = getWrestlerAffiliations(wrestler.id, game.wrestlers);
  const gmRead = getGMRead(wrestler, game);
  const weeksSinceLastBooked = getWeeksSinceLastBooked(wrestler, game.currentWeek);
  const identitySnapshot = getWrestlerIdentitySnapshot(wrestler, game);
  const valueProfile = getWrestlerValueProfile(wrestler);
  const lockerRoomRead = getWrestlerLockerRoomRead(wrestler, game);
  const contract = getContractForWrestler(game, wrestler.id);
  const marketClosed = latestResult?.week === game.currentWeek;
  const releaseGuardActive = game.wrestlers.length <= 8;
  const record = wrestler.record;
  const formatRecord = (wins = 0, losses = 0, draws = 0) => `${wins}-${losses}${draws ? `-${draws}` : ""}`;
  const showValueTierChip = valueProfile.valueTierLabel.toLowerCase() !== "protected star";
  const [activeReport, setActiveReport] = useState<ProfileReportId | null>(null);
  const [contractNegotiating, setContractNegotiating] = useState(false);
  const [selectedRenewalWeeks, setSelectedRenewalWeeks] = useState(4);
  const renewalOffer = getRenewalOffer(wrestler, selectedRenewalWeeks);
  const renewalDisabledReason = marketClosed
    ? "Contract desk closes after the show runs."
    : !contract
      ? "No active contract to extend."
      : game.money < renewalOffer.dueNow
        ? "Insufficient cash for this extension."
        : "";
  const releaseDisabledReason = marketClosed
    ? "Contract desk closes after the show runs."
    : releaseGuardActive
      ? "Minimum roster guard active."
      : "";
  const weeklyDeltas = getProfileWeeklyDeltas(game, wrestler, latestResult);
  const profileStatRows: ProfileStatRow[] = [
    { label: "Popularity", value: `${wrestler.popularity}`, weeklyDelta: weeklyDeltas.popularity },
    { label: "Momentum", value: `${wrestler.momentum}`, weeklyDelta: weeklyDeltas.momentum },
    { label: "Fatigue", value: `${wrestler.fatigue}`, weeklyDelta: weeklyDeltas.fatigue },
    { label: "Morale", value: `${wrestler.morale}`, weeklyDelta: weeklyDeltas.morale },
    { label: "Audience Heat", value: `${wrestler.audienceHeat ?? 50}`, note: "Resolved reaction", weeklyDelta: weeklyDeltas.audienceHeat },
    { label: "Trust", value: `${wrestler.trust ?? 50}`, note: "Office relationship", weeklyDelta: weeklyDeltas.trust },
    { label: "Ring Skill", value: `${wrestler.ringSkill}`, weeklyDelta: weeklyDeltas.ringSkill },
    { label: "Promo Skill", value: `${wrestler.promoSkill}`, weeklyDelta: weeklyDeltas.promoSkill },
    { label: "Injury", value: getInjuryStatusLabel(wrestler.injuryStatus), note: getInjuryDetail(wrestler) },
    { label: "Season Singles", value: formatRecord(record?.season.wins, record?.season.losses, record?.season.draws), note: "Resolved matches" },
    { label: "Season Tag", value: formatRecord(record?.season.tagWins, record?.season.tagLosses, record?.season.tagDraws), note: "Resolved tag matches" },
    { label: "Career Singles", value: formatRecord(record?.career.wins, record?.career.losses, record?.career.draws), note: "Resolved matches" },
    { label: "Career Tag", value: formatRecord(record?.career.tagWins, record?.career.tagLosses, record?.career.tagDraws), note: "Resolved tag matches" },
    { label: "Appearances", value: `${wrestler.appearancesThisSeason ?? 0}`, note: "This season" },
    { label: "Last Booked", value: wrestler.lastBookedWeek ? `Week ${wrestler.lastBookedWeek}` : "Never", note: `${weeksSinceLastBooked} weeks off TV` },
    { label: "TV Streak", value: `${wrestler.consecutiveWeeksBooked ?? 0}`, note: "Consecutive weeks booked" },
  ];
  const coreStatRows = profileStatRows.slice(0, 8);
  const activeSocialRequests = game.socialInbox.requests.filter((request) => request.wrestlerId === wrestler.id && (request.status === "accepted" || request.status === "declined"));
  const openOfficeRequests = activeSocialRequests.filter((request) => request.status === "accepted");
  const roleChips = [
    ...identitySnapshot.labels,
    ...(championships.length ? ["Champion"] : []),
    ...(activeRivalries.length ? ["Rivalry Anchor"] : []),
    ...(affiliations.length ? ["Locker Room Link"] : []),
    ...(recentAppearances.length >= 2 ? ["Recently Featured"] : []),
  ].filter((label, index, labels) => labels.indexOf(label) === index);
  const currentRoleSentence = championships.length
    ? `${wrestler.name} is carrying championship context: ${identitySnapshot.bookingUseRead}`
    : activeRivalries.length
      ? `${wrestler.name} is tied into active story pressure: ${identitySnapshot.bookingUseRead}`
      : identitySnapshot.bookingUseRead;
  const hasActiveInjury = wrestler.injuryStatus !== "healthy";
  const reports: ProfileReportPressure[] = [
    {
      id: "ratings",
      label: "Ratings Report",
      reason:
        hasActiveInjury
          ? "Injury status needs attention"
          : wrestler.fatigue >= 70
            ? "Fatigue watch"
            : (wrestler.consecutiveWeeksBooked ?? 0) >= 3
              ? "TV load rising"
              : "Ratings steady",
      score: (hasActiveInjury ? 50 : 0) + Math.max(0, wrestler.fatigue - 45) + Math.max(0, (wrestler.consecutiveWeeksBooked ?? 0) - 2) * 8,
      status: wrestler.fatigue >= 70 || hasActiveInjury ? "Condition pressure" : "Stat file",
      tone: "watch",
    },
    {
      id: "career",
      label: "Career File",
      reason: recentAppearances.length >= 3 ? "Recent run documented" : weeksSinceLastBooked >= 3 ? "Off-TV gap forming" : "History available",
      score: (recentAppearances.length >= 3 ? 24 : 0) + Math.max(0, weeksSinceLastBooked - 2) * 9,
      status: recentAppearances.length ? `${recentAppearances.length} recent` : "No recent run",
      tone: "steady",
    },
    {
      id: "creative",
      label: "Creative Context",
      reason: championships.length ? "Champion needs direction" : activeRivalries.length ? "Story pressure active" : titleSceneRows.length ? "Title-scene fit" : "Creative file",
      score: championships.length * 34 + activeRivalries.length * 24 + Math.min(titleSceneRows.length, 3) * 8 + affiliations.length * 5,
      status: championships.length ? "Champion" : activeRivalries.length ? "Rivalry active" : "Context",
      tone: "prestige",
    },
    {
      id: "office",
      label: "Office File",
      reason: openOfficeRequests.length
        ? "Promise on the desk"
        : wrestler.morale <= 55
          ? "Morale softening"
          : (wrestler.trust ?? 50) <= 50
            ? "Trust watch"
            : contract
              ? "Contract actions available"
              : "Office file",
      score: openOfficeRequests.length * 35 + Math.max(0, 60 - wrestler.morale) + Math.max(0, 55 - (wrestler.trust ?? 50)) + (contract ? 6 : 0),
      status: openOfficeRequests.length ? "Promise active" : wrestler.morale <= 55 || (wrestler.trust ?? 50) <= 50 ? "Office watch" : "Office steady",
      tone: "office",
    },
  ];
  const dominantReport = reports.reduce((best, report) => (report.score > best.score ? report : best), reports[0]);
  const activeReportModel = activeReport ? reports.find((report) => report.id === activeReport) : undefined;

  useEffect(() => {
    setActiveReport(null);
    setContractNegotiating(false);
    setSelectedRenewalWeeks(4);
  }, [wrestler.id]);

  useEffect(() => {
    if (!activeReport) {
      return undefined;
    }

    const closeReportWindow = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveReport(null);
      }
    };

    window.addEventListener("keydown", closeReportWindow);
    return () => window.removeEventListener("keydown", closeReportWindow);
  }, [activeReport]);

  const profileCta: DynastyManagementCta = {
    eyebrow: "Talent Profile",
    label: returnScreen === "booking" ? "Back to Booking" : returnScreen === "dashboard" ? "Back to Branch HQ" : "Back to Roster",
    onClick: returnScreen === "booking" ? onBackToBooking : returnScreen === "dashboard" ? onBackToDashboard : onBackToRoster,
    tone: "brand",
  };

  return (
    <DynastyManagementShell
      className="roster-profile-shell"
      cta={profileCta}
      currentScreen={returnScreen}
      game={game}
      latestResult={latestResult}
      onNavigate={onNavigate}
    >
      <section className="roster-profile-desk" aria-label={`${wrestler.name} profile`}>
        <div className="roster-profile-command-file">
          <aside className="roster-profile-talent-rail" aria-label={`${wrestler.name} talent plate`}>
            <RosterPanel className="roster-profile-talent-card" kicker="Talent Profile" title={wrestler.name}>
              <WrestlerPortrait className="roster-profile-hero-portrait" wrestler={wrestler} />
              <div className="roster-profile-alignment-desk" aria-label="Gimmick side">
                <span>Side</span>
                <div className="roster-profile-alignment-options" role="group" aria-label="Alignment">
                  {WRESTLER_ALIGNMENT_OPTIONS.map((option) => {
                    const dashboardAlignment = option === "Face" ? "face" : option === "Heel" ? "heel" : ("neutral" as const);

                    return (
                      <button aria-pressed={currentAlignment === option} className={currentAlignment === option ? "is-active" : ""} key={option} onClick={() => onSetAlignment(wrestler.id, option)} type="button">
                        <DashboardDynastyAlignment alignment={dashboardAlignment} />
                        <em>{option}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="pressure-tags roster-profile-quiet-tags">
                {identitySnapshot.labels
                  .filter((label) => {
                    const normalizedLabel = label.toLowerCase();
                    return normalizedLabel !== "protected star" && normalizedLabel !== "champion";
                  })
                  .slice(0, 3)
                  .map((label) => (
                    <span className="identity-chip" key={label}>
                      {label}
                    </span>
                  ))}
                {showValueTierChip ? <span className={`value-tier-chip ${valueProfile.contextMode === "missing" ? "value-tier-chip-missing" : ""}`}>{valueProfile.valueTierLabel}</span> : null}
              </div>
            </RosterPanel>

            <RosterPanel className="roster-profile-stats-panel" kicker="Ratings" title="Stats And TV Load">
              <div className="roster-profile-stat-rows compact">
                {coreStatRows.map((row) => (
                  <article className="roster-profile-stat-row" key={row.label}>
                    <span>{row.label}</span>
                    <strong>
                      {row.value}
                      {typeof row.weeklyDelta === "number" ? <em className={`roster-profile-stat-delta tone-${getProfileStatDeltaTone(row.weeklyDelta)}`}>{row.weeklyDeltaLabel ?? formatProfileStatDelta(row.weeklyDelta)}</em> : null}
                    </strong>
                    <small>{row.note ?? ""}</small>
                  </article>
                ))}
              </div>
            </RosterPanel>
          </aside>

          <section className="roster-profile-status-stage" aria-label={`${wrestler.name} current role`}>
            <RosterPanel className="roster-profile-role-panel" kicker="Current Role" title={identitySnapshot.roleRead}>
              <div className="pressure-tags roster-profile-role-tags">
                {roleChips.slice(0, 6).map((label) => (
                  <span className="identity-chip" key={label}>
                    {label}
                  </span>
                ))}
              </div>
              <p className="roster-profile-role-sentence">{currentRoleSentence}</p>
              <div className={`roster-locker-room-read tone-${lockerRoomRead.tone}`} aria-label={`${wrestler.name} locker room read`}>
                <span>Staff Read</span>
                <strong>{lockerRoomRead.headline}</strong>
                <p>{lockerRoomRead.detail}</p>
                <small>{lockerRoomRead.note}</small>
              </div>
              <div className="roster-profile-evidence-grid" aria-label="GM evidence">
                <article>
                  <span>Useful</span>
                  <strong>{gmRead.usefulness}</strong>
                </article>
                <article>
                  <span>Risk</span>
                  <strong>{gmRead.risk}</strong>
                </article>
                <article>
                  <span>Need</span>
                  <strong>{gmRead.need}</strong>
                </article>
                <article>
                  <span>Usage</span>
                  <strong>{identitySnapshot.usageRead}</strong>
                </article>
              </div>
            </RosterPanel>
          </section>

          <aside className="roster-profile-report-rail" aria-label={`${wrestler.name} reports`}>
            <RosterPanel className={`roster-profile-pressure-panel tone-${dominantReport.tone}`} kicker="Pressure Report" title={dominantReport.label}>
              <strong>{dominantReport.reason}</strong>
              <p>{dominantReport.status}</p>
            </RosterPanel>
            <div className="roster-profile-report-buttons" aria-label="Profile report windows">
              {reports.map((report) => (
                <button className={`roster-profile-report-button tone-${report.tone} ${report.id === dominantReport.id ? "is-dominant" : ""}`.trim()} key={report.id} onClick={() => setActiveReport(report.id)} type="button">
                  <span>{report.label}</span>
                  <strong>{report.id === dominantReport.id ? report.reason : report.status}</strong>
                </button>
              ))}
            </div>
          </aside>
        </div>

        {activeReport && activeReportModel ? (
          <div className="roster-profile-report-backdrop" aria-labelledby="roster-profile-report-title" aria-modal="true" role="dialog">
            <button className="roster-profile-report-scrim" aria-label="Close report" onClick={() => setActiveReport(null)} type="button" />
            <section className={`roster-profile-report-window tone-${activeReportModel.tone}`} role="document">
              <header className="roster-profile-report-head">
                <div>
                  <span>{wrestler.name}</span>
                  <strong id="roster-profile-report-title">{getProfileReportTitle(activeReport)}</strong>
                </div>
                <button className="roster-profile-report-close" onClick={() => setActiveReport(null)} type="button">
                  Close
                </button>
              </header>
              <div className="roster-profile-report-body">
                {activeReport === "ratings" ? (
                  <>
                    <div className="roster-profile-report-callout">
                      <span>{activeReportModel.reason}</span>
                      <strong>{getInjuryStatusLabel(wrestler.injuryStatus)} / Fatigue {wrestler.fatigue} / TV Streak {wrestler.consecutiveWeeksBooked ?? 0}</strong>
                    </div>
                    <div className="roster-profile-stat-rows report">
                      {profileStatRows.map((row) => (
                        <article className="roster-profile-stat-row" key={row.label}>
                          <span>{row.label}</span>
                          <strong>
                            {row.value}
                            {typeof row.weeklyDelta === "number" ? <em className={`roster-profile-stat-delta tone-${getProfileStatDeltaTone(row.weeklyDelta)}`}>{row.weeklyDeltaLabel ?? formatProfileStatDelta(row.weeklyDelta)}</em> : null}
                          </strong>
                          <small>{row.note ?? ""}</small>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}

                {activeReport === "career" ? (
                  <>
                    <div className="roster-profile-report-callout">
                      <span>{activeReportModel.reason}</span>
                      <strong>
                        Season {formatRecord(record?.season.wins, record?.season.losses, record?.season.draws)} / Career {formatRecord(record?.career.wins, record?.career.losses, record?.career.draws)}
                      </strong>
                    </div>
                    <div className="roster-profile-history-grid">
                      <article>
                        <span>Season Tag</span>
                        <strong>{formatRecord(record?.season.tagWins, record?.season.tagLosses, record?.season.tagDraws)}</strong>
                      </article>
                      <article>
                        <span>Career Tag</span>
                        <strong>{formatRecord(record?.career.tagWins, record?.career.tagLosses, record?.career.tagDraws)}</strong>
                      </article>
                      <article>
                        <span>Appearances</span>
                        <strong>{wrestler.appearancesThisSeason ?? 0}</strong>
                      </article>
                      <article>
                        <span>Last Booked</span>
                        <strong>{wrestler.lastBookedWeek ? `Week ${wrestler.lastBookedWeek}` : "Never"}</strong>
                      </article>
                    </div>
                    <div className="roster-profile-list">
                      {recentAppearances.length ? (
                        recentAppearances.map((appearance) => (
                          <article className="roster-profile-history-row" key={appearance.id}>
                            <div>
                              <span>
                                Week {appearance.week} / {appearance.showName}
                              </span>
                              <strong>{appearance.type}</strong>
                              {appearance.note ? <p>{appearance.note}</p> : null}
                            </div>
                            <b>{appearance.score}</b>
                          </article>
                        ))
                      ) : (
                        <div className="roster-empty-copy compact">No show appearances recorded yet.</div>
                      )}
                    </div>
                  </>
                ) : null}

                {activeReport === "creative" ? (
                  <>
                    <div className="roster-profile-report-callout">
                      <span>{activeReportModel.reason}</span>
                      <strong>{identitySnapshot.roleRead}</strong>
                    </div>
                    <div className="roster-profile-list">
                      {titleSceneRows.length ? (
                        titleSceneRows.map(({ championship, detail, relevance }) => (
                          <article className="roster-profile-context-row" key={championship.id}>
                            <strong>{championship.name}</strong>
                            <span>
                              {relevance} / {detail} / Prestige {championship.prestige}
                            </span>
                          </article>
                        ))
                      ) : (
                        <p className="roster-muted-copy">{wrestler.name} does not currently fit an active singles title scene.</p>
                      )}
                      {affiliations.length ? (
                        affiliations.map((affiliation) => (
                          <article className="roster-profile-context-row" key={affiliation.id}>
                            <strong>{affiliation.name}</strong>
                            <span>
                              {formatAffiliationKind(affiliation.kind)} / {affiliation.status}
                            </span>
                            <p>{getAffiliationMemberNames(affiliation, game.wrestlers) || wrestler.name}</p>
                            <small>{affiliation.notes}</small>
                          </article>
                        ))
                      ) : null}
                      {activeRivalries.length ? (
                        activeRivalries.map((rivalry) => {
                          const storyline = getRivalryStoryline(rivalry);
                          const relationship = getRivalryRelationship(rivalry);
                          const stage = getRivalryStageContext(game, rivalry);
                          const titleRelevance = getRivalryTitleRelevance(rivalry, game.championships, game.wrestlers);
                          const rivalryBlocked = isRivalryIntergenderBlocked(rivalry, game.wrestlers);

                          return (
                            <article className="roster-profile-context-row" key={rivalry.id}>
                              <strong>{rivalry.name}</strong>
                              <span>
                                {storyline.name} / {stage.name} / {relationship.name}
                                {rivalryBlocked ? " / Blocked Context" : titleRelevance ? ` / ${titleRelevance.label}` : ""}
                              </span>
                              <p>{rivalryBlocked ? "Legacy rivalry is visible, but booking context is blocked by the no-intergender rule." : `Heat ${rivalry.heat} / Freshness ${rivalry.freshness} / ${formatRivalryStatus(rivalry.status)}`}</p>
                            </article>
                          );
                        })
                      ) : (
                        <p className="roster-muted-copy">No active rivalry currently includes {wrestler.name}.</p>
                      )}
                    </div>
                    <div className="roster-history-list compact" aria-label="Creative history">
                      {[...recentTitleHistory, ...recentRivalryHistory].length ? (
                        <>
                          {recentTitleHistory.map((event) => (
                            <article className="roster-history-event" key={event.id}>
                              <span>
                                {formatChampionshipEventType(event.eventType)} / {formatHistoryStamp(event)}
                              </span>
                              <p>{event.note}</p>
                            </article>
                          ))}
                          {recentRivalryHistory.map((event) => (
                            <article className="roster-history-event" key={event.id}>
                              <span>
                                {formatRivalryEventType(event.eventType)} / {formatHistoryStamp(event)}
                              </span>
                              <p>{event.note}</p>
                            </article>
                          ))}
                        </>
                      ) : (
                        <p className="roster-muted-copy">No major title or rivalry history recorded for {wrestler.name} yet.</p>
                      )}
                    </div>
                  </>
                ) : null}

                {activeReport === "office" ? (
                  <>
                    <div className="roster-profile-report-callout">
                      <span>{activeReportModel.reason}</span>
                      <strong>
                        Morale {wrestler.morale} / Trust {wrestler.trust ?? 50}
                      </strong>
                    </div>
                    <div className="roster-readout-list">
                      <p>
                        <strong>Active deal:</strong>{" "}
                        {contract ? `${contract.contractWeeksRemaining} wk / ${formatMoney(contract.weeklySalary)}/wk rate / ${contract.paymentModel === "prepaid" ? "Prepaid" : `Penalty ${formatMoney(contract.releasePenalty)}`}` : "No active contract read"}
                      </p>
                      <p>
                        <strong>GM lens:</strong> {valueProfile.dossierRead}
                      </p>
                      <p>
                        <strong>Cost read:</strong> {valueProfile.costRead}
                      </p>
                    </div>
                    {contractNegotiating ? (
                      <div className="roster-contract-terms-panel">
                        <label>
                          <span>Extend Weeks</span>
                          <input min="1" max={MARKET_CONTRACT_MAX_WEEKS} onChange={(event) => setSelectedRenewalWeeks(Math.max(1, Math.min(MARKET_CONTRACT_MAX_WEEKS, Number(event.target.value) || 1)))} type="number" value={selectedRenewalWeeks} />
                        </label>
                        <strong>
                          {formatMoney(renewalOffer.weeklyAsk)}/wk / Due now {formatMoney(renewalOffer.dueNow)}
                        </strong>
                      </div>
                    ) : null}
                    <div className="roster-contract-actions" aria-label={`${wrestler.name} contract actions`}>
                      <button className={`roster-btn roster-btn-secondary ${contractNegotiating ? "is-active" : ""}`.trim()} disabled={marketClosed || !contract} onClick={() => setContractNegotiating((open) => !open)} type="button">
                        {contractNegotiating ? "Hide Terms" : "Negotiate"}
                      </button>
                      <button className="roster-btn roster-btn-primary" disabled={Boolean(renewalDisabledReason)} onClick={() => onRenewContract(wrestler.id, selectedRenewalWeeks)} type="button">
                        Extend Deal
                      </button>
                      <button className="roster-btn roster-btn-secondary" disabled={Boolean(releaseDisabledReason)} onClick={() => onReleaseWrestler(wrestler.id)} type="button">
                        Release
                      </button>
                    </div>
                    <small className="roster-muted-copy">{renewalDisabledReason || releaseDisabledReason || "Renewals and releases file from this superstar page. Trade proposals stay on the Market Desk wire."}</small>
                    <div className="roster-profile-list">
                      {activeSocialRequests.length ? (
                        activeSocialRequests.map((request) => (
                          <article className="roster-profile-context-row" key={request.id}>
                            <strong>{getProfileActionLabel(request.actionType)}</strong>
                            <span>
                              {request.status} / Deadline W{request.deadlineWeekNumber}
                            </span>
                            <p>{request.note ?? request.askLabel}</p>
                          </article>
                        ))
                      ) : (
                        <p className="roster-muted-copy">No current Superstar Mail decisions are filed for {wrestler.name}.</p>
                      )}
                      {recentSocialPosts.length ? (
                        recentSocialPosts.map((post) => (
                          <article className={`social-post compact-social tone-${post.tone}`} key={post.id}>
                            <div className="social-post-head">
                              <div>
                                <span>{formatSocialCategory(post.category)}</span>
                                <strong>{post.author}</strong>
                              </div>
                              <small>Week {post.weekNumber}</small>
                            </div>
                            <p>{post.text}</p>
                          </article>
                        ))
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </DynastyManagementShell>
  );
}
