type Props = {
  current: number;
  total: number;
  complete?: boolean;
};

export function ProgressBar({ current, total, complete }: Props) {
  const pct = complete ? 100 : Math.round((current / total) * 100);

  return (
    <div className="goal-progress" aria-hidden="true">
      <span className={complete ? "goal-progress-fill is-complete" : "goal-progress-fill"} style={{ width: `${pct}%` }} />
    </div>
  );
}
