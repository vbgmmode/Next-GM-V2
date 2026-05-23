import type { PlaythroughPhase } from "../fixtures/playthrough";
import { playthroughPhases } from "../fixtures/playthrough";

type Props = {
  phase: PlaythroughPhase;
  onPhaseChange: (phase: PlaythroughPhase) => void;
  onNextStep: () => void;
  toast?: string | null;
};

export function PlaythroughBar({ phase, onPhaseChange, onNextStep, toast }: Props) {
  const current = playthroughPhases.find((item) => item.id === phase) ?? playthroughPhases[0];
  const phaseIndex = playthroughPhases.findIndex((item) => item.id === phase);
  const isLast = phaseIndex >= playthroughPhases.length - 1;

  return (
    <>
      <header className="dynasty-prototype-bar dynasty-playthrough-bar">
        <span className="dynasty-prototype-label">Dynasty Full UI</span>
        <label>
          Playthrough
          <select value={phase} onChange={(event) => onPhaseChange(event.target.value as PlaythroughPhase)}>
            {playthroughPhases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p>{current.description}</p>
        <button className="dynasty-playthrough-next" type="button" onClick={onNextStep} disabled={isLast}>
          {isLast ? "Playthrough Complete" : "Next Step"}
        </button>
        <small>Compare :5183 vs Brand HQ :5174 · Dashboard ref :5182</small>
      </header>
      {toast ? (
        <div className="dynasty-prototype-toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}
