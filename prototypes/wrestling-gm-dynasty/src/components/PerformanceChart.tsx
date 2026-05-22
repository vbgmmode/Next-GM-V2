export function PerformanceChart() {
  return (
    <svg className="metrics-chart" viewBox="0 0 280 92" role="img" aria-label="Weekly viewership trend from week 20 to week 24">
      <defs>
        <linearGradient id="chartGlow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#701015" />
          <stop offset="100%" stopColor="#ff2b2b" />
        </linearGradient>
      </defs>
      <path className="chart-grid" d="M12 18H270M12 46H270M12 74H270" />
      <path className="chart-line-shadow" d="M16 68L78 57L140 61L202 35L264 24" />
      <path className="chart-line" d="M16 68L78 57L140 61L202 35L264 24" />
      {[16, 78, 140, 202, 264].map((x, index) => (
        <circle className="chart-node" cx={x} cy={[68, 57, 61, 35, 24][index]} r="3.8" key={x} />
      ))}
      {["W20", "W21", "W22", "W23", "W24"].map((label, index) => (
        <text className="chart-label" x={[16, 78, 140, 202, 264][index]} y="89" key={label}>
          {label}
        </text>
      ))}
    </svg>
  );
}
