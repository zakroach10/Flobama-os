export type PhotoBoothCaptureInsert = {
  id: string;
  venueId: string;
  storagePath: string;
  tokenHash: string;
  byteSize: number;
  eventLabel: string | null;
  createdAt: string;
  expiresAt: string;
};

export type PhotoBoothCaptureRow = PhotoBoothCaptureInsert & {
  purgedAt: string | null;
};

export type PhotoBoothRepository = {
  countHits(bucketKey: string, sinceIso: string): Promise<number>;
  insertHit(bucketKey: string, atIso: string): Promise<void>;
  deleteHitsBefore(beforeIso: string): Promise<void>;
  uploadJpeg(path: string, bytes: Uint8Array): Promise<{ error: string | null }>;
  deleteObject(path: string): Promise<{ error: string | null }>;
  downloadJpeg(path: string): Promise<{ bytes: Uint8Array | null; error: string | null }>;
  insertCapture(row: PhotoBoothCaptureInsert): Promise<{ error: string | null }>;
  findByTokenHash(tokenHash: string): Promise<PhotoBoothCaptureRow | null>;
  listDueForPurge(nowIso: string, limit: number): Promise<PhotoBoothCaptureRow[]>;
  markPurged(id: string, atIso: string): Promise<void>;
};
