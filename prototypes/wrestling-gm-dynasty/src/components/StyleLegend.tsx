import { styleLegend } from "../data/mockDashboard";

export function StyleLegend() {
  return (
    <div className="style-legend" aria-label="Wrestler style legend">
      {styleLegend.map((style) => (
        <span className="style-legend-item" key={style}>
          <i className="style-dot" />
          {style}
        </span>
      ))}
      <span className="roster-size-tag">Roster Size 48 / 60</span>
    </div>
  );
}
