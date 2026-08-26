export function generateOrderNumber(date: Date, sequence: number): string {
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(3, "0");
  return `SDK${y}${m}${d}${seq}`;
}
