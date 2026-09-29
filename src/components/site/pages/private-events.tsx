"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const PrivateEvents = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    const form = document.getElementById(
      "private-events-form",
    ) as HTMLFormElement;
    if (!form || !form.checkValidity()) {
      form?.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const labels = Object.keys(data).reduce(
      (acc, key) => ({ ...acc, [key]: key }),
      {},
    );

    const trackingPayload = {
      type: "external_form_submission",
      timestamp: new Date().toISOString(),
      formId: "private-events-form",
      formData: data,
      formLabels: labels,
      url: window.location.href,
      title: document.title,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      trackingId: "tk_db9f7546022a4e688dc84e43e045f7cc",
      locationId: "EoCbYBHBgxShA8KuCYLM",
      projectId: "1783648094219892481",
      sessionId: crypto.randomUUID(),
      properties: {
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent)
          ? "mobile"
          : "desktop",
        source: "ai_studio",
        projectId: "1783648094219892481",
        formName: "Private Events Form",
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
        setIsSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      <section className="relative h-[50vh] flex items-center justify-center overflow-hidden">
        <img
          src="https://flobamadowntown.com/wp-content/uploads/elementor/thumbs/DSC00315-scaled-e1778917781379-rnj7beq2fgxvsqqhq4oy72jvi8vvp55lxukd5ixxzs.jpg"
          alt="FloBama Venue"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6 text-white">
            Host an Unforgettable Event at FloBama
          </h1>
          <p className="text-xl text-white/90 font-medium max-w-2xl mx-auto">
            Looking for a private-event venue in downtown Florence? FloBama
            offers a flexible space, Southern food, professional live-music
            production, and an energetic atmosphere for gatherings of many
            sizes.
          </p>
        </div>
      </section>

      <section className="py-24 px-4 bg-card">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-heading font-bold uppercase tracking-wider mb-6">
                Types of Events
              </h2>
              <ul className="grid grid-cols-2 gap-4 text-muted-foreground">
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Birthday parties
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Company parties
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Business events
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Charity events
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Class reunions
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Social events
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Team celebrations
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Holiday parties
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Rehearsal dinners
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Ticketed concerts
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Fundraisers
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-heading font-bold uppercase tracking-wider mb-6">
                Venue Features
              </h2>
              <ul className="space-y-4 text-muted-foreground">
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Downtown Florence
                  location
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Full restaurant
                  and bar
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Professional
                  stage
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Lighting and
                  sound
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> In-house sound
                  engineer
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Custom food
                  options
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Flexible
                  entertainment options (Acoustic, DJ, Full Band)
                </li>
                <li className="flex items-center">
                  <span className="text-primary mr-2">•</span> Flexible seating
                  and event configurations
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold uppercase tracking-wider mb-4">
              Tell Us About Your Event
            </h2>
            <p className="text-muted-foreground">
              Please fill out the form below and a member of our team will
              review your details and contact you soon.
            </p>
          </div>

          {/* Integration placeholder for GHL Form */}
          <div className="bg-card p-8 rounded-xl border border-border">
            {isSubmitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-heading font-bold uppercase tracking-wider mb-2">
                  Request Received
                </h3>
                <p className="text-muted-foreground">
                  Thank you for considering FloBama. A member of our team will
                  review your event details and contact you soon.
                </p>
              </div>
            ) : (
              <form id="private-events-form" className="space-y-8 text-left">
                <input
                  type="hidden"
                  name="source"
                  value="Website - Private Events"
                />

                <div className="space-y-6">
                  <h3 className="text-xl font-heading font-bold uppercase tracking-wider text-primary border-b border-border pb-2">
                    Contact Information
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">
                        First Name <span className="text-destructive">*</span>
                      </Label>
                      <Input id="firstName" name="firstName" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">
                        Last Name <span className="text-destructive">*</span>
                      </Label>
                      <Input id="lastName" name="lastName" required />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input id="email" name="email" type="email" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Phone <span className="text-destructive">*</span>
                      </Label>
                      <Input id="phone" name="phone" type="tel" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">
                      Company or Organization (Optional)
                    </Label>
                    <Input id="company" name="company" />
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-heading font-bold uppercase tracking-wider text-primary border-b border-border pb-2">
                    Event Details
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="eventType">
                        Event Type <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="eventType"
                        name="eventType"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select event type...</option>
                        <option value="Birthday Party">Birthday Party</option>
                        <option value="Company Party">Company Party</option>
                        <option value="Business Event">Business Event</option>
                        <option value="Charity Event">Charity Event</option>
                        <option value="Class Reunion">Class Reunion</option>
                        <option value="Social Event">Social Event</option>
                        <option value="Team Celebration">
                          Team Celebration
                        </option>
                        <option value="Holiday Party">Holiday Party</option>
                        <option value="Rehearsal Dinner">
                          Rehearsal Dinner
                        </option>
                        <option value="Ticketed Concert">
                          Ticketed Concert
                        </option>
                        <option value="Fundraiser">Fundraiser</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guestCount">
                        Estimated Guest Count{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="guestCount"
                        name="guestCount"
                        type="number"
                        required
                        min="1"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="eventDate">
                        Desired Event Date{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="eventDate"
                        name="eventDate"
                        type="date"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="altDate">Alternate Event Date</Label>
                      <Input id="altDate" name="altDate" type="date" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Preferred Start Time</Label>
                      <Input id="startTime" name="startTime" type="time" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">Estimated End Time</Label>
                      <Input id="endTime" name="endTime" type="time" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Is the date flexible?</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="flexibleDate"
                          value="yes"
                          className="text-primary focus:ring-primary"
                          defaultChecked
                        />{" "}
                        Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="flexibleDate"
                          value="no"
                          className="text-primary focus:ring-primary"
                        />{" "}
                        No
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-heading font-bold uppercase tracking-wider text-primary border-b border-border pb-2">
                    Event Needs
                  </h3>
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label>Food or Catering?</Label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="foodNeeded"
                            value="yes"
                            className="text-primary focus:ring-primary"
                          />{" "}
                          Yes
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="foodNeeded"
                            value="no"
                            className="text-primary focus:ring-primary"
                          />{" "}
                          No
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="foodNeeded"
                            value="not sure"
                            className="text-primary focus:ring-primary"
                            defaultChecked
                          />{" "}
                          Not Sure
                        </label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label>Bar Service Needed?</Label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="barNeeded"
                            value="yes"
                            className="text-primary focus:ring-primary"
                          />{" "}
                          Yes
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="barNeeded"
                            value="no"
                            className="text-primary focus:ring-primary"
                          />{" "}
                          No
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="barNeeded"
                            value="not sure"
                            className="text-primary focus:ring-primary"
                            defaultChecked
                          />{" "}
                          Not Sure
                        </label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label>Entertainment Needed?</Label>
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="entertainmentNeeded"
                            value="yes"
                            className="text-primary focus:ring-primary"
                          />{" "}
                          Yes
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="entertainmentNeeded"
                            value="no"
                            className="text-primary focus:ring-primary"
                          />{" "}
                          No
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="entertainmentNeeded"
                            value="not sure"
                            className="text-primary focus:ring-primary"
                            defaultChecked
                          />{" "}
                          Not Sure
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entertainmentPref">
                        Entertainment Preference
                      </Label>
                      <select
                        id="entertainmentPref"
                        name="entertainmentPref"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select preference...</option>
                        <option value="Acoustic Artist">Acoustic Artist</option>
                        <option value="Karaoke">Karaoke</option>
                        <option value="DJ">DJ</option>
                        <option value="Full Band">Full Band</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Estimated Budget</Label>
                      <Input id="budget" name="budget" placeholder="$" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="details">
                      Tell Us About Your Event{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="details"
                      name="details"
                      required
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">How Did You Hear About Us?</Label>
                    <Input id="source" name="source" />
                  </div>
                </div>

                <div className="flex items-start space-x-2 pt-4 border-t border-border">
                  <Checkbox
                    id="consent"
                    name="consent"
                    value="yes"
                    required
                    className="mt-1"
                  />
                  <Label
                    htmlFor="consent"
                    className="text-sm text-muted-foreground font-normal leading-snug"
                  >
                    I agree to receive communications from FloBama regarding
                    this event inquiry.
                  </Label>
                </div>

                <Button
                  type="button"
                  onClick={handleSubmit}
                  size="lg"
                  className="w-full sm:w-auto font-heading font-bold uppercase tracking-wider px-8"
                >
                  Request Event Information
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivateEvents;
