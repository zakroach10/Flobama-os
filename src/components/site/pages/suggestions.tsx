"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

const SOCIAL_IMAGE =
  "https://vibe.filesafe.space/1783648094219892481/attachments/b1830cc3-5716-49fd-b6d5-595ceed8ea48.png";

const TRACKING_ID = "tk_db9f7546022a4e688dc84e43e045f7cc";
const LOCATION_ID = "EoCbYBHBgxShA8KuCYLM";
const PROJECT_ID = "1783648094219892481";
const FORM_ID = "suggestions-feedback";
const FORM_NAME = "FloBama Feedback";

// CRM custom field IDs (registered in the CRM)
const FIELD_RATING = "EozEgmr1sSLGdLiQ6IK3"; // Overall Experience Rating
const FIELD_FOOD = "Te5qLTWIadMJNehcJbbr"; // Food and Menu Feedback
const FIELD_IMPROVEMENTS = "zSXsVPaU3Z3OLt3wrfpM"; // Improvement Suggestions
const FIELD_NAME = "EBfQc7ETnw8qjQELG1sv"; // Feedback Name

const Suggestions = () => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState("");
  const [foodFeedback, setFoodFeedback] = useState("");
  const [improvements, setImprovements] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Help Us Make FloBama Better | FloBama Suggestions";
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) ogImg.setAttribute("content", SOCIAL_IMAGE);
    const twImg = document.querySelector('meta[name="twitter:image"]');
    if (twImg) twImg.setAttribute("content", SOCIAL_IMAGE);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!rating) e.rating = "Please select a rating.";
    if (!improvements.trim())
      e.improvements = "Please tell us what we could improve.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    // Build formData and formLabels with standard + custom fields
    const formData: Record<string, string> = {};
    const formLabels: Record<string, string> = {};

    // Standard contact fields
    if (email) {
      formData.email = email;
      formLabels.email = "Email Address";
    }
    if (name) {
      formData.first_name = name;
      formLabels.first_name = "Name";
    }

    // Custom fields
    formData[FIELD_RATING] = rating;
    formLabels[FIELD_RATING] = "Overall Experience Rating";

    if (foodFeedback) {
      formData[FIELD_FOOD] = foodFeedback;
      formLabels[FIELD_FOOD] = "Food and Menu Feedback";
    }

    formData[FIELD_IMPROVEMENTS] = improvements;
    formLabels[FIELD_IMPROVEMENTS] = "Improvement Suggestions";

    if (name) {
      formData[FIELD_NAME] = name;
      formLabels[FIELD_NAME] = "Feedback Name";
    }

    const payload = {
      type: "external_form_submission",
      timestamp: new Date().toISOString(),
      formId: FORM_ID,
      formName: FORM_NAME,
      formData,
      formLabels,
      url: window.location.href,
      title: document.title,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      trackingId: TRACKING_ID,
      locationId: LOCATION_ID,
      projectId: PROJECT_ID,
      sessionId: crypto.randomUUID(),
      properties: {
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent)
          ? "mobile"
          : "desktop",
        source: "ai_studio",
        projectId: PROJECT_ID,
        formName: FORM_NAME,
      },
    };

    const body = new FormData();
    body.append("event", JSON.stringify(payload));

    try {
      const res = await fetch(
        "https://backend.leadconnectorhq.com/external-tracking/events",
        {
          method: "POST",
          headers: {
            version: "2021-07-28",
          },
          body,
        },
      );
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Tracking error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <CheckCircle2 className="w-20 h-20 text-primary mx-auto mb-8" />
          <h2 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
            Thank You
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            Your feedback helps us make FloBama better for everyone. We
            appreciate you taking the time to share your thoughts.
          </p>
          <Button
            asChild
            size="lg"
            className="font-heading font-bold uppercase tracking-wider"
          >
            <a href="/suggestions">Submit Another</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-24">
      {/* Hero */}
      <section className="py-24 px-4 bg-card border-b border-border text-center">
        <div className="container mx-auto max-w-3xl">
          <p className="text-primary font-heading uppercase tracking-widest mb-4 font-bold">
            Help Us Make FloBama Better
          </p>
          <h1 className="text-5xl md:text-7xl font-heading font-bold uppercase tracking-wider mb-6">
            We Want Your Feedback
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your experience matters to us. Tell us what you love, what we can do
            better, and what you&apos;d like to see at FloBama.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-16 px-4 bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-12 gap-8 items-start">
            {/* Visual promo Card */}
            <div className="md:col-span-5 order-2 md:order-1">
              <div className="bg-card rounded-xl border border-border p-3 overflow-hidden shadow-2xl sticky top-28">
                <img
                  src={SOCIAL_IMAGE}
                  alt="Help Us Make FloBama Better - We Want Your Feedback"
                  className="w-full h-auto rounded-lg object-cover"
                />
              </div>
            </div>

            {/* Form */}
            <div className="md:col-span-7 order-1 md:order-2 bg-card rounded-xl border border-border p-8 md:p-10 shadow-2xl">
              <form className="space-y-6">
                {/* Rating - required dropdown */}
                <div className="space-y-3">
                  <Label
                    htmlFor="rating"
                    className="font-heading font-bold uppercase tracking-wider text-foreground"
                  >
                    How would you rate your overall experience at FloBama?{" "}
                    <span className="text-primary">*</span>
                  </Label>
                  <select
                    id="rating"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-4 py-3 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    required
                  >
                    <option value="" disabled>
                      Select a rating...
                    </option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Average">Average</option>
                    <option value="Below Average">Below Average</option>
                    <option value="Poor">Poor</option>
                  </select>
                  {errors.rating && (
                    <p className="text-red-400 text-sm">{errors.rating}</p>
                  )}
                </div>

                {/* Food feedback - optional */}
                <div className="space-y-3">
                  <Label
                    htmlFor="foodFeedback"
                    className="font-heading font-bold uppercase tracking-wider text-foreground"
                  >
                    What do you like or dislike about our food and menu?
                  </Label>
                  <Textarea
                    id="foodFeedback"
                    value={foodFeedback}
                    onChange={(e) => setFoodFeedback(e.target.value)}
                    rows={4}
                    placeholder="Tell us about your food experience..."
                    className="bg-background border-border focus:border-primary focus:ring-primary"
                  />
                </div>

                {/* Improvements - required */}
                <div className="space-y-3">
                  <Label
                    htmlFor="improvements"
                    className="font-heading font-bold uppercase tracking-wider text-foreground"
                  >
                    What could FloBama improve, change, or add?{" "}
                    <span className="text-primary">*</span>
                  </Label>
                  <Textarea
                    id="improvements"
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    rows={5}
                    placeholder="Share your suggestions..."
                    className="bg-background border-border focus:border-primary focus:ring-primary"
                    required
                  />
                  {errors.improvements && (
                    <p className="text-red-400 text-sm">
                      {errors.improvements}
                    </p>
                  )}
                </div>

                {/* Name - optional */}
                <div className="space-y-3">
                  <Label
                    htmlFor="name"
                    className="font-heading font-bold uppercase tracking-wider text-foreground"
                  >
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="bg-background border-border focus:border-primary focus:ring-primary"
                  />
                </div>

                {/* Email - optional */}
                <div className="space-y-3">
                  <Label
                    htmlFor="email"
                    className="font-heading font-bold uppercase tracking-wider text-foreground"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email (optional)"
                    className="bg-background border-border focus:border-primary focus:ring-primary"
                  />
                </div>

                <Button
                  type="button"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full font-heading font-bold uppercase tracking-wider h-14 text-lg"
                >
                  {submitting ? "Sending..." : "Send Feedback"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Suggestions;
