import { useEffect, useMemo, useState } from "react";
import { getRosterPressureTags } from "@game/rosterContextReads";
import { getLivingWorldPressureSnapshot } from "@game/gameContextReads";
import { getCurrentCalendarWeek, isValidSegment } from "@game/scoring";
import type { LiveDeskFixtureId, LiveDeskScene } from "./fixtures";
import { getFixture, liveDeskFixtures } from "./fixtures";
import { brandInitials } from "./fixtures/shared";
import { BrandHQScene } from "./scenes/BrandHQScene";
import { BroadcastRecapScene } from "./scenes/BroadcastRecapScene";
import { RundownScene } from "./scenes/RundownScene";
import { WeekReviewStrip } from "./scenes/WeekReviewStrip";
import { BroadcastHud } from "./shell/BroadcastHud";
import { BroadcastNav } from "./shell/BroadcastNav";
import { BroadcastShell } from "./shell/BroadcastShell";
import { CommandFeed, LowerThird } from "./shell/LowerThird";
import { getWeekPhase } from "./utils/calendar";

export function LiveDeskApp() {
  const [fixtureId, setFixtureId] = useState<LiveDeskFixtureId>("week-pressure");
  const fixture = useMemo(() => getFixture(fixtureId), [fixtureId]);
  const [scene, setScene] = useState<LiveDeskScene>(fixture.defaultScene);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | undefined>(fixture.game.currentShow[0]?.id);
  const [hudExpanded, setHudExpanded] = useState(false);
  const [lowerThird, setLowerThird] = useState({
    label: "Brand HQ",
    headline: "Tonight's desk",
    detail: "Open Production Rundown when the card is ready.",
  });

  const game = fixture.game;
  const result = fixture.result;
  const currentShow = getCurrentCalendarWeek(game);
  const weekPhase = getWeekPhase(currentShow);
  const validCount = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers)).length;
  const livingWorld = getLivingWorldPressureSnapshot(game, result);
  const rosterTags = game.wrestlers.flatMap((wrestler) => getRosterPressureTags(wrestler, game.currentWeek));
  const rosterHealthRead =
    rosterTags.filter((tag) => tag === "Unavailable").length > 0
      ? `${rosterTags.filter((tag) => tag === "Unavailable").length} out`
      : rosterTags.filter((tag) => tag === "Morale Risk" || tag === "Injury Risk").length > 0
        ? `${rosterTags.filter((tag) => tag === "Morale Risk" || tag === "Injury Risk").length} watch`
        : "Stable";
  const titleSceneRead = livingWorld.items.find((item) => item.id === "creative-room")?.value ?? "Scene steady";
  const urgentStatus =
    result && scene === "recap"
      ? "Fallout On Desk"
      : validCount >= 2
        ? "Card Runnable"
        : validCount > 0
          ? "Card Needs Fixes"
          : "Booking Desk Open";

  const showTicker = scene === "rundown" || scene === "recap";

  const tickerItems = useMemo(() => {
    if (result) {
      return [
        `${result.showName} closed at ${result.totalScore}`,
        result.titleNotes[0] ?? "Title desk quiet",
        result.rivalryNotes[0] ?? "Story desk steady",
      ];
    }
    return livingWorld.items.slice(0, 2).map((item) => `${item.voice}: ${item.value}`);
  }, [livingWorld.items, result]);

  useEffect(() => {
    if (scene === "brand-hq") {
      setLowerThird({
        label: "Brand HQ",
        headline: livingWorld.headline,
        detail: livingWorld.nextAction,
      });
    }
  }, [scene, livingWorld.headline, livingWorld.nextAction]);

  function handleFixtureChange(nextId: LiveDeskFixtureId) {
    const nextFixture = getFixture(nextId);
    setFixtureId(nextId);
    setScene(nextFixture.defaultScene);
    setSelectedSegmentId(nextFixture.game.currentShow[0]?.id);
    setHudExpanded(false);
    setLowerThird({
      label: "Fixture",
      headline: nextFixture.label,
      detail: nextFixture.description,
    });
  }

  function handleSelectSegment(segmentId: string) {
    setSelectedSegmentId(segmentId);
    const segment = game.currentShow.find((item) => item.id === segmentId);
    if (!segment) return;
    const names = segment.participantIds
      .map((id) => game.wrestlers.find((wrestler) => wrestler.id === id)?.name ?? "TBD")
      .join(" vs ");
    const validSegments = game.currentShow.filter((item) => isValidSegment(item, game.wrestlers)).length;
    setLowerThird({
      label: `Slot ${game.currentShow.findIndex((item) => item.id === segmentId) + 1}`,
      headline: `${segment.type} · ${names || "Unassigned"}`,
      detail: `${validSegments}/${game.currentShow.length} valid · ${currentShow.showName}`,
    });
  }

  function renderScene() {
    if (scene === "brand-hq") {
      return (
        <BrandHQScene
          game={game}
          result={result}
          onOpenRundown={() => {
            setScene("rundown");
            const validSegments = game.currentShow.filter((segment) => isValidSegment(segment, game.wrestlers)).length;
            setLowerThird({
              label: "Production",
              headline: currentShow.showName,
              detail: `${validSegments}/${game.currentShow.length} valid · ${livingWorld.nextAction}`,
            });
          }}
        />
      );
    }

    if (scene === "rundown") {
      return (
        <RundownScene
          game={game}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={handleSelectSegment}
          onRunShow={() => {
            if (fixture.result) {
              setScene("recap");
              setLowerThird({
                label: "Broadcast",
                headline: `${fixture.result.totalScore} · ${fixture.result.showName}`,
                detail: "Resolved post-show package",
              });
            }
          }}
        />
      );
    }

    if (scene === "recap" && result) {
      return (
        <BroadcastRecapScene
          game={game}
          result={result}
          onContinueWeekReview={() => {
            setScene("week-review");
            setLowerThird({ label: "GM Office", headline: "Week review handoff", detail: "Review fallout before advancing the calendar." });
          }}
        />
      );
    }

    if (scene === "week-review" && result) {
      return (
        <WeekReviewStrip
          game={game}
          result={result}
          onReturnToBrandHQ={() => {
            setScene("brand-hq");
            setLowerThird({ label: "Brand HQ", headline: livingWorld.headline, detail: livingWorld.nextAction });
          }}
        />
      );
    }

    return (
      <div className="ld-empty-scene">
        <p>This scene needs the Post-Show Fallout fixture.</p>
        <button type="button" className="ld-primary" onClick={() => handleFixtureChange("post-show-fallout")}>
          Load Post-Show Fallout
        </button>
      </div>
    );
  }

  return (
    <BroadcastShell
      brandStyle={game.brandStyle}
      weekPhase={weekPhase}
      prototypeControls={
        <>
          <span className="ld-prototype-label">Prototype</span>
          <label>
            Fixture
            <select value={fixtureId} onChange={(event) => handleFixtureChange(event.target.value as LiveDeskFixtureId)}>
              {liveDeskFixtures.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scene
            <select
              value={scene}
              onChange={(event) => {
                const nextScene = event.target.value as LiveDeskScene;
                setScene(nextScene);
              }}
            >
              <option value="brand-hq">Brand HQ</option>
              <option value="rundown">Production Rundown</option>
              <option value="recap" disabled={!result}>
                Post-Show Package
              </option>
              <option value="week-review" disabled={!result}>
                Week Review Strip
              </option>
            </select>
          </label>
        </>
      }
      nav={
        <BroadcastNav
          activeScene={scene}
          hasResults={Boolean(result)}
          cardNeedsAttention={validCount < 2 && scene !== "recap" && scene !== "week-review"}
          onNavigate={(nextScene) => setScene(nextScene)}
          brandInitials={brandInitials(game.brandName)}
        />
      }
      hud={
        <BroadcastHud
          game={game}
          result={result}
          urgentStatus={urgentStatus}
          cardValidCount={validCount}
          expanded={hudExpanded}
          onToggleExpand={() => setHudExpanded((open) => !open)}
          rosterHealthRead={rosterHealthRead}
          titleSceneRead={titleSceneRead}
        />
      }
      ticker={showTicker ? <CommandFeed items={tickerItems} /> : null}
      lowerThird={<LowerThird label={lowerThird.label} headline={lowerThird.headline} detail={lowerThird.detail} />}
    >
      {renderScene()}
    </BroadcastShell>
  );
}
