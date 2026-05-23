import type { DraftMode } from "./types";

export type DraftOrderBrand = {
  id: string;
  brandName: string;
  lotteryWeight?: number;
};

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000007;
  }

  return hash;
}

function deterministicShuffle<T>(items: T[], seed: string) {
  return [...items].sort((left, right) => {
    const leftKey = typeof left === "object" && left && "id" in left ? String((left as { id: string }).id) : String(left);
    const rightKey = typeof right === "object" && right && "id" in right ? String((right as { id: string }).id) : String(right);

    return hashString(`${seed}-${leftKey}`) - hashString(`${seed}-${rightKey}`);
  });
}

function getLotteryBaseOrder(brands: DraftOrderBrand[], seed: string) {
  return [...brands].sort((left, right) => {
    const leftWeight = Math.max(1, left.lotteryWeight ?? 1);
    const rightWeight = Math.max(1, right.lotteryWeight ?? 1);
    const leftScore = hashString(`${seed}-${left.id}-lottery`) / leftWeight;
    const rightScore = hashString(`${seed}-${right.id}-lottery`) / rightWeight;

    return leftScore - rightScore;
  });
}

export function getDraftRoundOrder(
  mode: DraftMode,
  brands: DraftOrderBrand[],
  roundIndex: number,
  seed: string,
): DraftOrderBrand[] {
  if (!brands.length) {
    return [];
  }

  if (mode === "linear") {
    return brands;
  }

  if (mode === "snake") {
    return roundIndex % 2 === 0 ? brands : [...brands].reverse();
  }

  if (mode === "random") {
    return deterministicShuffle(brands, `${seed}-round-${roundIndex}`);
  }

  return getLotteryBaseOrder(brands, `${seed}-lottery-base`);
}

export function getDraftModeLabel(mode: DraftMode) {
  switch (mode) {
    case "snake":
      return "Snake Draft";
    case "linear":
      return "Linear Draft";
    case "random":
      return "Randomized Each Round";
    case "lottery":
      return "Weighted Lottery";
  }
}
