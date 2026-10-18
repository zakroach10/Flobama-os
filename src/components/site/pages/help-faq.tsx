"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpShell } from "@/components/site/help/help-shell";
import { HELP_FAQ } from "@/lib/site/help";

export default function HelpFaq() {
  return (
    <HelpShell
      title="FAQ"
      description="Quick answers about FloBama OS sign-in, roles, public listings, screens, and ticketing."
    >
      <Accordion type="single" collapsible className="w-full">
        {HELP_FAQ.map((item, index) => (
          <AccordionItem key={item.question} value={`item-${index}`}>
            <AccordionTrigger className="text-left font-heading text-base font-bold uppercase tracking-wider text-foreground hover:no-underline hover:text-primary">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </HelpShell>
  );
}
