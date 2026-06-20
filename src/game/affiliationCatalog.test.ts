import { describe, expect, it } from "vitest";
import { affiliationCatalog } from "./affiliationCatalog";

function expectAffiliationMembers(name: string, expectedMemberIds: string[]) {
  const affiliation = affiliationCatalog.find((item) => item.name === name);

  expect(affiliation).toBeDefined();
  expect(affiliation?.memberWrestlerIds.sort()).toEqual([...expectedMemberIds].sort());
}

describe("affiliationCatalog", () => {
  it("includes complete tag and faction groups found in the current Top 200 draft pool", () => {
    expectAffiliationMembers("Alpha Academy", ["wwe-raw-akira-tozawa", "wwe-raw-maxxine-dupri", "wwe-raw-otis"]);
    expectAffiliationMembers("American Made", [
      "wwe-raw-brutus-creed",
      "wwe-raw-ivy-nile",
      "wwe-raw-julius-creed",
      "wwe-raw-original-el-grande-americano",
    ]);
    expectAffiliationMembers("FTR", ["aew-aew-cash-wheeler", "aew-aew-dax-harwood"]);
    expectAffiliationMembers("The Don Callis Family", [
      "aew-aew-jake-doyle",
      "aew-aew-josh-alexander",
      "aew-aew-kazuchika-okada",
      "aew-aew-konosuke-takeshita",
      "aew-aew-kyle-fletcher",
      "aew-aew-mark-davis",
    ]);
    expectAffiliationMembers("The War Raiders", ["wwe-raw-erik", "wwe-raw-ivar"]);
    expectAffiliationMembers("The Young Bucks", ["aew-aew-matt-jackson", "aew-aew-nick-jackson"]);
  });
});
