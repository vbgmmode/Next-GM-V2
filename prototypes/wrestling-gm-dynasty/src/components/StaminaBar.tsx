type Props = {
  value: number;
};

export function StaminaBar({ value }: Props) {
  return (
    <div className="stamina-track" aria-label={`Stamina ${value}`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
