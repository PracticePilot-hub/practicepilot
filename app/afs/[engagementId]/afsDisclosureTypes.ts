export type AfsReportPageKey =
  | "cover"
  | "general-information"
  | "index"
  | "directors-responsibilities"
  | "directors-report"
  | "compiler-report"
  | "statement-financial-position"
  | "statement-profit-loss"
  | "statement-changes-equity"
  | "cash-flow"
  | "accounting-policies"
  | "notes"
  | "detailed-income-statement"
  | "tax-computation";

export type AfsDisclosureSource =
  | "client-setup"
  | "people"
  | "trial-balance"
  | "lead-schedule"
  | "manual"
  | "computed"
  | "static";

export type AfsDisclosureVariant = {
  key: string;
  label: string;
  text: string;
};

export type AfsDisclosureDefault = {
  pageKey: AfsReportPageKey;
  sectionKey: string;
  disclosureKey: string;
  title: string;
  defaultEnabled: boolean;
  defaultOrder: number;
  source: AfsDisclosureSource;
  variants?: AfsDisclosureVariant[];
  defaultText?: string;
  hideIfBlank?: boolean;
  allowCustomText?: boolean;
  allowManualValue?: boolean;
  allowNoteNumber?: boolean;
};

export type AfsDisclosureSetting = {
  id?: string;
  engagement_id?: string;
  page_key: AfsReportPageKey;
  section_key: string;
  disclosure_key: string;
  is_enabled: boolean;
  display_order: number;
  selected_variant?: string | null;
  custom_title?: string | null;
  custom_text?: string | null;
  manual_current?: number | null;
  manual_prior?: number | null;
  manual_note_number?: string | null;
};

export type AfsReportRenderContext = {
  engagement: any;
  clientSetup: any;
  people: any[];
  trialBalanceLines: any[];
  disclosureSettings: AfsDisclosureSetting[];
};
