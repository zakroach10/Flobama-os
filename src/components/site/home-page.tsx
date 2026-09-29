"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeaturedEvents } from "@/components/site/featured-events";
import { StaffLoginSection } from "@/components/site/staff-login-section";

export function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* 1. Full-screen video hero */}
      <section className="flobama-hero">
        <video
          className="flobama-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="https://flobamadowntown.com/wp-content/uploads/elementor/thumbs/DSC00315-scaled-e1778917781379-rnj7beq2fgxvsqqhq4oy72jvi8vvp55lxukd5ixxzs.jpg"
          aria-hidden="true"
        >
          <source
            src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a50582deada8c1f45bbe670.mp4"
            type="video/mp4"
          />
        </video>

        <div className="flobama-hero-overlay"></div>

        <div className="flobama-hero-content">
          <p className="text-primary font-heading uppercase tracking-widest mb-2 text-sm md:text-base font-bold">
            Downtown Florence, Alabama
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold uppercase tracking-wide mb-6 leading-none text-white">
            Good Food. <br />
            Live Music. <br />
            <span className="text-primary">Real Shoals Energy.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mb-8 font-medium">
            Southern food, ice-cold drinks, and unforgettable live performances
            in the heart of downtown Florence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              asChild
              size="lg"
              className="font-heading font-bold uppercase tracking-wider text-lg h-14 px-8"
            >
              <Link href="/events">See Upcoming Events</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="font-heading font-bold uppercase tracking-wider text-lg h-14 px-8 border-2 hover:bg-white hover:text-black text-white border-white bg-transparent"
            >
              <a
                href="https://mk360.me/orderflobama"
                target="_self"
                rel="noopener noreferrer"
              >
                Order Online
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Brief FloBama introduction */}
      <section className="py-24 px-4 bg-card text-center">
        <div className="container mx-auto max-w-4xl">
          <p className="text-primary font-heading uppercase tracking-widest mb-4 font-bold">
            Downtown Florence, Alabama
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
            Where Live Music and Great Food Come Together
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
            Located in the heart of downtown Florence, FloBama is your
            destination for live performances, Southern food, ice-cold drinks,
            and unforgettable nights. Come for dinner, stay for the music, and
            experience the energy of the Shoals.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="font-heading font-bold uppercase tracking-wider"
            >
              <Link href="/events">View Events</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="font-heading font-bold uppercase tracking-wider"
            >
              <Link href="/menu">Explore the Menu</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 3. Featured events embed */}
      <section
        className="flobama-events-section"
        aria-labelledby="featured-events-title"
      >
        <div className="flobama-events-heading mb-8 text-center">
          <p className="text-primary font-heading uppercase tracking-widest mb-2 font-bold">
            Live & Loud
          </p>
          <h2
            id="featured-events-title"
            className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-4"
          >
            Featured Events
          </h2>
          <p className="text-lg text-muted-foreground">
            See who is taking the FloBama stage next.
          </p>
        </div>

        <div className="rounded-xl">
          <FeaturedEvents limit={8} />
        </div>

        <div className="flobama-events-actions mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="font-heading font-bold uppercase tracking-wider"
          >
            <Link href="/events">View All Events</Link>
          </Button>
        </div>
      </section>

      {/* 4. Food and drinks feature - Editorial Style */}
      <section className="py-32 px-4 bg-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-card/30 -skew-x-12 translate-x-20"></div>
        <div className="container mx-auto relative z-10">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 relative">
              <div className="absolute -inset-4 bg-primary/20 rounded-xl blur-xl -z-10"></div>
              <img
                src="https://vibe.filesafe.space/1783648094219892481/attachments/24f253de-01bd-4fc6-a255-b7c7f976e8c1.jpg"
                alt="FloBama Food"
                className="w-full h-auto rounded-xl shadow-2xl object-cover aspect-[4/3] border border-white/10"
              />
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-card rounded-full border border-white/10 flex items-center justify-center p-6 shadow-2xl hidden md:flex">
                <p className="font-heading font-bold uppercase text-center text-primary leading-tight transform -rotate-12">
                  Smoked
                  <br />
                  Daily
                </p>
              </div>
            </div>
            <div className="md:col-span-5 md:pl-12 mt-12 md:mt-0">
              <p className="text-primary font-heading uppercase tracking-[0.3em] mb-4 font-bold text-sm">
                Fuel Your Night
              </p>
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold uppercase tracking-wider mb-8 leading-[0.9]">
                Southern Favorites, <br />
                <span className="text-primary">Smoked Meats</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed font-medium">
                From hand-crafted burgers and crispy wings to slow-smoked
                barbecue, FloBama serves the food you want before the show and
                after the music starts.
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <Button
                  asChild
                  size="lg"
                  className="font-heading font-bold uppercase tracking-wider h-14 px-8 text-lg"
                >
                  <Link href="/menu">View Menu</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="font-heading font-bold uppercase tracking-wider h-14 px-8 text-lg border-2"
                >
                  <a
                    href="https://mk360.me/orderflobama"
                    target="_self"
                    rel="noopener noreferrer"
                  >
                    Order Online
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Live music feature - Editorial Style */}
      <section className="py-32 px-4 bg-card relative">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 md:pr-12 z-10 relative">
              <p className="text-primary font-heading uppercase tracking-[0.3em] mb-4 font-bold text-sm">
                Live & Loud
              </p>
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold uppercase tracking-wider mb-8 leading-[0.9]">
                The Best Live Music <br />
                <span className="text-muted-foreground">
                  Experience in the Shoals
                </span>
              </h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed font-medium">
                FloBama&apos;s stage features local favorites, touring performers,
                acoustic artists, full bands, tribute shows, karaoke, and
                special events. Professional lighting, sound, and an in-house
                engineer help make every performance memorable. We also feature
                5 8K PTZ cameras with a 16ft x 9ft LED Wall to capture the shows
                — the biggest screen in any venue in the Shoals.
              </p>
              <Button
                asChild
                size="lg"
                className="font-heading font-bold uppercase tracking-wider h-14 px-8 text-lg"
              >
                <Link href="/live-music">View Schedule</Link>
              </Button>
            </div>
            <div className="md:col-span-7 relative mt-12 md:mt-0">
              <div className="absolute top-10 -left-10 w-full h-full bg-primary/10 rounded-xl border border-primary/20 -z-10 hidden md:block"></div>
              <img
                src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a505e5e9c9b37b5fdf03587.jpeg"
                alt="Live Music at FloBama"
                className="w-full h-auto rounded-xl shadow-2xl object-cover relative z-10 border border-white/5"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5.5. Catering feature - Editorial Style */}
      <section className="py-32 px-4 bg-background relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1/2 h-full bg-card/30 skew-x-12 -translate-x-20"></div>
        <div className="container mx-auto relative z-10">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 relative order-2 md:order-1">
              <div className="absolute -inset-4 bg-primary/20 rounded-xl blur-xl -z-10"></div>
              <img
                src="https://vibe.filesafe.space/1783648094219892481/attachments/d050c218-0411-4ace-b1e8-b8912d3541a5.png"
                alt="FloBama Catering"
                className="w-full h-auto rounded-xl shadow-2xl object-cover aspect-[4/3] border border-white/10"
              />
              <div className="absolute -top-8 -left-8 w-48 h-48 bg-card rounded-full border border-white/10 flex items-center justify-center p-6 shadow-2xl hidden md:flex z-20">
                <p className="font-heading font-bold uppercase text-center text-primary leading-tight transform -rotate-12">
                  We Bring
                  <br />
                  The BBQ
                </p>
              </div>
            </div>
            <div className="md:col-span-5 md:pl-12 mb-12 md:mb-0 order-1 md:order-2">
              <p className="text-primary font-heading uppercase tracking-[0.3em] mb-4 font-bold text-sm">
                Bring FloBama to You
              </p>
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold uppercase tracking-wider mb-8 leading-[0.9]">
                Authentic Southern <br />
                <span className="text-primary">Catering</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed font-medium">
                Whether you&apos;re hosting a corporate lunch, a wedding reception,
                or a tailgate party, FloBama offers custom catering packages
                that bring our signature smoked meats and Southern sides
                directly to your event.
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <Button
                  asChild
                  size="lg"
                  className="font-heading font-bold uppercase tracking-wider h-14 px-8 text-lg"
                >
                  <Link href="/catering">Inquire Now</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="font-heading font-bold uppercase tracking-wider h-14 px-8 text-lg border-2"
                >
                  <Link href="/menu">View Menu</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Experience grid */}
      <section className="py-4 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/menu"
              className="group relative h-80 overflow-hidden rounded-xl block"
            >
              <img
                src="https://vibe.filesafe.space/1783648094219892481/attachments/24f253de-01bd-4fc6-a255-b7c7f976e8c1.jpg"
                alt="Dinner and Drinks"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <h3 className="text-3xl font-heading font-bold uppercase text-white tracking-wider">
                  Dinner and Drinks
                </h3>
              </div>
            </Link>

            <Link
              href="/live-music"
              className="group relative h-80 overflow-hidden rounded-xl block lg:col-span-2"
            >
              <img
                src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a505e5e9c9b37b5fdf03587.jpeg"
                alt="Live Music"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <h3 className="text-3xl font-heading font-bold uppercase text-white tracking-wider">
                  Live Music
                </h3>
              </div>
            </Link>

            <Link
              href="/events"
              className="group relative h-80 overflow-hidden rounded-xl block"
            >
              <img
                src="https://vibe.filesafe.space/1783648094219892481/attachments/e3c30cdc-3a91-439c-8ffd-8e62d06b58f9.jpg"
                alt="Late-Night Energy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <h3 className="text-3xl font-heading font-bold uppercase text-white tracking-wider">
                  Late-Night Energy
                </h3>
              </div>
            </Link>

            <Link
              href="/private-events"
              className="group relative h-80 overflow-hidden rounded-xl block"
            >
              <div className="absolute inset-0 bg-card"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-center items-center text-center">
                <h3 className="text-3xl font-heading font-bold uppercase text-foreground tracking-wider mb-4">
                  Private Events
                </h3>
                <span className="text-primary uppercase font-bold tracking-widest text-sm group-hover:underline">
                  Plan Yours
                </span>
              </div>
            </Link>

            <Link
              href="/our-story"
              className="group relative h-80 overflow-hidden rounded-xl block"
            >
              <div className="absolute inset-0 bg-primary/20"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-center items-center text-center">
                <h3 className="text-3xl font-heading font-bold uppercase text-foreground tracking-wider mb-4">
                  Shoals Music History
                </h3>
                <span className="text-primary uppercase font-bold tracking-widest text-sm group-hover:underline">
                  Read Our Story
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Private events callout */}
      <section className="py-24 px-4 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
            Bring Your Event to FloBama
          </h2>
          <p className="text-lg md:text-xl mb-10 leading-relaxed font-medium">
            From birthdays and class reunions to company parties, charity
            events, and ticketed concerts, FloBama can help create an event
            built around your crowd, budget, food, and entertainment needs.
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
      </section>

      {/* 8. FloBama story preview */}
      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-primary font-heading uppercase tracking-widest mb-4 font-bold">
            Built for the Music
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
            The FloBama Story
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
            FloBama began with a vision from brothers Bart and Drew Davis:
            create a gathering place that celebrates the Shoals&apos; music, food,
            and community. Years later, FloBama remains a downtown destination
            for locals, visitors, musicians, and unforgettable nights.
          </p>
          <Button
            asChild
            size="lg"
            className="font-heading font-bold uppercase tracking-wider"
          >
            <Link href="/our-story">Read the FloBama Story</Link>
          </Button>
        </div>
      </section>

      <StaffLoginSection />
    </div>
  );
}

