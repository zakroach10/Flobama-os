"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const Catering = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://api.view360brands.com/js/form_embed.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const scrollToForm = () => {
    document
      .getElementById("catering-form")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      {/* Hero */}
      <section className="relative h-[50vh] flex items-center justify-center overflow-hidden">
        <img
          src="https://vibe.filesafe.space/1783648094219892481/attachments/24f253de-01bd-4fc6-a255-b7c7f976e8c1.jpg"
          alt="FloBama Catering"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6 text-white">
            Catering
          </h1>
          <p className="text-xl text-white/90 font-medium">
            Bring FloBama&apos;s famous smoked meats and Southern sides to your next
            event.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="py-24 px-4 bg-card text-center">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-heading font-bold uppercase tracking-wider mb-6">
            Authentic Southern Catering
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            Whether you&apos;re hosting a corporate lunch, a wedding reception, a
            family reunion, or a tailgate party, FloBama offers catering
            packages that bring our signature flavors directly to you. From
            slow-smoked barbecue to our classic Southern sides, we have options
            to feed any crowd.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              onClick={scrollToForm}
              size="lg"
              className="font-heading font-bold uppercase tracking-wider"
            >
              Inquire About Catering
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="font-heading font-bold uppercase tracking-wider"
            >
              <Link href="/menu">View Our Menu</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-background border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-xl border border-border text-center">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                Smoked Meats
              </h3>
              <p className="text-muted-foreground">
                Slow-smoked pulled pork, ribs, brisket, and smoked chicken
                prepared by our pitmasters.
              </p>
            </div>
            <div className="bg-card p-8 rounded-xl border border-border text-center">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                Southern Sides
              </h3>
              <p className="text-muted-foreground">
                Mac and cheese, baked beans, coleslaw, potato salad, and more
                classic favorites.
              </p>
            </div>
            <div className="bg-card p-8 rounded-xl border border-border text-center">
              <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                Custom Packages
              </h3>
              <p className="text-muted-foreground">
                We can customize our catering menu to fit the size, budget, and
                style of your specific event.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section
        id="catering-form"
        className="py-24 px-4 bg-card border-t border-border"
      >
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold uppercase tracking-wider mb-4">
              Request a Catering Quote
            </h2>
            <p className="text-muted-foreground">
              Fill out the form below and our catering team will get back to you
              to discuss your event.
            </p>
          </div>

          <div className="bg-background rounded-xl border border-border overflow-hidden">
            <iframe
              src="https://api.view360brands.com/widget/form/zt9l0NHb90BXqwONENPH"
              style={{
                width: "100%",
                height: "976px",
                border: "none",
                borderRadius: "12px",
                display: "block",
              }}
              id="inline-zt9l0NHb90BXqwONENPH"
              data-layout="{'id':'INLINE'}"
              data-trigger-type="alwaysShow"
              data-trigger-value=""
              data-activation-type="alwaysActivated"
              data-activation-value=""
              data-deactivation-type="neverDeactivate"
              data-deactivation-value=""
              data-form-name="AI STUDIO | Catering"
              data-height="976"
              data-layout-iframe-id="inline-zt9l0NHb90BXqwONENPH"
              data-form-id="zt9l0NHb90BXqwONENPH"
              title="AI STUDIO | Catering"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Catering;
