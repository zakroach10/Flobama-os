"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  CAMERA_CONNECTOR_DMG_FILENAME,
  CAMERA_CONNECTOR_DMG_HREF,
  CAMERA_CONNECTOR_VERSION,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export function MacCameraDownload({ className }: { className?: string }) {
  return (
    <a
      href={CAMERA_CONNECTOR_DMG_HREF}
      download={CAMERA_CONNECTOR_DMG_FILENAME}
      className={cn(buttonVariants({ variant: "outline" }), className)}
    >
      Download Mac Camera {CAMERA_CONNECTOR_VERSION} (.dmg)
    </a>
  );
}
