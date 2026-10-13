export function isMissingDisplayDeviceRelation(message: string) {
  return /display_device|media_content_hashes/i.test(message) &&
    /does not exist|schema cache|could not find/i.test(message);
}
