import { FlobamaLogo } from "@/components/brand/flobama-logo";

export function ServerStationLoadingSplash({
  label = "Loading…",
}: {
  label?: string;
}) {
  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(211,107,74,0.2),_transparent_55%),linear-gradient(180deg,_#14110f_0%,_#1a1613_50%,_#100e0c_100%)] px-6 text-foreground">
      <FlobamaLogo className="h-14 w-auto max-w-[240px] brightness-110" priority />
      <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-[#e8d5c4] uppercase">Server Station</p>
      <div
        className="mt-8 size-8 animate-spin rounded-full border-2 border-[#e8d5c4]/25 border-t-[#d36b4a]"
        role="status"
        aria-live="polite"
        aria-label={label}
      />
      <p className="mt-4 text-base text-[#e8d5c4]/90">{label}</p>
    </div>
  );
}
