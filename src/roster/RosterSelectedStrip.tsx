import { SuperstarPortrait as WrestlerPortrait } from "../components/SuperstarPortrait";
import type { WrestlerAffiliation } from "../game/types";
import type { GameScreen } from "../game/migration";
import type { Championship, Wrestler } from "../game/types";
import { RosterPanel } from "./RosterPanel";
import { getWrestlerDivisionLabel, getWrestlerOverall } from "./rosterReads";
import type { WrestlerIdentitySnapshot, WrestlerLockerRoomRead, WrestlerValueProfile } from "./rosterTypes";

type Props = {
  affiliations: WrestlerAffiliation[];
  championships: Championship[];
  identity: WrestlerIdentitySnapshot;
  lockerRead: WrestlerLockerRoomRead;
  onNavigate: (screen: GameScreen) => void;
  onOpenProfile: (wrestlerId: string) => void;
  pressureTags: string[];
  valueProfile: WrestlerValueProfile;
  wrestler: Wrestler;
};

export function RosterSelectedStrip({
  affiliations,
  championships,
  identity,
  lockerRead,
  onNavigate,
  onOpenProfile,
  pressureTags,
  valueProfile,
  wrestler,
}: Props) {
  return (
    <RosterPanel className="roster-selected-strip" kicker="Selected Superstar" title={wrestler.name} badge={`OVR ${getWrestlerOverall(wrestler)}`}>
      <div className="roster-selected-strip-body">
        <WrestlerPortrait className="roster-selected-portrait" wrestler={wrestler} />
        <div className="roster-selected-summary">
          <div className="roster-selected-meta">
            <span>{wrestler.roleTier ?? "Roster"}</span>
            <span>{wrestler.archetype ?? "Utility"}</span>
            <span>{getWrestlerDivisionLabel(wrestler)}</span>
            {championships.length ? <span>{championships.map((championship) => championship.name).join(" / ")}</span> : null}
          </div>
        </div>
        <div className="roster-selected-metrics">
          <div>
            <span>POP</span>
            <strong>{wrestler.popularity}</strong>
            <b style={{ width: `${wrestler.popularity}%` }} />
          </div>
          <div>
            <span>MOR</span>
            <strong>{wrestler.morale}</strong>
            <b style={{ width: `${wrestler.morale}%` }} />
          </div>
          <div>
            <span>FAT</span>
            <strong>{wrestler.fatigue}</strong>
            <b style={{ width: `${wrestler.fatigue}%` }} />
          </div>
        </div>
        <div className={`roster-selected-read tone-${lockerRead.tone}`}>
          <span>{lockerRead.headline}</span>
          <p>{lockerRead.detail}</p>
          <small>{identity.usageRead}</small>
        </div>
        <div className="roster-selected-tags">
          <span>{valueProfile.valueTierLabel}</span>
          {pressureTags.length ? pressureTags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>) : <span>Balanced</span>}
          {affiliations.slice(0, 1).map((affiliation) => (
            <span key={affiliation.id}>{affiliation.name}</span>
          ))}
        </div>
        <div className="roster-selected-actions">
          <button className="roster-btn roster-btn-primary" onClick={() => onOpenProfile(wrestler.id)} type="button">
            View Profile
          </button>
          <button className="roster-btn roster-btn-secondary" onClick={() => onNavigate("booking")} type="button">
            Book Show
          </button>
        </div>
      </div>
    </RosterPanel>
  );
}

export function RosterSelectedStripEmpty() {
  return (
    <RosterPanel className="roster-selected-strip roster-selected-strip-empty" kicker="Locker Room" title="Select Superstar">
      <p className="roster-empty-copy">Select a superstar to open the locker room read.</p>
    </RosterPanel>
  );
}
