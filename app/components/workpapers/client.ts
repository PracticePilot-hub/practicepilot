import { supabase } from "@/app/lib/supabase";
async function authenticatedFetch(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (!token) throw new Error("Please sign in to PracticePilot.");
  const send = () =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  let response = await send();
  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
    if (!token || refreshed.error)
      throw new Error(
        "Your sign-in could not be renewed. Sign in again, then retry. Your unsaved work is still on this screen.",
      );
    response = await send();
  }
  return response;
}
export async function workpaperRequest<T = Record<string, unknown>>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(url, init);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "The request could not be completed.");
  return result as T;
}
export async function workpaperFile(url: string) {
  const response = await authenticatedFetch(url);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Could not load the document.");
  }
  return response.arrayBuffer();
}
export function saveDownload(
  bytes: Uint8Array | ArrayBuffer | Blob,
  name: string,
  type = "application/pdf",
) {
  const blob =
    bytes instanceof Blob
      ? bytes
      : new Blob([bytes instanceof Uint8Array ? bytes.slice().buffer : bytes], {
          type,
        });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const sha256 = async (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        bytes instanceof Uint8Array ? bytes.slice().buffer : bytes,
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
