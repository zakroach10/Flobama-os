const PrivacyPolicy = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pt-20">
      <section className="py-24 px-4 bg-card border-b border-border text-center">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-wider mb-6">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </section>

      <section className="py-16 px-4 bg-background">
        <div className="container mx-auto max-w-3xl">
          <div className="prose prose-invert max-w-none text-muted-foreground">
            <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-foreground mb-4">
              1. Information We Collect
            </h2>
            <p className="mb-6">
              We collect information you provide directly to us when you fill
              out a form, request a private event, submit a band inquiry, or
              contact us. This may include your name, email address, phone
              number, and any other details you choose to provide.
            </p>

            <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-foreground mb-4 mt-8">
              2. How We Use Your Information
            </h2>
            <p className="mb-6">
              We use the information we collect to communicate with you about
              your inquiries, process event or band booking requests, and send
              you updates or marketing communications if you have opted in to
              receive them.
            </p>

            <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-foreground mb-4 mt-8">
              3. Information Sharing
            </h2>
            <p className="mb-6">
              We do not sell or rent your personal information to third parties.
              We may share your information with trusted service providers who
              assist us in operating our website and conducting our business, as
              long as those parties agree to keep this information confidential.
            </p>

            <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-foreground mb-4 mt-8">
              4. Cookies and Tracking
            </h2>
            <p className="mb-6">
              Our website may use cookies and similar tracking technologies to
              enhance your browsing experience, analyze site traffic, and
              understand where our visitors are coming from. You can control
              cookies through your browser settings.
            </p>

            <h2 className="text-2xl font-heading font-bold uppercase tracking-wider text-foreground mb-4 mt-8">
              5. Contact Us
            </h2>
            <p className="mb-6">
              If you have any questions about this Privacy Policy, please
              contact us at:
              <br />
              <br />
              FloBama Restaurant and Music Hall
              <br />
              311 N. Court Street
              <br />
              Florence, AL 35630
              <br />
              bart@flobamadowntown.com
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
