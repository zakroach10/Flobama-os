import { FLOBAMA_LOGO_ALT, FLOBAMA_LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function FlobamaLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={FLOBAMA_LOGO_SRC}
      alt={FLOBAMA_LOGO_ALT}
      className={cn("h-auto w-full select-none", className)}
      draggable={false}
      {...(priority ? { fetchPriority: "high" as const } : {})}
    />
  );
}
