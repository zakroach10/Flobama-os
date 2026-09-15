export const BAND_INQUIRY_OBJECT = "custom_objects.band_inquiries";

export type BandInquiryFieldKind = "text" | "url" | "file";

export type BandInquiryFieldSpec = {
  key: string;
  label: string;
  kind?: BandInquiryFieldKind;
  aliases?: string[];
  section: "profile" | "links" | "booking" | "about" | "files";
};

export const BAND_INQUIRY_FIELDS: BandInquiryFieldSpec[] = [
  { key: "artist_band_name", label: "Artist / band name", aliases: ["band_name", "band name"], section: "profile" },
  { key: "genre", label: "Genre", section: "profile" },
  { key: "home_city__state", label: "Home city / state", aliases: ["home_city_state", "home_city"], section: "profile" },
  { key: "website", label: "Website", kind: "url", section: "links" },
  { key: "facebook", label: "Facebook", kind: "url", section: "links" },
  { key: "instagram", label: "Instagram", kind: "url", section: "links" },
  { key: "youtube", label: "YouTube", kind: "url", section: "links" },
  {
    key: "spotifystreaming",
    label: "Spotify / streaming",
    kind: "url",
    aliases: ["spotify_streaming", "spotify"],
    section: "links",
  },
  { key: "electronic_press_kit_epk", label: "Electronic press kit (EPK)", kind: "url", aliases: ["epk"], section: "links" },
  { key: "number_of_performers", label: "Number of performers", section: "booking" },
  { key: "typical_performance_length", label: "Typical performance length", section: "booking" },
  { key: "available_dates", label: "Available dates", section: "booking" },
  { key: "expected_compensation", label: "Expected compensation", section: "booking" },
  { key: "typical_draw", label: "Typical draw", aliases: ["typical_drawr"], section: "booking" },
  { key: "previously_played_flobama", label: "Previously played FloBama", section: "booking" },
  { key: "production_requirements", label: "Production requirements", section: "about" },
  { key: "artist_biography", label: "Artist biography", section: "about" },
  { key: "additional_information", label: "Additional information", section: "about" },
  { key: "uploaded_file", label: "Uploaded file", kind: "file", aliases: ["uploaded_files"], section: "files" },
  { key: "file_upload", label: "File upload", kind: "file", section: "files" },
];

export const BAND_INQUIRY_DISPLAY_KEYS = ["artist_band_name", "band_name"];

export type BandInquiryFieldValue = {
  key: string;
  label: string;
  value: string;
  href: string | null;
  section: BandInquiryFieldSpec["section"];
};

export type BandInquiryView = {
  contactName: string | null;
  genre: string | null;
  homeCity: string | null;
  compensation: string | null;
  availableDates: string | null;
  fields: BandInquiryFieldValue[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function scalar(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return text || null;
  }
  if (Array.isArray(value)) {
    const joined = value.map(scalar).filter(Boolean).join(", ");
    return joined || null;
  }
  const record = asRecord(value);
  if (!record) return null;
  if ("value" in record) return scalar(record.value);
  if ("url" in record) return scalar(record.url);
  if ("documentUrl" in record) return scalar(record.documentUrl);
  if ("full_name" in record) return scalar(record.full_name);
  return null;
}

function lastSegment(key: string): string {
  const parts = key.split(".");
  return (parts[parts.length - 1] ?? key).trim().toLowerCase();
}

function keyMatches(propKey: string, fieldKey: string): boolean {
  const prop = propKey.trim().toLowerCase();
  const field = fieldKey.trim().toLowerCase();
  return (
    prop === field ||
    prop === `${BAND_INQUIRY_OBJECT}.${field}` ||
    lastSegment(prop) === field ||
    prop.endsWith(`.${field}`)
  );
}

export function inquiryProperty(properties: Record<string, string | null>, spec: BandInquiryFieldSpec): string | null {
  const keys = [spec.key, ...(spec.aliases ?? [])];
  for (const key of keys) {
    const exact = properties[key] ?? properties[`${BAND_INQUIRY_OBJECT}.${key}`];
    if (exact) return exact;
    const match = Object.entries(properties).find(([propKey, value]) => value && keyMatches(propKey, key));
    if (match?.[1]) return match[1];
  }
  return null;
}

function firstContact(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const record = asRecord(item);
      if (record) return record;
    }
    return null;
  }
  return asRecord(value);
}

