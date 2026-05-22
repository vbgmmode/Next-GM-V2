import { TickerBar } from "@components/broadcast";

type LowerThirdProps = {
  label: string;
  headline: string;
  detail?: string;
};

export function LowerThird({ label, headline, detail }: LowerThirdProps) {
  return (
    <div className="ld-lower-third" aria-live="polite">
      <span className="ld-lower-third__label">{label}</span>
      <strong className="ld-lower-third__headline">{headline}</strong>
      {detail ? <span className="ld-lower-third__detail">{detail}</span> : null}
    </div>
  );
}

type CommandFeedProps = {
  items: string[];
};

export function CommandFeed({ items }: CommandFeedProps) {
  return <TickerBar label="Command Feed" items={items} className="ld-command-feed" />;
}
