import { useEffect, useState } from "react";
import type { Wrestler } from "../game/types";
import { getWrestlerPortraitSrc } from "../game/wrestlerPortraits";

function getWrestlerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SuperstarPortrait({
  className,
  decorative = true,
  label,
  wrestler,
}: {
  className?: string;
  decorative?: boolean;
  label?: string;
  wrestler: Pick<Wrestler, "id" | "name">;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const portraitSrc = imageFailed ? undefined : getWrestlerPortraitSrc(wrestler.id);
  const classes = [className, "superstar-portrait", "wrestler-portrait", portraitSrc ? "has-portrait" : "missing-portrait"].filter(Boolean).join(" ");

  useEffect(() => {
    setImageFailed(false);
  }, [wrestler.id]);

  return (
    <span aria-hidden={decorative ? "true" : undefined} aria-label={decorative ? undefined : label ?? `${wrestler.name} portrait`} className={classes} role={decorative ? undefined : "img"}>
      {portraitSrc ? (
        <img alt="" draggable={false} onError={() => setImageFailed(true)} src={portraitSrc} />
      ) : (
        <span>{getWrestlerInitials(wrestler.name)}</span>
      )}
    </span>
  );
}
