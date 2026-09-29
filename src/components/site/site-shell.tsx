"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Music2, Music4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NowPlayingWidget } from "@/components/site/now-playing-widget";
import { FloatingVideoWidget } from "@/components/site/floating-video-widget";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = window.setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const navLinks = [
    { name: "Live Music", path: "/live-music" },
    { name: "Events", path: "/events" },
    { name: "Menu", path: "/menu" },
    { name: "Catering", path: "/catering" },
    { name: "Private Events", path: "/private-events" },
    { name: "Band Inquiries", path: "/band-inquiries" },
    { name: "Our Story", path: "/our-story" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans antialiased">
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          isScrolled
            ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-4 h-24 md:h-28 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 z-50">
            <img
              src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6934c64d1d466e655f1b0c45.png"
              alt="FloBama Logo"
              className="h-16 md:h-20 w-auto object-contain"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.path}
                className="text-sm font-heading font-bold uppercase tracking-wider hover:text-primary transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            <Button
              asChild
              variant="default"
              className="font-heading font-bold uppercase tracking-wider"
            >
              <Link href="/events">See Events</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="font-heading font-bold uppercase tracking-wider border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <a
                href="https://mk360.me/orderflobama"
                target="_blank"
                rel="noopener noreferrer"
              >
                Order Online
              </a>
            </Button>
          </div>
          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 z-50 text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Nav */}
        <div
          className={`fixed inset-0 bg-background z-40 transition-transform duration-300 ease-in-out lg:hidden pt-28 px-6 overflow-y-auto ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <nav className="flex flex-col gap-6 text-center">
            <Link
              href="/"
              className="text-2xl font-heading font-bold uppercase tracking-wider"
            >
              Home
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.path}
                className="text-2xl font-heading font-bold uppercase tracking-wider hover:text-primary"
              >
                {link.name}
              </Link>
            ))}
            <div className="flex flex-col gap-4 mt-8">
              <Button
                asChild
                size="lg"
                className="w-full font-heading font-bold uppercase tracking-wider"
              >
                <a
                  href="https://mk360.me/orderflobama"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Order Online
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full font-heading font-bold uppercase tracking-wider"
              >
                <Link href="/events">Events</Link>
              </Button>
            </div>

            <div className="mt-12 flex flex-col gap-2 text-muted-foreground">
              <p className="font-heading font-bold uppercase text-foreground">
                FloBama Restaurant & Music Hall
              </p>
              <p>311 N. Court Street</p>
              <p>Florence, AL 35630</p>
              <p>256-764-2225</p>
              <div className="flex justify-center gap-4 mt-4">
                <a
                  href="https://www.facebook.com/flobamamusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  <span aria-label="Facebook" className="text-xs font-bold tracking-wider">FB</span>
                </a>
                <a
                  href="https://www.instagram.com/flobamamusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  <span aria-label="Instagram" className="text-xs font-bold tracking-wider">IG</span>
                </a>
                <a
                  href="https://www.youtube.com/@flobamamusichall"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  <span aria-label="YouTube" className="text-xs font-bold tracking-wider">YT</span>
                </a>
                <a
                  href="https://www.tiktok.com/@flobamadowntown"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  <Music2 />
                </a>
                <a
                  href="https://snapchat.com/t/lkpfmljo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  <Music4 />
                </a>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <NowPlayingWidget />
      <FloatingVideoWidget />

      <footer className="bg-[#111] border-t border-border pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div>
              <img
                src="https://assets.cdn.filesafe.space/EoCbYBHBgxShA8KuCYLM/media/6934c64d1d466e655f1b0c45.png"
                alt="FloBama Logo"
                className="h-16 w-auto object-contain mb-6"
              />
              <p className="text-muted-foreground mb-2">
                FloBama Restaurant and Music Hall
              </p>
              <p className="text-muted-foreground mb-2">311 N. Court Street</p>
              <p className="text-muted-foreground mb-2">Florence, AL 35630</p>
              <p className="text-muted-foreground mb-6">
                256-764-2225
                <br />
                bart@flobamadowntown.com
              </p>
              <div className="flex gap-4">
                <a
                  href="https://www.facebook.com/flobamamusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="text-xs font-bold">FB</span>
                </a>
                <a
                  href="https://www.instagram.com/flobamamusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="text-xs font-bold">IG</span>
                </a>
                <a
                  href="https://www.youtube.com/@flobamamusichall"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="text-xs font-bold">YT</span>
                </a>
                <a
                  href="https://www.tiktok.com/@flobamadowntown"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Music2 size={24} />
                </a>
                <a
                  href="https://snapchat.com/t/lkpfmljo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Music4 size={24} />
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-heading font-bold text-xl uppercase tracking-wider mb-6">
                Hours
              </h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex justify-between">
                  <span>Monday:</span> <span>Closed</span>
                </li>
                <li className="flex justify-between">
                  <span>Tuesday–Thursday:</span> <span>11:00 AM–11:00 PM</span>
                </li>
                <li className="flex justify-between">
                  <span>Friday–Saturday:</span> <span>11:00 AM–2:00 AM</span>
                </li>
                <li className="flex justify-between">
                  <span>Sunday:</span> <span>Closed</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-heading font-bold text-xl uppercase tracking-wider mb-6">
                Explore
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/events"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Events
                  </Link>
                </li>
                <li>
                  <Link
                    href="/menu"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Menu
                  </Link>
                </li>
                <li>
                  <Link
                    href="/catering"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Catering
                  </Link>
                </li>
                <li>
                  <Link
                    href="/private-events"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Private Events
                  </Link>
                </li>
                <li>
                  <Link
                    href="/band-inquiries"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Band Inquiries
                  </Link>
                </li>
                <li>
                  <Link
                    href="/our-story"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Our Story
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/suggestions"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Suggestions
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#staff-login"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    Staff Login
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-heading font-bold text-xl uppercase tracking-wider mb-6">
                Stay Connected
              </h3>
              <p className="text-muted-foreground mb-4">
                Join our list for updates on shows, events, and specials.
              </p>
              <form className="flex flex-col gap-3">
                <input
                  type="email"
                  id="newsletter-email"
                  placeholder="Email Address"
                  className="bg-background border border-border rounded-md px-4 py-2 focus:outline-none focus:border-primary text-foreground"
                  required
                />
                <Button
                  type="button"
                  className="font-heading font-bold uppercase tracking-wider"
                  onClick={async () => {
                    const input = document.getElementById(
                      "newsletter-email",
                    ) as HTMLInputElement;
                    if (!input || !input.checkValidity()) {
                      input?.reportValidity();
                      return;
                    }

                    const trackingPayload = {
                      type: "external_form_submission",
                      timestamp: new Date().toISOString(),
                      formId: "newsletter-signup",
                      formData: { email: input.value },
                      formLabels: { email: "Email" },
                      url: window.location.href,
                      title: document.title,
                      path: window.location.pathname,
                      userAgent: navigator.userAgent,
                      trackingId: "tk_db9f7546022a4e688dc84e43e045f7cc",
                      locationId: "EoCbYBHBgxShA8KuCYLM",
                      projectId: "1783648094219892481",
                      sessionId: crypto.randomUUID(),
                      properties: {
                        deviceType: /Mobile|Android|iPhone/i.test(
                          navigator.userAgent,
                        )
                          ? "mobile"
                          : "desktop",
                        source: "ai_studio",
                        projectId: "1783648094219892481",
                        formName: "Newsletter Signup",
                      },
                    };

                    try {
                      const res = await fetch(
                        "https://backend.leadconnectorhq.com/external-tracking/events",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(trackingPayload),
                        },
                      );
                      if (res.ok) {
                        input.value = "";
                        alert("Thank you for subscribing!");
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  Subscribe
                </Button>
              </form>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()} FloBama Restaurant and Music
              Hall. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link
                href="/privacy-policy"
                className="hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
