import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomerCheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const params = await searchParams;
  const order = params.order ?? "";
  const token = params.token ?? "";
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 bg-neutral-950 px-6 text-neutral-100">
      <p className="text-sm font-semibold tracking-[0.2em] text-amber-400 uppercase">FloBama</p>
      <h1 className="text-3xl font-semibold">Checkout canceled</h1>
      <p className="text-neutral-300">No payment was taken. You can return to the FloBama app and try again.</p>
      {order && token ? (
        <Link className="text-amber-300 underline" href={`flobama://shop`}>
          Return to the app
        </Link>
      ) : null}
    </main>
  );
}
