"use client";

import { useEffect, useRef, useState } from "react";
import { takeUnseenJoins, type WallJoinNotice } from "@/lib/screens/join-notices";

const JOIN_POPUP_MS = 4500;

export function JoinPopups({ joins }: { joins?: readonly WallJoinNotice[] }) {
  const seen = useRef<Set<string> | null>(null);
  const alive = useRef(true);
  const [popups, setPopups] = useState<WallJoinNotice[]>([]);
  const signature = (joins ?? []).map((join) => join.id).join("|");

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const list = joins ?? [];
    if (seen.current === null) {
      seen.current = new Set(list.map((join) => join.id));
      return;
    }
    const fresh = takeUnseenJoins(seen.current, list);
    if (fresh.length === 0) return;
    for (const join of fresh) seen.current.add(join.id);
    setPopups((current) => [...current, ...fresh].slice(-3));
    for (const join of fresh) {
      window.setTimeout(() => {
        if (!alive.current) return;
        setPopups((current) => current.filter((item) => item.id !== join.id));
      }, JOIN_POPUP_MS);
    }
  }, [joins, signature]);

  if (popups.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-40 flex justify-center px-8">
      <div className="flex max-w-6xl flex-wrap items-center justify-center gap-3">
        {popups.map((join) => (
          <div
            key={join.id}
            className="animate-in fade-in slide-in-from-bottom-3 rounded-full bg-white px-7 py-3 text-2xl font-black tracking-tight text-neutral-950 shadow-[0_16px_50px_rgba(0,0,0,0.45)] duration-300 sm:text-3xl"
          >
            {join.displayName} joined
          </div>
        ))}
      </div>
    </div>
  );
}
