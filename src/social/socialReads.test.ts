import { describe, expect, it } from "vitest";
import { getSocialAuthorAvatarSrc } from "./socialReads";

describe("social author avatars", () => {
  it("uses fixed avatar assignments for built-in timeline accounts", () => {
    expect(getSocialAuthorAvatarSrc("@ClipMachine")).toBe("/social-avatars/social-avatar-010.png");
    expect(getSocialAuthorAvatarSrc("Gorilla Position Analytics")).toBe("/social-avatars/social-avatar-054.png");
  });

  it("uses a stable exported avatar for generated authors", () => {
    const first = getSocialAuthorAvatarSrc("Dirt Sheet Dispatch");
    const second = getSocialAuthorAvatarSrc("Dirt Sheet Dispatch");

    expect(first).toBe(second);
    expect(first).toMatch(/^\/social-avatars\/social-avatar-\d{3}\.png$/);
  });
});
