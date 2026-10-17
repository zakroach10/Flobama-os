"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HELP_SECTIONS, type HelpSectionHref } from "@/lib/site/help";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: HelpSectionHref; label: string }[] = [
  { href: "/help", label: "Help Center" },
  ...HELP_SECTIONS.map((section) => ({
    href: section.href,
    label: section.title,
  })),
];

export function HelpShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background pt-20 text-foreground">
      <section className="border-b border-border bg-card px-4 py-16 text-center md:py-20">
        <div className="container mx-auto max-w-4xl">
          <p className="mb-3 text-sm font-heading font-bold uppercase tracking-[0.2em] text-primary">
            FloBama OS
          </p>
          <h1 className="mb-4 text-4xl font-heading font-bold uppercase tracking-wider md:text-5xl">
            {title}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{description}</p>
        </div>
      </section>

      <section className="px-4 py-12 md:py-16">
        <div className="container mx-auto grid max-w-6xl gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <nav aria-label="Help Center" className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-heading font-bold uppercase tracking-wider transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </section>
    </div>
  );
}
