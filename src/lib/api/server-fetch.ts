import { headers } from "next/headers";

/**
 * Ortam değişkeni yanlış/eksik olsa bile çalışması için taban URL'yi
 * öncelikle gelen isteğin host bilgisinden üretiriz (Vercel, özel domain,
 * localhost hepsi otomatik doğru olur). Yalnızca host yoksa env'e düşeriz.
 */
function fallbackBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

function baseUrlFromHeaders(headersList: Headers): string {
  const host = headersList.get("host");
  if (!host) return fallbackBaseUrl();
  const forwardedProto = headersList.get("x-forwarded-proto");
  const proto =
    forwardedProto ?? (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function serverFetch<T>(
  path: string,
  init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } }
): Promise<T> {
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  const baseUrl = baseUrlFromHeaders(headersList);

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      cookie,
      ...(init?.headers ?? {}),
    },
    cache: init?.cache ?? "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "İstek başarısız.", res.status);
  }

  return res.json() as Promise<T>;
}
