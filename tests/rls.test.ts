import { describe, expect, it } from "vitest";

const hasLiveSupabase =
  Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.RLS_TEST_ENABLED);

describe("database security (disposable environment)", () => {
  it.skipIf(!hasLiveSupabase)(
    "runs against a disposable Supabase project when RLS_TEST_ENABLED=1",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
      const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

      const { data: events, error } = await anonClient.from("events").select("id").limit(1);
      expect(error).toBeNull();
      expect(events ?? []).toEqual([]);

      const suffix = crypto.randomUUID();
      const password = `Test-${suffix}-aaaa`;
      const viewerEmail = `viewer-${suffix}@example.com`;
      const { data: viewerUser, error: viewerCreateError } = await admin.auth.admin.createUser({
        email: viewerEmail,
        password,
        email_confirm: true,
      });
      expect(viewerCreateError).toBeNull();
      const viewerId = viewerUser.user?.id;
      expect(viewerId).toBeTruthy();

      const venueId = "11111111-1111-4111-8111-111111111111";
      const { error: memberError } = await admin.from("venue_memberships").insert({
        venue_id: venueId,
        user_id: viewerId!,
        role: "viewer",
      });
      expect(memberError).toBeNull();

      const viewer = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: signInError } = await viewer.auth.signInWithPassword({ email: viewerEmail, password });
      expect(signInError).toBeNull();

      const { error: insertError } = await viewer.from("events").insert({
        venue_id: venueId,
        title: "Should fail",
        event_type: "other",
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600000).toISOString(),
      });
      expect(insertError).toBeTruthy();

      const { error: selfPromote } = await viewer
        .from("venue_memberships")
        .update({ role: "admin" })
        .eq("user_id", viewerId!);
      expect(selfPromote).toBeTruthy();

      await admin.auth.admin.deleteUser(viewerId!);
    },
  );

  it("documents that live RLS checks did not run without a disposable project", () => {
    if (!hasLiveSupabase) {
      expect(hasLiveSupabase).toBe(false);
    }
  });
});
