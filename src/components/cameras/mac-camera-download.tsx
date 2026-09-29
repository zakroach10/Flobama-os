"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  CAMERA_CONNECTOR_DMG_FILENAME,
  CAMERA_CONNECTOR_DMG_HREF,
  CAMERA_CONNECTOR_VERSION,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export function MacCameraDownload({
  className,
  connectorVersion,
}: {
  className?: string;
  connectorVersion?: string | null;
}) {
  const running = connectorVersion?.trim() || null;
  const outdated = Boolean(running && running !== CAMERA_CONNECTOR_VERSION);

  return (
    <div className={cn("space-y-3", className)}>
      <a
        href={CAMERA_CONNECTOR_DMG_HREF}
        download={CAMERA_CONNECTOR_DMG_FILENAME}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Download Mac Camera {CAMERA_CONNECTOR_VERSION} (.dmg)
      </a>
      {outdated ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Mac is reporting connector <span className="font-mono">{running}</span>, but production needs{" "}
          <span className="font-mono">{CAMERA_CONNECTOR_VERSION}</span>. An old app in Applications or an old
          .dmg in Downloads is still running — that also blocks NDI discovery.
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Quit the current Terminal / Cam status helper</li>
            <li>Eject every “FloBama Mac Camera” disk (including 1.0.0)</li>
            <li>
              Delete <span className="font-mono">/Applications/FloBama Mac Camera.app</span>
            </li>
            <li>Download the button above (filename must end in {CAMERA_CONNECTOR_VERSION}.dmg)</li>
            <li>Open that disk — Finder title must say FloBama Mac Camera {CAMERA_CONNECTOR_VERSION}</li>
            <li>Drag into Applications, open it, confirm Terminal says {CAMERA_CONNECTOR_VERSION}</li>
          </ol>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          After download: eject old disks, replace the app in Applications, then confirm Terminal starts with
          “FloBama Mac Camera {CAMERA_CONNECTOR_VERSION}”.
        </p>
      )}
    </div>
  );
}
