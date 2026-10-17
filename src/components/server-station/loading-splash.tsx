import { FlobamaLogo } from "@/components/brand/flobama-logo";

export function ServerStationLoadingSplash({
  label = "Loading Server Station…",
}: {
  label?: string;
}) {
  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(211,107,74,0.2),_transparent_55%),linear-gradient(180deg,_#14110f_0%,_#1a1613_50%,_#100e0c_100%)] px-6 text-foreground">
      <FlobamaLogo className="h-14 w-auto max-w-[240px] brightness-110" priority />
      <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-[#e8d5c4] uppercase">Server Station</p>
      <div
        className="mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-white/10"
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#d36b4a]" />
      </div>
      <p className="mt-4 text-base text-[#e8d5c4]/90">{label}</p>
    </div>
  );
}
