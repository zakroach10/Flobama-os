"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PhotoBoothLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Guest photo booth</h2>
        <p className="text-sm text-muted-foreground">
          Open this on a standing portrait kiosk with a USB webcam. Mevo Start and Core work in Wired Webcam
          mode: power on, then double-tap the power button. Guests get a QR code. Photos are unlisted and
          deleted after 48 hours.
        </p>
        <p className="mt-2 text-sm break-all">{url}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success("Copied photo booth URL");
        }}
      >
        {copied ? "Copied" : "Copy photo booth URL"}
      </Button>
    </section>
  );
}
