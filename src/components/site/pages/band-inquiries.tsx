"use client";

import { useEffect } from "react";

const BandInquiries = () => {
  useEffect(() => {
    document.title = "Band Inquiries | Play the FloBama Stage in Florence, AL";

    const existing = document.getElementById("view360-form-embed");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = "https://api.view360brands.com/js/form_embed.js";
    script.id = "view360-form-embed";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById("view360-form-embed");
      if (s) s.remove();
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      <section className="py-24 px-4 bg-card border-b border-border text-center">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6">
            Play the FloBama Stage
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            FloBama welcomes inquiries from local, regional, and touring
            artists. Tell us about your act, audience, availability, and
            performance requirements.
          </p>
        </div>
      </section>

      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-heading font-bold uppercase tracking-wider mb-6">
              Venue Information
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-left">
              <div className="bg-card p-6 rounded-lg border border-border">
                <span className="text-primary font-bold block mb-2">
                  The Stage
                </span>
                <p className="text-muted-foreground text-sm">
                  30-foot professional stage equipped for full bands and dynamic
                  performances.
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <span className="text-primary font-bold block mb-2">
                  Production
                </span>
                <p className="text-muted-foreground text-sm">
                  Professional lighting and sound with an in-house sound
                  engineer.
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <span className="text-primary font-bold block mb-2">
                  Location
                </span>
                <p className="text-muted-foreground text-sm">
                  Located in downtown Florence with an established live-music
                  audience.
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <span className="text-primary font-bold block mb-2">
                  Atmosphere
                </span>
                <p className="text-muted-foreground text-sm">
                  High-energy restaurant and nightlife environment.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold uppercase tracking-wider mb-4">
              Submit Your Band or Artist Information
            </h2>
            <p className="text-muted-foreground">
              Complete the inquiry form below. Our team will review your
              information and contact you if the opportunity fits our current
              booking needs.
            </p>
          </div>

          <div className="bg-background rounded-xl border border-border overflow-hidden">
            <iframe
              src="https://api.view360brands.com/widget/form/DWqlNMpeDS0U0hJOK8sK"
              style={{
                width: "100%",
                height: "1981px",
                border: "none",
                borderRadius: "12px",
                display: "block",
              }}
              id="inline-DWqlNMpeDS0U0hJOK8sK"
              data-layout="{'id':'INLINE'}"
              data-trigger-type="alwaysShow"
              data-trigger-value=""
              data-activation-type="alwaysActivated"
              data-activation-value=""
              data-deactivation-type="neverDeactivate"
              data-deactivation-value=""
              data-form-name="AI STUDIO | Band Inquiry"
              data-height="1981"
              data-layout-iframe-id="inline-DWqlNMpeDS0U0hJOK8sK"
              data-form-id="DWqlNMpeDS0U0hJOK8sK"
              data-cookie-consent="true"
              data-cookie-consent-provider="auto"
              title="AI STUDIO | Band Inquiry"
            ></iframe>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BandInquiries;
