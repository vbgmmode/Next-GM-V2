import { useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { getRosterAffiliations } from "../game/affiliationCatalog";
import { formatWeekCount } from "../booking/bookingUtils";
import { getInjuryStatusLabel, getRosterPressureTags, getTopOverusedWrestler, getTopUnderusedWrestler } from "../game/rosterContextReads";
import { RosterPanel } from "./RosterPanel";
import { RosterSelectedStrip, RosterSelectedStripEmpty } from "./RosterSelectedStrip";
import {
  getAverageRosterMoraleLabel,
  getMoraleTrendSvgPoints,
  getRosterFilterLabel,
  getRosterFilterMatch,
  getRosterMoraleTrend,
  getRosterSortLabel,
  getWrestlerChampionships,
  getWrestlerIdentitySnapshot,
  getWrestlerLockerRoomRead,
} from "./rosterReads";
import type { RosterFilter, RosterScreenProps, RosterSort } from "./rosterTypes";
import { getWrestlerValueProfile } from "./rosterValueReads";
import { WrestlerCard } from "./WrestlerCard";

export function RosterScreen({ game, latestResult, onNavigate, onOpenProfile }: RosterScreenProps) {
  const [sortBy, setSortBy] = useState<RosterSort>("momentum");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWrestlerId, setSelectedWrestlerId] = useState(game.wrestlers[0]?.id ?? "");
  const rosterAffiliations = getRosterAffiliations(game.wrestlers);
  const visibleWrestlers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...game.wrestlers]
      .filter((wrestler) => getRosterFilterMatch(filter, wrestler, game))
      .filter((wrestler) => {
        if (!normalizedSearch) {
          return true;
        }

        return [wrestler.name, wrestler.roleTier, wrestler.archetype, wrestler.sourceBrand, wrestler.division]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [filter, game, searchQuery, sortBy]);
  const topOverused = getTopOverusedWrestler(game.wrestlers);
  const topUnderused = getTopUnderusedWrestler(game.wrestlers, game.currentWeek);
  const featuredAffiliations = rosterAffiliations
    .filter((affiliation) => affiliation.memberWrestlerIds.length > 1)
    .slice(0, 3);
  const moraleTrend = getRosterMoraleTrend(game);
  const moraleTrendLine = getMoraleTrendSvgPoints(moraleTrend);
  const averageMorale = moraleTrend[moraleTrend.length - 1]?.value ?? getAverageRosterMoraleLabel(game.wrestlers);
  const selectedWrestler = visibleWrestlers.find((wrestler) => wrestler.id === selectedWrestlerId) ?? visibleWrestlers[0] ?? game.wrestlers[0];
  const selectedPressureTags = selectedWrestler ? getRosterPressureTags(selectedWrestler, game.currentWeek) : [];
  const selectedValueProfile = selectedWrestler ? getWrestlerValueProfile(selectedWrestler) : undefined;
  const selectedIdentity = selectedWrestler ? getWrestlerIdentitySnapshot(selectedWrestler, game) : undefined;
  const selectedLockerRead = selectedWrestler ? getWrestlerLockerRoomRead(selectedWrestler, game) : undefined;
  const selectedChampionships = selectedWrestler ? getWrestlerChampionships(selectedWrestler.id, game.championships) : [];
  const selectedAffiliations = selectedWrestler ? rosterAffiliations.filter((affiliation) => affiliation.memberWrestlerIds.includes(selectedWrestler.id)) : [];
  const injuryWatch = game.wrestlers
    .filter((wrestler) => wrestler.injuryStatus !== "healthy" || getRosterPressureTags(wrestler, game.currentWeek).includes("Injury Risk"))
    .sort((a, b) => b.fatigue - a.fatigue)
    .slice(0, 4);
  const filterOptions: RosterFilter[] = ["all", "mens", "womens", "champions"];
  const sortOptions: RosterSort[] = ["momentum", "popularity", "fatigue", "morale"];
  const filterCounts = filterOptions.reduce(
    (counts, option) => ({
      ...counts,
      [option]: game.wrestlers.filter((wrestler) => getRosterFilterMatch(option, wrestler, game)).length,
    }),
    {} as Record<RosterFilter, number>,
  );
  const rosterCta: DynastyManagementCta = selectedWrestler
    ? {
        eyebrow: "Selected Superstar",
        label: "View Profile",
        onClick: () => onOpenProfile(selectedWrestler.id),
        tone: "brand",
      }
    : {
        eyebrow: "Next Action",
        label: "Book Show",
        onClick: () => onNavigate("booking"),
        tone: "brand",
      };

  return (
    <DynastyManagementShell className="roster-dynasty-shell" currentScreen="roster" cta={rosterCta} game={game} latestResult={latestResult} onNavigate={onNavigate}>
      <section className="roster-dynasty-desk" aria-label="Locker Room command board">
        <div className="roster-dynasty-main">
          <aside className="roster-filter-rail" aria-label="Roster filters">
          <RosterPanel kicker="Filters" title="Locker Room" badge={`${game.wrestlers.length} Signed`}>
            <div className="roster-filter-stack">
              {filterOptions.map((option) => (
                <button className={`roster-filter-btn ${filter === option ? "is-active" : ""}`} key={option} onClick={() => setFilter(option)} type="button">
                  <span>{getRosterFilterLabel(option)}</span>
                  <strong>{filterCounts[option]}</strong>
                </button>
              ))}
            </div>
            <div className="roster-sort-box">
              <span>Sort By</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as RosterSort)}>
                {sortOptions.map((option) => (
                  <option key={option} value={option}>
                    {getRosterSortLabel(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="roster-quick-reads">
              <p className="roster-panel-kicker">Quick Reads</p>
              <span>{topOverused ? `${topOverused.name} needs protection` : "No overuse spike"}</span>
              <span>{topUnderused ? `${topUnderused.name} needs TV time` : "No long absence"}</span>
              <span>{featuredAffiliations.length ? `${featuredAffiliations.length} team links visible` : "No team links drafted"}</span>
            </div>
          </RosterPanel>
        </aside>

        <section className="roster-board-stage" aria-label="Superstar board">
          <RosterPanel kicker="Superstar Board" title={`Superstars (${visibleWrestlers.length})`}>
            <label className="roster-search-field">
              <span>Search</span>
              <input
                aria-label="Search superstars"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search superstars..."
                type="search"
                value={searchQuery}
              />
            </label>
            <div className="roster-grid" aria-label="Roster list">
              {visibleWrestlers.length ? (
                visibleWrestlers.map((wrestler) => (
                  <WrestlerCard
                    game={game}
                    isSelected={selectedWrestler?.id === wrestler.id}
                    key={wrestler.id}
                    onSelectWrestler={setSelectedWrestlerId}
                    rosterAffiliations={rosterAffiliations}
                    wrestler={wrestler}
                  />
                ))
              ) : (
                <div className="roster-empty-copy">No wrestlers match this board view.</div>
              )}
            </div>
          </RosterPanel>
        </section>

        <aside className="roster-pulse-rail" aria-label="Locker room pulse">
          <RosterPanel kicker="Locker Room Pulse" title="Room Status">
            <section className="roster-side-panel morale-trend-panel" aria-label="Average morale trend">
              <div className="roster-side-heading">
                <span>Morale Trend</span>
                <strong>{averageMorale} Avg</strong>
              </div>
              <svg className="morale-trend-plot" role="img" viewBox="0 0 100 36" aria-label={`Average morale trend ending at ${averageMorale}`}>
                <polyline points={moraleTrendLine} />
                {moraleTrend.map((point, index) => {
                  const x = moraleTrend.length <= 1 ? 50 : (index / (moraleTrend.length - 1)) * 100;
                  const y = 34 - (Math.max(0, Math.min(100, point.value)) / 100) * 32;
                  return <circle cx={x} cy={y} key={`${point.label}-${index}`} r="1.8" />;
                })}
              </svg>
              <div className="morale-trend-axis-labels" aria-hidden="true">
                <span>Y: Morale</span>
                <span>X: Week</span>
              </div>
              <div className="morale-trend-labels">
                {moraleTrend.map((point, index) => (
                  <span key={`${point.label}-${index}`}>
                    {point.label} <strong>{point.value}</strong>
                  </span>
                ))}
              </div>
            </section>

            <section className="roster-side-panel" aria-label="Injury report">
              <div className="roster-side-heading">
                <span>Injury Report</span>
                <strong>{injuryWatch.length ? `${injuryWatch.length} Flagged` : "Clear"}</strong>
              </div>
              <div className="roster-note-list">
                {injuryWatch.length ? (
                  injuryWatch.map((wrestler) => (
                    <article className="injury-line-item" key={wrestler.id}>
                      <strong>{wrestler.name}</strong>
                      <span>{wrestler.injuryStatus === "healthy" ? "At risk" : formatWeekCount(wrestler.injuryWeeksRemaining)}</span>
                    </article>
                  ))
                ) : (
                  <p className="roster-muted-copy">No injury or medical-risk read is leading the board.</p>
                )}
              </div>
            </section>
          </RosterPanel>
        </aside>
        </div>

        {selectedWrestler && selectedValueProfile && selectedIdentity && selectedLockerRead ? (
          <RosterSelectedStrip
            affiliations={selectedAffiliations}
            championships={selectedChampionships}
            identity={selectedIdentity}
            lockerRead={selectedLockerRead}
            onNavigate={onNavigate}
            onOpenProfile={onOpenProfile}
            pressureTags={selectedPressureTags}
            valueProfile={selectedValueProfile}
            wrestler={selectedWrestler}
          />
        ) : (
          <RosterSelectedStripEmpty />
        )}
      </section>
    </DynastyManagementShell>
  );
}
