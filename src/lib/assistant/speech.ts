export type SpeechChunk = { transcript: string; isFinal: boolean };

/** Join recognizer chunks into the text shown in the assistant field. */
export function speechTranscript(chunks: SpeechChunk[]): string {
  return chunks
    .map((chunk) => chunk.transcript.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
