export const HELP_SECTIONS = [
  {
    href: "/help/introduction",
    title: "Introduction",
    description: "What FloBama OS is and how the public site and staff tools fit together.",
  },
  {
    href: "/help/faq",
    title: "FAQ",
    description: "Answers to common questions about sign-in, roles, events, screens, and ticketing.",
  },
  {
    href: "/help/run",
    title: "Run FloBama OS",
    description: "Local setup, Supabase bootstrap, scripts, and deploy notes.",
  },
] as const;

export type HelpSectionHref = (typeof HELP_SECTIONS)[number]["href"] | "/help";

export const HELP_FAQ = [
  {
    question: "What is FloBama OS?",
    answer:
      "FloBama OS is the staff operations platform for FloBama Music Hall, plus the public venue site. Staff use it for programming, booking, screens, cameras, ticketing, social, and audience tools. Guests use the public pages for events, menu, catering, and inquiries.",
  },
  {
    question: "How do I sign in?",
    answer:
      "Open the staff sign-in page at the site root (/). Use the email and temporary password an admin created for you in Settings → Staff. There is no public registration.",
  },
  {
    question: "Can I create my own staff account?",
    answer:
      "No. An admin creates staff logins in Settings → Staff. The first admin is bootstrapped once in Supabase (see Run FloBama OS). People cannot raise their own role.",
  },
  {
    question: "What do the staff roles mean?",
    answer:
      "Admins manage staff, venue settings, events, screens, and ticketing. Managers edit events/artists, import listings, screens, and ticketing, but cannot create staff or rename the venue. Viewers get read-only calendar and directory access and can activate LED wall scenes. Audience Interactors only see the Audience console.",
  },
  {
    question: "How do public events get updated?",
    answer:
      "Admins and managers use Events → Update to pull the published FloBama master sheet. Published, public, non-archived rows become public listings. Unpublished or archived sheet rows withdraw matching OS events.",
  },
  {
    question: "Where do guests buy tickets?",
    answer:
      "Public ticket pages live at /tickets/[eventId]. Staff manage inventory, orders, and door check-in under Ticketing. QR passes resolve at /t/[token].",
  },
  {
    question: "How does the LED wall work?",
    answer:
      "Staff configure and activate scenes under Screens → LED wall. A booth Mac runs the FloBama LED OBS client beside OBS. The client polls FloBama OS and switches the OBS scene. Uploaded media plays from /display/led.",
  },
  {
    question: "What port does local development use?",
    answer:
      "npm run dev serves the app at http://localhost:43123. Keep that origin in Supabase Auth redirect URLs when developing locally.",
  },
  {
    question: "Does this change flobamadowntown.com?",
    answer:
      "No. This repository does not modify flobamadowntown.com, Pick'em, or other production systems. Public embeds and APIs can be used from WordPress if you choose.",
  },
  {
    question: "Who do I contact for help?",
    answer:
      "Venue questions: bart@flobamadowntown.com or 256-764-2225. For FloBama OS access or setup issues, contact your FloBama admin or View360 support.",
  },
] as const;