export function extractContact(record: Record<string, unknown>, properties: Record<string, string | null>) {
  const relations = asRecord(record.relations);
  const contactProps =
    asRecord(record.contact) ??
    asRecord(record.primaryContact) ??
    asRecord(record.contactDetails) ??
    firstContact(record.associatedContacts) ??
    firstContact(relations?.contact) ??
    firstContact(relations?.contacts);
  const first = scalar(contactProps?.firstName ?? contactProps?.first_name);
  const last = scalar(contactProps?.lastName ?? contactProps?.last_name);
  const combined = [first, last].filter(Boolean).join(" ").trim() || null;

  const name =
    scalar(contactProps?.full_name) ??
    scalar(contactProps?.name) ??
    combined ??
    properties["contact.full_name"] ??
    properties.full_name ??
    null;
  const email =
    scalar(contactProps?.email) ??
    properties["contact.email"] ??
    properties.email ??
    properties.contact_email ??
    null;
  const phone =
    scalar(contactProps?.phone) ??
    scalar(contactProps?.phoneNumber) ??
    properties["contact.phone"] ??
    properties.phone ??
    properties.contact_phone ??
    null;

  return { name, email, phone };
}

export function toTelHref(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.toLowerCase().startsWith("tel:")) return trimmed;
  const digits = trimmed.replace(/[^\d+]/g, "");
  return `tel:${digits || trimmed}`;
}

export function toMailtoHref(email: string, subject?: string): string {
  const address = email.trim();
  if (!subject) return `mailto:${address}`;
  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

export function toWebHref(value: string, network?: "facebook" | "instagram" | "youtube" | "spotify"): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:")) return trimmed;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  const handle = trimmed.replace(/^@/, "");
  if (network === "instagram" && /^[\w.]+$/.test(handle)) return `https://instagram.com/${handle}`;
  if (network === "facebook" && !trimmed.includes(" ")) return `https://facebook.com/${handle}`;
  if (network === "youtube" && !trimmed.includes(" ")) {
    return trimmed.includes("/") ? `https://${trimmed.replace(/^https?:\/\//, "")}` : `https://youtube.com/@${handle}`;
  }
  if (network === "spotify" && !/^https?:/i.test(trimmed) && trimmed.includes("spotify")) {
    return trimmed;
  }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function hrefForField(spec: BandInquiryFieldSpec, value: string): string | null {
  if (spec.kind !== "url" && spec.kind !== "file") return null;
  if (spec.key === "instagram") return toWebHref(value, "instagram");
  if (spec.key === "facebook") return toWebHref(value, "facebook");
  if (spec.key === "youtube") return toWebHref(value, "youtube");
  if (spec.key === "spotifystreaming") return toWebHref(value, "spotify");
  return toWebHref(value);
}

function fieldByKey(key: string): BandInquiryFieldSpec {
  return BAND_INQUIRY_FIELDS.find((spec) => spec.key === key) ?? { key, label: key, section: "profile" };
}

export function buildBandInquiryView(
  record: Record<string, unknown>,
  properties: Record<string, string | null>,
): BandInquiryView {
  const fields = BAND_INQUIRY_FIELDS.map((spec) => {
    const value = inquiryProperty(properties, spec);
    if (!value) return null;
    return {
      key: spec.key,
      label: spec.label,
      value,
      href: hrefForField(spec, value),
      section: spec.section,
    } satisfies BandInquiryFieldValue;
  }).filter((field): field is BandInquiryFieldValue => Boolean(field));

  const byKey = (key: string) => fields.find((field) => field.key === key)?.value ?? inquiryProperty(properties, fieldByKey(key));

  return {
    contactName: extractContact(record, properties).name,
    genre: byKey("genre"),
    homeCity: byKey("home_city__state"),
    compensation: byKey("expected_compensation"),
    availableDates: byKey("available_dates"),
    fields,
  };
}

