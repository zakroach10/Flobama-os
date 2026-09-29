"use client";

import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-forms";

export function StaffLoginSection() {
  return (
    <section
      id="staff-login"
      className="border-t border-border bg-[#120e0c] px-4 py-20 text-[#f7f1ea]"
      aria-labelledby="staff-login-title"
    >
      <div className="container mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-start">
        <div>
          <p className="text-sm font-heading font-bold uppercase tracking-[0.28em] text-[#d36b4a]">
            Staff access
          </p>
          <h2
            id="staff-login-title"
            className="mt-3 text-4xl font-heading font-bold uppercase tracking-wider md:text-5xl"
          >
            FloBama OS login
          </h2>
          <p className="mt-4 max-w-xl text-lg text-[#cbb7a8]">
            Venue staff sign in here for events, screens, LED wall, trivia, and ticketing. There is no public
            registration.
          </p>
          <p className="mt-6 text-sm text-[#8a7368]">
            Prefer a dedicated page?{" "}
            <Link href="/login" className="text-[#d36b4a] underline-offset-4 hover:underline">
              Open /login
            </Link>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/35 p-6 shadow-2xl backdrop-blur-sm">
          <LoginForm nextPath="/dashboard" compact />
        </div>
      </div>
    </section>
  );
}
