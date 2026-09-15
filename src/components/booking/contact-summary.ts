function contactSummary(record: {
  contactLinkStatus: "linked" | "none" | "error";
  contactLinkMessage: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}): { text: string; tone: "muted" | "error" } {
  if (record.contactLinkStatus === "error") {
    return { text: record.contactLinkMessage || "Contact lookup failed", tone: "error" };
  }
  if (record.contactLinkStatus === "none") {
    return { text: "No linked contact", tone: "muted" };
  }
  const text = [record.contactName, record.email, record.phone].filter(Boolean).join(" · ");
  return { text: text || "Linked contact has no name, email, or phone", tone: "muted" };
}

export { contactSummary };
