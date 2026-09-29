"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { FlobamaLogo } from "@/components/brand/flobama-logo";

export type TriviaKioskPromo = {
  joinCode: string;
  joinUrl: string;
  packTitle: string;
  playerCount: number;
  status: string;
};

export function TriviaKioskSlide({ promo }: { promo: TriviaKioskPromo }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(promo.joinUrl, { margin: 1, width: 640, color: { dark: "#1b1612", light: "#f7f1ea" } }).then(
      (src) => {
        if (!cancelled) setQr(src);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [promo.joinUrl]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-between bg-[#1b1612] px-16 py-20 text-center text-[#f7f1ea]">
      <div className="space-y-6">
        <FlobamaLogo className="mx-auto w-[640px]" />
        <p className="text-[34px] font-semibold tracking-[0.28em] text-[#d36b4a] uppercase">Live trivia</p>
        <h2 className="text-[64px] leading-none font-black tracking-tight">{promo.packTitle}</h2>
        <p className="text-[34px] text-[#cbb7a8]">Scan to join on your phone</p>
      </div>
      <div className="flex w-full max-w-[760px] flex-col items-center gap-10">
        <div className="aspect-square w-full max-w-[640px] rounded-[48px] bg-[#f7f1ea] p-10">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Join trivia QR code" className="h-full w-full object-contain" />
          ) : (
            <div className="h-full w-full animate-pulse rounded-[32px] bg-[#ddd2c6]" />
          )}
        </div>
        <p className="text-[72px] font-black tracking-[0.2em]">{promo.joinCode}</p>
        <p className="text-[32px] text-[#8a7368]">{promo.playerCount} joined · {promo.status}</p>
      </div>
    </div>
  );
}
