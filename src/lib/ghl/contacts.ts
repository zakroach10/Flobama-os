import { ghlFetch, resolveGhlConfig, ghlConfigured, type GhlDeps } from "@/lib/ghl/client";

export type LinkedContactStatus = "linked" | "none" | "error";

export type LinkedContact = {
  status: LinkedContactStatus;
  contactId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  relationshipLabel: string | null;
};

export type GhlRelation = {
  id?: string;
  associationId?: string;
  firstObjectKey?: string;
  secondObjectKey?: string;
  firstObjectLabel?: string;
  secondObjectLabel?: string;
  firstRecordId?: string;
  secondRecordId?: string;
  recordId?: string;
  relatedRecordId?: string;
  objectKey?: string;
  relatedObjectKey?: string;
  key?: string;
  label?: string;
  [key: string]: unknown;
};

/** Preferred association labels when multiple contacts are linked. */
export const INTENDED_CONTACT_LABELS = [
  "primary contact",
  "band contact",
  "inquiry contact",
  "submitter",
  "applicant",
  "contact",
];

const RELATION_PAGE_LIMIT = 100;
const MAX_RELATION_PAGES = 20;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function isContactObjectKey(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeLabel(value);
  return normalized === "contact" || normalized === "contacts" || normalized.endsWith(" contact");
}

export function extractRelations(payload: unknown): GhlRelation[] {
  if (Array.isArray(payload)) return payload as GhlRelation[];
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of ["relations", "data", "results", "items"]) {
    if (Array.isArray(record[key])) return record[key] as GhlRelation[];
  }
  return [];
}

export function unwrapContact(payload: unknown): Record<string, unknown> | null {
  const record = asRecord(payload);
  if (!record) return null;
  if (asRecord(record.contact)) return asRecord(record.contact);
  if (record.id || record.firstName || record.email || record.phone) return record;
  return null;
}

export function mapContactFields(contact: Record<string, unknown>): {
  name: string | null;
  email: string | null;
  phone: string | null;
} {
  const first = asString(contact.firstName ?? contact.first_name);
  const last = asString(contact.lastName ?? contact.last_name);
  const name = [first, last].filter(Boolean).join(" ").trim() || null;
  return {
    name,
    email: asString(contact.email),
    phone: asString(contact.phone),
  };
}

type ContactCandidate = {
  contactId: string;
  relationshipLabel: string | null;
  rank: number;
};

function relationLabels(relation: GhlRelation): string[] {
  return [
    asString(relation.firstObjectLabel),
    asString(relation.secondObjectLabel),
    asString(relation.label),
    asString(relation.key),
  ].filter((value): value is string => Boolean(value));
}

function labelRank(labels: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const label of labels) {
    const normalized = normalizeLabel(label);
    const index = INTENDED_CONTACT_LABELS.findIndex((intended) => intended === normalized);
    if (index >= 0) best = Math.min(best, index);
  }
  return best;
}

export function resolveLinkedContactId(
  relations: GhlRelation[],
  recordId: string,
): { contactId: string; relationshipLabel: string | null } | { contactId: null; reason: "none" | "ambiguous" } {
  const candidates: ContactCandidate[] = [];

  for (const relation of relations) {
    const firstKey = asString(relation.firstObjectKey);
    const secondKey = asString(relation.secondObjectKey);
    const firstId = asString(relation.firstRecordId);
    const secondId = asString(relation.secondRecordId);
    const labels = relationLabels(relation);

    if (firstId && secondId) {
      const recordIsFirst = firstId === recordId;
      const recordIsSecond = secondId === recordId;
      if (!recordIsFirst && !recordIsSecond) continue;

      if (recordIsFirst && isContactObjectKey(secondKey)) {
        candidates.push({ contactId: secondId, relationshipLabel: labels[0] ?? null, rank: labelRank(labels) });
        continue;
      }
      if (recordIsSecond && isContactObjectKey(firstKey)) {
        candidates.push({ contactId: firstId, relationshipLabel: labels[0] ?? null, rank: labelRank(labels) });
        continue;
      }

      // When object keys are omitted, only accept the other side if a label indicates contact.
      if (!firstKey && !secondKey && labelRank(labels) !== Number.POSITIVE_INFINITY) {
        const otherId = recordIsFirst ? secondId : firstId;
        candidates.push({ contactId: otherId, relationshipLabel: labels[0] ?? null, rank: labelRank(labels) });
      }
      continue;
    }

    // Alternate payload shape: recordId + relatedRecordId
    const sourceId = asString(relation.recordId);
    const relatedId = asString(relation.relatedRecordId);
    const relatedKey = asString(relation.relatedObjectKey ?? relation.objectKey);
    if (sourceId === recordId && relatedId && isContactObjectKey(relatedKey ?? "contact")) {
      candidates.push({ contactId: relatedId, relationshipLabel: labels[0] ?? null, rank: labelRank(labels) });
    }
  }

  if (candidates.length === 0) return { contactId: null, reason: "none" };

  const unique = new Map<string, ContactCandidate>();
  for (const candidate of candidates) {
    const existing = unique.get(candidate.contactId);
    if (!existing || candidate.rank < existing.rank) unique.set(candidate.contactId, candidate);
  }
  const list = [...unique.values()];
  if (list.length === 1) {
    return { contactId: list[0]!.contactId, relationshipLabel: list[0]!.relationshipLabel };
  }

  const intended = list
    .filter((candidate) => candidate.rank !== Number.POSITIVE_INFINITY)
    .sort((a, b) => a.rank - b.rank);
  if (intended.length >= 1) {
    return { contactId: intended[0]!.contactId, relationshipLabel: intended[0]!.relationshipLabel };
  }

  return { contactId: null, reason: "ambiguous" };
}

