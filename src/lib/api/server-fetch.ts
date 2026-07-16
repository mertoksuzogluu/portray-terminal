import { headers } from "next/headers";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
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

  const res = await fetch(`${getBaseUrl()}${path}`, {
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
