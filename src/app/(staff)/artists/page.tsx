import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listArtists } from "@/lib/queries/artists";
import { ARTIST_PAGE_SIZE } from "@/lib/constants";
import { canManageProgramming } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/states";
import { ArtistForm } from "@/components/artists/artist-form";

export const dynamic = "force-dynamic";

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string; page?: string; new?: string }>;
}) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const params = await searchParams;
  const query = params.q ?? "";
  const includeArchived = params.archived === "1";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { artists, count, error } = await listArtists(supabase, context.venue.id, {
    query,
    includeArchived,
    page,
    pageSize: ARTIST_PAGE_SIZE,
  });
  const canEdit = canManageProgramming(context.role);
  const showCreate = params.new === "1" && canEdit;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Artists</h1>
          <p className="text-muted-foreground">Operational directory — not the public Wall of Fame.</p>
        </div>
        {canEdit ? (
          <Button className="w-full sm:w-auto" render={<Link href="/artists?new=1" />}>
            Add artist
          </Button>
        ) : null}
      </header>

      {showCreate ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">New artist</h2>
          <ArtistForm canEdit={canEdit} />
        </section>
      ) : null}

      <form className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row" method="get">
        <Input name="q" defaultValue={query} placeholder="Search name or genre" aria-label="Search artists" />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="size-4" />
          Include archived
        </label>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error ? (
        <ErrorState title="Could not load artists" description={error} />
      ) : artists.length === 0 ? (
        query ? (
          <EmptyState title="No matching artists" description="Try a different name or include archived records." />
        ) : (
          <EmptyState
            title="No artists yet"
            description="Create a directory record before attaching performers to events."
            actionHref={canEdit ? "/artists?new=1" : undefined}
            actionLabel={canEdit ? "Add artist" : undefined}
          />
        )
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {artists.map((artist) => (
            <li key={artist.id}>
              <Link href={`/artists/${artist.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{artist.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {artist.genre || "No genre"}
                    {artist.archived_at ? " · Archived" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">{count} records</p>
    </div>
  );
}
