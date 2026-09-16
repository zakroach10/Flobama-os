"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getPushPublicKeyAction,
  sendTestPushAction,
  subscribePushAction,
  unsubscribePushAction,
} from "@/actions/push";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export function PwaPushCard({ vapidConfigured }: { vapidConfigured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [supported, setSupported] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("Tonight’s lineup is live.");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    setIsIos(ios);
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)),
    );

    const pushOk = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(pushOk);

    void (async () => {
      const keyResult = await getPushPublicKeyAction();
      if (keyResult.ok && "publicKey" in keyResult) {
        setPublicKey(keyResult.publicKey);
      }
      if (pushOk) {
        try {
          const registration = await registerServiceWorker();
          const existing = await registration.pushManager.getSubscription();
          setSubscription(existing);
        } catch {
          /* SW may fail on insecure origins during local HTTP */
        }
      }
      setReady(true);
    })();
  }, []);

  function enablePush() {
    startTransition(async () => {
      try {
        if (!publicKey) {
          toast.error("VAPID public key is missing on the server.");
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Notification permission was not granted.");
          return;
        }
        const registration = await registerServiceWorker();
        await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const serialized = JSON.parse(JSON.stringify(sub)) as unknown;
        const result = await subscribePushAction(serialized);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        setSubscription(sub);
        toast.success(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not enable push notifications.");
      }
    });
  }

  function disablePush() {
    startTransition(async () => {
      try {
        const endpoint = subscription?.endpoint ?? null;
        await subscription?.unsubscribe();
        setSubscription(null);
        const result = await unsubscribePushAction(endpoint);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not disable push.");
      }
    });
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestPushAction(testMessage);
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card/90 p-5 shadow-sm shadow-foreground/5">
      <div>
        <h2 className="text-lg font-semibold">App & notifications</h2>
        <p className="text-sm text-muted-foreground">
          Install FloBama OS as a Progressive Web App and enable push alerts on this device. You’ll get notified for{" "}
          <span className="font-medium text-foreground">new band submissions</span> and a{" "}
          <span className="font-medium text-foreground">Monday reminder</span> to post the weekly schedule.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium">Install on this device</p>
        {standalone ? (
          <p className="text-muted-foreground">Running as an installed app.</p>
        ) : isIos ? (
          <p className="text-muted-foreground">
            On iPhone/iPad: open Share, then <span className="font-medium text-foreground">Add to Home Screen</span>.
            Push requires the installed app on iOS 16.4+.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Use your browser’s <span className="font-medium text-foreground">Install app</span> /{" "}
            <span className="font-medium text-foreground">Add to Home Screen</span> control (Chrome/Edge address bar
            or the browser menu).
          </p>
        )}
      </div>

      {!vapidConfigured || !publicKey ? (
        <p className="text-sm text-muted-foreground">
          Push keys are not configured yet. Set <code className="text-xs">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> and{" "}
          <code className="text-xs">VAPID_PRIVATE_KEY</code>, then redeploy. Generate with{" "}
          <code className="text-xs">npx web-push generate-vapid-keys</code>.
        </p>
      ) : !supported ? (
        <p className="text-sm text-muted-foreground">
          This browser does not support web push. Try Chrome, Edge, Firefox, or an installed iOS home-screen app.
        </p>
      ) : !ready ? (
        <p className="text-sm text-muted-foreground">Checking notification support…</p>
      ) : subscription ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Push notifications are enabled on this device.</p>
          <div className="space-y-2">
            <Label htmlFor="push-test-message">Test message</Label>
            <Input
              id="push-test-message"
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
              maxLength={180}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={sendTest}>
              Send test notification
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={disablePush}>
              Disable on this device
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enable push to get staff alerts even when the tab is in the background.
          </p>
          <Button type="button" disabled={pending} onClick={enablePush}>
            Enable push notifications
          </Button>
        </div>
      )}
    </section>
  );
}
