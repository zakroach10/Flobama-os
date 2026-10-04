import Link from "next/link";
import { HelpShell } from "@/components/site/help/help-shell";

export default function HelpIntroduction() {
  return (
    <HelpShell
      title="Introduction"
      description="FloBama OS is the operations platform for FloBama Music Hall in downtown Florence, Alabama."
    >
      <div className="space-y-10 text-muted-foreground">
        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            What it is
          </h2>
          <p className="mb-4">
            FloBama OS powers the public venue experience and the staff tools behind the
            scenes. Guests browse live music, events, menu, catering, private events, and
            band inquiries. Staff sign in to manage programming, screens, cameras,
            ticketing, booking, social, and audience engagement.
          </p>
          <p>
            This app does not modify flobamadowntown.com or other production systems. It
            is the FloBama Music Hall site plus the authenticated Staff OS under routes
            like <code className="text-foreground">/dashboard</code>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Who uses it
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="text-foreground">Guests</span> — public pages for shows,
              food, catering, and inquiries.
            </li>
            <li>
              <span className="text-foreground">Staff</span> — signed-in operators who
              run the room, calendar, wall, and door.
            </li>
            <li>
              <span className="text-foreground">Admins</span> — create staff logins,
              assign menus/roles, and manage venue settings.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Core staff areas
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="text-foreground">Programming</span> — events, artists, and
              sheet updates.
            </li>
            <li>
              <span className="text-foreground">Screens & cameras</span> — LED wall,
              vertical TVs, takeovers, and booth cameras.
            </li>
            <li>
              <span className="text-foreground">Ticketing</span> — inventory, guest
              checkout, QR passes, and door check-in.
            </li>
            <li>
              <span className="text-foreground">Booking & social</span> — GoHighLevel
              inboxes and social planner tools when configured.
            </li>
            <li>
              <span className="text-foreground">Audience</span> — interactive wall and
              trivia experiences for the room.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
            Next steps
          </h2>
          <ul className="space-y-3">
            <li>
              <Link href="/help/faq" className="text-primary hover:underline">
                Read the FAQ
              </Link>{" "}
              for sign-in, roles, events, and wall questions.
            </li>
            <li>
              <Link href="/help/run" className="text-primary hover:underline">
                Run FloBama OS
              </Link>{" "}
              if you need local setup or deploy instructions.
            </li>
            <li>
              <Link href="/" className="text-primary hover:underline">
                Staff sign in
              </Link>{" "}
              when you already have a login.
            </li>
          </ul>
        </section>
      </div>
    </HelpShell>
  );
}
