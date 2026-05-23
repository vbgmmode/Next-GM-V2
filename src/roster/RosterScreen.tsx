import { useMemo, useState } from "react";
import { DynastyManagementShell, type DynastyManagementCta } from "../components/DynastyManagementShell";
import { getRosterAffiliations } from "../game/affiliationCatalog";
import { getRosterPressureTags, getTopOverusedWrestler, getTopUnderusedWrestler } from "../game/rosterContextReads";
import { LockerRoomPulsePanel } from "./LockerRoomPulsePanel";
import { RosterPanel } from "./RosterPanel";
import { RosterSelectedStrip, RosterSelectedStripEmpty } from "./RosterSelectedStrip";
import {
  getRosterFilterLabel,
  getRosterFilterMatch,
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
  const selectedWrestler = visibleWrestlers.find((wrestler) => wrestler.id === selectedWrestlerId) ?? visibleWrestlers[0] ?? game.wrestlers[0];
  const selectedPressureTags = selectedWrestler ? getRosterPressureTags(selectedWrestler, game.currentWeek) : [];
  const selectedValueProfile = selectedWrestler ? getWrestlerValueProfile(selectedWrestler) : undefined;
  const selectedIdentity = selectedWrestler ? getWrestlerIdentitySnapshot(selectedWrestler, game) : undefined;
  const selectedLockerRead = selectedWrestler ? getWrestlerLockerRoomRead(selectedWrestler, game) : undefined;
  const selectedChampionships = selectedWrestler ? getWrestlerChampionships(selectedWrestler.id, game.championships) : [];
  const selectedAffiliations = selectedWrestler ? rosterAffiliations.filter((affiliation) => affiliation.memberWrestlerIds.includes(selectedWrestler.id)) : [];
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
          <LockerRoomPulsePanel game={game} />
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
