const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export function formatNumber(value: number) {
  return integerFormatter.format(value);
}

export function formatAttendance(value: number) {
  return formatNumber(value);
}

export function formatMoney(amount: number) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${formatNumber(Math.abs(amount))}`;
}
