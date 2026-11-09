export function liveChangePreview(input: { summary: string; current: string; next: string }) {
  return {
    preview: true,
    changed: false,
    summary: input.summary,
    current: input.current,
    next: input.next,
    instruction: "Nothing was changed. Call this tool again with confirm set to true to apply it.",
  };
}

export function requiresConfirm(confirm: boolean | undefined) {
  return confirm !== true;
}
