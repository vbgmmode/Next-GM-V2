import type { Wrestler } from "./types";

const titleCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const normalize = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim();
  return cleaned ? cleaned : undefined;
}

function getRoleLabel(roleTier: unknown, role: unknown) {
  const normalizedRole = normalize(role);
  if (normalizedRole) {
    return normalizedRole;
  }

  const normalizedRoleTier = normalize(roleTier);
  if (!normalizedRoleTier) {
    return "Open Role";
  }

  return titleCase(normalizedRoleTier);
}

function getCareerStageLabel(roleTier: unknown): string {
  const normalized = normalize(roleTier)?.toLowerCase();
  if (normalized === "mainevent") {
    return "Core Division Anchor";
  }

  if (normalized === "uppercard") {
    return "Established Main Eventer";
  }

  if (normalized === "midcard") {
    return "Midcard Workhorse";
  }

  if (normalized === "prospect") {
    return "High-Potential Prospect";
  }

  if (normalized === "enhancement") {
    return "Role-Player";
  }

  return "Established Talent";
}

type WrestlerIdentityContext = {
  role: string;
  wrestlingStyle: string;
  promoStyle: string;
  presentationHook: string;
  careerStageLabel: string;
};

function getWrestlingStyle(archetype: unknown, ringSkill: unknown) {
  const normalized = normalize(archetype)?.toLowerCase();
  if (normalized?.includes("technician")) {
    return "Technical";
  }

  if (normalized?.includes("showman")) {
    return "Showmanship";
  }

  if (normalized?.includes("powerhouse")) {
    return "Powerhouse";
  }

  if (normalized?.includes("brawler")) {
    return "Brawler";
  }

  if (normalized?.includes("hybrid")) {
    return "Hybrid";
  }

  const ringSkillValue = typeof ringSkill === "number" ? ringSkill : 0;

  if (ringSkillValue >= 95) {
    return "Elite Technician";
  }

  if (ringSkillValue >= 85) {
    return "Well-Rounded";
  }

  return "All-Around";
}

function getPromoStyle(alignment: unknown, promoSkill: unknown, promoStyle: unknown) {
  const normalized = normalize(promoStyle);
  if (normalized) {
    return normalized;
  }

  const normalizedAlignment = normalize(alignment)?.toLowerCase();
  if (normalizedAlignment === "face") {
    return "Promo Connector";
  }

  if (normalizedAlignment === "heel") {
    return "Promo Provocateur";
  }

  const promoSkillValue = typeof promoSkill === "number" ? promoSkill : 0;

  if (promoSkillValue >= 90) {
    return "Mic Architect";
  }

  if (promoSkillValue >= 75) {
    return "Promo Engine";
  }

  return "Steady Mic";
}

function getPresentationHook(roleLabel: string, wrestlingStyle: string, careerStageLabel: string, promotion?: string) {
  const promotionLabel = normalize(promotion) ?? "Open card";
  return `${roleLabel} in a ${wrestlingStyle.toLowerCase()} lane, framed by ${careerStageLabel.toLowerCase()} momentum from ${promotionLabel}.`;
}

function getIdentityContext(wrestler: Partial<Wrestler>): WrestlerIdentityContext {
  const role = getRoleLabel(wrestler.roleTier, wrestler.role);
  const wrestlingStyle = getWrestlingStyle(wrestler.archetype, wrestler.ringSkill);
  const promoStyle = getPromoStyle(wrestler.alignment, wrestler.promoSkill, wrestler.promoStyle);
  const careerStageLabel = getCareerStageLabel(wrestler.roleTier);
  const presentationHook = getPresentationHook(role, wrestlingStyle, careerStageLabel, wrestler.sourceBrand);

  return {
    role,
    wrestlingStyle,
    promoStyle,
    presentationHook,
    careerStageLabel,
  };
}

export function enrichWrestlerIdentityContext<T extends Partial<Wrestler>>(wrestler: T): T & WrestlerIdentityContext {
  const identityContext = getIdentityContext(wrestler);

  return {
    ...wrestler,
    role: identityContext.role,
    wrestlingStyle: identityContext.wrestlingStyle,
    promoStyle: identityContext.promoStyle,
    presentationHook: identityContext.presentationHook,
    careerStageLabel: identityContext.careerStageLabel,
  };
}

export function getWrestlerIdentityContext(wrestler: Wrestler) {
  return getIdentityContext(wrestler);
}
