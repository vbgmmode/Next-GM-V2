import { mockCareerSaves } from "../fixtures/playthrough";

type Props = {
  onNewCareer: () => void;
  onContinue: () => void;
};

export function TitleScene({ onNewCareer, onContinue }: Props) {
  const hasSaves = mockCareerSaves.length > 0;

  return (
    <main className="dynasty-title-screen">
      <section className="dynasty-title-grid">
        <article className="panel dynasty-title-copy">
          <div className="panel-kicker">Offline GM Command Center</div>
          <h1>Next GM</h1>
          <p>Enter the brand headquarters, book the card, run the show, and carry the locker room fallout into next week.</p>
          <div className="dynasty-title-strip">
            <span>{mockCareerSaves.length}/5 Careers</span>
            <span>Offline Career Mode</span>
            <span>Prototype Playthrough</span>
          </div>
          <div className="action-row dynasty-title-actions">
            {hasSaves ? (
              <button type="button" onClick={onContinue}>
                Continue Career
              </button>
            ) : null}
            <button className="primary-action" type="button" onClick={onNewCareer}>
              New Career
            </button>
          </div>
        </article>

        <aside className="panel dynasty-title-sidebar">
          <div className="panel-kicker">Career Deck</div>
          <div className="section-heading">
            <span>Load Careers</span>
            <b>{mockCareerSaves.length} Saves</b>
          </div>
          <div className="dynasty-scroll-list dynasty-save-list">
            {mockCareerSaves.map((save) => (
              <div className="dynasty-save-row" key={save.id}>
                <strong>{save.brandName}</strong>
                <span>
                  GM {save.gmName} · S{save.season} W{save.week}
                </span>
              </div>
            ))}
          </div>
          <p className="dynasty-empty-copy">Visual prototype — saves are mock data only.</p>
        </aside>
      </section>
    </main>
  );
}
