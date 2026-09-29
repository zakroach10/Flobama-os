import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canConfigureLedWall, canManageProgramming } from "@/lib/auth/permissions";
import { LED_WALL_SQL, TRIVIA_SQL } from "@/lib/constants";
import { getPublicAppUrl, getPublicSupabaseEnv } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";
import { getLedWallAgentStatus, getLedWallRuntime, getLedWallSettings, listLedWallScenes } from "@/lib/queries/led-wall";
import { listStaffLedPlaylistItems, listStaffLedPlaylists } from "@/lib/queries/led-playlists";
import { listStaffMenuSpecials, listStaffPlaylistItems, listStaffPlaylists } from "@/lib/queries/playlists";
import { getStaffTakeover, listStaffScreenAds } from "@/lib/queries/screens";
import { getStaffTriviaSession, listTriviaPacks } from "@/lib/queries/trivia";
import { LedPlaylistsPanel } from "@/components/screens/led-playlists-panel";
import { LedWallPanel } from "@/components/screens/led-wall-panel";
import { PlaylistsPanel } from "@/components/screens/playlists-panel";
import { ScreensWorkspace, type ScreensTab } from "@/components/screens/screens-workspace";
import { SpecialsPanel } from "@/components/screens/specials-panel";
import { TakeoverPanel } from "@/components/screens/takeover-panel";
import { TriviaPanel } from "@/components/screens/trivia-panel";
import { VerticalAdsPanel } from "@/components/screens/vertical-ads-panel";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function ScreensPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; playlist?: string; ledPlaylist?: string }>;
}) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const canProgram = canManageProgramming(context.role);
  const canConfigure = canConfigureLedWall(context.role);
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const params = await searchParams;
  const requested = params.tab;
  const tab: ScreensTab =
    requested === "trivia"
      ? "trivia"
      : canProgram && requested === "vertical"
        ? "vertical"
        : "led";

  const [
    { scenes, missingTable, error: scenesError },
    runtimeRes,
    agentRes,
    settingsRes,
    adsRes,
    takeoverRes,
    packsRes,
    triviaSessionRes,
    playlistsRes,
    specialsRes,
    ledPlaylistsRes,
  ] = await Promise.all([
    listLedWallScenes(supabase, context.venue.id),
    getLedWallRuntime(supabase, context.venue.id),
    getLedWallAgentStatus(supabase, context.venue.id),
    canConfigure ? getLedWallSettings(supabase, context.venue.id) : Promise.resolve(null),
    canProgram ? listStaffScreenAds(supabase, context.venue.id) : Promise.resolve(null),
    canProgram ? getStaffTakeover(supabase, context.venue.id) : Promise.resolve(null),
    listTriviaPacks(supabase, context.venue.id),
    getStaffTriviaSession(supabase, context.venue.id),
    canProgram
      ? listStaffPlaylists(supabase, context.venue.id)
      : Promise.resolve({ playlists: [], missingTable: false, error: null }),
    canProgram
      ? listStaffMenuSpecials(supabase, context.venue.id)
      : Promise.resolve({ specials: [], missingTable: false, error: null }),
    listStaffLedPlaylists(supabase, context.venue.id),
  ]);

  if (missingTable || runtimeRes.missingTable || agentRes.missingTable || settingsRes?.missingTable) {
    return (
      <ErrorState
        title="Could not load LED wall scenes"
        description={`Apply ${LED_WALL_SQL} in the Supabase SQL editor, then reload Screens.`}
      />
    );
  }
  if (scenesError) return <ErrorState title="Could not load LED wall scenes" description={scenesError} />;
  if (runtimeRes.error) return <ErrorState title="Could not load the active scene" description={runtimeRes.error} />;
  if (agentRes.error) return <ErrorState title="Could not load booth client status" description={agentRes.error} />;
  if (settingsRes?.error) return <ErrorState title="Could not load LED wall settings" description={settingsRes.error} />;
  if (adsRes?.error) return <ErrorState title="Could not load ads" description={adsRes.error} />;
  if (playlistsRes.error) return <ErrorState title="Could not load playlists" description={playlistsRes.error} />;
  if (specialsRes.error) return <ErrorState title="Could not load specials" description={specialsRes.error} />;
  if (ledPlaylistsRes.error) {
    return <ErrorState title="Could not load LED playlists" description={ledPlaylistsRes.error} />;
  }
  if (packsRes.error) {
    return <ErrorState title="Could not load trivia packs" description={packsRes.error} />;
  }
  if (triviaSessionRes.error) {
    return <ErrorState title="Could not load trivia session" description={triviaSessionRes.error} />;
  }

  const activePlaylist =
    playlistsRes.playlists.find((playlist) => playlist.is_active) ?? playlistsRes.playlists[0] ?? null;
  const selectedPlaylist =
    playlistsRes.playlists.find((playlist) => playlist.id === params.playlist) ?? activePlaylist;
  const itemsRes =
    canProgram && selectedPlaylist && !playlistsRes.missingTable
      ? await listStaffPlaylistItems(supabase, context.venue.id, selectedPlaylist.id)
      : { items: [], missingTable: playlistsRes.missingTable, error: null as string | null };
  if (itemsRes.error) return <ErrorState title="Could not load playlist items" description={itemsRes.error} />;

  const activeLedPlaylistId = runtimeRes.runtime?.active_playlist_id ?? null;
  const selectedLedPlaylist =
    ledPlaylistsRes.playlists.find((playlist) => playlist.id === params.ledPlaylist) ??
    ledPlaylistsRes.playlists.find((playlist) => playlist.id === activeLedPlaylistId) ??
    ledPlaylistsRes.playlists[0] ??
    null;
  const ledItemsRes =
    selectedLedPlaylist && !ledPlaylistsRes.missingTable
      ? await listStaffLedPlaylistItems(supabase, context.venue.id, selectedLedPlaylist.id)
      : { items: [], missingTable: ledPlaylistsRes.missingTable, error: null as string | null };
  if (ledItemsRes.error) {
    return <ErrorState title="Could not load LED playlist items" description={ledItemsRes.error} />;
  }

  const supabaseEnv = getPublicSupabaseEnv();
  const displayUrl = joinPublicUrl(getPublicAppUrl(), "/display/led");
  const joinBaseUrl = joinPublicUrl(getPublicAppUrl(), "/play");
  const verticalDisplayUrl = joinPublicUrl(getPublicAppUrl(), "/display/vertical");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Screens</h1>
        <p className="text-muted-foreground">
          Choose a scene for the LED wall, build vertical playlists, or run automated trivia.
        </p>
      </header>
      <ScreensWorkspace
        defaultTab={tab}
        showVertical={canProgram}
        led={
          <>
            <LedWallPanel
              scenes={scenes}
              activeSceneId={activeLedPlaylistId ? null : (runtimeRes.runtime?.active_scene_id ?? null)}
              agent={agentRes.agent}
              canConfigure={canConfigure}
              mediaObsSceneName={settingsRes?.settings?.media_obs_scene_name ?? ""}
              tokenIssuedAt={settingsRes?.settings?.agent_token_issued_at ?? null}
              venueId={context.venue.id}
              displayUrl={displayUrl}
              supabaseEnv={supabaseEnv}
              hasTriviaScene={scenes.some((scene) => scene.kind === "trivia")}
            />
            <LedPlaylistsPanel
              playlists={ledPlaylistsRes.playlists}
              items={ledItemsRes.items}
              scenes={scenes}
              selectedPlaylistId={selectedLedPlaylist?.id ?? null}
              activePlaylistId={activeLedPlaylistId}
              missingTable={ledPlaylistsRes.missingTable}
              canConfigure={canConfigure}
            />
          </>
        }
        vertical={
          canProgram && adsRes && takeoverRes ? (
            <>
              <TakeoverPanel
                ads={adsRes.ads}
                takeover={takeoverRes.takeover}
                missingTable={takeoverRes.missingTable}
                venueId={context.venue.id}
                supabaseEnv={supabaseEnv}
              />
              <SpecialsPanel
                specials={specialsRes.specials}
                venueId={context.venue.id}
                activePlaylistId={activePlaylist?.id ?? null}
                missingTable={specialsRes.missingTable || playlistsRes.missingTable}
                supabaseEnv={supabaseEnv}
              />
              <PlaylistsPanel
                playlists={playlistsRes.playlists}
                items={itemsRes.items}
                selectedPlaylistId={selectedPlaylist?.id ?? null}
                venueId={context.venue.id}
                displayUrl={verticalDisplayUrl}
                missingTable={playlistsRes.missingTable}
                supabaseEnv={supabaseEnv}
              />
              {playlistsRes.missingTable ? (
                <VerticalAdsPanel
                  ads={adsRes.ads}
                  venueId={context.venue.id}
                  displayUrl={verticalDisplayUrl}
                  supabaseEnv={supabaseEnv}
                />
              ) : null}
            </>
          ) : null
        }
        trivia={
          <TriviaPanel
            packs={packsRes.packs}
            session={triviaSessionRes.session}
            missingTable={packsRes.missingTable || triviaSessionRes.missingTable}
            canConfigure={canProgram}
            joinBaseUrl={joinBaseUrl}
          />
        }
      />
      {packsRes.missingTable ? (
        <p className="text-sm text-muted-foreground">
          Trivia needs {TRIVIA_SQL} applied on the hosted Supabase project.
        </p>
      ) : null}
    </div>
  );
}
