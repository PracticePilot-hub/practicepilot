import "server-only";

import type {
  DocumentProviderAdapter,
  DocumentProviderName,
} from "./types";
import { egnyteAdapter } from "./egnyte";

export function getDocumentProviderAdapter(
  provider: DocumentProviderName
): DocumentProviderAdapter {
  switch (provider) {
    case "egnyte":
      return egnyteAdapter;

    case "google_drive":
      throw new Error(
        "Google Drive support has not been configured for this practice yet."
      );

    case "onedrive":
      throw new Error(
        "OneDrive support has not been configured for this practice yet."
      );

    case "dropbox":
      throw new Error(
        "Dropbox support has not been configured for this practice yet."
      );

    default:
      throw new Error(
        `Document provider '${provider}' does not support live browsing yet.`
      );
  }
}
