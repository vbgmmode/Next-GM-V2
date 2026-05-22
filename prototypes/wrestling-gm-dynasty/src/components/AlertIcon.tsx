import type { Alert } from "../data/mockDashboard";

type Props = {
  alert: Alert;
};

const icons: Record<Alert["icon"], string> = {
  injury: "⚠",
  contract: "📅",
  scout: "🔍",
  power: "★",
};

export function AlertIcon({ alert }: Props) {
  return (
    <div className={`alert-row alert-${alert.tone}`}>
      <span aria-hidden="true">{icons[alert.icon]}</span>
      <strong>{alert.message}</strong>
    </div>
  );
}
