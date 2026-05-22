type Props = {
  value: number;
};

export function IntensityMeter({ value }: Props) {
  const activeBlocks = Math.round(value / 10);

  return (
    <div className="led-meter" aria-label={`Intensity ${value}`}>
      {Array.from({ length: 10 }, (_, index) => (
        <span className={index < activeBlocks ? "is-hot" : ""} key={index} />
      ))}
    </div>
  );
}
