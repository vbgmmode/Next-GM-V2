import type { Role } from "../data/mockDashboard";

type Props = {
  role: Role;
};

export function RoleIcon({ role }: Props) {
  const label = {
    ace: "Ace",
    main: "Main",
    upper: "Upper",
    mid: "Mid",
    prospect: "Prospect",
    tag: "Tag",
  }[role];

  return (
    <span className={`role-icon role-icon--${role}`} aria-label={label} title={label}>
      {role === "ace" && "★"}
      {role === "main" && "◆"}
      {role === "upper" && "▲"}
      {role === "mid" && "●"}
      {role === "prospect" && "○"}
      {role === "tag" && "⬡"}
    </span>
  );
}
