import { headers } from "next/headers";
import { CustomerSubnav } from "@/components/customer/customer-subnav";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") || "/customer/menu";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customer app</h1>
          <p className="text-muted-foreground">
            Menu, merch, orders, and past shows for the FloBama iOS and Android app. Live video is read from Mux.
          </p>
        </div>
        <CustomerSubnav pathname={pathname} />
      </header>
      {children}
    </div>
  );
}
