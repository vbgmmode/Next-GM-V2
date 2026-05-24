import { describe, expect, it } from "vitest";
import { affiliationCatalog } from "./affiliationCatalog";

function expectAffiliationMembers(name: string, expectedMemberIds: string[]) {
  const affiliation = affiliationCatalog.find((item) => item.name === name);

  expect(affiliation).toBeDefined();
  expect(affiliation?.memberWrestlerIds.sort()).toEqual([...expectedMemberIds].sort());
}

describe("affiliationCatalog", () => {
  it("includes complete tag and faction groups found in the current Top 200 draft pool", () => {
    expectAffiliationMembers("Damage CTRL", ["wwe-raw-asuka", "wwe-raw-iyo-sky"]);
    expectAffiliationMembers("The Street Profits", ["wwe-raw-angelo-dawkins", "wwe-raw-montez-ford"]);
    expectAffiliationMembers("The Usos", ["wwe-raw-jey-uso", "wwe-raw-jimmy-uso"]);
    expectAffiliationMembers("DIY", ["aew-aew-tommaso-ciampa", "wwe-smackdown-johnny-gargano"]);
    expectAffiliationMembers("Hank and Tank", ["wwe-nxt-hank-walker", "wwe-nxt-tank-ledger"]);
    expectAffiliationMembers("The Judgment Day", [
      "wwe-raw-dominik-mysterio",
      "wwe-raw-finn-b-lor",
      "wwe-raw-jd-mcdonagh",
      "wwe-raw-liv-morgan",
      "wwe-raw-raquel-rodriguez",
      "wwe-raw-roxanne-perez",
    ]);
  });
});
