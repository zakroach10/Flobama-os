"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  claimServerStationPairingCodeAction,
  verifyServerStationPinAction,
} from "@/actions/server-station-auth";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { ServerStationInstallCard } from "@/components/pwa/server-station-install-card";
import { ServerStationButton, serverStationInputClass } from "@/components/server-station/shell";
import { cn } from "@/lib/utils";

type StaffOption = {
  userId: string;
  displayName: string;
};

export function ServerStationLoginClient({
  paired,
  staffOptions,
  reason,
}: {
  paired: boolean;
  staffOptions: StaffOption[];
  reason?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"pair" | "pick" | "pin">(paired ? "pick" : "pair");
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (reason === "idle") toast.message("Locked after inactivity. Enter your PIN to continue.");
  }, [reason]);

  function appendDigit(digit: string) {
    setPin((value) => (value.length >= 6 ? value : `${value}${digit}`));
  }

  return (
    <div className="dark flex min-h-full flex-col bg-[radial-gradient(ellipse_at_top,_rgba(211,107,74,0.18),_transparent_55%),linear-gradient(180deg,_#14110f_0%,_#1a1613_50%,_#100e0c_100%)] px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
        <FlobamaLogo className="mx-auto h-12 w-auto max-w-[220px] brightness-110" priority />
        <p className="mt-3 text-center text-xs font-semibold tracking-[0.2em] text-[#e8d5c4] uppercase">
          Server Station
        </p>

        {step === "pair" ? (
          <div className="mt-10 space-y-5 rounded-[28px] border border-white/10 bg-black/30 p-6">
            <h1 className="text-3xl font-bold text-[#f7efe6]">Pair this kiosk</h1>
            <p className="text-lg text-[#e8d5c4]">
              Ask a manager for a pairing code from Settings → Server Station.
            </p>
            <input
              className={cn(serverStationInputClass, "tracking-[0.3em] uppercase")}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABCD2345"
              maxLength={8}
            />
            <ServerStationButton
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await claimServerStationPairingCodeAction({ code });
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  toast.success(result.message);
                  setStep("pick");
                  router.refresh();
                });
              }}
            >
              Pair Kiosk
            </ServerStationButton>
          </div>
        ) : null}

        {step === "pick" ? (
          <div className="mt-10 space-y-5">
            <h1 className="text-3xl font-bold text-[#f7efe6]">Who’s using the station?</h1>
            <p className="text-lg text-[#e8d5c4]">Tap your name, then enter your PIN.</p>
            <div className="grid gap-3">
              {staffOptions.map((person) => (
                <button
                  key={person.userId}
                  type="button"
                  onClick={() => {
                    setSelected(person);
                    setPin("");
                    setStep("pin");
                  }}
                  className="min-h-16 rounded-2xl border border-white/15 bg-white/5 px-5 text-left text-xl font-semibold text-[#f7efe6]"
                >
                  {person.displayName}
                </button>
              ))}
              {!staffOptions.length ? (
                <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-50">
                  No Server Station staff with PINs yet. Ask an admin to create Server accounts and set PINs.
                </p>
              ) : null}
            </div>
            {!paired ? (
              <ServerStationButton variant="secondary" onClick={() => setStep("pair")}>
                Pair a different kiosk code
              </ServerStationButton>
            ) : null}
          </div>
        ) : null}

        {step === "pin" && selected ? (
          <div className="mt-10 space-y-5">
            <button
              type="button"
              className="text-base font-semibold text-[#e8d5c4]"
              onClick={() => setStep("pick")}
            >
              ← Change person
            </button>
            <h1 className="text-3xl font-bold text-[#f7efe6]">{selected.displayName}</h1>
            <p className="text-lg text-[#e8d5c4]">Enter your PIN</p>
            <div className="flex justify-center gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "size-4 rounded-full border border-white/30",
                    pin.length > index ? "bg-[#d36b4a]" : "bg-transparent",
                  )}
                />
              ))}
            </div>
            <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Go"].map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (key === "⌫") {
                      setPin((value) => value.slice(0, -1));
                      return;
                    }
                    if (key === "Go") {
                      startTransition(async () => {
                        const result = await verifyServerStationPinAction({
                          userId: selected.userId,
                          pin,
                        });
                        if (!result.ok) {
                          toast.error(result.message);
                          setPin("");
                          return;
                        }
                        toast.success(result.message);
                        router.replace(result.redirectTo || "/server");
                        router.refresh();
                      });
                      return;
                    }
                    appendDigit(key);
                  }}
                  className="flex min-h-20 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-2xl font-bold text-[#f7efe6]"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <ServerStationInstallCard />
        </div>
      </div>
    </div>
  );
}
