export function formatDuration(sec: number): string {
  return (Math.round(sec * 10) / 10).toFixed(1)
}
