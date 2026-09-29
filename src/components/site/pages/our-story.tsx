import Link from "next/link";
import { Button } from "@/components/ui/button";

const OurStory = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <img
          src="https://flobamadowntown.com/wp-content/uploads/elementor/thumbs/DSC00315-scaled-e1778917781379-rnj7beq2fgxvsqqhq4oy72jvi8vvp55lxukd5ixxzs.jpg"
          alt="FloBama Venue History"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <p className="text-primary font-heading uppercase tracking-widest mb-4 font-bold">
            Built for the Music
          </p>
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6 text-white">
            The FloBama Story
          </h1>
        </div>
      </section>

      <section className="py-24 px-4 bg-card">
        <div className="container mx-auto max-w-3xl">
          <div className="prose prose-invert prose-lg max-w-none">
            <h2 className="text-3xl font-heading font-bold uppercase tracking-wider mb-6 text-foreground">
              A Vision for Downtown Florence
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              FloBama began with a vision from brothers Bart and Drew Davis:
              create a gathering place that celebrates the Shoals&apos; music, food,
              and community. What started as an idea has grown into a
              cornerstone of downtown Florence nightlife and entertainment.
            </p>

            <h2 className="text-3xl font-heading font-bold uppercase tracking-wider mb-6 text-foreground mt-12">
              The Origins
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Opening a venue of this scale was not without its challenges. It
              took determination, community support, and a commitment to
              preserving the historic feel of downtown Florence while building a
              modern, professional music venue. The Davis brothers worked
              tirelessly to ensure the space would honor the area&apos;s musical
              heritage.
            </p>

            <h2 className="text-3xl font-heading font-bold uppercase tracking-wider mb-6 text-foreground mt-12">
              Shoals Music History
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              The Shoals area is world-renowned for its musical legacy, from
              FAME Studios to Muscle Shoals Sound. FloBama was built to continue
              that tradition by providing a premier stage for local talent,
              regional acts, and touring performers. Our 30-foot stage and
              professional production capabilities were designed specifically to
              give artists the best possible environment to perform.
            </p>

            <h2 className="text-3xl font-heading font-bold uppercase tracking-wider mb-6 text-foreground mt-12">
              Our Mission Today
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-12">
              Years later, FloBama remains a downtown destination for locals,
              visitors, musicians, and unforgettable nights. We are committed to
              serving great Southern food, pouring ice-cold drinks, and keeping
              live music alive in Florence.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-12 border-t border-border pt-12">
            <Button
              asChild
              size="lg"
              className="font-heading font-bold uppercase tracking-wider"
            >
              <Link href="/events">See Upcoming Events</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OurStory;
