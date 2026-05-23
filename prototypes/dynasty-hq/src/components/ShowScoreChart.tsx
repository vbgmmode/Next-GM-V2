type ChartPoint = {
  label: string;
  value: number;
};

type Props = {
  points: ChartPoint[];
};

export function ShowScoreChart({ points }: Props) {
  if (!points.length) {
    return (
      <svg className="metrics-chart metrics-chart--empty" viewBox="0 0 280 92" role="img" aria-label="No show history yet">
        <text className="chart-label" x="140" y="48" textAnchor="middle">
          No resolved shows
        </text>
      </svg>
    );
  }

  const width = 280;
  const height = 92;
  const padX = 16;
  const padTop = 18;
  const padBottom = 18;
  const plotHeight = height - padTop - padBottom;
  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const range = Math.max(maxValue - minValue, 1);

  const coords = points.map((point, index) => {
    const x = padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const y = padTop + (1 - (point.value - minValue) / range) * plotHeight;
    return { x, y, label: point.label };
  });

  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");

  return (
    <svg className="metrics-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent show score trend">
      <defs>
        <linearGradient id="dynastyChartGlow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#701015" />
          <stop offset="100%" stopColor="#ff2b2b" />
        </linearGradient>
      </defs>
      <path className="chart-grid" d={`M12 18H270M12 46H270M12 74H270`} />
      <path className="chart-line-shadow" d={linePath} />
      <path className="chart-line" d={linePath} />
      {coords.map((point) => (
        <circle className="chart-node" cx={point.x} cy={point.y} r="3.8" key={point.label} />
      ))}
      {coords.map((point) => (
        <text className="chart-label" x={point.x} y="89" key={`${point.label}-label`} textAnchor="middle">
          {point.label}
        </text>
      ))}
    </svg>
  );
}
