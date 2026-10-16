"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { PublicSupabaseEnv } from "@/lib/env";

export type WallOpsLinkState = "connected" | "reconnecting" | "offline";

const POLL_MS = 12_000;
const RECONNECT_POLL_MS = 5_000;

function initialLinkState(): WallOpsLinkState {
  if (typeof navigator === "undefined") return "connected";
  return navigator.onLine ? "connected" : "offline";
}

/**
 * Keeps two venue computers in sync via Supabase realtime (+ polling fallback).
 * Refreshes the RSC tree when authoritative screen state changes. Does not
 * invent device-connected status.
 */
export function useWallOpsSync(input: {
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  enabled?: boolean;
}) {
  const router = useRouter();
  const [linkState, setLinkState] = useState<WallOpsLinkState>(initialLinkState);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(() => initialLinkState() === "offline");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (input.enabled === false) return;

    function markSynced() {
      setLastSyncedAt(new Date().toISOString());
      setStale(false);
    }

    function scheduleRefresh() {
      const now = Date.now();
      if (now - lastRefreshAt.current < 400) return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        lastRefreshAt.current = Date.now();
        router.refresh();
        markSynced();
      }, 250);
    }

    function onOnline() {
      setLinkState("reconnecting");
      scheduleRefresh();
      setLinkState(navigator.onLine ? "connected" : "offline");
    }
    function onOffline() {
      setLinkState("offline");
      setStale(true);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const supabase = createBrowserSupabaseClient(input.supabaseEnv ?? undefined);
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let realtimeOk = false;

    if (supabase) {
      channel = supabase
        .channel(`wall-ops-${input.venueId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "led_wall_runtime", filter: `venue_id=eq.${input.venueId}` },
          () => scheduleRefresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "led_wall_agent_status", filter: `venue_id=eq.${input.venueId}` },
          () => scheduleRefresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "screen_takeovers", filter: `venue_id=eq.${input.venueId}` },
          () => scheduleRefresh(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "screen_display_signals", filter: `venue_id=eq.${input.venueId}` },
          () => scheduleRefresh(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            realtimeOk = true;
            if (navigator.onLine) setLinkState("connected");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            realtimeOk = false;
            if (navigator.onLine) setLinkState("reconnecting");
          } else if (status === "CLOSED") {
            realtimeOk = false;
          }
        });
    }

    // First sync after mount (async — avoids setState-during-effect lint).
    const bootId = setTimeout(() => {
      markSynced();
      scheduleRefresh();
    }, 0);

    function poll() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setLinkState("offline");
        setStale(true);
        return;
      }
      if (!realtimeOk) setLinkState("reconnecting");
      scheduleRefresh();
      if (realtimeOk && navigator.onLine) setLinkState("connected");
    }

    pollId = setInterval(poll, RECONNECT_POLL_MS);
    const tuneId = setTimeout(() => {
      if (pollId) clearInterval(pollId);
      pollId = setInterval(poll, realtimeOk ? POLL_MS : RECONNECT_POLL_MS);
    }, 2_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (pollId) clearInterval(pollId);
      clearTimeout(tuneId);
      clearTimeout(bootId);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [input.enabled, input.supabaseEnv, input.venueId, router]);

  return { linkState, lastSyncedAt, stale };
}
