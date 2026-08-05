export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounting_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          client_id: string
          created_at: string
          id: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          client_id: string
          created_at?: string
          id?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          client_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounting_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_bank_transfers: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string | null
          from_account_id: string
          id: string
          journal_id: string | null
          matched_at: string | null
          matched_journal_id: string | null
          status: string
          to_account_id: string
          transfer_date: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          description?: string | null
          from_account_id: string
          id?: string
          journal_id?: string | null
          matched_at?: string | null
          matched_journal_id?: string | null
          status?: string
          to_account_id: string
          transfer_date: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          from_account_id?: string
          id?: string
          journal_id?: string | null
          matched_at?: string | null
          matched_journal_id?: string | null
          status?: string
          to_account_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_bank_transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounting_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_bank_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_bank_transfers_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "accounting_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_bank_transfers_matched_journal_id_fkey"
            columns: ["matched_journal_id"]
            isOneToOne: false
            referencedRelation: "accounting_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_bank_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_cashbook_drafts: {
        Row: {
          bank_account_id: string | null
          client_id: string
          created_at: string
          draft_rows: Json
          id: string
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          client_id: string
          created_at?: string
          draft_rows?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          client_id?: string
          created_at?: string
          draft_rows?: Json
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_cashbook_drafts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_cashbook_drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "accounting_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_clients: {
        Row: {
          client_name: string
          created_at: string
          id: string
        }
        Insert: {
          client_name: string
          created_at?: string
          id?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      accounting_journal_lines: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_id: string
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id: string
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounting_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "accounting_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_journals: {
        Row: {
          client_id: string
          created_at: string
          description: string
          id: string
          journal_date: string
          journal_number: string | null
          source: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          id?: string
          journal_date: string
          journal_number?: string | null
          source?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          journal_date?: string
          journal_number?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_journals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounting_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_adjusting_journal_lines: {
        Row: {
          account_code: string | null
          account_name: string | null
          created_at: string
          credit: number
          debit: number
          description: string | null
          engagement_id: string
          id: string
          journal_id: string
          line_number: number
          line_order: number
          note: string
          trial_balance_line_id: string | null
          updated_at: string
        }
        Insert: {
          account_code?: string | null
          account_name?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          engagement_id: string
          id?: string
          journal_id: string
          line_number?: number
          line_order?: number
          note?: string
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string | null
          account_name?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          engagement_id?: string
          id?: string
          journal_id?: string
          line_number?: number
          line_order?: number
          note?: string
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_adjusting_journal_lines_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afs_adjusting_journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "afs_adjusting_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afs_adjusting_journal_lines_trial_balance_line_id_fkey"
            columns: ["trial_balance_line_id"]
            isOneToOne: false
            referencedRelation: "afs_trial_balance_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_adjusting_journals: {
        Row: {
          created_at: string
          credit_total: number
          debit_total: number
          description: string | null
          difference: number
          engagement_id: string
          id: string
          journal_date: string | null
          journal_number: string | null
          journal_period: string
          journal_prefix: string | null
          journal_reference: string | null
          posted_at: string | null
          posted_by: string | null
          posted_by_name: string | null
          posted_by_user_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_total?: number
          debit_total?: number
          description?: string | null
          difference?: number
          engagement_id: string
          id?: string
          journal_date?: string | null
          journal_number?: string | null
          journal_period?: string
          journal_prefix?: string | null
          journal_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posted_by_name?: string | null
          posted_by_user_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_total?: number
          debit_total?: number
          description?: string | null
          difference?: number
          engagement_id?: string
          id?: string
          journal_date?: string | null
          journal_number?: string | null
          journal_period?: string
          journal_prefix?: string | null
          journal_reference?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posted_by_name?: string | null
          posted_by_user_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_adjusting_journals_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_client_people: {
        Row: {
          appointment_date: string | null
          cell: string | null
          created_at: string
          email: string | null
          engagement_id: string
          full_name: string
          id: string
          id_number: string | null
          income_tax_number: string | null
          nationality: string | null
          person_type: string
          resignation_date: string | null
          updated_at: string
        }
        Insert: {
          appointment_date?: string | null
          cell?: string | null
          created_at?: string
          email?: string | null
          engagement_id: string
          full_name: string
          id?: string
          id_number?: string | null
          income_tax_number?: string | null
          nationality?: string | null
          person_type?: string
          resignation_date?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string | null
          cell?: string | null
          created_at?: string
          email?: string | null
          engagement_id?: string
          full_name?: string
          id?: string
          id_number?: string | null
          income_tax_number?: string | null
          nationality?: string | null
          person_type?: string
          resignation_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_client_people_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_client_setup: {
        Row: {
          account_holder: string | null
          account_type: string | null
          afs_approval_date: string | null
          authorised_ordinary_share_par_value: string | null
          authorised_ordinary_shares: string | null
          authorised_share_count: number | null
          authorised_share_par_value: number | null
          banker_name: string | null
          basis_of_preparation: string | null
          borrowing_limitations_text: string | null
          country: string | null
          cover_show_client_logo: boolean | null
          cover_show_framework_line: boolean | null
          cover_show_no_assurance_line: boolean | null
          created_at: string
          currency: string | null
          currency_symbol: string | null
          current_period_heading: string | null
          date_business_commenced: string | null
          date_of_incorporation: string | null
          director_interest_contracts_text: string | null
          engagement_id: string
          entity_type: string | null
          firm_letterhead_footer_path: string | null
          firm_letterhead_header_path: string | null
          going_concern_custom_text: string | null
          going_concern_free_text_1: string | null
          going_concern_free_text_2: string | null
          going_concern_free_text_3: string | null
          going_concern_include_losses_wording: boolean | null
          going_concern_include_material_uncertainty: boolean | null
          going_concern_include_subordination_wording: boolean | null
          going_concern_variant: string | null
          group_description: string | null
          id: string
          income_tax_number: string | null
          industry: string | null
          issued_ordinary_share_par_value: string | null
          issued_ordinary_shares: string | null
          issued_share_count: number | null
          issued_share_par_value: number | null
          legal_framework: string | null
          liquidity_solvency_text: string | null
          litigation_statement_text: string | null
          logo_url: string | null
          member_firm: string | null
          nature_of_business: string | null
          number_of_directors: number | null
          parent_entity: string | null
          paye_number: string | null
          physical_address_city: string | null
          physical_address_line_1: string | null
          physical_address_line_2: string | null
          physical_address_postal_code: string | null
          physical_address_province: string | null
          place_of_signature: string | null
          postal_address_city: string | null
          postal_address_line_1: string | null
          postal_address_line_2: string | null
          postal_address_postal_code: string | null
          postal_address_province: string | null
          ppe_additions_text: string | null
          practice_name: string | null
          practitioner_designation: string | null
          practitioner_name: string | null
          prior_period_heading: string | null
          public_officer_cell: string | null
          public_officer_email: string | null
          public_officer_id_number: string | null
          public_officer_income_tax_number: string | null
          public_officer_name: string | null
          publish_date: string | null
          registered_name: string | null
          registered_office_city: string | null
          registered_office_line_1: string | null
          registered_office_line_2: string | null
          registered_office_postal_code: string | null
          registered_office_province: string | null
          registration_number: string | null
          report_required: string | null
          sdl_number: string | null
          secretary_address: string | null
          secretary_name: string | null
          share_capital_class: string | null
          share_capital_note: string | null
          share_capital_note_override: string | null
          shareholder_note: string | null
          shareholder_ownership_text: string | null
          signature_date: string | null
          tax_loss_current_year: number | null
          tax_loss_prior_year: number | null
          tax_rate_current_year: number | null
          tax_rate_prior_year: number | null
          trading_name: string | null
          type_of_engagement: string | null
          uif_number: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          account_holder?: string | null
          account_type?: string | null
          afs_approval_date?: string | null
          authorised_ordinary_share_par_value?: string | null
          authorised_ordinary_shares?: string | null
          authorised_share_count?: number | null
          authorised_share_par_value?: number | null
          banker_name?: string | null
          basis_of_preparation?: string | null
          borrowing_limitations_text?: string | null
          country?: string | null
          cover_show_client_logo?: boolean | null
          cover_show_framework_line?: boolean | null
          cover_show_no_assurance_line?: boolean | null
          created_at?: string
          currency?: string | null
          currency_symbol?: string | null
          current_period_heading?: string | null
          date_business_commenced?: string | null
          date_of_incorporation?: string | null
          director_interest_contracts_text?: string | null
          engagement_id: string
          entity_type?: string | null
          firm_letterhead_footer_path?: string | null
          firm_letterhead_header_path?: string | null
          going_concern_custom_text?: string | null
          going_concern_free_text_1?: string | null
          going_concern_free_text_2?: string | null
          going_concern_free_text_3?: string | null
          going_concern_include_losses_wording?: boolean | null
          going_concern_include_material_uncertainty?: boolean | null
          going_concern_include_subordination_wording?: boolean | null
          going_concern_variant?: string | null
          group_description?: string | null
          id?: string
          income_tax_number?: string | null
          industry?: string | null
          issued_ordinary_share_par_value?: string | null
          issued_ordinary_shares?: string | null
          issued_share_count?: number | null
          issued_share_par_value?: number | null
          legal_framework?: string | null
          liquidity_solvency_text?: string | null
          litigation_statement_text?: string | null
          logo_url?: string | null
          member_firm?: string | null
          nature_of_business?: string | null
          number_of_directors?: number | null
          parent_entity?: string | null
          paye_number?: string | null
          physical_address_city?: string | null
          physical_address_line_1?: string | null
          physical_address_line_2?: string | null
          physical_address_postal_code?: string | null
          physical_address_province?: string | null
          place_of_signature?: string | null
          postal_address_city?: string | null
          postal_address_line_1?: string | null
          postal_address_line_2?: string | null
          postal_address_postal_code?: string | null
          postal_address_province?: string | null
          ppe_additions_text?: string | null
          practice_name?: string | null
          practitioner_designation?: string | null
          practitioner_name?: string | null
          prior_period_heading?: string | null
          public_officer_cell?: string | null
          public_officer_email?: string | null
          public_officer_id_number?: string | null
          public_officer_income_tax_number?: string | null
          public_officer_name?: string | null
          publish_date?: string | null
          registered_name?: string | null
          registered_office_city?: string | null
          registered_office_line_1?: string | null
          registered_office_line_2?: string | null
          registered_office_postal_code?: string | null
          registered_office_province?: string | null
          registration_number?: string | null
          report_required?: string | null
          sdl_number?: string | null
          secretary_address?: string | null
          secretary_name?: string | null
          share_capital_class?: string | null
          share_capital_note?: string | null
          share_capital_note_override?: string | null
          shareholder_note?: string | null
          shareholder_ownership_text?: string | null
          signature_date?: string | null
          tax_loss_current_year?: number | null
          tax_loss_prior_year?: number | null
          tax_rate_current_year?: number | null
          tax_rate_prior_year?: number | null
          trading_name?: string | null
          type_of_engagement?: string | null
          uif_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          account_holder?: string | null
          account_type?: string | null
          afs_approval_date?: string | null
          authorised_ordinary_share_par_value?: string | null
          authorised_ordinary_shares?: string | null
          authorised_share_count?: number | null
          authorised_share_par_value?: number | null
          banker_name?: string | null
          basis_of_preparation?: string | null
          borrowing_limitations_text?: string | null
          country?: string | null
          cover_show_client_logo?: boolean | null
          cover_show_framework_line?: boolean | null
          cover_show_no_assurance_line?: boolean | null
          created_at?: string
          currency?: string | null
          currency_symbol?: string | null
          current_period_heading?: string | null
          date_business_commenced?: string | null
          date_of_incorporation?: string | null
          director_interest_contracts_text?: string | null
          engagement_id?: string
          entity_type?: string | null
          firm_letterhead_footer_path?: string | null
          firm_letterhead_header_path?: string | null
          going_concern_custom_text?: string | null
          going_concern_free_text_1?: string | null
          going_concern_free_text_2?: string | null
          going_concern_free_text_3?: string | null
          going_concern_include_losses_wording?: boolean | null
          going_concern_include_material_uncertainty?: boolean | null
          going_concern_include_subordination_wording?: boolean | null
          going_concern_variant?: string | null
          group_description?: string | null
          id?: string
          income_tax_number?: string | null
          industry?: string | null
          issued_ordinary_share_par_value?: string | null
          issued_ordinary_shares?: string | null
          issued_share_count?: number | null
          issued_share_par_value?: number | null
          legal_framework?: string | null
          liquidity_solvency_text?: string | null
          litigation_statement_text?: string | null
          logo_url?: string | null
          member_firm?: string | null
          nature_of_business?: string | null
          number_of_directors?: number | null
          parent_entity?: string | null
          paye_number?: string | null
          physical_address_city?: string | null
          physical_address_line_1?: string | null
          physical_address_line_2?: string | null
          physical_address_postal_code?: string | null
          physical_address_province?: string | null
          place_of_signature?: string | null
          postal_address_city?: string | null
          postal_address_line_1?: string | null
          postal_address_line_2?: string | null
          postal_address_postal_code?: string | null
          postal_address_province?: string | null
          ppe_additions_text?: string | null
          practice_name?: string | null
          practitioner_designation?: string | null
          practitioner_name?: string | null
          prior_period_heading?: string | null
          public_officer_cell?: string | null
          public_officer_email?: string | null
          public_officer_id_number?: string | null
          public_officer_income_tax_number?: string | null
          public_officer_name?: string | null
          publish_date?: string | null
          registered_name?: string | null
          registered_office_city?: string | null
          registered_office_line_1?: string | null
          registered_office_line_2?: string | null
          registered_office_postal_code?: string | null
          registered_office_province?: string | null
          registration_number?: string | null
          report_required?: string | null
          sdl_number?: string | null
          secretary_address?: string | null
          secretary_name?: string | null
          share_capital_class?: string | null
          share_capital_note?: string | null
          share_capital_note_override?: string | null
          shareholder_note?: string | null
          shareholder_ownership_text?: string | null
          signature_date?: string | null
          tax_loss_current_year?: number | null
          tax_loss_prior_year?: number | null
          tax_rate_current_year?: number | null
          tax_rate_prior_year?: number | null
          trading_name?: string | null
          type_of_engagement?: string | null
          uif_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afs_client_setup_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_engagements: {
        Row: {
          client_id: string | null
          client_name: string
          created_at: string
          entity_type: string | null
          financial_year_end: string
          firm_client_name: string | null
          id: string
          notes: string | null
          organisation_id: string | null
          prepared_by: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          created_at?: string
          entity_type?: string | null
          financial_year_end: string
          firm_client_name?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          prepared_by?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          created_at?: string
          entity_type?: string | null
          financial_year_end?: string
          firm_client_name?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          prepared_by?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      afs_financial_statement_outputs: {
        Row: {
          created_at: string
          engagement_id: string
          generated_at: string
          generated_by: string | null
          id: string
          output_json: Json
          statement_key: string
          statement_title: string
        }
        Insert: {
          created_at?: string
          engagement_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          output_json?: Json
          statement_key: string
          statement_title: string
        }
        Update: {
          created_at?: string
          engagement_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          output_json?: Json
          statement_key?: string
          statement_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_financial_statement_outputs_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_firm_settings: {
        Row: {
          address_lines: string | null
          created_at: string
          email: string | null
          firm_name: string | null
          footer_logo_url: string | null
          footer_text: string | null
          governing_body_logo_url: string | null
          governing_body_name: string | null
          governing_body_registration_number: string | null
          id: string
          logo_url: string | null
          owner_user_id: string | null
          practitioner_designation: string | null
          practitioner_name: string | null
          second_governing_body_logo_url: string | null
          second_governing_body_name: string | null
          second_governing_body_registration_number: string | null
          secondary_governing_body_logo_url: string | null
          secondary_governing_body_name: string | null
          secondary_governing_body_registration_number: string | null
          telephone: string | null
          trading_name: string | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address_lines?: string | null
          created_at?: string
          email?: string | null
          firm_name?: string | null
          footer_logo_url?: string | null
          footer_text?: string | null
          governing_body_logo_url?: string | null
          governing_body_name?: string | null
          governing_body_registration_number?: string | null
          id?: string
          logo_url?: string | null
          owner_user_id?: string | null
          practitioner_designation?: string | null
          practitioner_name?: string | null
          second_governing_body_logo_url?: string | null
          second_governing_body_name?: string | null
          second_governing_body_registration_number?: string | null
          secondary_governing_body_logo_url?: string | null
          secondary_governing_body_name?: string | null
          secondary_governing_body_registration_number?: string | null
          telephone?: string | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address_lines?: string | null
          created_at?: string
          email?: string | null
          firm_name?: string | null
          footer_logo_url?: string | null
          footer_text?: string | null
          governing_body_logo_url?: string | null
          governing_body_name?: string | null
          governing_body_registration_number?: string | null
          id?: string
          logo_url?: string | null
          owner_user_id?: string | null
          practitioner_designation?: string | null
          practitioner_name?: string | null
          second_governing_body_logo_url?: string | null
          second_governing_body_name?: string | null
          second_governing_body_registration_number?: string | null
          secondary_governing_body_logo_url?: string | null
          secondary_governing_body_name?: string | null
          secondary_governing_body_registration_number?: string | null
          telephone?: string | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      afs_lead_schedule_annotations: {
        Row: {
          annotation_note: string | null
          created_at: string
          engagement_id: string
          id: string
          prepared_by: string | null
          reference_code: string | null
          reviewed_by: string | null
          schedule_key: string
          tickmark_code: string | null
          tickmark_label: string | null
          trial_balance_line_id: string | null
          updated_at: string
        }
        Insert: {
          annotation_note?: string | null
          created_at?: string
          engagement_id: string
          id?: string
          prepared_by?: string | null
          reference_code?: string | null
          reviewed_by?: string | null
          schedule_key: string
          tickmark_code?: string | null
          tickmark_label?: string | null
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Update: {
          annotation_note?: string | null
          created_at?: string
          engagement_id?: string
          id?: string
          prepared_by?: string | null
          reference_code?: string | null
          reviewed_by?: string | null
          schedule_key?: string
          tickmark_code?: string | null
          tickmark_label?: string | null
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_lead_schedule_annotations_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afs_lead_schedule_annotations_trial_balance_line_id_fkey"
            columns: ["trial_balance_line_id"]
            isOneToOne: false
            referencedRelation: "afs_trial_balance_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_notes: {
        Row: {
          created_at: string
          engagement_id: string
          id: string
          note_body: string | null
          note_number: string
          note_title: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          engagement_id: string
          id?: string
          note_body?: string | null
          note_number: string
          note_title: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          engagement_id?: string
          id?: string
          note_body?: string | null
          note_number?: string
          note_title?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_notes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_print_studio_settings: {
        Row: {
          accounting_policy_texts: Json
          compiler_report_settings: Json
          cover_settings: Json
          created_at: string
          directors_report_texts: Json
          engagement_id: string
          id: string
          note_texts: Json
          report_options: Json
          statement_overrides: Json
          structured_notes_state: Json
          updated_at: string
        }
        Insert: {
          accounting_policy_texts?: Json
          compiler_report_settings?: Json
          cover_settings?: Json
          created_at?: string
          directors_report_texts?: Json
          engagement_id: string
          id?: string
          note_texts?: Json
          report_options?: Json
          statement_overrides?: Json
          structured_notes_state?: Json
          updated_at?: string
        }
        Update: {
          accounting_policy_texts?: Json
          compiler_report_settings?: Json
          cover_settings?: Json
          created_at?: string
          directors_report_texts?: Json
          engagement_id?: string
          id?: string
          note_texts?: Json
          report_options?: Json
          statement_overrides?: Json
          structured_notes_state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_print_studio_settings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: true
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_report_assets: {
        Row: {
          asset_type: string
          created_at: string
          engagement_id: string
          file_mime_type: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_active: boolean
          title: string | null
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          engagement_id: string
          file_mime_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          engagement_id?: string
          file_mime_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          title?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_report_assets_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_report_disclosure_settings: {
        Row: {
          created_at: string
          custom_text: string | null
          custom_title: string | null
          disclosure_key: string
          display_order: number
          engagement_id: string
          id: string
          is_enabled: boolean
          manual_current: number | null
          manual_note_number: string | null
          manual_prior: number | null
          page_key: string
          section_key: string
          selected_variant: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_text?: string | null
          custom_title?: string | null
          disclosure_key: string
          display_order?: number
          engagement_id: string
          id?: string
          is_enabled?: boolean
          manual_current?: number | null
          manual_note_number?: string | null
          manual_prior?: number | null
          page_key: string
          section_key: string
          selected_variant?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_text?: string | null
          custom_title?: string | null
          disclosure_key?: string
          display_order?: number
          engagement_id?: string
          id?: string
          is_enabled?: boolean
          manual_current?: number | null
          manual_note_number?: string | null
          manual_prior?: number | null
          page_key?: string
          section_key?: string
          selected_variant?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_report_disclosure_settings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_report_manual_tables: {
        Row: {
          created_at: string
          current_value: number | null
          display_order: number
          engagement_id: string
          id: string
          is_enabled: boolean
          label: string
          note_number: string | null
          prior_value: number | null
          row_key: string
          table_key: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          display_order?: number
          engagement_id: string
          id?: string
          is_enabled?: boolean
          label: string
          note_number?: string | null
          prior_value?: number | null
          row_key: string
          table_key: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          display_order?: number
          engagement_id?: string
          id?: string
          is_enabled?: boolean
          label?: string
          note_number?: string | null
          prior_value?: number | null
          row_key?: string
          table_key?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_report_manual_tables_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_review_points: {
        Row: {
          assigned_to: string | null
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          detail: string | null
          engagement_id: string
          id: string
          lead_schedule_key: string | null
          priority: string | null
          raised_at: string
          raised_by: string | null
          response: string | null
          section_key: string | null
          source_area: string | null
          source_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          detail?: string | null
          engagement_id: string
          id?: string
          lead_schedule_key?: string | null
          priority?: string | null
          raised_at?: string
          raised_by?: string | null
          response?: string | null
          section_key?: string | null
          source_area?: string | null
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          detail?: string | null
          engagement_id?: string
          id?: string
          lead_schedule_key?: string | null
          priority?: string | null
          raised_at?: string
          raised_by?: string | null
          response?: string | null
          section_key?: string | null
          source_area?: string | null
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_review_points_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_review_signoffs: {
        Row: {
          created_at: string
          engagement_id: string
          id: string
          note: string | null
          prepared_at: string | null
          prepared_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          section_key: string
          section_title: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          engagement_id: string
          id?: string
          note?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section_key: string
          section_title: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          engagement_id?: string
          id?: string
          note?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section_key?: string
          section_title?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_review_signoffs_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_rollover_refresh_audit: {
        Row: {
          history_rows_copied: number
          history_rows_upserted: number
          id: string
          organisation_id: string | null
          print_studio_refreshed: boolean
          prior_history_rows_upserted: number
          refresh_reason: string
          refreshed_at: string
          refreshed_by: string | null
          source_engagement_id: string
          source_financial_year_end: string | null
          target_engagement_id: string
          target_financial_year_end: string | null
          target_status_after: string | null
          target_status_before: string | null
          trial_balance_lines_inserted: number
          trial_balance_lines_updated: number
        }
        Insert: {
          history_rows_copied?: number
          history_rows_upserted?: number
          id?: string
          organisation_id?: string | null
          print_studio_refreshed?: boolean
          prior_history_rows_upserted?: number
          refresh_reason: string
          refreshed_at?: string
          refreshed_by?: string | null
          source_engagement_id: string
          source_financial_year_end?: string | null
          target_engagement_id: string
          target_financial_year_end?: string | null
          target_status_after?: string | null
          target_status_before?: string | null
          trial_balance_lines_inserted?: number
          trial_balance_lines_updated?: number
        }
        Update: {
          history_rows_copied?: number
          history_rows_upserted?: number
          id?: string
          organisation_id?: string | null
          print_studio_refreshed?: boolean
          prior_history_rows_upserted?: number
          refresh_reason?: string
          refreshed_at?: string
          refreshed_by?: string | null
          source_engagement_id?: string
          source_financial_year_end?: string | null
          target_engagement_id?: string
          target_financial_year_end?: string | null
          target_status_after?: string | null
          target_status_before?: string | null
          trial_balance_lines_inserted?: number
          trial_balance_lines_updated?: number
        }
        Relationships: []
      }
      afs_subordination_selections: {
        Row: {
          account_code: string | null
          account_name: string | null
          agreement_status: string
          balance_current: number | null
          balance_prior: number | null
          company_signatory_capacity: string | null
          company_signatory_name: string | null
          company_signatory_person_id: string | null
          created_at: string
          creditor_name: string | null
          engagement_id: string
          id: string
          include_in_agreement: boolean
          interest_terms: string | null
          relationship: string | null
          repayment_terms: string | null
          security_terms: string | null
          subordination_terms: string | null
          trial_balance_line_id: string | null
          updated_at: string
        }
        Insert: {
          account_code?: string | null
          account_name?: string | null
          agreement_status?: string
          balance_current?: number | null
          balance_prior?: number | null
          company_signatory_capacity?: string | null
          company_signatory_name?: string | null
          company_signatory_person_id?: string | null
          created_at?: string
          creditor_name?: string | null
          engagement_id: string
          id?: string
          include_in_agreement?: boolean
          interest_terms?: string | null
          relationship?: string | null
          repayment_terms?: string | null
          security_terms?: string | null
          subordination_terms?: string | null
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string | null
          account_name?: string | null
          agreement_status?: string
          balance_current?: number | null
          balance_prior?: number | null
          company_signatory_capacity?: string | null
          company_signatory_name?: string | null
          company_signatory_person_id?: string | null
          created_at?: string
          creditor_name?: string | null
          engagement_id?: string
          id?: string
          include_in_agreement?: boolean
          interest_terms?: string | null
          relationship?: string | null
          repayment_terms?: string | null
          security_terms?: string | null
          subordination_terms?: string | null
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_subordination_selections_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_tax_calculations: {
        Row: {
          accounting_profit: number
          assessed_loss_brought_forward: number
          calculation_name: string
          created_at: string
          engagement_id: string
          id: string
          normal_tax: number
          notes: string | null
          permanent_differences: number
          provisional_tax_paid: number
          tax_payable: number
          tax_rate: number
          taxable_income: number
          temporary_differences: number
          updated_at: string
        }
        Insert: {
          accounting_profit?: number
          assessed_loss_brought_forward?: number
          calculation_name?: string
          created_at?: string
          engagement_id: string
          id?: string
          normal_tax?: number
          notes?: string | null
          permanent_differences?: number
          provisional_tax_paid?: number
          tax_payable?: number
          tax_rate?: number
          taxable_income?: number
          temporary_differences?: number
          updated_at?: string
        }
        Update: {
          accounting_profit?: number
          assessed_loss_brought_forward?: number
          calculation_name?: string
          created_at?: string
          engagement_id?: string
          id?: string
          normal_tax?: number
          notes?: string | null
          permanent_differences?: number
          provisional_tax_paid?: number
          tax_payable?: number
          tax_rate?: number
          taxable_income?: number
          temporary_differences?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_tax_calculations_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_trial_balance_history: {
        Row: {
          account_code: string
          account_name: string
          closing_balance: number
          created_at: string
          engagement_id: string
          financial_year_end: string
          id: string
          lead_schedule_key: string | null
          lead_schedule_number: string | null
          mapping_code: string | null
          mapping_label: string | null
          mapping_path: string | null
          mapping_section: string | null
          mapping_statement: string | null
          organisation_id: string | null
          source_engagement_id: string | null
          trial_balance_line_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          closing_balance?: number
          created_at?: string
          engagement_id: string
          financial_year_end: string
          id?: string
          lead_schedule_key?: string | null
          lead_schedule_number?: string | null
          mapping_code?: string | null
          mapping_label?: string | null
          mapping_path?: string | null
          mapping_section?: string | null
          mapping_statement?: string | null
          organisation_id?: string | null
          source_engagement_id?: string | null
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          closing_balance?: number
          created_at?: string
          engagement_id?: string
          financial_year_end?: string
          id?: string
          lead_schedule_key?: string | null
          lead_schedule_number?: string | null
          mapping_code?: string | null
          mapping_label?: string | null
          mapping_path?: string | null
          mapping_section?: string | null
          mapping_statement?: string | null
          organisation_id?: string | null
          source_engagement_id?: string | null
          trial_balance_line_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afs_trial_balance_history_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afs_trial_balance_history_source_engagement_id_fkey"
            columns: ["source_engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afs_trial_balance_history_trial_balance_line_id_fkey"
            columns: ["trial_balance_line_id"]
            isOneToOne: false
            referencedRelation: "afs_trial_balance_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_trial_balance_lines: {
        Row: {
          account_code: string | null
          account_name: string
          account_type: string | null
          adjustments: number
          amount_layout: string
          created_at: string
          credit: number
          current_balance: number
          current_year_balance: number
          debit: number
          engagement_id: string
          final_balance: number
          id: string
          import_basis: string
          lead_schedule_key: string | null
          lead_schedule_number: string | null
          manual_adjustment: number
          mapping_category: string | null
          mapping_code: string | null
          mapping_confidence: string | null
          mapping_label: string | null
          mapping_leaf_id: string | null
          mapping_path: string | null
          mapping_saved_at: string | null
          mapping_section: string | null
          mapping_smart_rule: string | null
          mapping_statement: string | null
          note_number: string | null
          opening_balance: number
          period_1: number
          period_10: number
          period_11: number
          period_12: number
          period_2: number
          period_3: number
          period_4: number
          period_5: number
          period_6: number
          period_7: number
          period_8: number
          period_9: number
          prior_year_balance: number
          reclassifications: number
          source_balance: number
          updated_at: string | null
        }
        Insert: {
          account_code?: string | null
          account_name: string
          account_type?: string | null
          adjustments?: number
          amount_layout?: string
          created_at?: string
          credit?: number
          current_balance?: number
          current_year_balance?: number
          debit?: number
          engagement_id: string
          final_balance?: number
          id?: string
          import_basis?: string
          lead_schedule_key?: string | null
          lead_schedule_number?: string | null
          manual_adjustment?: number
          mapping_category?: string | null
          mapping_code?: string | null
          mapping_confidence?: string | null
          mapping_label?: string | null
          mapping_leaf_id?: string | null
          mapping_path?: string | null
          mapping_saved_at?: string | null
          mapping_section?: string | null
          mapping_smart_rule?: string | null
          mapping_statement?: string | null
          note_number?: string | null
          opening_balance?: number
          period_1?: number
          period_10?: number
          period_11?: number
          period_12?: number
          period_2?: number
          period_3?: number
          period_4?: number
          period_5?: number
          period_6?: number
          period_7?: number
          period_8?: number
          period_9?: number
          prior_year_balance?: number
          reclassifications?: number
          source_balance?: number
          updated_at?: string | null
        }
        Update: {
          account_code?: string | null
          account_name?: string
          account_type?: string | null
          adjustments?: number
          amount_layout?: string
          created_at?: string
          credit?: number
          current_balance?: number
          current_year_balance?: number
          debit?: number
          engagement_id?: string
          final_balance?: number
          id?: string
          import_basis?: string
          lead_schedule_key?: string | null
          lead_schedule_number?: string | null
          manual_adjustment?: number
          mapping_category?: string | null
          mapping_code?: string | null
          mapping_confidence?: string | null
          mapping_label?: string | null
          mapping_leaf_id?: string | null
          mapping_path?: string | null
          mapping_saved_at?: string | null
          mapping_section?: string | null
          mapping_smart_rule?: string | null
          mapping_statement?: string | null
          note_number?: string | null
          opening_balance?: number
          period_1?: number
          period_10?: number
          period_11?: number
          period_12?: number
          period_2?: number
          period_3?: number
          period_4?: number
          period_5?: number
          period_6?: number
          period_7?: number
          period_8?: number
          period_9?: number
          prior_year_balance?: number
          reclassifications?: number
          source_balance?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afs_trial_balance_lines_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      afs_working_papers: {
        Row: {
          created_at: string
          document_type: string | null
          engagement_id: string
          file_mime_type: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_url: string | null
          id: string
          lead_schedule_key: string | null
          lead_schedule_number: string | null
          note: string | null
          prepared_at: string | null
          prepared_by: string | null
          prepared_comment: string | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          section: string
          status: string
          title: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
          wp_reference: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          engagement_id: string
          file_mime_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          lead_schedule_key?: string | null
          lead_schedule_number?: string | null
          note?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          prepared_comment?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section: string
          status?: string
          title: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          wp_reference?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          engagement_id?: string
          file_mime_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          lead_schedule_key?: string | null
          lead_schedule_number?: string | null
          note?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          prepared_comment?: string | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          section?: string
          status?: string
          title?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          wp_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afs_working_papers_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_annual_returns: {
        Row: {
          annual_return_due_date: string | null
          annual_return_status: string | null
          cipc_fee: number | null
          client_id: string | null
          created_at: string | null
          financial_year_end: string | null
          id: string
          notes: string | null
          organisation_id: string | null
          proof_file_bucket: string | null
          proof_file_path: string | null
          submitted_date: string | null
          turnover_range: string | null
          updated_at: string | null
        }
        Insert: {
          annual_return_due_date?: string | null
          annual_return_status?: string | null
          cipc_fee?: number | null
          client_id?: string | null
          created_at?: string | null
          financial_year_end?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          proof_file_bucket?: string | null
          proof_file_path?: string | null
          submitted_date?: string | null
          turnover_range?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_return_due_date?: string | null
          annual_return_status?: string | null
          cipc_fee?: number | null
          client_id?: string | null
          created_at?: string | null
          financial_year_end?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          proof_file_bucket?: string | null
          proof_file_path?: string | null
          submitted_date?: string | null
          turnover_range?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_annual_returns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_annual_returns_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_beneficial_owners: {
        Row: {
          client_id: string | null
          control_type: string | null
          created_at: string | null
          effective_date: string | null
          email: string | null
          end_date: string | null
          id: string
          id_registration_number: string | null
          is_active: boolean | null
          notes: string | null
          organisation_id: string | null
          owner_name: string
          owner_type: string | null
          ownership_percentage: number | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          control_type?: string | null
          created_at?: string | null
          effective_date?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          id_registration_number?: string | null
          is_active?: boolean | null
          notes?: string | null
          organisation_id?: string | null
          owner_name: string
          owner_type?: string | null
          ownership_percentage?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          control_type?: string | null
          created_at?: string | null
          effective_date?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          id_registration_number?: string | null
          is_active?: boolean | null
          notes?: string | null
          organisation_id?: string | null
          owner_name?: string
          owner_type?: string | null
          ownership_percentage?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_beneficial_owners_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_beneficial_owners_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_addresses: {
        Row: {
          address_type: string
          city: string | null
          client_id: string | null
          country: string | null
          created_at: string | null
          id: string
          line_1: string | null
          line_2: string | null
          organisation_id: string | null
          postal_code: string | null
          province: string | null
          updated_at: string | null
        }
        Insert: {
          address_type: string
          city?: string | null
          client_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          line_1?: string | null
          line_2?: string | null
          organisation_id?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Update: {
          address_type?: string
          city?: string | null
          client_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          line_1?: string | null
          line_2?: string | null
          organisation_id?: string | null
          postal_code?: string | null
          province?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_addresses_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_contacts: {
        Row: {
          client_id: string | null
          contact_name: string | null
          contact_position: string | null
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          mobile: string | null
          organisation_id: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          contact_name?: string | null
          contact_position?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          organisation_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          contact_name?: string | null
          contact_position?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          organisation_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_directors: {
        Row: {
          appointment_date: string | null
          client_id: string | null
          created_at: string | null
          director_name: string
          email: string | null
          id: string
          id_passport_number: string | null
          is_active: boolean | null
          organisation_id: string | null
          phone: string | null
          resignation_date: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date?: string | null
          client_id?: string | null
          created_at?: string | null
          director_name: string
          email?: string | null
          id?: string
          id_passport_number?: string | null
          is_active?: boolean | null
          organisation_id?: string | null
          phone?: string | null
          resignation_date?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string | null
          client_id?: string | null
          created_at?: string | null
          director_name?: string
          email?: string | null
          id?: string
          id_passport_number?: string | null
          is_active?: boolean | null
          organisation_id?: string | null
          phone?: string | null
          resignation_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_directors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_directors_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_notes: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          id: string
          note_body: string | null
          note_title: string | null
          note_type: string | null
          organisation_id: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          note_body?: string | null
          note_title?: string | null
          note_type?: string | null
          organisation_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          note_body?: string | null
          note_title?: string | null
          note_type?: string | null
          organisation_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_notes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_notes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_client_services: {
        Row: {
          client_id: string | null
          created_at: string | null
          end_date: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          last_generated_until: string | null
          next_generation_date: string | null
          notes: string | null
          organisation_id: string | null
          service_id: string | null
          service_settings: Json
          start_date: string | null
          task_generation_enabled: boolean
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_generated_until?: string | null
          next_generation_date?: string | null
          notes?: string | null
          organisation_id?: string | null
          service_id?: string | null
          service_settings?: Json
          start_date?: string | null
          task_generation_enabled?: boolean
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          last_generated_until?: string | null
          next_generation_date?: string | null
          notes?: string | null
          organisation_id?: string | null
          service_id?: string | null
          service_settings?: Json
          start_date?: string | null
          task_generation_enabled?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_client_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_services_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_client_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "crm_services"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          annual_fee: number | null
          billing_frequency: string | null
          client_code: string | null
          client_lead_user_id: string | null
          client_name: string
          created_at: string | null
          customs_number: string | null
          date_of_birth: string | null
          entity_type: string | null
          id: string
          id_passport_number: string | null
          imported_source: string | null
          manager_user_id: string | null
          monthly_fee: number | null
          organisation_id: string | null
          partner_user_id: string | null
          paye_number: string | null
          profitability_notes: string | null
          registration_date: string | null
          registration_number: string | null
          sdl_registered: boolean | null
          status: string | null
          tax_number: string | null
          trading_name: string | null
          trust_deed_number: string | null
          uif_registration_number: string | null
          updated_at: string | null
          vat_number: string | null
          wcc_reference_number: string | null
          year_end: string | null
        }
        Insert: {
          annual_fee?: number | null
          billing_frequency?: string | null
          client_code?: string | null
          client_lead_user_id?: string | null
          client_name: string
          created_at?: string | null
          customs_number?: string | null
          date_of_birth?: string | null
          entity_type?: string | null
          id?: string
          id_passport_number?: string | null
          imported_source?: string | null
          manager_user_id?: string | null
          monthly_fee?: number | null
          organisation_id?: string | null
          partner_user_id?: string | null
          paye_number?: string | null
          profitability_notes?: string | null
          registration_date?: string | null
          registration_number?: string | null
          sdl_registered?: boolean | null
          status?: string | null
          tax_number?: string | null
          trading_name?: string | null
          trust_deed_number?: string | null
          uif_registration_number?: string | null
          updated_at?: string | null
          vat_number?: string | null
          wcc_reference_number?: string | null
          year_end?: string | null
        }
        Update: {
          annual_fee?: number | null
          billing_frequency?: string | null
          client_code?: string | null
          client_lead_user_id?: string | null
          client_name?: string
          created_at?: string | null
          customs_number?: string | null
          date_of_birth?: string | null
          entity_type?: string | null
          id?: string
          id_passport_number?: string | null
          imported_source?: string | null
          manager_user_id?: string | null
          monthly_fee?: number | null
          organisation_id?: string | null
          partner_user_id?: string | null
          paye_number?: string | null
          profitability_notes?: string | null
          registration_date?: string | null
          registration_number?: string | null
          sdl_registered?: boolean | null
          status?: string | null
          tax_number?: string | null
          trading_name?: string | null
          trust_deed_number?: string | null
          uif_registration_number?: string | null
          updated_at?: string | null
          vat_number?: string | null
          wcc_reference_number?: string | null
          year_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_client_lead_user_id_fkey"
            columns: ["client_lead_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_clients_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_clients_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_clients_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_directors: {
        Row: {
          appointment_date: string | null
          client_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          id_passport_number: string | null
          is_active: boolean | null
          organisation_id: string | null
          phone: string | null
          resignation_date: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date?: string | null
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_passport_number?: string | null
          is_active?: boolean | null
          organisation_id?: string | null
          phone?: string | null
          resignation_date?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string | null
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_passport_number?: string | null
          is_active?: boolean | null
          organisation_id?: string | null
          phone?: string | null
          resignation_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_directors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_directors_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_services: {
        Row: {
          colour_hex: string | null
          created_at: string | null
          default_due_day: number | null
          default_frequency: string | null
          default_service_settings: Json
          default_workflow_type: string | null
          id: string
          is_active: boolean | null
          organisation_id: string | null
          service_group: string | null
          service_name: string
          text_colour_hex: string | null
          updated_at: string | null
        }
        Insert: {
          colour_hex?: string | null
          created_at?: string | null
          default_due_day?: number | null
          default_frequency?: string | null
          default_service_settings?: Json
          default_workflow_type?: string | null
          id?: string
          is_active?: boolean | null
          organisation_id?: string | null
          service_group?: string | null
          service_name: string
          text_colour_hex?: string | null
          updated_at?: string | null
        }
        Update: {
          colour_hex?: string | null
          created_at?: string | null
          default_due_day?: number | null
          default_frequency?: string | null
          default_service_settings?: Json
          default_workflow_type?: string | null
          id?: string
          is_active?: boolean | null
          organisation_id?: string | null
          service_group?: string | null
          service_name?: string
          text_colour_hex?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_services_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_share_certificates: {
        Row: {
          cancelled_date: string | null
          certificate_number: string | null
          client_id: string | null
          created_at: string | null
          file_bucket: string | null
          file_path: string | null
          id: string
          is_cancelled: boolean | null
          issue_date: string | null
          number_of_shares: number | null
          organisation_id: string | null
          share_class: string | null
          shareholder_id: string | null
          updated_at: string | null
        }
        Insert: {
          cancelled_date?: string | null
          certificate_number?: string | null
          client_id?: string | null
          created_at?: string | null
          file_bucket?: string | null
          file_path?: string | null
          id?: string
          is_cancelled?: boolean | null
          issue_date?: string | null
          number_of_shares?: number | null
          organisation_id?: string | null
          share_class?: string | null
          shareholder_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cancelled_date?: string | null
          certificate_number?: string | null
          client_id?: string | null
          created_at?: string | null
          file_bucket?: string | null
          file_path?: string | null
          id?: string
          is_cancelled?: boolean | null
          issue_date?: string | null
          number_of_shares?: number | null
          organisation_id?: string | null
          share_class?: string | null
          shareholder_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_share_certificates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_share_certificates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_share_certificates_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "crm_shareholders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_shareholders: {
        Row: {
          acquisition_date: string | null
          client_id: string | null
          created_at: string | null
          disposal_date: string | null
          email: string | null
          id: string
          id_registration_number: string | null
          is_active: boolean | null
          number_of_shares: number | null
          organisation_id: string | null
          percentage_holding: number | null
          phone: string | null
          share_class: string | null
          shareholder_name: string
          shareholder_type: string | null
          updated_at: string | null
        }
        Insert: {
          acquisition_date?: string | null
          client_id?: string | null
          created_at?: string | null
          disposal_date?: string | null
          email?: string | null
          id?: string
          id_registration_number?: string | null
          is_active?: boolean | null
          number_of_shares?: number | null
          organisation_id?: string | null
          percentage_holding?: number | null
          phone?: string | null
          share_class?: string | null
          shareholder_name: string
          shareholder_type?: string | null
          updated_at?: string | null
        }
        Update: {
          acquisition_date?: string | null
          client_id?: string | null
          created_at?: string | null
          disposal_date?: string | null
          email?: string | null
          id?: string
          id_registration_number?: string | null
          is_active?: boolean | null
          number_of_shares?: number | null
          organisation_id?: string | null
          percentage_holding?: number | null
          phone?: string | null
          share_class?: string | null
          shareholder_name?: string
          shareholder_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_shareholders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_task_documents: {
        Row: {
          client_id: string | null
          created_at: string | null
          document_name: string | null
          document_type: string | null
          external_file_id: string | null
          external_file_path: string | null
          external_file_url: string | null
          file_bucket: string | null
          file_path: string | null
          file_url: string | null
          id: string
          notes: string | null
          organisation_id: string | null
          review_status: string
          reviewed_copy_path: string | null
          reviewed_final_path: string | null
          storage_provider: string
          task_id: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          uploaded_by_user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          document_name?: string | null
          document_type?: string | null
          external_file_id?: string | null
          external_file_path?: string | null
          external_file_url?: string | null
          file_bucket?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          review_status?: string
          reviewed_copy_path?: string | null
          reviewed_final_path?: string | null
          storage_provider?: string
          task_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          uploaded_by_user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          document_name?: string | null
          document_type?: string | null
          external_file_id?: string | null
          external_file_path?: string | null
          external_file_url?: string | null
          file_bucket?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          review_status?: string
          reviewed_copy_path?: string | null
          reviewed_final_path?: string | null
          storage_provider?: string
          task_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_documents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_documents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_task_review_comments: {
        Row: {
          assigned_to: string | null
          comment_status: string
          created_at: string
          created_by: string | null
          document_id: string | null
          id: string
          reference_label: string | null
          resolved_at: string | null
          review_note: string
          task_id: string
        }
        Insert: {
          assigned_to?: string | null
          comment_status?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          reference_label?: string | null
          resolved_at?: string | null
          review_note: string
          task_id: string
        }
        Update: {
          assigned_to?: string | null
          comment_status?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          id?: string
          reference_label?: string | null
          resolved_at?: string | null
          review_note?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_review_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "crm_task_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_review_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_task_time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          note: string | null
          started_at: string
          stopped_at: string | null
          task_id: string
          user_id: string
          work_stage: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note?: string | null
          started_at?: string
          stopped_at?: string | null
          task_id: string
          user_id: string
          work_stage?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note?: string | null
          started_at?: string
          stopped_at?: string | null
          task_id?: string
          user_id?: string
          work_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_task_time_logs: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string
          notes: string | null
          organisation_id: string | null
          started_at: string
          stopped_at: string | null
          task_id: string | null
          updated_at: string | null
          user_profile_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          started_at?: string
          stopped_at?: string | null
          task_id?: string | null
          updated_at?: string | null
          user_profile_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          started_at?: string
          stopped_at?: string | null
          task_id?: string | null
          updated_at?: string | null
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_time_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_time_logs_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_task_workflow_steps: {
        Row: {
          assigned_to_user_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          organisation_id: string | null
          started_at: string | null
          step_name: string
          step_order: number
          step_status: string | null
          task_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          started_at?: string | null
          step_name: string
          step_order: number
          step_status?: string | null
          task_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string | null
          started_at?: string | null
          step_name?: string
          step_order?: number
          step_status?: string | null
          task_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_task_workflow_steps_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_workflow_steps_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_task_workflow_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          ad_hoc_category: string | null
          ad_hoc_notes: string | null
          assigned_to_user_id: string | null
          client_id: string | null
          client_service_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          due_date: string | null
          has_deadline: boolean | null
          id: string
          is_manual_task: boolean | null
          meeting_end_time: string | null
          meeting_location: string | null
          meeting_start_time: string | null
          organisation_id: string | null
          period_end: string | null
          period_start: string | null
          ready_for_review_at: string | null
          review_notes: string | null
          review_outcome: string | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          service_name: string | null
          started_at: string | null
          task_description: string | null
          task_status: string | null
          task_title: string
          updated_at: string | null
        }
        Insert: {
          ad_hoc_category?: string | null
          ad_hoc_notes?: string | null
          assigned_to_user_id?: string | null
          client_id?: string | null
          client_service_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          due_date?: string | null
          has_deadline?: boolean | null
          id?: string
          is_manual_task?: boolean | null
          meeting_end_time?: string | null
          meeting_location?: string | null
          meeting_start_time?: string | null
          organisation_id?: string | null
          period_end?: string | null
          period_start?: string | null
          ready_for_review_at?: string | null
          review_notes?: string | null
          review_outcome?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          service_name?: string | null
          started_at?: string | null
          task_description?: string | null
          task_status?: string | null
          task_title: string
          updated_at?: string | null
        }
        Update: {
          ad_hoc_category?: string | null
          ad_hoc_notes?: string | null
          assigned_to_user_id?: string | null
          client_id?: string | null
          client_service_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          due_date?: string | null
          has_deadline?: boolean | null
          id?: string
          is_manual_task?: boolean | null
          meeting_end_time?: string | null
          meeting_location?: string | null
          meeting_start_time?: string | null
          organisation_id?: string | null
          period_end?: string | null
          period_start?: string | null
          ready_for_review_at?: string | null
          review_notes?: string | null
          review_outcome?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          service_name?: string | null
          started_at?: string | null
          task_description?: string | null
          task_status?: string | null
          task_title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_client_service_id_fkey"
            columns: ["client_service_id"]
            isOneToOne: false
            referencedRelation: "crm_client_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cubechem_approved_prices: {
        Row: {
          accepted_increase: boolean
          approved_price: number
          branch_markup_percent: number | null
          category_name: string | null
          category_sort: number | null
          ccd_item_code: string
          created_at: string
          description: string | null
          hq_markup_percent: number | null
          hq_price: number | null
          id: string
          item_sort: number | null
          manually_adjusted: boolean
          price_month: string
          pricing_method: string | null
          source_status: string | null
          supplier_ex_vat: number | null
          updated_at: string
        }
        Insert: {
          accepted_increase?: boolean
          approved_price: number
          branch_markup_percent?: number | null
          category_name?: string | null
          category_sort?: number | null
          ccd_item_code: string
          created_at?: string
          description?: string | null
          hq_markup_percent?: number | null
          hq_price?: number | null
          id?: string
          item_sort?: number | null
          manually_adjusted?: boolean
          price_month: string
          pricing_method?: string | null
          source_status?: string | null
          supplier_ex_vat?: number | null
          updated_at?: string
        }
        Update: {
          accepted_increase?: boolean
          approved_price?: number
          branch_markup_percent?: number | null
          category_name?: string | null
          category_sort?: number | null
          ccd_item_code?: string
          created_at?: string
          description?: string | null
          hq_markup_percent?: number | null
          hq_price?: number | null
          id?: string
          item_sort?: number | null
          manually_adjusted?: boolean
          price_month?: string
          pricing_method?: string | null
          source_status?: string | null
          supplier_ex_vat?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cubechem_category_rules: {
        Row: {
          category_name: string
          category_sort: number
          created_at: string
          description_contains: string | null
          id: string
          is_active: boolean
          item_code_exact: string | null
          item_code_prefix: string | null
          item_sort: number | null
          rule_name: string
        }
        Insert: {
          category_name: string
          category_sort?: number
          created_at?: string
          description_contains?: string | null
          id?: string
          is_active?: boolean
          item_code_exact?: string | null
          item_code_prefix?: string | null
          item_sort?: number | null
          rule_name: string
        }
        Update: {
          category_name?: string
          category_sort?: number
          created_at?: string
          description_contains?: string | null
          id?: string
          is_active?: boolean
          item_code_exact?: string | null
          item_code_prefix?: string | null
          item_sort?: number | null
          rule_name?: string
        }
        Relationships: []
      }
      cubechem_ccd_items: {
        Row: {
          approved_price: number | null
          created_at: string
          description: string | null
          id: string
          item_code: string
          old_price: number | null
          sheet_name: string | null
          status: string
          upload_id: string
        }
        Insert: {
          approved_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          item_code: string
          old_price?: number | null
          sheet_name?: string | null
          status?: string
          upload_id: string
        }
        Update: {
          approved_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          item_code?: string
          old_price?: number | null
          sheet_name?: string | null
          status?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cubechem_ccd_items_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "cubechem_ccd_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      cubechem_ccd_uploads: {
        Row: {
          file_name: string
          file_path: string | null
          id: string
          price_month: string
          status: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_path?: string | null
          id?: string
          price_month: string
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string | null
          id?: string
          price_month?: string
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      cubechem_franchises: {
        Row: {
          area_heading: string
          created_at: string
          email: string | null
          franchise_code: string
          franchise_name: string
          id: string
          is_active: boolean
          phone: string | null
          slogan: string | null
          sort_order: number
        }
        Insert: {
          area_heading: string
          created_at?: string
          email?: string | null
          franchise_code: string
          franchise_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          slogan?: string | null
          sort_order?: number
        }
        Update: {
          area_heading?: string
          created_at?: string
          email?: string | null
          franchise_code?: string
          franchise_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          slogan?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      cubechem_partner_products: {
        Row: {
          created_at: string
          id: string
          item_code: string
          partner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_code: string
          partner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_code?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cubechem_partner_products_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "cubechem_sales_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cubechem_price_items: {
        Row: {
          approved_price: number | null
          branch_price: number | null
          created_at: string
          description: string | null
          hq_price: number | null
          id: string
          item_code: string
          override_reason: string | null
          status: string
          supplier_ex_vat: number | null
          supplier_inc_vat: number | null
          upload_id: string
        }
        Insert: {
          approved_price?: number | null
          branch_price?: number | null
          created_at?: string
          description?: string | null
          hq_price?: number | null
          id?: string
          item_code: string
          override_reason?: string | null
          status?: string
          supplier_ex_vat?: number | null
          supplier_inc_vat?: number | null
          upload_id: string
        }
        Update: {
          approved_price?: number | null
          branch_price?: number | null
          created_at?: string
          description?: string | null
          hq_price?: number | null
          id?: string
          item_code?: string
          override_reason?: string | null
          status?: string
          supplier_ex_vat?: number | null
          supplier_inc_vat?: number | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cubechem_price_items_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "cubechem_price_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      cubechem_price_review_items: {
        Row: {
          accepted_increase: boolean
          approved_price: number | null
          branch_markup_percent: number | null
          calculated_price: number | null
          category_name: string | null
          category_sort: number | null
          ccd_item_code: string
          created_at: string
          description: string | null
          difference: number | null
          difference_percent: number | null
          hq_markup_percent: number | null
          hq_price: number | null
          id: string
          is_approved: boolean
          item_sort: number | null
          manually_adjusted: boolean
          missing_sources: Json
          override_reason: string | null
          previous_approved_price: number | null
          price_month: string
          pricing_method: string | null
          status: string | null
          supplier_ex_vat: number | null
          updated_at: string
        }
        Insert: {
          accepted_increase?: boolean
          approved_price?: number | null
          branch_markup_percent?: number | null
          calculated_price?: number | null
          category_name?: string | null
          category_sort?: number | null
          ccd_item_code: string
          created_at?: string
          description?: string | null
          difference?: number | null
          difference_percent?: number | null
          hq_markup_percent?: number | null
          hq_price?: number | null
          id?: string
          is_approved?: boolean
          item_sort?: number | null
          manually_adjusted?: boolean
          missing_sources?: Json
          override_reason?: string | null
          previous_approved_price?: number | null
          price_month: string
          pricing_method?: string | null
          status?: string | null
          supplier_ex_vat?: number | null
          updated_at?: string
        }
        Update: {
          accepted_increase?: boolean
          approved_price?: number | null
          branch_markup_percent?: number | null
          calculated_price?: number | null
          category_name?: string | null
          category_sort?: number | null
          ccd_item_code?: string
          created_at?: string
          description?: string | null
          difference?: number | null
          difference_percent?: number | null
          hq_markup_percent?: number | null
          hq_price?: number | null
          id?: string
          is_approved?: boolean
          item_sort?: number | null
          manually_adjusted?: boolean
          missing_sources?: Json
          override_reason?: string | null
          previous_approved_price?: number | null
          price_month?: string
          pricing_method?: string | null
          status?: string | null
          supplier_ex_vat?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cubechem_price_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_path: string | null
          id: string
          price_list_type: string
          price_month: string
          status: string
          supplier_name: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path?: string | null
          id?: string
          price_list_type?: string
          price_month: string
          status?: string
          supplier_name?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string | null
          id?: string
          price_list_type?: string
          price_month?: string
          status?: string
          supplier_name?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      cubechem_product_rules: {
        Row: {
          bottle_cost: number
          ccd_description: string | null
          ccd_item_code: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          rule_type: string
          source_items: Json
        }
        Insert: {
          bottle_cost?: number
          ccd_description?: string | null
          ccd_item_code: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          rule_type?: string
          source_items?: Json
        }
        Update: {
          bottle_cost?: number
          ccd_description?: string | null
          ccd_item_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          rule_type?: string
          source_items?: Json
        }
        Relationships: []
      }
      cubechem_sales_partners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          partner_type: string
          public_price_list_enabled: boolean
          purchase_markup_percent: number | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          partner_type: string
          public_price_list_enabled?: boolean
          purchase_markup_percent?: number | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          partner_type?: string
          public_price_list_enabled?: boolean
          purchase_markup_percent?: number | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cubechem_static_pdf_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          item_code: string
          price: number
          section_key: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          item_code: string
          price: number
          section_key: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          item_code?: string
          price?: number
          section_key?: string
          sort_order?: number
        }
        Relationships: []
      }
      cubechem_static_pdf_sections: {
        Row: {
          body_text: string | null
          created_at: string
          id: string
          is_active: boolean
          section_key: string
          section_title: string
          show_for_franchise_code: string | null
          sort_order: number
        }
        Insert: {
          body_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          section_key: string
          section_title: string
          show_for_franchise_code?: string | null
          sort_order?: number
        }
        Update: {
          body_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          section_key?: string
          section_title?: string
          show_for_franchise_code?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      management_account_mappings: {
        Row: {
          account_name: string
          client_id: string
          created_at: string
          display_name: string | null
          id: string
          report_order: number
          report_section: string
          report_type: string
          source_category: string
        }
        Insert: {
          account_name: string
          client_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          report_order?: number
          report_section: string
          report_type: string
          source_category: string
        }
        Update: {
          account_name?: string
          client_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          report_order?: number
          report_section?: string
          report_type?: string
          source_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_account_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "management_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      management_clients: {
        Row: {
          client_name: string
          created_at: string
          financial_year_end_month: number
          id: string
        }
        Insert: {
          client_name: string
          created_at?: string
          financial_year_end_month: number
          id?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          financial_year_end_month?: number
          id?: string
        }
        Relationships: []
      }
      management_graph_inputs: {
        Row: {
          client_id: string
          created_at: string
          graph_data: Json
          id: string
          updated_at: string
          year_labels: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          graph_data?: Json
          id?: string
          updated_at?: string
          year_labels?: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          graph_data?: Json
          id?: string
          updated_at?: string
          year_labels?: Json
        }
        Relationships: [
          {
            foreignKeyName: "management_graph_inputs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "management_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      management_report_periods: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_rolling: boolean
          number_of_months: number | null
          number_of_years: number | null
          report_name: string
          report_type: string
          start_month: number | null
          start_year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_rolling?: boolean
          number_of_months?: number | null
          number_of_years?: number | null
          report_name: string
          report_type: string
          start_month?: number | null
          start_year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_rolling?: boolean
          number_of_months?: number | null
          number_of_years?: number | null
          report_name?: string
          report_type?: string
          start_month?: number | null
          start_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "management_report_periods_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "management_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      management_trial_balance_lines: {
        Row: {
          account_name: string
          balance: number
          category: string
          credit: number
          debit: number
          id: string
          trial_balance_id: string
        }
        Insert: {
          account_name: string
          balance?: number
          category: string
          credit?: number
          debit?: number
          id?: string
          trial_balance_id: string
        }
        Update: {
          account_name?: string
          balance?: number
          category?: string
          credit?: number
          debit?: number
          id?: string
          trial_balance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_trial_balance_lines_trial_balance_id_fkey"
            columns: ["trial_balance_id"]
            isOneToOne: false
            referencedRelation: "management_trial_balances"
            referencedColumns: ["id"]
          },
        ]
      }
      management_trial_balances: {
        Row: {
          client_id: string
          file_name: string | null
          id: string
          imported_at: string
          period_month: number
          period_year: number
        }
        Insert: {
          client_id: string
          file_name?: string | null
          id?: string
          imported_at?: string
          period_month: number
          period_year: number
        }
        Update: {
          client_id?: string
          file_name?: string | null
          id?: string
          imported_at?: string
          period_month?: number
          period_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "management_trial_balances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "management_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          access_enabled: boolean
          contact_email: string | null
          contact_number: string | null
          contact_person: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          paia_billing_enabled: boolean
          paia_free_manuals_allowed: number
          paia_free_manuals_used: number
          paia_manual_price: number
          status: string
        }
        Insert: {
          access_enabled?: boolean
          contact_email?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          paia_billing_enabled?: boolean
          paia_free_manuals_allowed?: number
          paia_free_manuals_used?: number
          paia_manual_price?: number
          status?: string
        }
        Update: {
          access_enabled?: boolean
          contact_email?: string | null
          contact_number?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          paia_billing_enabled?: boolean
          paia_free_manuals_allowed?: number
          paia_free_manuals_used?: number
          paia_manual_price?: number
          status?: string
        }
        Relationships: []
      }
      paia_manual_cross_border: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_selected: boolean | null
          manual_id: string
          option_key: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_selected?: boolean | null
          manual_id: string
          option_key: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_selected?: boolean | null
          manual_id?: string
          option_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_cross_border_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_data_subjects: {
        Row: {
          created_at: string | null
          id: string
          information_processed: string | null
          is_custom: boolean | null
          is_selected: boolean | null
          manual_id: string
          sort_order: number | null
          subject_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          information_processed?: string | null
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id: string
          sort_order?: number | null
          subject_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          information_processed?: string | null
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id?: string
          sort_order?: number | null
          subject_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_data_subjects_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_exports: {
        Row: {
          export_type: string
          exported_at: string | null
          exported_by: string | null
          file_url: string | null
          id: string
          manual_id: string
        }
        Insert: {
          export_type: string
          exported_at?: string | null
          exported_by?: string | null
          file_url?: string | null
          id?: string
          manual_id: string
        }
        Update: {
          export_type?: string
          exported_at?: string | null
          exported_by?: string | null
          file_url?: string | null
          id?: string
          manual_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_exports_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_legislation: {
        Row: {
          applicable_records: string | null
          created_at: string | null
          id: string
          is_custom: boolean | null
          is_selected: boolean | null
          legislation_name: string
          manual_id: string
          sort_order: number | null
        }
        Insert: {
          applicable_records?: string | null
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          legislation_name: string
          manual_id: string
          sort_order?: number | null
        }
        Update: {
          applicable_records?: string | null
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          legislation_name?: string
          manual_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_legislation_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_personal_information_categories: {
        Row: {
          category_name: string
          created_at: string | null
          id: string
          is_custom: boolean | null
          is_selected: boolean | null
          manual_id: string
          person_type: string
          sort_order: number | null
        }
        Insert: {
          category_name: string
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id: string
          person_type: string
          sort_order?: number | null
        }
        Update: {
          category_name?: string
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id?: string
          person_type?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_personal_information_categories_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_processing_purposes: {
        Row: {
          created_at: string | null
          id: string
          is_custom: boolean | null
          is_selected: boolean | null
          manual_id: string
          purpose_name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id: string
          purpose_name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id?: string
          purpose_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_processing_purposes_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_recipients: {
        Row: {
          created_at: string | null
          id: string
          information_shared: string | null
          is_custom: boolean | null
          is_selected: boolean | null
          manual_id: string
          recipient_name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          information_shared?: string | null
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id: string
          recipient_name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          information_shared?: string | null
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id?: string
          recipient_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_recipients_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_record_categories: {
        Row: {
          category_key: string
          category_name: string
          created_at: string | null
          id: string
          manual_id: string
          sort_order: number | null
        }
        Insert: {
          category_key: string
          category_name: string
          created_at?: string | null
          id?: string
          manual_id: string
          sort_order?: number | null
        }
        Update: {
          category_key?: string
          category_name?: string
          created_at?: string | null
          id?: string
          manual_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_record_categories_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_records: {
        Row: {
          available_on_request: boolean | null
          available_on_website: boolean | null
          category_key: string
          created_at: string | null
          id: string
          is_custom: boolean | null
          is_selected: boolean | null
          manual_id: string
          notes: string | null
          record_name: string
          sort_order: number | null
        }
        Insert: {
          available_on_request?: boolean | null
          available_on_website?: boolean | null
          category_key: string
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id: string
          notes?: string | null
          record_name: string
          sort_order?: number | null
        }
        Update: {
          available_on_request?: boolean | null
          available_on_website?: boolean | null
          category_key?: string
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id?: string
          notes?: string | null
          record_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_records_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_security_measures: {
        Row: {
          created_at: string | null
          id: string
          is_custom: boolean | null
          is_selected: boolean | null
          manual_id: string
          measure_name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id: string
          measure_name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          is_selected?: boolean | null
          manual_id?: string
          measure_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_security_measures_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manual_signatories: {
        Row: {
          created_at: string | null
          id: string
          manual_id: string
          signatory_capacity: string | null
          signatory_name: string
          signature_label: string | null
          signed_at: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manual_id: string
          signatory_capacity?: string | null
          signatory_name: string
          signature_label?: string | null
          signed_at?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manual_id?: string
          signatory_capacity?: string | null
          signatory_name?: string
          signature_label?: string | null
          signed_at?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paia_manual_signatories_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "paia_manuals"
            referencedColumns: ["id"]
          },
        ]
      }
      paia_manuals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billing_amount: number
          billing_status: string
          client_id: string | null
          cover_page_file_path: string | null
          cover_page_url: string | null
          created_at: string | null
          created_by: string | null
          created_by_user_id: string | null
          created_from_manual_id: string | null
          date_compiled: string | null
          date_revised: string | null
          deputy_information_officer_email: string | null
          deputy_information_officer_name: string | null
          deputy_information_officer_position: string | null
          deputy_information_officer_telephone: string | null
          email: string | null
          entity_name: string
          entity_registration_number: string | null
          entity_type: string | null
          id: string
          industry: string | null
          information_officer_email: string | null
          information_officer_name: string | null
          information_officer_position: string | null
          information_officer_telephone: string | null
          invoice_number: string | null
          invoiced_at: string | null
          is_free_manual: boolean
          logo_file_path: string | null
          logo_url: string | null
          manual_name: string
          next_review_date: string | null
          physical_address: string | null
          postal_address: string | null
          prepared_by: string | null
          reviewed_by: string | null
          status: string | null
          telephone: string | null
          updated_at: string | null
          vat_number: string | null
          version_number: string | null
          website: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billing_amount?: number
          billing_status?: string
          client_id?: string | null
          cover_page_file_path?: string | null
          cover_page_url?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_user_id?: string | null
          created_from_manual_id?: string | null
          date_compiled?: string | null
          date_revised?: string | null
          deputy_information_officer_email?: string | null
          deputy_information_officer_name?: string | null
          deputy_information_officer_position?: string | null
          deputy_information_officer_telephone?: string | null
          email?: string | null
          entity_name: string
          entity_registration_number?: string | null
          entity_type?: string | null
          id?: string
          industry?: string | null
          information_officer_email?: string | null
          information_officer_name?: string | null
          information_officer_position?: string | null
          information_officer_telephone?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          is_free_manual?: boolean
          logo_file_path?: string | null
          logo_url?: string | null
          manual_name: string
          next_review_date?: string | null
          physical_address?: string | null
          postal_address?: string | null
          prepared_by?: string | null
          reviewed_by?: string | null
          status?: string | null
          telephone?: string | null
          updated_at?: string | null
          vat_number?: string | null
          version_number?: string | null
          website?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billing_amount?: number
          billing_status?: string
          client_id?: string | null
          cover_page_file_path?: string | null
          cover_page_url?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_user_id?: string | null
          created_from_manual_id?: string | null
          date_compiled?: string | null
          date_revised?: string | null
          deputy_information_officer_email?: string | null
          deputy_information_officer_name?: string | null
          deputy_information_officer_position?: string | null
          deputy_information_officer_telephone?: string | null
          email?: string | null
          entity_name?: string
          entity_registration_number?: string | null
          entity_type?: string | null
          id?: string
          industry?: string | null
          information_officer_email?: string | null
          information_officer_name?: string | null
          information_officer_position?: string | null
          information_officer_telephone?: string | null
          invoice_number?: string | null
          invoiced_at?: string | null
          is_free_manual?: boolean
          logo_file_path?: string | null
          logo_url?: string | null
          manual_name?: string
          next_review_date?: string | null
          physical_address?: string | null
          postal_address?: string | null
          prepared_by?: string | null
          reviewed_by?: string | null
          status?: string | null
          telephone?: string | null
          updated_at?: string | null
          vat_number?: string | null
          version_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      practicepilot_module_access: {
        Row: {
          access_level: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          module_key: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          module_key: string
        }
        Update: {
          access_level?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          module_key?: string
        }
        Relationships: []
      }
      project_contractors: {
        Row: {
          access_enabled: boolean
          address: string | null
          bank_details: string | null
          contact_person: string | null
          contractor_name: string
          created_at: string
          email: string | null
          id: string
          notes: string | null
          organisation_id: string
          payment_terms: string | null
          phone: string | null
          project_id: string | null
          trade_category: string | null
          vat_number: string | null
        }
        Insert: {
          access_enabled?: boolean
          address?: string | null
          bank_details?: string | null
          contact_person?: string | null
          contractor_name: string
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          organisation_id: string
          payment_terms?: string | null
          phone?: string | null
          project_id?: string | null
          trade_category?: string | null
          vat_number?: string | null
        }
        Update: {
          access_enabled?: boolean
          address?: string | null
          bank_details?: string | null
          contact_person?: string | null
          contractor_name?: string
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          organisation_id?: string
          payment_terms?: string | null
          phone?: string | null
          project_id?: string | null
          trade_category?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_contractors_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invoices: {
        Row: {
          created_at: string | null
          expected_amount: number
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoiced_amount: number | null
          phase_number: number
          project_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          expected_amount: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoiced_amount?: number | null
          phase_number: number
          project_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          expected_amount?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoiced_amount?: number | null
          phase_number?: number
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_line_item_quote_files: {
        Row: {
          file_name: string
          file_path: string
          id: string
          line_item_id: string
          project_id: string
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          line_item_id: string
          project_id: string
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          line_item_id?: string
          project_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_line_item_quote_files_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "project_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_line_item_quote_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_line_items: {
        Row: {
          amount: number
          contractor_id: string | null
          created_at: string | null
          description: string
          id: string
          project_id: string
          quote_file_name: string | null
          quote_file_path: string | null
          vat_mode: string
        }
        Insert: {
          amount: number
          contractor_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          project_id: string
          quote_file_name?: string | null
          quote_file_path?: string | null
          vat_mode: string
        }
        Update: {
          amount?: number
          contractor_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          project_id?: string
          quote_file_name?: string | null
          quote_file_path?: string | null
          vat_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_line_items_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "project_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payments: {
        Row: {
          created_at: string | null
          id: string
          invoice_id: string
          paid_amount: number
          payment_date: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_id: string
          paid_amount: number
          payment_date?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_id?: string
          paid_amount?: number
          payment_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "project_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phase_splits: {
        Row: {
          calculated_amount: number
          created_at: string | null
          id: string
          line_item_id: string
          override_amount: number | null
          override_type: string | null
          percentage: number
          phase_number: number
        }
        Insert: {
          calculated_amount: number
          created_at?: string | null
          id?: string
          line_item_id: string
          override_amount?: number | null
          override_type?: string | null
          percentage: number
          phase_number: number
        }
        Update: {
          calculated_amount?: number
          created_at?: string | null
          id?: string
          line_item_id?: string
          override_amount?: number | null
          override_type?: string | null
          percentage?: number
          phase_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_phase_splits_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "project_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      project_supplier_invoice_files: {
        Row: {
          contractor_id: string | null
          file_name: string
          file_path: string
          id: string
          line_item_id: string
          phase_split_id: string | null
          project_id: string
          supplier_phase_number: number
          uploaded_at: string | null
        }
        Insert: {
          contractor_id?: string | null
          file_name: string
          file_path: string
          id?: string
          line_item_id: string
          phase_split_id?: string | null
          project_id: string
          supplier_phase_number: number
          uploaded_at?: string | null
        }
        Update: {
          contractor_id?: string | null
          file_name?: string
          file_path?: string
          id?: string
          line_item_id?: string
          phase_split_id?: string | null
          project_id?: string
          supplier_phase_number?: number
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_supplier_invoice_files_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "project_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supplier_invoice_files_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "project_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supplier_invoice_files_phase_split_id_fkey"
            columns: ["phase_split_id"]
            isOneToOne: false
            referencedRelation: "project_phase_splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supplier_invoice_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_supplier_payments: {
        Row: {
          contractor_id: string | null
          created_at: string
          id: string
          line_item_id: string
          notes: string | null
          paid_amount: number
          payment_date: string | null
          phase_split_id: string | null
          pop_file_name: string | null
          pop_file_path: string | null
          project_id: string
          supplier_phase_number: number
          updated_at: string
        }
        Insert: {
          contractor_id?: string | null
          created_at?: string
          id?: string
          line_item_id: string
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          phase_split_id?: string | null
          pop_file_name?: string | null
          pop_file_path?: string | null
          project_id: string
          supplier_phase_number: number
          updated_at?: string
        }
        Update: {
          contractor_id?: string | null
          created_at?: string
          id?: string
          line_item_id?: string
          notes?: string | null
          paid_amount?: number
          payment_date?: string | null
          phase_split_id?: string | null
          pop_file_name?: string | null
          pop_file_path?: string | null
          project_id?: string
          supplier_phase_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_supplier_payments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "project_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supplier_payments_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "project_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supplier_payments_phase_split_id_fkey"
            columns: ["phase_split_id"]
            isOneToOne: false
            referencedRelation: "project_phase_splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supplier_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timeline_items: {
        Row: {
          contractor_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          organisation_id: string | null
          project_id: string
          start_date: string | null
          status: string
          title: string
        }
        Insert: {
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          organisation_id?: string | null
          project_id: string
          start_date?: string | null
          status?: string
          title: string
        }
        Update: {
          contractor_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          organisation_id?: string | null
          project_id?: string
          start_date?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_timeline_items_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "project_contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timeline_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_timeline_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_income_total: number | null
          client_income_vat_mode: string | null
          client_payment_count: number | null
          client_payment_percentages: Json | null
          created_at: string | null
          current_supplier_phase: number | null
          id: string
          name: string
          number_of_phases: number
          organisation_id: string | null
          status: string
        }
        Insert: {
          client_income_total?: number | null
          client_income_vat_mode?: string | null
          client_payment_count?: number | null
          client_payment_percentages?: Json | null
          created_at?: string | null
          current_supplier_phase?: number | null
          id?: string
          name: string
          number_of_phases: number
          organisation_id?: string | null
          status?: string
        }
        Update: {
          client_income_total?: number | null
          client_income_vat_mode?: string | null
          client_payment_count?: number | null
          client_payment_percentages?: Json | null
          created_at?: string | null
          current_supplier_phase?: number | null
          id?: string
          name?: string
          number_of_phases?: number
          organisation_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_services: {
        Row: {
          amount: number
          category: string
          client_facing_note: string | null
          created_at: string
          description: string | null
          fee_type: string
          id: string
          included_in_package: boolean
          proposal_id: string
          scope_quantity: number | null
          scope_unit: string | null
          service_code: string | null
          service_name: string
          sort_order: number
        }
        Insert: {
          amount?: number
          category: string
          client_facing_note?: string | null
          created_at?: string
          description?: string | null
          fee_type: string
          id?: string
          included_in_package?: boolean
          proposal_id: string
          scope_quantity?: number | null
          scope_unit?: string | null
          service_code?: string | null
          service_name: string
          sort_order?: number
        }
        Update: {
          amount?: number
          category?: string
          client_facing_note?: string | null
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          included_in_package?: boolean
          proposal_id?: string
          scope_quantity?: number | null
          scope_unit?: string | null
          service_code?: string | null
          service_name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_services_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          annual_fee: number
          client_id: string | null
          client_name: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          fee_is_exclusive_vat: boolean
          id: string
          introduction: string | null
          monthly_fee: number
          notes: string | null
          once_off_fee: number
          package_code: string | null
          package_description: string | null
          package_monthly_fee: number
          package_name: string | null
          proposal_date: string
          proposal_number: string
          prospect_company_name: string | null
          prospect_contact_email: string | null
          prospect_contact_name: string | null
          prospect_contact_number: string | null
          status: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          annual_fee?: number
          client_id?: string | null
          client_name: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          fee_is_exclusive_vat?: boolean
          id?: string
          introduction?: string | null
          monthly_fee?: number
          notes?: string | null
          once_off_fee?: number
          package_code?: string | null
          package_description?: string | null
          package_monthly_fee?: number
          package_name?: string | null
          proposal_date?: string
          proposal_number: string
          prospect_company_name?: string | null
          prospect_contact_email?: string | null
          prospect_contact_name?: string | null
          prospect_contact_number?: string | null
          status?: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          annual_fee?: number
          client_id?: string | null
          client_name?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          fee_is_exclusive_vat?: boolean
          id?: string
          introduction?: string | null
          monthly_fee?: number
          notes?: string | null
          once_off_fee?: number
          package_code?: string | null
          package_description?: string | null
          package_monthly_fee?: number
          package_name?: string | null
          proposal_date?: string
          proposal_number?: string
          prospect_company_name?: string | null
          prospect_contact_email?: string | null
          prospect_contact_name?: string | null
          prospect_contact_number?: string | null
          status?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          access_enabled: boolean
          can_access_accounting: boolean
          can_access_afs: boolean
          can_access_budgeting: boolean
          can_access_crm: boolean
          can_access_management_reports: boolean
          can_access_paia: boolean
          can_access_projects: boolean
          can_access_secretarial: boolean
          can_edit_projects: boolean
          created_at: string
          email: string
          full_name: string | null
          hourly_cost_rate: number | null
          id: string
          monthly_salary: number | null
          organisation_id: string | null
          productivity_target_hours: number | null
          role: string
          user_id: string
        }
        Insert: {
          access_enabled?: boolean
          can_access_accounting?: boolean
          can_access_afs?: boolean
          can_access_budgeting?: boolean
          can_access_crm?: boolean
          can_access_management_reports?: boolean
          can_access_paia?: boolean
          can_access_projects?: boolean
          can_access_secretarial?: boolean
          can_edit_projects?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          hourly_cost_rate?: number | null
          id?: string
          monthly_salary?: number | null
          organisation_id?: string | null
          productivity_target_hours?: number | null
          role?: string
          user_id: string
        }
        Update: {
          access_enabled?: boolean
          can_access_accounting?: boolean
          can_access_afs?: boolean
          can_access_budgeting?: boolean
          can_access_crm?: boolean
          can_access_management_reports?: boolean
          can_access_paia?: boolean
          can_access_projects?: boolean
          can_access_secretarial?: boolean
          can_edit_projects?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          hourly_cost_rate?: number | null
          id?: string
          monthly_salary?: number | null
          organisation_id?: string | null
          productivity_target_hours?: number | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          role_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          role_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          role_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      afs_posted_journal_effects: {
        Row: {
          engagement_id: string | null
          net_adjustment: number | null
          posted_credits: number | null
          posted_debits: number | null
          trial_balance_line_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afs_adjusting_journal_lines_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "afs_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afs_adjusting_journal_lines_trial_balance_line_id_fkey"
            columns: ["trial_balance_line_id"]
            isOneToOne: false
            referencedRelation: "afs_trial_balance_lines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
