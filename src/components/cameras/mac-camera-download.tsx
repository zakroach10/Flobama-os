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
          <span className="font-mono">{CAMERA_CONNECTOR_VERSION}</span>. Replace the app in Applications.
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Quit Cam ● / any old FloBama Mac Camera process</li>
            <li>Eject every “FloBama Mac Camera” disk</li>
            <li>
              Delete <span className="font-mono">/Applications/FloBama Mac Camera.app</span>
            </li>
            <li>Download {CAMERA_CONNECTOR_VERSION} below and drag into Applications</li>
            <li>Open the app — allow Local Network for “FloBama Mac Camera” if asked</li>
          </ol>
        </div>
      ) : (
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            After install, open the app from Applications (not an old disk). Look for{" "}
            <span className="font-medium">Cam ●</span> in the menu bar — no Terminal window is required in{" "}
            {CAMERA_CONNECTOR_VERSION}+.
          </p>
          <p>
            Local Network: macOS only lists apps that have requested access. You cannot manually add
            FloBama. Open Mac Camera {CAMERA_CONNECTOR_VERSION}, then enable{" "}
            <span className="font-medium">FloBama Mac Camera</span> under System Settings → Privacy &amp;
            Security → Local Network if the prompt was dismissed.
          </p>
        </div>
      )}
    </div>
  );
}