export async function listRecordRelations(recordId: string, deps?: GhlDeps): Promise<GhlRelation[]> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return [];

  const relations: GhlRelation[] = [];
  let skip = 0;
  for (let page = 0; page < MAX_RELATION_PAGES; page += 1) {
    const payload = await ghlFetch(
      `/associations/relations/${encodeURIComponent(recordId)}`,
      {
        searchParams: {
          locationId: config.locationId,
          skip: String(skip),
          limit: String(RELATION_PAGE_LIMIT),
        },
      },
      { ...deps, config },
    );
    const batch = extractRelations(payload);
    relations.push(...batch);
    if (batch.length < RELATION_PAGE_LIMIT) break;
    skip += RELATION_PAGE_LIMIT;
  }
  return relations;
}

export async function getContact(contactId: string, deps?: GhlDeps): Promise<Record<string, unknown> | null> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return null;
  const payload = await ghlFetch(`/contacts/${encodeURIComponent(contactId)}`, {}, { ...deps, config });
  return unwrapContact(payload);
}

export async function loadLinkedContact(recordId: string, deps?: GhlDeps): Promise<LinkedContact> {
  try {
    const relations = await listRecordRelations(recordId, deps);
    const resolved = resolveLinkedContactId(relations, recordId);
    if (!resolved.contactId) {
      if ("reason" in resolved && resolved.reason === "ambiguous") {
        return {
          status: "error",
          contactId: null,
          name: null,
          email: null,
          phone: null,
          relationshipLabel: null,
          message: "Multiple contacts are linked; none match the intended contact relationship label.",
        };
      }
      return {
        status: "none",
        contactId: null,
        name: null,
        email: null,
        phone: null,
        relationshipLabel: null,
        message: "No linked contact",
      };
    }

    const contact = await getContact(resolved.contactId, deps);
    if (!contact) {
      return {
        status: "error",
        contactId: resolved.contactId,
        name: null,
        email: null,
        phone: null,
        relationshipLabel: resolved.relationshipLabel,
        message: "Linked contact lookup failed.",
      };
    }

    const fields = mapContactFields(contact);
    return {
      status: "linked",
      contactId: resolved.contactId,
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      relationshipLabel: resolved.relationshipLabel,
      message: null,
    };
  } catch (error) {
    return {
      status: "error",
      contactId: null,
      name: null,
      email: null,
      phone: null,
      relationshipLabel: null,
      message: error instanceof Error ? error.message : "Linked contact lookup failed.",
    };
  }
}

export async function loadLinkedContacts(
  recordIds: string[],
  deps?: GhlDeps,
  concurrency = 5,
): Promise<Map<string, LinkedContact>> {
  const results = new Map<string, LinkedContact>();
  const unique = [...new Set(recordIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += concurrency) {
    const slice = unique.slice(i, i + concurrency);
    const batch = await Promise.all(
      slice.map(async (id) => [id, await loadLinkedContact(id, deps)] as const),
    );
    for (const [id, contact] of batch) results.set(id, contact);
  }
  return results;
}
