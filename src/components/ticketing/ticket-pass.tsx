"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { FlobamaLogo } from "@/components/brand/flobama-logo";

export function TicketPass({ token }: { token: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [ticket, setTicket] = useState<{
    purchaser: string;
    orderNumber?: string;
    admissionsTotal: number;
    admissionsCheckedIn: number;
    status: string;
    eventName?: string;
    tableLabel?: string | null;
    ticketType?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void QRCode.toDataURL(`${window.location.origin}/t/${token}`, { margin: 1, width: 280 }).then(setSrc);
    void fetch(`/api/public/v1/ticketing/tickets/${token}`)
      .then((response) => response.json())
      .then((json: { ok?: boolean; ticket?: typeof ticket; error?: string }) => {
        if (!json.ok || !json.ticket) setError(json.error ?? "Ticket not found.");
        else setTicket(json.ticket);
      });
  }, [token]);

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center bg-[#14110f] px-4 py-10 text-center text-[#f4ebe3]">
      <FlobamaLogo className="mb-6 w-[220px]" />
      <p className="text-xs tracking-[0.28em] text-[#d36b4a] uppercase">FloBama ticket</p>
      <h1 className="mt-2 text-3xl font-semibold">{ticket?.eventName ?? "Ticket"}</h1>
      {error ? <p className="mt-3 text-sm text-[#f0a089]">{error}</p> : null}
      {ticket ? (
        <>
          <p className="mt-2 text-[#c9b8aa]">{ticket.purchaser}</p>
          {ticket.ticketType ? <p className="text-sm">{ticket.ticketType}</p> : null}
          {ticket.tableLabel ? <p className="mt-1 font-medium">{ticket.tableLabel}</p> : null}
          <p className="text-sm text-[#8a7368]">Order {ticket.orderNumber}</p>
          <p className="mt-2 text-sm">
            {ticket.admissionsCheckedIn} / {ticket.admissionsTotal} checked in · {ticket.status}
          </p>
        </>
      ) : null}
      <p className="mt-3 max-w-sm text-sm text-[#8a7368]">
        This QR is a random token. Door staff resolve it on the server.
      </p>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Ticket QR" className="mt-6 rounded-xl bg-white p-3" />
      ) : null}
    </main>
  );
}
