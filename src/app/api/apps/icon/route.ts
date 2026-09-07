const APPLE_LOOKUP_ORIGIN = "https://itunes.apple.com";
const ICON_CACHE_SECONDS = 86_400;

type AppleLookupResponse = {
  results?: Array<{ artworkUrl100?: string }>;
};

function isAppleArtworkUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".mzstatic.com");
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const iosAppId = new URL(request.url).searchParams.get("iosAppId");
  if (!iosAppId || !/^\d+$/.test(iosAppId)) {
    return new Response(null, { status: 400 });
  }

  try {
    const lookup = await fetch(
      `${APPLE_LOOKUP_ORIGIN}/lookup?id=${encodeURIComponent(iosAppId)}&country=kr`,
      { next: { revalidate: ICON_CACHE_SECONDS } },
    );
    if (!lookup.ok) return new Response(null, { status: 404 });

    const metadata = (await lookup.json()) as AppleLookupResponse;
    const artworkUrl = metadata.results?.[0]?.artworkUrl100;
    if (!artworkUrl || !isAppleArtworkUrl(artworkUrl)) {
      return new Response(null, { status: 404 });
    }

    const artwork = await fetch(artworkUrl, {
      next: { revalidate: ICON_CACHE_SECONDS },
    });
    if (!artwork.ok) return new Response(null, { status: 404 });

    return new Response(await artwork.arrayBuffer(), {
      headers: {
        "Cache-Control": `public, max-age=${ICON_CACHE_SECONDS}, stale-while-revalidate=604800`,
        "Content-Type": artwork.headers.get("content-type") ?? "image/jpeg",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
