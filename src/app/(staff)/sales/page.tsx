import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { getStaffContext } from "@/lib/auth/staff";
import { requireStaffMenu } from "@/lib/auth/require-menu";
import { canManageStaff } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { deriveCapabilityStatuses, loadSpotOnSettings, unavailableOrCents } from "@/lib/spoton/status";
import { loadEventSales, loadSalesDashboard } from "@/lib/spoton/queries";
import { METRIC_DOCUMENTATION } from "@/lib/spoton/reporting/metrics";
import { formatCentsExact } from "@/lib/spoton/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpotOnCategoryMappingForm } from "@/components/sales/spoton-category-form";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; compare?: string }>;
}) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  await requireStaffMenu("spoton");
  if (!canManageStaff(context.role)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        <p className="text-sm text-muted-foreground">
          POS sales reports are restricted to administrators until a dedicated finance role exists.
        </p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const params = (await searchParams) ?? {};
  const today = DateTime.now().setZone(DEFAULT_VENUE_TIMEZONE).toISODate()!;
  const businessDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const compareDate =
    params.compare && /^\d{4}-\d{2}-\d{2}$/.test(params.compare)
      ? params.compare
      : DateTime.fromISO(businessDate).minus({ days: 7 }).toISODate()!;

  let settings = null;
  try {
    settings = await loadSpotOnSettings(supabase, context.venue.id);
  } catch {
    settings = null;
  }
  const capabilities = deriveCapabilityStatuses(settings);
  const reportingAvailable = capabilities.reporting === "verified";
  const cutoff = settings?.business_day_cutoff_local?.slice(0, 5) ?? "04:00";

  const dashboard = await loadSalesDashboard({
    client: supabase,
    venueId: context.venue.id,
    businessDate,
    compareBusinessDate: compareDate,
    cutoffLocal: cutoff,
    coverageThrough: settings?.coverage_through ?? null,
    reportingAvailable,
  });

  const fromIso = DateTime.fromISO(businessDate, { zone: DEFAULT_VENUE_TIMEZONE })
    .minus({ days: 2 })
    .toUTC()
    .toISO()!;
  const toIso = DateTime.fromISO(businessDate, { zone: DEFAULT_VENUE_TIMEZONE })
    .plus({ days: 2 })
    .endOf("day")
    .toUTC()
    .toISO()!;

  const eventSales = await loadEventSales({
    client: supabase,
    venueId: context.venue.id,
    fromIso,
    toIso,
    preMinutes: settings?.event_window_pre_minutes ?? 0,
    postMinutes: settings?.event_window_post_minutes ?? 0,
    reportingAvailable,
  });

  const categoriesRes = await supabase
    .from("spoton_category_mappings")
    .select("external_category_name, reporting_bucket")
    .eq("venue_id", context.venue.id)
    .order("external_category_name");

  const totals = dashboard.totals;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sales</h1>
          <Badge variant={reportingAvailable ? "default" : "secondary"}>
            {reportingAvailable ? "Reporting verified" : "Reporting unavailable"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          SpotOn POS snapshots for FloBama. Figures are sales during the selected business day — not proof that
          entertainment caused the sales. Configure the connection under Settings → Integrations → SpotOn.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings">SpotOn settings</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href="https://client.restaurantpos.spoton.com/b/" target="_blank" rel="noreferrer">
              SpotOn BOH
            </a>
          </Button>
        </div>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Business day</span>
          <input
            type="date"
            name="date"
            defaultValue={businessDate}
            className="block h-9 rounded-lg border bg-background px-3"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Compare</span>
          <input
            type="date"
            name="compare"
            defaultValue={compareDate}
            className="block h-9 rounded-lg border bg-background px-3"
          />
        </label>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </form>

      {!reportingAvailable ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Sales totals are unavailable until Restaurant Export or Central reporting access is configured and
          verified. Webhook-only mode does not establish access to every sale. Values below show as Unavailable,
          not zero.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Gross sales"
          value={unavailableOrCents(totals?.grossSalesCents, reportingAvailable)}
        />
        <Metric
          label="Discounts"
          value={unavailableOrCents(totals?.discountsCents, reportingAvailable)}
        />
        <Metric
          label="Refunds"
          value={unavailableOrCents(totals?.refundsCents, reportingAvailable)}
        />
        <Metric
          label="Net sales"
          value={unavailableOrCents(totals?.netSalesCents, reportingAvailable)}
        />
        <Metric label="Taxes" value={unavailableOrCents(totals?.taxCents, reportingAvailable)} />
        <Metric label="Tips" value={unavailableOrCents(totals?.tipCents, reportingAvailable)} />
        <Metric
          label="Orders"
          value={reportingAvailable && totals ? String(totals.orderCount) : "Unavailable"}
        />
        <Metric
          label="Avg order"
          value={unavailableOrCents(totals?.averageOrderValueCents, reportingAvailable)}
        />
      </section>

      {reportingAvailable && totals ? (
        <p className="text-xs text-muted-foreground">
          Coverage through {totals.coverageThrough ?? "Unavailable"}
          {totals.dataAgeLabel ? ` · ${totals.dataAgeLabel}` : ""}
          {totals.partial ? " · period includes incomplete snapshots" : " · complete snapshots only"}
          {dashboard.compareTotals
            ? ` · compare ${compareDate} net ${formatCentsExact(dashboard.compareTotals.netSalesCents)}`
            : ""}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Category totals</h2>
        <p className="text-sm text-muted-foreground">
          Buckets come from explicit SpotOn category mappings only — never inferred from item names. Unmapped
          revenue stays visible.
        </p>
        <div className="grid gap-2 sm:grid-cols-4">
          {(dashboard.categories.length
            ? dashboard.categories
            : [
                { bucket: "food", netSalesCents: 0, itemCount: 0 },
                { bucket: "alcohol", netSalesCents: 0, itemCount: 0 },
                { bucket: "other", netSalesCents: 0, itemCount: 0 },
                { bucket: "unmapped", netSalesCents: 0, itemCount: 0 },
              ]
          ).map((row) => (
            <div key={row.bucket} className="rounded-lg border px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.bucket}</p>
              <p className="text-lg font-semibold">
                {unavailableOrCents(row.netSalesCents, reportingAvailable)}
              </p>
            </div>
          ))}
        </div>
        <SpotOnCategoryMappingForm
          existing={(categoriesRes.data ?? []).map((row) => ({
            name: row.external_category_name,
            bucket: row.reporting_bucket,
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Hourly trend</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
          {(dashboard.hourly.length ? dashboard.hourly : Array.from({ length: 24 }, (_, hourLocal) => ({
            hourLocal,
            netSalesCents: 0,
            orderCount: 0,
          }))).map((bucket) => (
            <div key={bucket.hourLocal} className="rounded border px-2 py-1 text-center text-xs">
              <div className="text-muted-foreground">{String(bucket.hourLocal).padStart(2, "0")}</div>
              <div className="font-medium">
                {reportingAvailable ? formatCentsExact(bucket.netSalesCents) : "—"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sales during entertainment events</h2>
        <p className="text-sm text-muted-foreground">
          These figures are sales during each event window. They do not prove the band caused the sales. Revenue
          minus booking fee is shown only as a fee comparison — never labeled profit. Missing booking costs stay
          distinct from $0.
        </p>
        {eventSales.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {reportingAvailable ? "No events in the nearby window." : "Unavailable without verified reporting."}
          </p>
        ) : (
          <ul className="space-y-3">
            {eventSales.map((event) => (
              <li key={event.eventId} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{event.title}</h3>
                  {event.ambiguous ? <Badge variant="destructive">Overlapping window</Badge> : null}
                  {!event.windowComplete ? <Badge variant="outline">Open-ended window</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.windowStartAt} → {event.windowEndAt ?? "no end"} · attribution {event.attributionBasis}
                </p>
                {event.attributionLimitation ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{event.attributionLimitation}</p>
                ) : null}
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Sales during event</dt>
                    <dd className="font-medium">{formatCentsExact(event.netSalesCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Orders</dt>
                    <dd className="font-medium">{event.orderCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Booking cost</dt>
                    <dd className="font-medium">
                      {event.bookingCostMissing ? "Missing" : formatCentsExact(event.bookingCostCents ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sales − booking fee</dt>
                    <dd className="font-medium">
                      {event.netSalesMinusBookingFeeCents == null
                        ? "Unavailable"
                        : formatCentsExact(event.netSalesMinusBookingFeeCents)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {event.categoryTotals.map((cat) => (
                    <span key={cat.bucket} className="rounded bg-muted px-2 py-1">
                      {cat.bucket}: {formatCentsExact(cat.netSalesCents)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Metric definitions</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {METRIC_DOCUMENTATION.map((metric) => (
            <li key={metric.key}>
              <span className="font-medium text-foreground">{metric.label}:</span> {metric.calculation}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
