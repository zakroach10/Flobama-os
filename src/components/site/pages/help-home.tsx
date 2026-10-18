import Link from "next/link";
import { HelpShell } from "@/components/site/help/help-shell";
import { HELP_SECTIONS } from "@/lib/site/help";

export default function HelpHome() {
  return (
    <HelpShell
      title="Help Center"
      description="Guides for FloBama OS — introduction, answers to common questions, and instructions to run the platform."
    >
      <div className="space-y-8">
        <p className="text-muted-foreground">
          Use these guides whether you are learning the staff tools, answering a setup
          question, or bringing FloBama OS up on a new machine.
        </p>

        <ul className="space-y-4">
          {HELP_SECTIONS.map((section) => (
            <li key={section.href}>
              <Link
                href={section.href}
                className="block border-b border-border py-5 transition-colors hover:border-primary"
              >
                <h2 className="mb-2 text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
                  {section.title}
                </h2>
                <p className="text-muted-foreground">{section.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </HelpShell>
  );
}
