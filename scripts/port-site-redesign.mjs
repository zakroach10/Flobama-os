import fs from "node:fs";
import path from "node:path";

const roots = [
  "src/components/site",
  "src/components/ui/accordion.tsx",
  "src/lib/site/events.ts",
];

function walk(filePath, files = []) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      walk(path.join(filePath, entry), files);
    }
  } else if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
    files.push(filePath);
  }
  return files;
}

const files = roots.flatMap((root) => {
  const abs = path.join(process.cwd(), root);
  if (!fs.existsSync(abs)) return [];
  return walk(abs);
});

for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  const original = source;

  source = source.replace(/from\s+"react-router-dom"/g, 'from "next/link"');
  source = source.replace(/import\s+\{\s*Link\s*\}\s+from\s+"next\/link";?/g, 'import Link from "next/link";');
  source = source.replace(
    /import\s+\{\s*Outlet,\s*Link,\s*useLocation\s*\}\s+from\s+"next\/link";?/g,
    'import Link from "next/link";\nimport { usePathname } from "next/navigation";',
  );
  source = source.replace(
    /import\s+\{\s*Link,\s*useLocation\s*\}\s+from\s+"next\/link";?/g,
    'import Link from "next/link";\nimport { usePathname } from "next/navigation";',
  );
  source = source.replace(/\bto=/g, "href=");
  source = source.replace(/useLocation\(\)/g, "usePathname()");
  source = source.replace(/location\.pathname/g, "pathname");
  source = source.replace(/const location = usePathname\(\);/g, "const pathname = usePathname();");
  source = source.replace(/\[location\.pathname\]/g, "[pathname]");
  source = source.replace(/from "@\/lib\/events"/g, 'from "@/lib/site/events"');
  source = source.replace(/from "@\/components\/LiveEventsSheet"/g, 'from "@/components/site/live-events-sheet"');
  source = source.replace(/from "\.\/NowPlayingWidget"/g, 'from "@/components/site/now-playing-widget"');
  source = source.replace(/from "\.\/FloatingVideoWidget"/g, 'from "@/components/site/floating-video-widget"');
  source = source.replace(/from "\.\/ui\/button"/g, 'from "@/components/ui/button"');
  source = source.replace(/from "@\/lib\/utils"/g, 'from "@/lib/utils"');

  // Ensure client directive for interactive components
  if (
    (file.includes("/components/site/") || file.includes("/pages/")) &&
    !source.startsWith('"use client"') &&
    (source.includes("useState") ||
      source.includes("useEffect") ||
      source.includes("useMemo") ||
      source.includes("usePathname") ||
      source.includes("onClick") ||
      source.includes("LiveEventsSheet"))
  ) {
    source = `"use client";\n\n${source}`;
  }

  // Remove default exports naming leftovers where we keep default export
  if (file.endsWith("home-page.tsx")) {
    source = source.replace(/const Index = \(\) => \{/, "export function HomePage() {");
    source = source.replace(/export default Index;?\s*$/m, "");
  }

  if (file.endsWith("site-shell.tsx")) {
    source = source.replace(/export function Layout\(\)/, "export function SiteShell({ children }: { children: React.ReactNode })");
    source = source.replace(/<Outlet\s*\/>/g, "{children}");
    if (!source.includes("usePathname")) {
      source = source.replace('import Link from "next/link";', 'import Link from "next/link";\nimport { usePathname } from "next/navigation";');
    }
  }

  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log("updated", path.relative(process.cwd(), file));
  }
}

console.log(`Processed ${files.length} files`);
