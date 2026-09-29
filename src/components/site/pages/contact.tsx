"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const Contact = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://api.view360brands.com/js/form_embed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      <section className="py-24 px-4 bg-card border-b border-border text-center">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6">
            Contact FloBama
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Have a general question about FloBama, an upcoming event, your
            visit, or the restaurant? Send us a message and our team will follow
            up.
          </p>
        </div>
      </section>

      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-3 gap-12 mb-16">
            <div className="lg:col-span-1 space-y-8">
              <div>
                <h3 className="text-xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                  Location
                </h3>
                <p className="text-muted-foreground">
                  FloBama Restaurant and Music Hall
                  <br />
                  311 N. Court Street
                  <br />
                  Florence, AL 35630
                </p>
              </div>
              <div>
                <h3 className="text-xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                  Contact
                </h3>
                <p className="text-muted-foreground mb-2">
                  <a href="tel:2567642225" className="hover:text-primary">
                    256-764-2225
                  </a>
                </p>
                <p className="text-muted-foreground">
                  <a
                    href="mailto:bart@flobamadowntown.com"
                    className="hover:text-primary"
                  >
                    bart@flobamadowntown.com
                  </a>
                </p>
              </div>
              <div>
                <h3 className="text-xl font-heading font-bold uppercase tracking-wider mb-4 text-primary">
                  Hours
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>Monday: Closed</li>
                  <li>Tuesday–Thursday: 11:00 AM–11:00 PM</li>
                  <li>Friday–Saturday: 11:00 AM–2:00 AM</li>
                  <li>Sunday: Closed</li>
                </ul>
              </div>

              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-4">
                  For private events, use our Private Events form. Artists and
                  bands should use our Band Inquiries form.
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full font-heading font-bold uppercase tracking-wider"
                  >
                    <Link href="/private-events">Private Event Inquiry</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full font-heading font-bold uppercase tracking-wider"
                  >
                    <Link href="/band-inquiries">Band Inquiry</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-card py-2 md:py-6 rounded-xl border border-border h-full flex flex-col justify-center min-h-[600px] overflow-hidden">
                <iframe
                  src="https://api.view360brands.com/widget/form/bd50u3TF3AGRionh2NnI"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    borderRadius: "12px",
                  }}
                  id="inline-bd50u3TF3AGRionh2NnI"
                  data-layout="{'id':'INLINE'}"
                  data-trigger-type="alwaysShow"
                  data-trigger-value=""
                  data-activation-type="alwaysActivated"
                  data-activation-value=""
                  data-deactivation-type="neverDeactivate"
                  data-deactivation-value=""
                  data-form-name="AI STUDIO | CONTACT FORM"
                  data-height="1025"
                  data-layout-iframe-id="inline-bd50u3TF3AGRionh2NnI"
                  data-form-id="bd50u3TF3AGRionh2NnI"
                  title="AI STUDIO | CONTACT FORM"
                ></iframe>
              </div>
            </div>
          </div>

          <div className="w-full h-96 bg-card rounded-xl overflow-hidden border border-border">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3261.272545041151!2d-87.679636!3d34.8000499!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x887d1dfcbb3e9703%3A0xa69d515a815779!2sFloBama%20Restaurant%20and%20Music%20Hall!5e0!3m2!1sen!2sus!4v1715000000000!5m2!1sen!2sus"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
