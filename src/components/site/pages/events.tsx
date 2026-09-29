"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeaturedEvents } from "@/components/site/featured-events";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Events = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      {/* Hero */}
      <section className="py-24 px-4 bg-card border-b border-border text-center">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6">
            Upcoming Events
          </h1>
          <p className="text-xl text-muted-foreground">
            See who is playing next at FloBama Restaurant and Music Hall.
          </p>
        </div>
      </section>

      {/* Events Embed */}
      <section className="py-16 px-4 bg-background">
        <div className="container mx-auto">
          <div className="rounded-xl shadow-2xl">
            <FeaturedEvents limit={24} />
          </div>
        </div>
      </section>

      {/* Private Events Promo */}
      <section className="py-24 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
                Host Your Own Event
              </h2>
              <p className="text-lg mb-8 font-medium leading-relaxed">
                Looking for the perfect venue? FloBama offers flexible space,
                custom food options, and professional entertainment capabilities
                for birthdays, company parties, reunions, and more.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="font-heading font-bold uppercase tracking-wider bg-background text-foreground hover:bg-background/90"
              >
                <Link href="/private-events">Plan a Private Event</Link>
              </Button>
            </div>
            <div>
              <img
                src="https://flobamadowntown.com/wp-content/uploads/elementor/thumbs/DSC00315-scaled-e1778917781379-rnj7beq2fgxvsqqhq4oy72jvi8vvp55lxukd5ixxzs.jpg"
                alt="Private Event at FloBama"
                className="w-full h-auto rounded-xl shadow-xl object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4 bg-card">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold uppercase tracking-wider mb-4">
              Event FAQ
            </h2>
            <p className="text-muted-foreground">
              Common questions about visiting and booking FloBama.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-border">
              <AccordionTrigger className="text-lg font-heading font-bold uppercase tracking-wide hover:text-primary">
                How far in advance should I book?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                For standard reservations and dinner shows, availability may
                open during the week of the event. Large gatherings such as
                birthdays, company events, or class reunions should generally be
                discussed at least 7–10 days in advance. Earlier inquiries
                provide more planning flexibility.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border-border">
              <AccordionTrigger className="text-lg font-heading font-bold uppercase tracking-wide hover:text-primary">
                How many people can FloBama accommodate?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                FloBama&apos;s standard seating capacity is approximately 278.
                Capacity may vary for concerts, standing-room events, or
                alternative room layouts.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border-border">
              <AccordionTrigger className="text-lg font-heading font-bold uppercase tracking-wide hover:text-primary">
                Does FloBama host business events?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                Yes. FloBama can host business meetings, company parties, team
                celebrations, charity events, and other group functions. Food
                and entertainment options may be customized around the event.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border-border">
              <AccordionTrigger className="text-lg font-heading font-bold uppercase tracking-wide hover:text-primary">
                Are guests under 21 allowed?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                FloBama is a restaurant and family-friendly music venue. Local
                curfew requirements and special-event policies may apply later
                in the evening. Contact FloBama for details concerning a
                particular event.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
    </div>
  );
};

export default Events;
