"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeaturedEvents } from "@/components/site/featured-events";

const LiveMusic = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <img
          src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a505e5e9c9b37b5fdf03587.jpeg"
          alt="Live performance at FloBama"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto mt-16">
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6 text-white">
            Live Music at FloBama
          </h1>
          <p className="text-xl text-white/90 font-medium">
            The heartbeat of downtown Florence nightlife and entertainment.
          </p>
        </div>
      </section>

      {/* Intro & Embed */}
      <section className="py-24 px-4 bg-card">
        <div className="container mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold uppercase tracking-wider mb-6">
              Experience the Sound of the Shoals
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              From local favorites and acoustic artists to full bands and
              touring performers, FloBama is built for live music. Check out our
              upcoming schedule and join us for an unforgettable night of
              entertainment.
            </p>
          </div>

          <div className="rounded-xl shadow-2xl">
            <FeaturedEvents limit={16} />
          </div>
        </div>
      </section>

      {/* Stage Info */}
      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary font-heading uppercase tracking-widest mb-4 font-bold">
                Professional Production
              </p>
              <h2 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
                Built for the Performance
              </h2>
              <ul className="space-y-6 mb-8 text-lg text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-3 text-2xl leading-none">
                    •
                  </span>
                  <span>
                    <strong>30-Foot Professional Stage:</strong> Providing ample
                    room for full bands and dynamic performances.
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 text-2xl leading-none">
                    •
                  </span>
                  <span>
                    <strong>Professional Lighting & Sound:</strong>{" "}
                    State-of-the-art equipment to ensure every note sounds
                    perfect.
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 text-2xl leading-none">
                    •
                  </span>
                  <span>
                    <strong>In-House Sound Engineer:</strong> Dedicated
                    professionals managing the mix so artists can focus on
                    playing.
                  </span>
                </li>
              </ul>
              <Button
                asChild
                size="lg"
                className="font-heading font-bold uppercase tracking-wider"
              >
                <Link href="/band-inquiries">
                  Interested in Performing at FloBama?
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img
                src="https://flobamadowntown.com/wp-content/uploads/elementor/thumbs/DSC00315-scaled-e1778917781379-rnj7beq2fgxvsqqhq4oy72jvi8vvp55lxukd5ixxzs.jpg"
                alt="FloBama Crowd"
                className="w-full h-64 object-cover rounded-xl"
              />
              <img
                src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a505e5e9c9b37b5fdf03587.jpeg"
                alt="FloBama Stage"
                className="w-full h-64 object-cover rounded-xl mt-8"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Experience Types */}
      <section className="py-24 px-4 bg-card border-y border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-background p-10 rounded-xl border border-border">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4">
                Dinner Shows
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Enjoy a family-friendly atmosphere during our early evening
                performances. Pair our Southern menu and smoked meats with great
                acoustic sets or local bands while you dine.
              </p>
            </div>
            <div className="bg-background p-10 rounded-xl border border-border">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4">
                Late-Night Energy
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                As the night goes on, FloBama transforms into Florence&apos;s premier
                nightlife destination. High-energy performances, packed dance
                floors, and an atmosphere you won&apos;t find anywhere else.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
            Don&apos;t Miss the Next Show
          </h2>
          <p className="text-xl mb-10 font-medium">
            Grab your friends, order some food, and enjoy the best live music in
            Florence.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="font-heading font-bold uppercase tracking-wider bg-background text-foreground hover:bg-background/90"
          >
            <Link href="/events">View Full Schedule</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default LiveMusic;
