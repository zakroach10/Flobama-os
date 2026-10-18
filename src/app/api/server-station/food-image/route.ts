export const dynamic = "force-dynamic";

function allowedFoodImage(raw: string) {
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" || target.hostname !== "res.cloudinary.com") return null;
  if (!target.pathname.includes("/emaginepos/")) return null;
  return target;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  const target = allowedFoodImage(raw);
  if (!target) return new Response("Image host is not allowed.", { status: 400 });

  const upstream = await fetch(target, { next: { revalidate: 86_400 } });
  if (!upstream.ok) return new Response("Image unavailable.", { status: 502 });
  const bytes = await upstream.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "content-type": upstream.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
}
