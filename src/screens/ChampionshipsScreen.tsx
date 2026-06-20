import { useEffect, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { Metric } from "../components/gameShell";
import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import { getTitleDivisionScene, getTitleScenePressureSnapshot, getTitleSceneTalentScore } from "../game/gameContextReads";
import type { GameScreen } from "../game/migration";
import { getChampionshipHistory, formatChampionshipEventType } from "../game/storyContextReads";
import { getChampionshipArtworkSrc, wrestlerFitsChampionshipDivision } from "../game/titleCatalog";
import type { GameState, ShowResult } from "../game/types";
import {
  buildTagTeamChallengerRows,
  getChampionshipAcronym,
  getChampionshipOfficeRead,
  getChampionshipSceneDeskRead,
  getReignLength,
  getTagDivisionHealthDiagnostics,
  getTitleSceneGMRead,
  getTitleSceneIdentityRead,
  getTitleSceneRead,
  getTitleSceneTalentRead,
  getWrestlerNames,
  formatHistoryStamp,
  isTagChampionship,
} from "./championshipsScreenReads";
import "./ChampionshipsScreen.css";

export function ChampionshipsScreen({
  game,
  latestResult,
  onAssignChampionship,
  onBookChampionship,
  onNavigate,
  onRevokeChampionship,
  onSetContenders,
}: {
  game: GameState;
  latestResult?: ShowResult;
  onAssignChampionship: (championshipId: string, championIds: string[]) => void;
  onBookChampionship: (championshipId: string) => void;
  onNavigate: (screen: GameScreen) => void;
  onRevokeChampionship: (championshipId: string) => void;
  onSetContenders: (championshipId: string, wrestlerIds: string[]) => void;
}) {
  const officeRead = getChampionshipOfficeRead(game);
  const [editContendersOpen, setEditContendersOpen] = useState(false);
  const [assignChampionOpen, setAssignChampionOpen] = useState(false);
  const [assignTagChampionOneId, setAssignTagChampionOneId] = useState("");
  const [assignTagChampionTwoId, setAssignTagChampionTwoId] = useState("");
  const [committeeExpanded, setCommitteeExpanded] = useState(false);
  const defaultSelectedChampionship =
    game.championships.find((championship) => championship.name === officeRead.attentionTitle) ??
    game.championships.find((championship) => championship.name === officeRead.prestigeTitle) ??
    game.championships[0];
  const [selectedChampionshipId, setSelectedChampionshipId] = useState(defaultSelectedChampionship?.id ?? "");
  const championshipReads = game.championships.map((championship) => {
    const scene = getTitleDivisionScene(championship, game.wrestlers, game.rivalries, game.currentWeek, game.championships);
    const recentHistory = getChampionshipHistory(game, championship.id);
    const titleRead = getTitleSceneRead(championship, game.wrestlers, game.currentWeek, game.rivalries);
    const pressureSnapshot = getTitleScenePressureSnapshot(championship, game);
    const gmRead = getTitleSceneGMRead(championship, scene);
    const isTagTitle = isTagChampionship(championship);
    const tagDivisionHealth = isTagTitle ? getTagDivisionHealthDiagnostics(championship, game) : [];
    const titleDeskRead = getChampionshipSceneDeskRead(championship, game, scene, pressureSnapshot);
    const identityRead = getTitleSceneIdentityRead(championship, game, scene, pressureSnapshot);

    return {
      championship,
      scene,
      recentHistory,
      titleRead,
      pressureSnapshot,
      gmRead,
      isTagTitle,
      tagDivisionHealth,
      titleDeskRead,
      identityRead,
    };
  });
  const selectedTitleRead =
    championshipReads.find((read) => read.championship.id === selectedChampionshipId) ??
    championshipReads.find((read) => read.championship.id === defaultSelectedChampionship?.id) ??
    championshipReads[0];
  const selectedContenderRows = selectedTitleRead
    ? selectedTitleRead.scene.topContenders.map((wrestler, index) => ({
        index,
        wrestler,
        read: getTitleSceneTalentRead(wrestler, game, selectedTitleRead.championship.id),
        lane: "Top Contender",
      }))
    : [];
  const selectedContenderIds = new Set(selectedContenderRows.map(({ wrestler }) => wrestler.id));
  const selectedChampionIds = new Set(selectedTitleRead?.championship.championIds ?? []);
  const addableContenders = selectedTitleRead
    ? game.wrestlers
        .filter((wrestler) => !selectedChampionIds.has(wrestler.id))
        .filter((wrestler) => !selectedContenderIds.has(wrestler.id))
        .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, selectedTitleRead.championship, game.wrestlers))
        .sort((a, b) => getTitleSceneTalentScore(b, selectedTitleRead.championship, game.rivalries) - getTitleSceneTalentScore(a, selectedTitleRead.championship, game.rivalries))
        .slice(0, 8)
    : [];
  const tagTeamChallengerRows = selectedTitleRead?.isTagTitle
    ? buildTagTeamChallengerRows(selectedContenderRows, game.wrestlers, [...selectedChampionIds], 3)
    : [];
  const assignableChampionCandidates = selectedTitleRead
    ? game.wrestlers
        .filter((wrestler) => wrestlerFitsChampionshipDivision(wrestler, selectedTitleRead.championship, game.wrestlers))
        .sort((a, b) => getTitleSceneTalentScore(b, selectedTitleRead.championship, game.rivalries) - getTitleSceneTalentScore(a, selectedTitleRead.championship, game.rivalries))
    : [];
  const tagChampionAssignReady =
    Boolean(assignTagChampionOneId && assignTagChampionTwoId && assignTagChampionOneId !== assignTagChampionTwoId);

  useEffect(() => {
    if (!championshipReads.some((read) => read.championship.id === selectedChampionshipId)) {
      setSelectedChampionshipId(defaultSelectedChampionship?.id ?? "");
    }
  }, [championshipReads, defaultSelectedChampionship?.id, selectedChampionshipId]);

  useEffect(() => {
    setAssignTagChampionOneId("");
    setAssignTagChampionTwoId("");
  }, [selectedChampionshipId, assignChampionOpen]);

  function handleSelectChampionship(championshipId: string) {
    setSelectedChampionshipId(championshipId);
    setEditContendersOpen(false);
    setAssignChampionOpen(false);
    setCommitteeExpanded(false);
  }

  const attentionTitleRead =
    championshipReads.find((read) => read.championship.name === officeRead.attentionTitle) ?? selectedTitleRead;
  const prestigeTitleRead = championshipReads.find((read) => read.championship.name === officeRead.prestigeTitle);
  const priorityTitleReads = [attentionTitleRead, prestigeTitleRead].filter(
    (read, index, reads): read is (typeof championshipReads)[number] =>
      Boolean(read) && reads.findIndex((candidate) => candidate?.championship.id === read?.championship.id) === index,
  );
  const beltWallReads = championshipReads.filter(
    (read) => !priorityTitleReads.some((priorityRead) => priorityRead.championship.id === read.championship.id),
  );

  function renderBeltRow(read: (typeof championshipReads)[number], isPriority = false) {
    const { championship, pressureSnapshot, scene } = read;
    const isSelected = selectedTitleRead?.championship.id === championship.id;
    const champion = scene.champions[0];
    const artworkSrc = getChampionshipArtworkSrc(championship);

    return (
      <button
        className={`championship-belt-row ${isSelected ? "is-selected" : ""} ${isPriority ? "is-priority" : ""}`.trim()}
        key={championship.id}
        onClick={() => handleSelectChampionship(championship.id)}
        type="button"
      >
        {artworkSrc ? (
          <img alt="" aria-hidden="true" className="championship-belt-row-art" src={artworkSrc} />
        ) : (
          <span className="championship-belt-row-mark">{getChampionshipAcronym(championship.name)}</span>
        )}
        {champion ? (
          <WrestlerPortrait className="championship-row-portrait" wrestler={champion} />
        ) : (
          <span aria-hidden="true" className="championship-belt-row-mark">
            —
          </span>
        )}
        <span>
          <strong>{championship.name}</strong>
          <small>
            {pressureSnapshot.primary.label} · {getWrestlerNames(championship.championIds, game.wrestlers) || "Vacant"}
          </small>
        </span>
        <b>{championship.prestige}</b>
      </button>
    );
  }

  const beltsNeedingAttention = championshipReads.filter(
    (read) => read.identityRead.tone === "watch" || read.identityRead.tone === "build",
  ).length;
  const titleUrgencyRead =
    beltsNeedingAttention > 0
      ? `${beltsNeedingAttention} belt${beltsNeedingAttention === 1 ? "" : "s"} on the clock · ${game.championships.length} live`
      : `${game.championships.length} belt${game.championships.length === 1 ? "" : "s"} stable this week`;
  const hasChampion = Boolean(selectedTitleRead?.championship.championIds.length);
  const hasContenderLane = selectedContenderRows.length > 0;
  const focusReady = Boolean(selectedTitleRead && hasChampion && hasContenderLane);
  const focusBlocked = Boolean(selectedTitleRead && (!hasChampion || !hasContenderLane));
  const decisionTone = focusReady ? "ready" : focusBlocked ? "blocked" : "neutral";
  const decisionHeadline = !hasChampion
    ? "Vacant Belt Needs A Champion"
    : !hasContenderLane
      ? "Thin Contender Lane"
      : "Title Match Ready";
  const mandateHeadline =
    beltsNeedingAttention > 0
      ? `${beltsNeedingAttention} Belt${beltsNeedingAttention === 1 ? "" : "s"} On The Clock`
      : "Title Scenes Stable";
  const mandateDetail = selectedTitleRead
    ? `${getChampionshipAcronym(selectedTitleRead.championship.name)} · ${selectedTitleRead.pressureSnapshot.primary.label}`
    : titleUrgencyRead;
  const decisionBodyShort = selectedTitleRead
    ? selectedTitleRead.pressureSnapshot.primary.detail.split(".")[0]?.trim() + (selectedTitleRead.pressureSnapshot.primary.detail.includes(".") ? "." : "")
    : "Select a belt from the rail.";
  const championshipsCta: DynastyManagementCta = selectedTitleRead
    ? {
        eyebrow: "Selected Title",
        label: "Book Title",
        onClick: () => onBookChampionship(selectedTitleRead.championship.id),
        tone: "brand",
      }
    : {
        eyebrow: "Title Office",
        label: "No Title Selected",
        tone: "neutral",
      };
  const selectedTitleArtworkSrc = selectedTitleRead ? getChampionshipArtworkSrc(selectedTitleRead.championship) : undefined;

  return (
    <DynastyManagementShell className="championships-command-shell" currentScreen="championships" cta={championshipsCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <div className="championship-desk-body">
        <section className={`championship-mandate-strip tone-${officeRead.tone}`} aria-label="Title office mandate">
          <p className="eyebrow">Title Office</p>
          <strong>{mandateHeadline}</strong>
          <span>{mandateDetail}</span>
        </section>

        <section className="championship-command-board" aria-label="Championship title desk">
          <aside className="championship-belt-rail championship-panel" aria-label="Belt rail">
            <div className="championship-panel-head">
              <div>
                <p className="eyebrow">Gold Scene</p>
                <h2>Active Belts</h2>
              </div>
              <strong>{game.championships.length} Live</strong>
            </div>
            <p className="championship-belt-urgency">{beltsNeedingAttention > 0 ? `${beltsNeedingAttention} on the clock` : "All scenes steady"}</p>
            <div className="championship-belt-list">
              {priorityTitleReads.length ? (
                <>
                  <p className="eyebrow">On The Clock</p>
                  {priorityTitleReads.map((read) => renderBeltRow(read, true))}
                </>
              ) : null}
              {(beltWallReads.length ? beltWallReads : championshipReads).map((read) => renderBeltRow(read))}
            </div>
          </aside>

          {selectedTitleRead ? (
            <section
              className={`championship-focus-workspace championship-panel ${focusReady ? "is-ready" : focusBlocked ? "is-blocked" : ""}`.trim()}
              aria-label={`${selectedTitleRead.championship.name} title focus`}
            >
              <div className="championship-focus-head">
                <div className="championship-focus-title-block">
                  <div className="championship-focus-visuals">
                    {selectedTitleArtworkSrc ? (
                      <img
                        alt={`${selectedTitleRead.championship.name} title belt`}
                        className="championship-focus-title-art"
                        src={selectedTitleArtworkSrc}
                      />
                    ) : (
                      <span className="championship-focus-title-fallback">{getChampionshipAcronym(selectedTitleRead.championship.name)}</span>
                    )}
                    <div className="championship-hero-portraits">
                      {selectedTitleRead.scene.champions.length ? (
                        selectedTitleRead.scene.champions.slice(0, 2).map((wrestler) => (
                          <WrestlerPortrait className="championship-hero-portrait" key={wrestler.id} wrestler={wrestler} />
                        ))
                      ) : (
                        <button
                          aria-expanded={assignChampionOpen}
                          aria-label={`Assign champion to ${selectedTitleRead.championship.name}`}
                          className={`championship-hero-vacant${assignChampionOpen ? " is-open" : ""}`}
                          onClick={() => setAssignChampionOpen(true)}
                          type="button"
                        >
                          <span>Vacant</span>
                          <small>Belt Open</small>
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow">On The Desk</p>
                    <h3 className="championship-focus-full-name">{selectedTitleRead.championship.name}</h3>
                    <div className="championship-focus-tags">
                      <span>{selectedTitleRead.championship.division}</span>
                      <span>{selectedTitleRead.championship.eligibleMatchScope === "tag_team" ? "Tag" : "Singles"}</span>
                      <span>{selectedTitleRead.pressureSnapshot.primary.label}</span>
                    </div>
                  </div>
                </div>
                <div className="championship-focus-badge">
                  <span>Prestige</span>
                  <strong>{selectedTitleRead.championship.prestige}</strong>
                </div>
              </div>

              <div className="championship-focus-metrics">
                <Metric
                  label="Champion"
                  value={getWrestlerNames(selectedTitleRead.championship.championIds, game.wrestlers) || "Vacant"}
                />
                <Metric label="Reign" value={`${getReignLength(selectedTitleRead.championship, game.currentWeek)} wk`} detail={`${selectedTitleRead.championship.defenses} def`} />
                <Metric label="Contenders" value={`${selectedContenderRows.length}`} />
                <Metric label="Prestige" value={`${selectedTitleRead.championship.prestige}`} />
              </div>

              <div className="championship-focus-body">
                <div className={`championship-focus-decision tone-${decisionTone}`}>
                  <div className="championship-focus-read">
                    <p className="eyebrow">Title Desk</p>
                    <h4>{decisionHeadline}</h4>
                    <p>{decisionBodyShort}</p>
                  </div>
                  <div className="championship-focus-controls">
                    <button className="primary-action" onClick={() => onBookChampionship(selectedTitleRead.championship.id)} type="button">
                      Book Title Match
                    </button>
                  </div>
                </div>

                <section
                  className="championship-challenger-strip"
                  aria-label={`${selectedTitleRead.championship.name} ${selectedTitleRead.isTagTitle ? "tag team" : "challenger"} lane`}
                >
                  <div className="championship-challenger-strip-head">
                    <span>{selectedTitleRead.isTagTitle ? "Tag Teams" : "Next Challengers"}</span>
                    <strong>
                      {selectedTitleRead.isTagTitle
                        ? tagTeamChallengerRows.length
                          ? `Top ${Math.min(3, tagTeamChallengerRows.length)}`
                          : "No Lane"
                        : selectedContenderRows.length
                          ? `Top ${Math.min(3, selectedContenderRows.length)}`
                          : "No Lane"}
                    </strong>
                  </div>
                  <div className="championship-challenger-cards">
                    {selectedTitleRead.isTagTitle ? (
                      tagTeamChallengerRows.length ? (
                        tagTeamChallengerRows.map(({ rank, wrestlers }) => (
                          <article className="championship-challenger-card is-tag-team" key={`${wrestlers[0].id}-${wrestlers[1].id}`}>
                            <span>{String(rank).padStart(2, "0")}</span>
                            <div className="championship-challenger-team-portraits">
                              {wrestlers.map((wrestler) => (
                                <WrestlerPortrait className="championship-challenger-portrait" key={wrestler.id} wrestler={wrestler} />
                              ))}
                            </div>
                            <strong>{wrestlers.map((wrestler) => wrestler.name).join(" / ")}</strong>
                          </article>
                        ))
                      ) : (
                        <p className="muted-copy">No tag teams in the lane yet.</p>
                      )
                    ) : selectedContenderRows.length ? (
                      selectedContenderRows.slice(0, 3).map(({ index, wrestler }) => (
                        <article className="championship-challenger-card" key={wrestler.id}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <WrestlerPortrait className="championship-challenger-portrait" wrestler={wrestler} />
                          <strong>{wrestler.name}</strong>
                        </article>
                      ))
                    ) : (
                      <p className="muted-copy">No challenger lane is visible yet.</p>
                    )}
                  </div>
                </section>
              </div>
            </section>
          ) : (
            <section className="championship-focus-workspace championship-panel" aria-label="Title focus workspace">
              <p className="muted-copy">Pick a belt from the rail to open the title desk.</p>
            </section>
          )}

          <aside className="championship-action-rail" aria-label="Title office actions">
            {selectedTitleRead ? (
              <>
                <article className="championship-panel">
                  <div className="championship-panel-head">
                    <div>
                      <p className="eyebrow">Champion Control</p>
                      <h2>Gold Holder</h2>
                    </div>
                    {selectedTitleRead.championship.championIds.length ? (
                      <button className="danger-action" onClick={() => onRevokeChampionship(selectedTitleRead.championship.id)} type="button">
                        Revoke
                      </button>
                    ) : (
                      <button className="secondary-action" onClick={() => setAssignChampionOpen((open) => !open)} type="button">
                        {assignChampionOpen ? "Cancel" : "Assign"}
                      </button>
                    )}
                  </div>
                  <p className="championship-action-note">{getWrestlerNames(selectedTitleRead.championship.championIds, game.wrestlers) || "Vacant belt — assign a champion or book the scene."}</p>
                  {assignChampionOpen && !selectedTitleRead.championship.championIds.length ? (
                    <div className="championship-assign-options">
                      {selectedTitleRead.isTagTitle ? (
                        assignableChampionCandidates.length >= 2 ? (
                          <div className="championship-tag-assign-form">
                            <label className="championship-tag-assign-field">
                              <span>Champion 1</span>
                              <select
                                onChange={(event) => setAssignTagChampionOneId(event.target.value)}
                                value={assignTagChampionOneId}
                              >
                                <option value="">Select wrestler</option>
                                {assignableChampionCandidates
                                  .filter((wrestler) => wrestler.id !== assignTagChampionTwoId)
                                  .map((wrestler) => (
                                    <option key={wrestler.id} value={wrestler.id}>
                                      {wrestler.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label className="championship-tag-assign-field">
                              <span>Champion 2</span>
                              <select
                                onChange={(event) => setAssignTagChampionTwoId(event.target.value)}
                                value={assignTagChampionTwoId}
                              >
                                <option value="">Select wrestler</option>
                                {assignableChampionCandidates
                                  .filter((wrestler) => wrestler.id !== assignTagChampionOneId)
                                  .map((wrestler) => (
                                    <option key={wrestler.id} value={wrestler.id}>
                                      {wrestler.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              className="primary-action championship-tag-assign-confirm"
                              disabled={!tagChampionAssignReady}
                              onClick={() => {
                                if (!tagChampionAssignReady) {
                                  return;
                                }

                                onAssignChampionship(selectedTitleRead.championship.id, [assignTagChampionOneId, assignTagChampionTwoId]);
                                setAssignChampionOpen(false);
                              }}
                              type="button"
                            >
                              Assign Tag Champions
                            </button>
                          </div>
                        ) : (
                          <p className="muted-copy">Need at least two eligible wrestlers in this division.</p>
                        )
                      ) : assignableChampionCandidates.length ? (
                        assignableChampionCandidates.slice(0, 10).map((wrestler) => (
                          <button
                            key={wrestler.id}
                            onClick={() => {
                              onAssignChampionship(selectedTitleRead.championship.id, [wrestler.id]);
                              setAssignChampionOpen(false);
                            }}
                            type="button"
                          >
                            {wrestler.name}
                          </button>
                        ))
                      ) : (
                        <p className="muted-copy">No eligible champion available.</p>
                      )}
                    </div>
                  ) : null}
                </article>

                <article className="championship-panel">
                  <div className="championship-panel-head">
                    <div>
                      <p className="eyebrow">Contender Lane</p>
                      <h2>Title Picture</h2>
                    </div>
                    <button className="secondary-action" onClick={() => setEditContendersOpen((open) => !open)} type="button">
                      {editContendersOpen ? "Done" : "Edit"}
                    </button>
                  </div>
                  {editContendersOpen ? (
                    <div className="championship-add-contender-panel">
                      {addableContenders.slice(0, 6).map((wrestler) => (
                        <button
                          key={wrestler.id}
                          onClick={() => onSetContenders(selectedTitleRead.championship.id, [...selectedContenderRows.map((row) => row.wrestler.id), wrestler.id])}
                          type="button"
                        >
                          + {wrestler.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="championship-contender-list">
                    {selectedContenderRows.length ? (
                      selectedContenderRows.map(({ index, wrestler }) => (
                        <article className={`championship-contender-row ${editContendersOpen ? "is-editing" : ""}`.trim()} key={wrestler.id}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <WrestlerPortrait className="championship-mini-portrait" wrestler={wrestler} />
                          <strong>{wrestler.name}</strong>
                          {editContendersOpen ? (
                            <button
                              aria-label={`Remove ${wrestler.name} from ${selectedTitleRead.championship.name} contender lane`}
                              className="danger-action championship-contender-remove"
                              onClick={() =>
                                onSetContenders(
                                  selectedTitleRead.championship.id,
                                  selectedContenderRows
                                    .map((row) => row.wrestler.id)
                                    .filter((wrestlerId) => wrestlerId !== wrestler.id),
                                )
                              }
                              type="button"
                            >
                              Remove
                            </button>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="muted-copy">No contenders set.</p>
                    )}
                  </div>
                </article>

                <article className={`championship-panel championship-committee-collapsible ${committeeExpanded ? "is-expanded" : ""}`}>
                  <button className="championship-manage-toggle" onClick={() => setCommitteeExpanded((open) => !open)} type="button">
                    <div>
                      <p className="eyebrow">Committee Read</p>
                      <strong>{selectedTitleRead.recentHistory[0]?.note ?? "No resolved title history yet"}</strong>
                    </div>
                    <span>{committeeExpanded ? "▴" : "▾"}</span>
                  </button>
                  {committeeExpanded ? (
                    <>
                      <div className="history-list title-history-focus">
                        {selectedTitleRead.recentHistory.length ? (
                          selectedTitleRead.recentHistory.map((event) => (
                            <article className="history-event" key={event.id}>
                              <span>{formatChampionshipEventType(event.eventType)} · {formatHistoryStamp(event)}</span>
                              <p>{event.note}</p>
                            </article>
                          ))
                        ) : (
                          <p className="muted-copy">No title history yet.</p>
                        )}
                      </div>
                      <p className="championship-contender-note">
                        <strong>GM Read:</strong> {selectedTitleRead.pressureSnapshot.producerRead} {selectedTitleRead.gmRead}
                      </p>
                    </>
                  ) : null}
                </article>
              </>
            ) : (
              <article className="championship-panel">
                <p className="muted-copy">Select a belt to manage champion control and contender order.</p>
              </article>
            )}
          </aside>
        </section>
      </div>
    </DynastyManagementShell>
  );
}
