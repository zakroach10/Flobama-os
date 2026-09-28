"use client";

import { buttonVariants } from "@/components/ui/button";
import { LED_OBS_DMG_HREF } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ObsClientDownload({ className }: { className?: string }) {
  return (
    <a href={LED_OBS_DMG_HREF} download className={cn(buttonVariants({ variant: "outline" }), className)}>
      Download OBS client (.dmg)
    </a>
  );
}
