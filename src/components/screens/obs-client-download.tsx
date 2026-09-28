"use client";

import { buttonVariants } from "@/components/ui/button";
import { LED_OBS_CLIENT_VERSION, LED_OBS_DMG_FILENAME, LED_OBS_DMG_HREF } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ObsClientDownload({ className }: { className?: string }) {
  return (
    <a
      href={LED_OBS_DMG_HREF}
      download={LED_OBS_DMG_FILENAME}
      className={cn(buttonVariants({ variant: "outline" }), className)}
    >
      Download OBS client {LED_OBS_CLIENT_VERSION} (.dmg)
    </a>
  );
}
