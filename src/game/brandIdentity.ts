import type { BrandIdentity, BrandStyle, PrototypeBrand } from "./types";

export const PLAYER_BRAND_ID = "player";

const prototypeBrandKeys: PrototypeBrand[] = ["Raw", "SmackDown", "NXT", "AEW"];

function isPrototypeBrandStyle(value: BrandStyle): value is PrototypeBrand {
  return prototypeBrandKeys.includes(value as PrototypeBrand);
}

export function createPlayerBrandIdentity(brandName: string, brandStyle: BrandStyle): BrandIdentity {
  const name = brandName.trim() || "Player Brand";

  return {
    id: PLAYER_BRAND_ID,
    ownerType: "player",
    brandKey: isPrototypeBrandStyle(brandStyle) ? brandStyle : undefined,
    name,
    style: brandStyle,
  };
}

export function createCpuBrandIdentity(id: string, brandKey: PrototypeBrand, brandName: string = brandKey): BrandIdentity {
  return {
    id,
    ownerType: "cpu",
    brandKey,
    name: brandName.trim() || brandKey,
    style: brandKey,
  };
}
