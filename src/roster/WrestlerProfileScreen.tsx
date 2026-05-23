import { useEffect, useState } from "react";
import { isRivalryIntergenderBlocked } from "../booking/bookingUtils";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import { getWrestlerAffiliations } from "../game/affiliationCatalog";
import { formatAffiliationKind, getAffiliationMemberNames } from "./rosterDisplayUtils";
import { getInjuryStatusLabel, getRosterPressureTags, getWeeksSinceLastBooked } from "../game/rosterContextReads";
import { getRivalryRelationship, getRivalryStoryline } from "../game/rivalryCatalog";
import { getWrestlerIdentityContext } from "../game/wrestlerIdentityContext";
import { RosterPanel } from "./RosterPanel";
import { RosterProfilePanel } from "./RosterProfilePanel";
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
  getRosterAlignmentLabel,
  getWrestlerChampionships,
  getWrestlerIdentitySnapshot,
  getWrestlerLockerRoomRead,
  getWrestlerRivalries,
  getWrestlerStatus,
} from "./rosterReads";
import type { ProfilePanelId, WrestlerProfileScreenProps } from "./rosterTypes";
import { getWrestlerValueProfile } from "./rosterValueReads";

export function WrestlerProfileScreen({
  game,
  latestResult,
  onBackToBooking,
  onBackToRoster,
  onNavigate,
  returnScreen,
  wrestler,
}: WrestlerProfileScreenProps) {
  const status = getWrestlerStatus(wrestler);
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
  const identity = getWrestlerIdentityContext(wrestler);
  const identitySnapshot = getWrestlerIdentitySnapshot(wrestler, game);
  const valueProfile = getWrestlerValueProfile(wrestler);
  const lockerRoomRead = getWrestlerLockerRoomRead(wrestler, game);
  const [expandedProfilePanels, setExpandedProfilePanels] = useState<Set<ProfilePanelId>>(() => new Set(["stats", "gmRead"]));
  const profileStatRows = [
    { label: "Popularity", value: `${wrestler.popularity}` },
    { label: "Momentum", value: `${wrestler.momentum}` },
    { label: "Fatigue", value: `${wrestler.fatigue}` },
    { label: "Morale", value: `${wrestler.morale}` },
    { label: "Ring Skill", value: `${wrestler.ringSkill}` },
    { label: "Promo Skill", value: `${wrestler.promoSkill}` },
    { label: "Injury", value: getInjuryStatusLabel(wrestler.injuryStatus), note: getInjuryDetail(wrestler) },
    { label: "Appearances", value: `${wrestler.appearancesThisSeason ?? 0}`, note: "This season" },
    { label: "Last Booked", value: wrestler.lastBookedWeek ? `Week ${wrestler.lastBookedWeek}` : "Never", note: `${weeksSinceLastBooked} weeks off TV` },
    { label: "TV Streak", value: `${wrestler.consecutiveWeeksBooked ?? 0}`, note: "Consecutive weeks booked" },
  ];
  const profilePanelExpanded = (panelId: ProfilePanelId) => expandedProfilePanels.has(panelId);
  const toggleProfilePanel = (panelId: ProfilePanelId) => {
    setExpandedProfilePanels((currentPanels) => {
      const nextPanels = new Set(currentPanels);
      if (nextPanels.has(panelId)) {
        nextPanels.delete(panelId);
      } else {
        nextPanels.add(panelId);
      }
      return nextPanels;
    });
  };

  useEffect(() => {
    setExpandedProfilePanels(new Set(["stats", "gmRead"]));
  }, [wrestler.id]);

  const statsSummary = `POP ${wrestler.popularity} / MOM ${wrestler.momentum} / FAT ${wrestler.fatigue} / MOR ${wrestler.morale}`;
  const gmReadSummary = `${lockerRoomRead.headline}${pressureTags.length ? ` / ${pressureTags.slice(0, 2).join(" / ")}` : " / Balanced"}`;
  const contractSummary = `${valueProfile.valueTierLabel} / ${valueProfile.weeklyValueLabel}`;
  const affiliationSummary = affiliations.length ? `${affiliations.length} locker room link${affiliations.length === 1 ? "" : "s"}` : "No source link";
  const showHistorySummary = recentAppearances.length ? `${recentAppearances.length} recent appearance${recentAppearances.length === 1 ? "" : "s"}` : "No show appearances";
  const championshipSummary = championships.length
    ? `${championships.length} current title${championships.length === 1 ? "" : "s"}`
    : titleSceneRows.length
      ? `${titleSceneRows.length} title scene fit${titleSceneRows.length === 1 ? "" : "s"}`
      : "No current title scene";
  const rivalrySummary = activeRivalries.length ? `${activeRivalries.length} active / ${activeRivalries[0].name}` : "No active rivalry";
  const socialSummary = recentSocialPosts.length ? `${recentSocialPosts.length} recent mention${recentSocialPosts.length === 1 ? "" : "s"}` : "No recent social mentions";

  const profileCta: DynastyManagementCta = {
    eyebrow: "Talent Profile",
    label: returnScreen === "booking" ? "Back to Booking" : "Back to Roster",
    onClick: returnScreen === "booking" ? onBackToBooking : onBackToRoster,
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
        <RosterPanel className="roster-profile-hero" kicker="Wrestler Profile" title={wrestler.name}>
          <div className="roster-profile-hero-body">
            <WrestlerPortrait className="roster-profile-hero-portrait" wrestler={wrestler} />
            <div className="roster-profile-hero-main">
              <div className="roster-profile-identity-strip">
                <span>{identity.role}</span>
                <span>{getRosterAlignmentLabel(wrestler)}</span>
                <span>{status}</span>
                <span>{getInjuryStatusLabel(wrestler.injuryStatus)}</span>
                {pressureTags.length ? pressureTags.map((tag) => <span key={tag}>{tag}</span>) : <span>Balanced</span>}
                {championships.length ? championships.map((championship) => <span key={championship.id}>{championship.name}</span>) : null}
              </div>
            </div>
          </div>
        </RosterPanel>

        <div className="roster-profile-layout">
          <div className="roster-profile-main">
            <RosterProfilePanel
              className="roster-profile-stats-panel"
              expanded={profilePanelExpanded("stats")}
              eyebrow="Current Value"
              id="stats"
              onToggle={toggleProfilePanel}
              summary={statsSummary}
              title="Stats And TV Load"
            >
              <div className="roster-profile-stat-rows">
                {profileStatRows.map((row) => (
                  <article className="roster-profile-stat-row" key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                    <small>{row.note ?? ""}</small>
                  </article>
                ))}
              </div>
            </RosterProfilePanel>

            <RosterProfilePanel
              className={`roster-profile-contract-panel ${valueProfile.contextMode === "missing" ? "is-missing" : ""}`}
              expanded={profilePanelExpanded("contractValue")}
              eyebrow="Contract Value Dossier"
              id="contractValue"
              onToggle={toggleProfilePanel}
              summary={contractSummary}
              title={valueProfile.valueTierLabel}
            >
              <div className="roster-readout-list">
                <p>
                  <strong>Draft profile:</strong> {valueProfile.draftValueLabel}
                </p>
                <p>
                  <strong>Weekly context:</strong> {valueProfile.weeklyValueLabel}
                </p>
                <p>
                  <strong>GM lens:</strong> {valueProfile.dossierRead}
                </p>
                <p>
                  <strong>Cost read:</strong> {valueProfile.costRead}
                </p>
                <small className="roster-muted-copy">
                  Context-only readout. No contract mechanics, payroll locks, or automatic booking restrictions are active in this build.
                </small>
              </div>
            </RosterProfilePanel>

            <RosterProfilePanel
              className="roster-profile-affiliation-panel"
              expanded={profilePanelExpanded("affiliations")}
              eyebrow="Affiliation Context"
              id="affiliations"
              onToggle={toggleProfilePanel}
              summary={affiliationSummary}
              title={affiliations.length ? "Locker Room Links" : "No Source Link"}
            >
              <div className="roster-profile-list">
                {affiliations.length ? (
                  affiliations.map((affiliation) => (
                    <article className="roster-profile-context-row" key={affiliation.id}>
                      <strong>{affiliation.name}</strong>
                      <span>
                        {formatAffiliationKind(affiliation.kind)} · {affiliation.status}
                      </span>
                      <p>{getAffiliationMemberNames(affiliation, game.wrestlers) || wrestler.name}</p>
                      <small>{affiliation.notes}</small>
                    </article>
                  ))
                ) : (
                  <div className="roster-empty-copy compact">No team, faction, or affiliation label is available for {wrestler.name} in the current Top 200 source data.</div>
                )}
              </div>
            </RosterProfilePanel>

            <RosterProfilePanel
              expanded={profilePanelExpanded("showHistory")}
              eyebrow="Recent Show History"
              id="showHistory"
              onToggle={toggleProfilePanel}
              summary={showHistorySummary}
              title="Last Five Appearances"
            >
              <div className="roster-profile-list">
                {recentAppearances.length ? (
                  recentAppearances.map((appearance) => (
                    <article className="roster-profile-history-row" key={appearance.id}>
                      <div>
                        <span>
                          Week {appearance.week} · {appearance.showName}
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
            </RosterProfilePanel>
          </div>

          <aside className="roster-profile-side">
            <RosterProfilePanel
              className="roster-profile-gm-panel"
              expanded={profilePanelExpanded("gmRead")}
              eyebrow="GM Read"
              id="gmRead"
              onToggle={toggleProfilePanel}
              summary={gmReadSummary}
              title="Decision Context"
            >
              <div className="roster-identity-snapshot-panel" aria-label="Identity snapshot">
                <div className="pressure-tags">
                  {identitySnapshot.labels.map((label) => (
                    <span className="identity-chip" key={label}>
                      {label}
                    </span>
                  ))}
                </div>
                <strong>{identitySnapshot.roleRead}</strong>
                <p>{identitySnapshot.bookingUseRead}</p>
                <small>{identitySnapshot.usageRead}</small>
              </div>
              <div className={`roster-locker-room-read tone-${lockerRoomRead.tone}`} aria-label={`${wrestler.name} locker room read`}>
                <span>Locker Room Read</span>
                <strong>{lockerRoomRead.headline}</strong>
                <p>{lockerRoomRead.detail}</p>
                <small>{lockerRoomRead.note}</small>
              </div>
              <div className="roster-readout-list">
                <p>
                  <strong>Useful:</strong> {gmRead.usefulness}
                </p>
                <p>
                  <strong>Risk:</strong> {gmRead.risk}
                </p>
                <p>
                  <strong>Need:</strong> {gmRead.need}
                </p>
              </div>
            </RosterProfilePanel>

            <RosterProfilePanel
              className="roster-profile-title-panel"
              expanded={profilePanelExpanded("championships")}
              eyebrow="Championship Context"
              id="championships"
              onToggle={toggleProfilePanel}
              summary={championshipSummary}
              title={championships.length ? "Current Champion" : titleSceneRows.length ? "Title Scene Fit" : "No Current Title"}
            >
              <div className="roster-profile-list">
                {titleSceneRows.length ? (
                  titleSceneRows.map(({ championship, detail, relevance }) => (
                    <article className="roster-profile-context-row" key={championship.id}>
                      <strong>{championship.name}</strong>
                      <span>
                        {relevance} · {detail} · Prestige {championship.prestige}
                      </span>
                    </article>
                  ))
                ) : (
                  <p className="roster-muted-copy">{wrestler.name} does not currently fit an active singles title scene.</p>
                )}
              </div>
              <div className="roster-history-list compact" aria-label="Recent title history">
                {recentTitleHistory.length ? (
                  recentTitleHistory.map((event) => (
                    <article className="roster-history-event" key={event.id}>
                      <span>
                        {formatChampionshipEventType(event.eventType)} · {formatHistoryStamp(event)}
                      </span>
                      <p>{event.note}</p>
                    </article>
                  ))
                ) : (
                  <p className="roster-muted-copy">No title history recorded for {wrestler.name} yet.</p>
                )}
              </div>
            </RosterProfilePanel>

            <RosterProfilePanel
              className="roster-profile-rivalry-panel"
              expanded={profilePanelExpanded("rivalries")}
              eyebrow="Active Rivalries"
              id="rivalries"
              onToggle={toggleProfilePanel}
              summary={rivalrySummary}
              title={activeRivalries.length ? "Story Pressure" : "No Active Rivalry"}
            >
              <div className="roster-profile-list">
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
                          {storyline.name} · {stage.name} · {relationship.name}
                          {rivalryBlocked ? " · Blocked Context" : titleRelevance ? ` · ${titleRelevance.label}` : ""}
                        </span>
                        <p>
                          {rivalryBlocked
                            ? "Legacy rivalry is visible, but booking context is blocked by the no-intergender rule."
                            : `Heat ${rivalry.heat} · Freshness ${rivalry.freshness} · ${formatRivalryStatus(rivalry.status)}`}
                        </p>
                      </article>
                    );
                  })
                ) : (
                  <p className="roster-muted-copy">No active rivalry currently includes {wrestler.name}.</p>
                )}
              </div>
              <div className="roster-history-list compact" aria-label="Major rivalry history">
                {recentRivalryHistory.length ? (
                  recentRivalryHistory.map((event) => (
                    <article className="roster-history-event" key={event.id}>
                      <span>
                        {formatRivalryEventType(event.eventType)} · {formatHistoryStamp(event)}
                      </span>
                      <p>{event.note}</p>
                    </article>
                  ))
                ) : (
                  <p className="roster-muted-copy">No major rivalry history recorded for {wrestler.name} yet.</p>
                )}
              </div>
            </RosterProfilePanel>

            <RosterProfilePanel
              className="roster-profile-social-panel"
              expanded={profilePanelExpanded("social")}
              eyebrow="Social Mentions"
              id="social"
              onToggle={toggleProfilePanel}
              summary={socialSummary}
              title="Recent IWC Read"
            >
              <div className="roster-profile-list">
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
                ) : (
                  <div className="roster-empty-copy compact">No recent social posts mention {wrestler.name}.</div>
                )}
              </div>
            </RosterProfilePanel>
          </aside>
        </div>
      </section>
    </DynastyManagementShell>
  );
}
