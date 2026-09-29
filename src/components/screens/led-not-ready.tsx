export function LedNotReady({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return <p className="text-sm font-medium text-amber-800">LED not ready · {names.join(", ")}</p>;
}
