import { useState } from "react";
import { draftPool, defaultCareer } from "@game/seed";
import { DynastyPanel, DynastyPrimaryAction, DynastyScrollList, DynastySectionHeading } from "../components/DynastyPanel";
import { DynastyPortrait } from "../components/DynastyPortrait";

export type SetupStep = "contract" | "gm" | "brand" | "rules" | "draft";

const steps: Array<{ id: SetupStep; label: string }> = [
  { id: "contract", label: "Contract" },
  { id: "gm", label: "GM Profile" },
  { id: "brand", label: "Brand Identity" },
  { id: "rules", label: "Rules" },
  { id: "draft", label: "Draft" },
];

type Props = {
  onComplete: () => void;
  onCancel: () => void;
};

export function SetupScene({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<SetupStep>("contract");
  const [gmName, setGmName] = useState(defaultCareer.gmName);
  const [brandName, setBrandName] = useState(defaultCareer.brandName);
  const draftPicks = draftPool.slice(0, 8);
  const stepIndex = steps.findIndex((item) => item.id === step);

  function goNext() {
    if (stepIndex >= steps.length - 1) {
      onComplete();
      return;
    }
    setStep(steps[stepIndex + 1].id);
  }

  return (
    <main className="dynasty-setup-screen">
      <section className="dynasty-setup-grid">
        <nav className="panel dynasty-setup-rail" aria-label="Setup steps">
          <div className="panel-kicker">New Career</div>
          {steps.map((item, index) => (
            <button
              className={item.id === step ? "dynasty-setup-step is-active" : "dynasty-setup-step"}
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>

        <article className="panel dynasty-setup-main">
          {step === "contract" ? (
            <>
              <DynastySectionHeading title="Sign Your Contract" badge="Step 1" />
              <p className="dynasty-copy">Welcome to the GM office. Your campaign starts with the contract on the desk.</p>
              <label className="dynasty-field">
                GM Name
                <input value={gmName} onChange={(event) => setGmName(event.target.value)} />
              </label>
            </>
          ) : null}
          {step === "gm" ? (
            <>
              <DynastySectionHeading title="GM Style" badge="Step 2" />
              <p className="dynasty-copy">Choose how the locker room reads your leadership voice.</p>
              <div className="dynasty-chip-row">
                {["Balanced", "Aggressive", "Story-First"].map((style) => (
                  <span className="filter-chip is-active" key={style}>
                    {style}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {step === "brand" ? (
            <>
              <DynastySectionHeading title="Brand Identity" badge="Step 3" />
              <label className="dynasty-field">
                Brand Name
                <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
              </label>
              <div className="dynasty-chip-row">
                {["Raw", "SmackDown", "NXT"].map((style) => (
                  <span className={style === "Raw" ? "filter-chip is-active" : "filter-chip"} key={style}>
                    {style}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          {step === "rules" ? (
            <>
              <DynastySectionHeading title="Season Rules" badge="Step 4" />
              <div className="mini-stat-grid">
                <div>
                  <span>Difficulty</span>
                  <strong>Medium</strong>
                </div>
                <div>
                  <span>Starting Budget</span>
                  <strong>$2M</strong>
                </div>
                <div>
                  <span>Rival GMs</span>
                  <strong>3 Brands</strong>
                </div>
              </div>
            </>
          ) : null}
          {step === "draft" ? (
            <>
              <DynastySectionHeading title="Opening Draft" badge="Step 5" />
              <p className="dynasty-copy">Mock draft board — {draftPicks.length} picks locked for prototype preview.</p>
              <DynastyScrollList className="dynasty-draft-board">
                {draftPicks.map((wrestler, index) => (
                  <div className="dynasty-draft-row" key={wrestler.id}>
                    <span>{index + 1}</span>
                    <DynastyPortrait wrestler={wrestler} size="sm" />
                    <strong>{wrestler.name}</strong>
                    <em>{wrestler.archetype ?? wrestler.wrestlingStyle}</em>
                  </div>
                ))}
              </DynastyScrollList>
            </>
          ) : null}

          <DynastyPrimaryAction
            actions={[
              { label: "Back", onClick: stepIndex === 0 ? onCancel : () => setStep(steps[Math.max(0, stepIndex - 1)].id) },
              { label: step === "draft" ? "Sign Contract" : "Next", primary: true, onClick: goNext },
            ]}
          />
        </article>

        <DynastyPanel kicker="Draft Focus" title="Prospect Spotlight" badge="Board Leader">
          <DynastyPortrait wrestler={draftPicks[0]} size="lg" />
          <strong className="dynasty-focus-name">{draftPicks[0]?.name}</strong>
          <p className="dynasty-copy">{draftPicks[0]?.wrestlingStyle ?? "All-Around"} · Pop {draftPicks[0]?.popularity}</p>
        </DynastyPanel>
      </section>
    </main>
  );
}
