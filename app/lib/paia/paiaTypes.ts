// Path: app/lib/paia/paiaTypes.ts

export type PaiaManual = {
  id: string;
  client_id?: string | null;
  manual_name: string;
  entity_name: string;
  entity_registration_number?: string | null;
  vat_number?: string | null;
  entity_type?: string | null;
  industry?: string | null;

  information_officer_name?: string | null;
  information_officer_position?: string | null;
  information_officer_email?: string | null;
  information_officer_telephone?: string | null;

  deputy_information_officer_name?: string | null;
  deputy_information_officer_position?: string | null;
  deputy_information_officer_email?: string | null;
  deputy_information_officer_telephone?: string | null;

  physical_address?: string | null;
  postal_address?: string | null;
  telephone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;

  date_compiled?: string | null;
  date_revised?: string | null;
  next_review_date?: string | null;
  version_number?: string | null;
  status?: string | null;

  prepared_by?: string | null;
  reviewed_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;

  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaiaRecord = {
  id?: string;
  manual_id?: string;
  category_key: string;
  record_name: string;
  is_selected: boolean;
  is_custom?: boolean;
  available_on_website?: boolean;
  available_on_request?: boolean;
  notes?: string | null;
  sort_order?: number;
};

export type PaiaLegislation = {
  id?: string;
  manual_id?: string;
  legislation_name: string;
  applicable_records?: string | null;
  is_selected: boolean;
  is_custom?: boolean;
  sort_order?: number;
};

export type PaiaProcessingPurpose = {
  id?: string;
  manual_id?: string;
  purpose_name: string;
  is_selected: boolean;
  is_custom?: boolean;
  sort_order?: number;
};

export type PaiaDataSubject = {
  id?: string;
  manual_id?: string;
  subject_name: string;
  information_processed?: string | null;
  is_selected: boolean;
  is_custom?: boolean;
  sort_order?: number;
};

export type PaiaPersonalInfoCategory = {
  id?: string;
  manual_id?: string;
  person_type: "natural_person" | "juristic_person" | "special_information";
  category_name: string;
  is_selected: boolean;
  is_custom?: boolean;
  sort_order?: number;
};

export type PaiaRecipient = {
  id?: string;
  manual_id?: string;
  recipient_name: string;
  information_shared?: string | null;
  is_selected: boolean;
  is_custom?: boolean;
  sort_order?: number;
};

export type PaiaCrossBorder = {
  id?: string;
  manual_id?: string;
  option_key: string;
  description?: string | null;
  is_selected: boolean;
};

export type PaiaSecurityMeasure = {
  id?: string;
  manual_id?: string;
  measure_name: string;
  is_selected: boolean;
  is_custom?: boolean;
  sort_order?: number;
};

export type PaiaSignatory = {
  id?: string;
  manual_id?: string;
  signatory_name: string;
  signatory_capacity?: string | null;
  signature_label?: string | null;
  signed_at?: string | null;
  sort_order?: number;
};

export type PaiaSections = {
  records: PaiaRecord[];
  legislation: PaiaLegislation[];
  processingPurposes: PaiaProcessingPurpose[];
  dataSubjects: PaiaDataSubject[];
  personalInfoCategories: PaiaPersonalInfoCategory[];
  recipients: PaiaRecipient[];
  crossBorder: PaiaCrossBorder[];
  securityMeasures: PaiaSecurityMeasure[];
  signatories: PaiaSignatory[];
};
