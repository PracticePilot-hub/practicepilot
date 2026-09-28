import "server-only";

import { decryptPracticeCredential } from "@/app/lib/practiceCredentialCrypto";
import type {
  DocumentProviderAdapter,
  DocumentProviderRecord,
  ProviderBrowseResult,
  ProviderDownloadResult,
  ProviderUploadResult,
} from "./types";

const tokenCache = new Map<
  string,
  { encryptedValue: string; token: string }
>();

function encodeEgnytePath(path: string) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function normalisePath(value: string) {
  const parts = String(value || "")
    .split("/")
    .filter(Boolean);

  return `/${parts.join("/")}`;
}

function providerBaseUrl(provider: DocumentProviderRecord) {
  return String(
    provider.provider_base_url ||
      `https://${provider.provider_domain}.egnyte.com`
  ).replace(/\/+$/, "");
}

function providerToken(provider: DocumentProviderRecord) {
  if (!provider.access_token_encrypted) {
    throw new Error(
      "Egnyte is not connected for this practice. Connect Egnyte in Settings first."
    );
  }

  const cacheKey = String(provider.id || provider.organisation_id || "egnyte");
  const encryptedValue = provider.access_token_encrypted;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.encryptedValue === encryptedValue) {
    return cached.token;
  }

  const token = decryptPracticeCredential(encryptedValue);

  tokenCache.set(cacheKey, {
    encryptedValue,
    token,
  });

  return token;
}

async function egnyteError(response: Response, fallback: string) {
  const text = await response.text();

  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (response.status === 401) {
    return new Error(
      "Egnyte token is no longer valid. Reconnect Egnyte in Settings."
    );
  }

  return new Error(
    json?.error_description ||
      json?.message ||
      json?.Errors?.[0]?.description ||
      text ||
      `${fallback} (${response.status}).`
  );
}

function egnyteTimestamp(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const text = String(value).trim();
  const asNumber = Number(text);

  if (Number.isFinite(asNumber) && text) {
    const millis = asNumber > 10_000_000_000 ? asNumber : asNumber * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function browseEgnyteFolder(args: {
  provider: DocumentProviderRecord;
  path: string;
}): Promise<ProviderBrowseResult> {
  const { provider } = args;
  const accessToken = providerToken(provider);
  const baseUrl = providerBaseUrl(provider);
  const requestedPath = normalisePath(args.path);

  const response = await fetch(
    `${baseUrl}/pubapi/v1/fs/${encodeEgnytePath(requestedPath)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw await egnyteError(response, "Could not read Egnyte folder");
  }

  const json = await response.json();

  const folderRows = Array.isArray(json?.folders) ? json.folders : [];
  const fileRows = Array.isArray(json?.files) ? json.files : [];

  const folders = folderRows.map((folder: any) => ({
    id: folder?.folder_id || folder?.id || folder?.group_id || null,
    name: String(
      folder?.name ||
        folder?.folder_name ||
        folder?.path?.split("/").pop() ||
        "Folder"
    ),
    path: normalisePath(
      folder?.path || `${requestedPath}/${folder?.name || ""}`
    ),
    type: "folder" as const,
    size_bytes: null,
    modified_at: egnyteTimestamp(
      folder?.lastModified || folder?.last_modified || folder?.uploaded
    ),
  }));

  const files = fileRows.map((file: any) => ({
    id: file?.group_id || file?.entry_id || file?.id || null,
    name: String(
      file?.name ||
        file?.file_name ||
        file?.path?.split("/").pop() ||
        "File"
    ),
    path: normalisePath(
      file?.path || `${requestedPath}/${file?.name || ""}`
    ),
    type: "file" as const,
    size_bytes:
      typeof file?.size === "number"
        ? file.size
        : Number(file?.size || 0) || null,
    modified_at: egnyteTimestamp(
      file?.lastModified || file?.last_modified || file?.uploaded
    ),
  }));

  return {
    current_path: normalisePath(json?.path || requestedPath),
    current_name: String(
      json?.name ||
        requestedPath.split("/").filter(Boolean).pop() ||
        "Documents"
    ),
    items: [...folders, ...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    }),
  };
}

async function downloadEgnyteFile(args: {
  provider: DocumentProviderRecord;
  path: string;
}): Promise<ProviderDownloadResult> {
  const { provider } = args;
  const accessToken = providerToken(provider);
  const baseUrl = providerBaseUrl(provider);
  const requestedPath = normalisePath(args.path);

  const response = await fetch(
    `${baseUrl}/pubapi/v1/fs-content/${encodeEgnytePath(requestedPath)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw await egnyteError(response, "Could not download Egnyte file");
  }

  return {
    bytes: await response.arrayBuffer(),
    content_type:
      response.headers.get("content-type") || "application/octet-stream",
    file_name:
      requestedPath.split("/").filter(Boolean).pop() || "document",
  };
}

async function uploadEgnyteFile(args: {
  provider: DocumentProviderRecord;
  folderPath: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
}): Promise<ProviderUploadResult> {
  const { provider } = args;
  const accessToken = providerToken(provider);
  const baseUrl = providerBaseUrl(provider);

  const cleanFileName = String(args.fileName || "")
    .replace(/[\/\\]/g, "_")
    .trim();

  if (!cleanFileName) {
    throw new Error("The upload file name is invalid.");
  }

  const destinationPath = normalisePath(
    `${normalisePath(args.folderPath)}/${cleanFileName}`
  );

  const response = await fetch(
    `${baseUrl}/pubapi/v1/fs-content/${encodeEgnytePath(destinationPath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": args.contentType || "application/octet-stream",
        "Content-Length": String(args.bytes.byteLength),
      },
      body: args.bytes,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw await egnyteError(response, "Could not upload Egnyte file");
  }

  const responseText = await response.text();

  let responseJson: any = null;

  try {
    responseJson = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseJson = null;
  }

  return {
    path: destinationPath,
    id:
      responseJson?.group_id ||
      responseJson?.entry_id ||
      responseJson?.id ||
      null,
  };
}

export const egnyteAdapter: DocumentProviderAdapter = {
  browseFolder: browseEgnyteFolder,
  downloadFile: downloadEgnyteFile,
  uploadFile: uploadEgnyteFile,
};
