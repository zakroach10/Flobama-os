"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  LOCAL_RUNNER_DMG_FILENAME,
  LOCAL_RUNNER_DMG_HREF,
  LOCAL_RUNNER_VERSION,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LocalRunnerDownload({ className }: { className?: string }) {
  return (
    <a
      href={LOCAL_RUNNER_DMG_HREF}
      download={LOCAL_RUNNER_DMG_FILENAME}
      className={cn(buttonVariants({ variant: "default" }), className)}
    >
      Download Local Runner {LOCAL_RUNNER_VERSION} (.dmg)
    </a>
  );
}
