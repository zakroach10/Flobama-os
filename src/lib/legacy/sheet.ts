import { readFile } from "node:fs/promises";
import path from "node:path";

/** Published CSV of the FloBama master events sheet (File → Share → Publish to web). */
export const FLO_BAMA_MASTER_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRENsjXeSHSUIuHU1Fne1ciKu6zW3FzaNxofXOvCUWjSKYaOHZskJupvfG3QHK-AeVfTvZwzN7VaMUk/pub?output=csv";

export type MasterSheetSource = "live" | "local";

export function looksLikeMasterSheetCsv(csv: string): boolean {
  const header = csv.split(/\r?\n/, 1)[0] ?? "";
  return /event id/i.test(header) && /\bname\b/i.test(header);
}

export async function loadMasterSheetCsv(): Promise<{ csv: string; source: MasterSheetSource }> {
  try {
    const response = await fetch(FLO_BAMA_MASTER_SHEET_CSV_URL, {
      cache: "no-store",
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" },
    });
    if (response.ok) {
      const csv = await response.text();
      if (looksLikeMasterSheetCsv(csv)) {
        return { csv, source: "live" };
      }
    }
  } catch {
    // Fall back to the bundled snapshot when Google is unreachable.
  }

  const csvPath = path.join(process.cwd(), "data", "legacy-events.csv");
  const csv = await readFile(csvPath, "utf8");
  return { csv, source: "local" };
}
