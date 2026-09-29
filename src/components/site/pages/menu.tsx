import Link from "next/link";
import { Button } from "@/components/ui/button";

const Menu = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      {/* Hero */}
      <section className="relative h-[50vh] flex items-center justify-center overflow-hidden">
        <img
          src="https://vibe.filesafe.space/1783648094219892481/attachments/24f253de-01bd-4fc6-a255-b7c7f976e8c1.jpg"
          alt="FloBama Food"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6 text-white">
            Food & Drinks
          </h1>
          <p className="text-xl text-white/90 font-medium">
            Southern favorites, smoked meats, and ice-cold drinks.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="py-24 px-4 bg-card text-center">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold uppercase tracking-wider mb-6">
            Fuel Your Night
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            From hand-crafted burgers and crispy wings to slow-smoked barbecue,
            FloBama serves the food you want before the show and after the music
            starts.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="font-heading font-bold uppercase tracking-wider"
            >
              <a
                href="https://mk360.me/orderflobama"
                target="_self"
                rel="noopener noreferrer"
              >
                Order Online Now
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="font-heading font-bold uppercase tracking-wider"
            >
              <a
                href="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6a654b53cf9f8312dc2740ca.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download PDF Menu
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-24 px-4 bg-background border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-xl border border-border">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                Starters & Wings
              </h3>
              <p className="text-muted-foreground mb-6">
                Crispy wings, loaded fries, nachos, and shareable apps to get
                the table started.
              </p>
            </div>
            <div className="bg-card p-8 rounded-xl border border-border">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                Smoked Meats
              </h3>
              <p className="text-muted-foreground mb-6">
                Slow-smoked pulled pork, ribs, and brisket plates served with
                classic Southern sides.
              </p>
            </div>
            <div className="bg-card p-8 rounded-xl border border-border">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                Burgers & Sandwiches
              </h3>
              <p className="text-muted-foreground mb-6">
                Hand-crafted burgers and hearty sandwiches built for a big
                appetite.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Callouts */}
      <section className="py-24 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 text-center">
            <div className="bg-background/10 p-12 rounded-xl backdrop-blur-sm">
              <h3 className="text-3xl font-heading font-bold uppercase tracking-wider mb-4">
                Catering & Events
              </h3>
              <p className="mb-8 font-medium">
                Bring FloBama&apos;s famous smoked meats and Southern sides to your
                next off-site event or in-house party.
              </p>
              <Button
                asChild
                variant="secondary"
                className="font-heading font-bold uppercase tracking-wider bg-background text-foreground hover:bg-background/90"
              >
                <Link href="/catering">Inquire About Catering</Link>
              </Button>
            </div>
            <div className="bg-background/10 p-12 rounded-xl backdrop-blur-sm">
              <h3 className="text-3xl font-heading font-bold uppercase tracking-wider mb-4">
                Gift Cards
              </h3>
              <p className="mb-8 font-medium">
                Give the gift of great food and live music. Perfect for
                birthdays, holidays, or just because.
              </p>
              <Button
                asChild
                variant="secondary"
                className="font-heading font-bold uppercase tracking-wider bg-background text-foreground hover:bg-background/90"
              >
                <a href="#" target="_blank" rel="noopener noreferrer">
                  Purchase Gift Card
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Menu;
