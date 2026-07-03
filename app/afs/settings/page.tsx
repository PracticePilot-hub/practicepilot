"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type FirmSettings = {
  id?: string;
  owner_user_id?: string;
  firm_name: string;
  trading_name: string;
  logo_url: string;
  address_lines: string;
  telephone: string;
  email: string;
  website: string;
  practitioner_name: string;
  practitioner_designation: string;
  governing_body_name: string;
  governing_body_registration_number: string;
  governing_body_logo_url: string;
  secondary_governing_body_name: string;
  secondary_governing_body_registration_number: string;
  secondary_governing_body_logo_url: string;
  footer_text: string;
  footer_logo_url: string;
};

const emptySettings: FirmSettings = {
  firm_name: "",
  trading_name: "",
  logo_url: "",
  address_lines: "",
  telephone: "",
  email: "",
  website: "",
  practitioner_name: "",
  practitioner_designation: "",
  governing_body_name: "",
  governing_body_registration_number: "",
  governing_body_logo_url: "",
  secondary_governing_body_name: "",
  secondary_governing_body_registration_number: "",
  secondary_governing_body_logo_url: "",
  footer_text: "",
  footer_logo_url: "",
};

function fileExt(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName) return fromName.toLowerCase();
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

export default function AfsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [settings, setSettings] = useState<FirmSettings>(emptySettings);

  const addressPreview = useMemo(
    () => settings.address_lines.split(/\n+/).map((line) => line.trim()).filter(Boolean),
    [settings.address_lines],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        if (!supabase) {
          setStatus("Supabase is not configured.");
          setLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const authUser = authData.user;
        if (!authUser?.id) {
          setStatus("You need to be logged in to edit AFS settings.");
          setLoading(false);
          return;
        }

        if (!cancelled) setUserId(authUser.id);

        const { data, error } = await supabase
          .from("afs_firm_settings")
          .select("*")
          .eq("owner_user_id", authUser.id)
          .maybeSingle();

        if (error) throw error;

        if (!cancelled) {
          setSettings({ ...emptySettings, ...(data || {}) });
          setLoading(false);
        }
      } catch (error: any) {
        console.error("AFS SETTINGS LOAD ERROR:", error);
        if (!cancelled) {
          setStatus(error?.message || "Could not load AFS settings.");
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: keyof FirmSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function uploadImage(field: keyof FirmSettings, file: File | null) {
    if (!file || !supabase || !userId) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Please upload an image file only.");
      return;
    }

    setUploadingField(String(field));
    setStatus("");

    try {
      const path = `${userId}/${String(field)}.${fileExt(file)}`;

      const { error: uploadError } = await supabase.storage
        .from("afs-branding")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/png",
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("afs-branding").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      updateField(field, publicUrl);
      setStatus("Image uploaded. Remember to save settings.");
    } catch (error: any) {
      console.error("AFS BRANDING UPLOAD ERROR:", error);
      setStatus(error?.message || "Image upload failed.");
    } finally {
      setUploadingField(null);
    }
  }

  async function saveSettings() {
    if (!supabase || !userId) return;

    setSaving(true);
    setStatus("");

    try {
      const payload = {
        ...settings,
        owner_user_id: userId,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("afs_firm_settings")
        .upsert(payload, { onConflict: "owner_user_id" });

      if (error) throw error;

      setStatus("AFS firm settings saved.");
    } catch (error: any) {
      console.error("AFS SETTINGS SAVE ERROR:", error);
      setStatus(error?.message || "Could not save AFS settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.headerCard}>
        <div>
          <div style={styles.eyebrow}>PRACTICEPILOT AFS</div>
          <h1 style={styles.title}>Firm / Letterhead Settings</h1>
          <p style={styles.subtitle}>
            Capture the firm branding used on compilation reports and future AFS exports.
          </p>
        </div>
        <Link href="/afs" style={styles.backLink}>Back to AFS dashboard</Link>
      </div>

      {loading ? (
        <section style={styles.card}>Loading settings...</section>
      ) : (
        <div style={styles.layout}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Header details</h2>
              <p style={styles.sectionHelp}>Use a clean logo-only PNG/SVG/WebP. Do not upload a full Word letterhead screenshot.</p>
            </div>

            <ImageUploadRow
              label="Firm logo"
              help="Logo only. The report will create the letterhead layout around it."
              value={settings.logo_url}
              uploading={uploadingField === "logo_url"}
              onUpload={(file) => uploadImage("logo_url", file)}
              onClear={() => updateField("logo_url", "")}
            />

            <div style={styles.gridTwo}>
              <Field label="Firm name" value={settings.firm_name} onChange={(value) => updateField("firm_name", value)} />
              <Field label="Trading name" value={settings.trading_name} onChange={(value) => updateField("trading_name", value)} />
            </div>

            <TextAreaField
              label="Address lines"
              value={settings.address_lines}
              onChange={(value) => updateField("address_lines", value)}
              placeholder="81 Kafue Street\nLynnwood Glen\nPretoria"
            />

            <div style={styles.gridThree}>
              <Field label="Telephone" value={settings.telephone} onChange={(value) => updateField("telephone", value)} />
              <Field label="Email" value={settings.email} onChange={(value) => updateField("email", value)} />
              <Field label="Website" value={settings.website} onChange={(value) => updateField("website", value)} />
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Practitioner and governing body</h2>
              <p style={styles.sectionHelp}>These details appear near the compiler signature and footer.</p>
            </div>

            <div style={styles.gridTwo}>
              <Field label="Practitioner / director / partner name" value={settings.practitioner_name} onChange={(value) => updateField("practitioner_name", value)} />
              <Field label="Designation" value={settings.practitioner_designation} onChange={(value) => updateField("practitioner_designation", value)} />
            </div>

            <div style={styles.gridTwo}>
              <Field label="Governing body" value={settings.governing_body_name} onChange={(value) => updateField("governing_body_name", value)} placeholder="SAIPA" />
              <Field label="Governing body reg no." value={settings.governing_body_registration_number} onChange={(value) => updateField("governing_body_registration_number", value)} placeholder="28289" />
            </div>

            <ImageUploadRow
              label="Governing body logo"
              help="Example: SAIPA logo. Optional, but useful for the footer."
              value={settings.governing_body_logo_url}
              uploading={uploadingField === "governing_body_logo_url"}
              onUpload={(file) => uploadImage("governing_body_logo_url", file)}
              onClear={() => updateField("governing_body_logo_url", "")}
            />

            <div style={styles.gridTwo}>
              <Field label="Second governing body" value={settings.secondary_governing_body_name} onChange={(value) => updateField("secondary_governing_body_name", value)} />
              <Field label="Second governing body reg no." value={settings.secondary_governing_body_registration_number} onChange={(value) => updateField("secondary_governing_body_registration_number", value)} />
            </div>

            <ImageUploadRow
              label="Second governing body logo"
              help="Optional."
              value={settings.secondary_governing_body_logo_url}
              uploading={uploadingField === "secondary_governing_body_logo_url"}
              onUpload={(file) => uploadImage("secondary_governing_body_logo_url", file)}
              onClear={() => updateField("secondary_governing_body_logo_url", "")}
            />
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Footer</h2>
              <p style={styles.sectionHelp}>Footer text is preferred. A footer strip remains optional.</p>
            </div>

            <TextAreaField
              label="Footer text"
              value={settings.footer_text}
              onChange={(value) => updateField("footer_text", value)}
              placeholder="Registered Professional Accountant | SAIPA 28289"
            />

            <ImageUploadRow
              label="Optional footer logo / strip"
              help="Optional. Footer text and governing body logos will usually be cleaner than a large image strip."
              value={settings.footer_logo_url}
              uploading={uploadingField === "footer_logo_url"}
              onUpload={(file) => uploadImage("footer_logo_url", file)}
              onClear={() => updateField("footer_logo_url", "")}
            />
          </section>

          <aside style={styles.previewCard}>
            <h2 style={styles.sectionTitle}>Preview</h2>
            <div style={styles.previewBox}>
              <div style={styles.previewTop}>
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Firm logo preview" style={styles.previewLogo} />
                ) : (
                  <div style={styles.logoPlaceholder}>LOGO</div>
                )}
                <div style={styles.previewContact}>
                  <strong>{settings.firm_name || "Firm name"}</strong>
                  {settings.trading_name ? <span>{settings.trading_name}</span> : null}
                  {addressPreview.map((line) => <span key={line}>{line}</span>)}
                  {settings.telephone ? <span>Tel: {settings.telephone}</span> : null}
                  {settings.email ? <span>Email: {settings.email}</span> : null}
                  {settings.website ? <span>{settings.website}</span> : null}
                </div>
              </div>

              <div style={styles.previewBodyLine} />
              <div style={styles.previewFooter}>
                <div>
                  <strong>{settings.practitioner_name || "Practitioner"}</strong>
                  <span>{settings.practitioner_designation || "Designation"}</span>
                  <span>
                    {[settings.governing_body_name, settings.governing_body_registration_number]
                      .filter(Boolean)
                      .join(" - ") || "Governing body details"}
                  </span>
                </div>
                <div style={styles.previewLogoRow}>
                  {settings.governing_body_logo_url ? (
                    <img src={settings.governing_body_logo_url} alt="Governing body logo preview" style={styles.previewSmallLogo} />
                  ) : null}
                  {settings.secondary_governing_body_logo_url ? (
                    <img src={settings.secondary_governing_body_logo_url} alt="Second governing body logo preview" style={styles.previewSmallLogo} />
                  ) : null}
                </div>
              </div>
            </div>

            <button type="button" style={styles.saveButton} onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save firm settings"}
            </button>

            {status ? <p style={styles.status}>{status}</p> : null}
          </aside>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={styles.fieldLabel}>
      <span>{label}</span>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || ""}
        style={styles.input}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={styles.fieldLabel}>
      <span>{label}</span>
      <textarea
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || ""}
        style={styles.textarea}
      />
    </label>
  );
}

function ImageUploadRow({
  label,
  help,
  value,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  help: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div style={styles.uploadRow}>
      <div style={styles.uploadText}>
        <strong>{label}</strong>
        <span>{help}</span>
        {value ? <em>{value}</em> : null}
      </div>
      {value ? <img src={value} alt={label} style={styles.uploadThumb} /> : null}
      <label style={styles.uploadButton}>
        {uploading ? "Uploading..." : "Upload"}
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          disabled={uploading}
          onChange={(event) => onUpload(event.target.files?.[0] || null)}
        />
      </label>
      {value ? (
        <button type="button" style={styles.clearButton} onClick={onClear}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f3f6fb",
    padding: "28px 24px 40px",
    color: "#0f172a",
  },
  headerCard: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: 18,
    padding: "24px 26px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 900,
    color: "#2563eb",
    letterSpacing: "0.12em",
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 30,
    letterSpacing: "-0.04em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#475569",
    fontSize: 14,
  },
  backLink: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    textDecoration: "none",
    borderRadius: 10,
    padding: "10px 13px",
    fontSize: 13,
    fontWeight: 850,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    gap: 20,
    alignItems: "start",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
    marginBottom: 18,
  },
  previewCard: {
    position: "sticky",
    top: 78,
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    letterSpacing: "-0.02em",
  },
  sectionHelp: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  gridThree: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 14,
  },
  fieldLabel: {
    display: "grid",
    gap: 6,
    fontSize: 12,
    fontWeight: 850,
    color: "#334155",
    marginBottom: 14,
  },
  input: {
    width: "100%",
    height: 40,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "0 11px",
    fontSize: 13,
    color: "#0f172a",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: 88,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 11px",
    fontSize: 13,
    color: "#0f172a",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
  },
  uploadRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
    gap: 10,
    alignItems: "center",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    background: "#f8fafc",
  },
  uploadText: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  uploadThumb: {
    maxWidth: 92,
    maxHeight: 42,
    objectFit: "contain",
    display: "block",
  },
  uploadButton: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#ffffff",
    borderRadius: 9,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  clearButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 9,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  previewBox: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: 16,
    marginTop: 14,
    background: "#ffffff",
  },
  previewTop: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    alignItems: "center",
    borderBottom: "1px solid #0f172a",
    paddingBottom: 12,
  },
  previewLogo: {
    maxWidth: 160,
    maxHeight: 70,
    objectFit: "contain",
    display: "block",
  },
  logoPlaceholder: {
    border: "1px dashed #94a3b8",
    borderRadius: 10,
    color: "#94a3b8",
    display: "grid",
    placeItems: "center",
    height: 64,
    fontWeight: 900,
    fontSize: 12,
  },
  previewContact: {
    display: "grid",
    gap: 2,
    textAlign: "right",
    fontSize: 11,
    color: "#334155",
  },
  previewBodyLine: {
    height: 90,
    borderBottom: "1px solid #e2e8f0",
  },
  previewFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    paddingTop: 12,
    fontSize: 11,
    color: "#334155",
  },
  previewLogoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  previewSmallLogo: {
    maxWidth: 62,
    maxHeight: 30,
    objectFit: "contain",
    display: "block",
  },
  saveButton: {
    width: "100%",
    marginTop: 16,
    border: 0,
    background: "#0f172a",
    color: "#ffffff",
    borderRadius: 11,
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  status: {
    margin: "12px 0 0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 750,
  },
};
