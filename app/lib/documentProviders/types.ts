export type DocumentProviderName =
  | "egnyte"
  | "google_drive"
  | "onedrive"
  | "dropbox"
  | "manual";

export type DocumentProviderRecord = {
  id: string;
  organisation_id: string;
  provider: DocumentProviderName;
  provider_domain?: string | null;
  provider_base_url?: string | null;
  root_folder_path?: string | null;
  access_token_encrypted?: string | null;
};

export type DocumentLocationRecord = {
  id: string;
  organisation_id: string;
  client_id: string;
  provider_id: string;
  folder_id?: string | null;
  folder_path: string;
  folder_name?: string | null;
  is_primary: boolean;
  is_active: boolean;
};

export type ProviderBrowseItem = {
  id: string | null;
  name: string;
  path: string;
  type: "folder" | "file";
  size_bytes: number | null;
  modified_at: string | null;
};

export type ProviderBrowseResult = {
  current_path: string;
  current_name: string;
  items: ProviderBrowseItem[];
};

export type ProviderDownloadResult = {
  bytes: ArrayBuffer;
  content_type: string;
  file_name: string;
};

export type ProviderUploadResult = {
  path: string;
  id: string | null;
};

export interface DocumentProviderAdapter {
  browseFolder(args: {
    provider: DocumentProviderRecord;
    path: string;
  }): Promise<ProviderBrowseResult>;

  downloadFile(args: {
    provider: DocumentProviderRecord;
    path: string;
  }): Promise<ProviderDownloadResult>;

  uploadFile(args: {
    provider: DocumentProviderRecord;
    folderPath: string;
    fileName: string;
    contentType: string;
    bytes: ArrayBuffer;
  }): Promise<ProviderUploadResult>;
}
