"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type FirmSettings = {
  id?: string;
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

  second_governing_body_name: string;
  second_governing_body_registration_number: string;
  second_governing_body_logo_url: string;

  footer_text: string;
  footer_logo_url: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

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

  second_governing_body_name: "",
  second_governing_body_registration_number: "",
  second_governing_body_logo_url: "",

  footer_text: "",
  footer_logo_url: "",
};

function normaliseStoragePath(name: string) {
  return String(name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fieldValue(value: unknown) {
  return String(value || "");
}

export default function AfsFirmSettingsPage() {
  const [settings, setSettings] = useState<FirmSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const governingLogoInputRef = useRef<HTMLInputElement | null>(null);
  const secondGoverningLogoInputRef = useRef<HTMLInputElement | null>(null);
  const footerLogoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;

        if (!user?.id) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("afs_firm_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSettings({
            ...emptySettings,
            ...data,
          });
        }
      } catch (error) {
        console.error("Failed to load AFS firm settings", error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateField(key: keyof FirmSettings, value: string) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveSettings(nextSettings = settings) {
    if (!supabase) return;

    setSaveStatus("saving");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user?.id) throw new Error("No logged-in user found.");

      const payload = {
        user_id: user.id,
        firm_name: nextSettings.firm_name,
        trading_name: nextSettings.trading_name,
        logo_url: nextSettings.logo_url,
        address_lines: nextSettings.address_lines,
        telephone: nextSettings.telephone,
        email: nextSettings.email,
        website: nextSettings.website,

        practitioner_name: nextSettings.practitioner_name,
        practitioner_designation: nextSettings.practitioner_designation,

        governing_body_name: nextSettings.governing_body_name,
        governing_body_registration_number:
          nextSettings.governing_body_registration_number,
        governing_body_logo_url: nextSettings.governing_body_logo_url,

        second_governing_body_name: nextSettings.second_governing_body_name,
        second_governing_body_registration_number:
          nextSettings.second_governing_body_registration_number,
        second_governing_body_logo_url: nextSettings.second_governing_body_logo_url,

        footer_text: nextSettings.footer_text,
        footer_logo_url: nextSettings.footer_logo_url,
        updated_at: new Date().toISOString(),
      };

      const { data: existing, error: lookupError } = await supabase
        .from("afs_firm_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("afs_firm_settings")
          .update(payload)
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("afs_firm_settings")
          .insert(payload);

        if (insertError) throw insertError;
      }

      setSaveStatus("saved");

      window.setTimeout(() => {
        setSaveStatus((current) => (current === "saved" ? "idle" : current));
      }, 1600);
    } catch (error) {
      console.error("Failed to save AFS firm settings", error);
      setSaveStatus("error");
    }
  }

  async function uploadBrandingFile(
    file: File | null | undefined,
    key: keyof FirmSettings,
  ) {
    if (!file || !supabase) return;

    setUploadingField(String(key));

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user?.id) throw new Error("No logged-in user found.");

      const safeName = normaliseStoragePath(file.name);
      const path = `${user.id}/${String(key)}-${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("afs-branding")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("afs-branding").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const nextSettings = {
        ...settings,
        [key]: publicUrl,
      } as FirmSettings;

      setSettings(nextSettings);
      await saveSettings(nextSettings);
    } catch (error) {
      console.error("Failed to upload branding file", error);
      setSaveStatus("error");
    } finally {
      setUploadingField(null);
    }
  }

  const previewAddressLines = useMemo(
    () =>
      fieldValue(settings.address_lines)
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    [settings.address_lines],
  );

  const previewFirmName =
    settings.trading_name || settings.firm_name || "Firm name";

  const previewPractitioner =
    settings.practitioner_name || "Practitioner / partner name";

  const previewDesignation =
    settings.practitioner_designation || "Professional designation";

  const previewGoverningBody =
    settings.governing_body_name ||
    (settings.governing_body_registration_number ? "Governing body" : "");

  const previewGoverningBodyLine = [previewGoverningBody, settings.governing_body_registration_number]
    .filter(Boolean)
    .join(" ");

  const previewSecondGoverningBodyLine = [
    settings.second_governing_body_name,
    settings.second_governing_body_registration_number,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.kicker}>PRACTICEPILOT AFS</div>
          <h1 style={styles.title}>Firm / Letterhead Settings</h1>
          <p style={styles.subtitle}>
            Capture the firm branding used on compilation reports and future AFS exports.
          </p>
        </div>

        <Link href="/afs" style={styles.backButton}>
          Back to AFS dashboard
        </Link>
      </section>

      {loading ? (
        <section style={styles.panel}>
          <p style={styles.mutedText}>Loading firm settings...</p>
        </section>
      ) : (
        <section style={styles.contentStack}>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Header details</h2>
                <p style={styles.panelHint}>
                  Upload a clean logo-only PNG/SVG/WebP. Do not upload a full Word letterhead screenshot.
                </p>
              </div>
            </div>

            <div style={styles.uploadRow}>
              <div>
                <h3 style={styles.uploadTitle}>Firm logo</h3>
                <p style={styles.uploadText}>
                  Logo only. PracticePilot will create the letterhead layout around it.
                </p>
                {settings.logo_url ? (
                  <div style={styles.currentFile}>Logo uploaded</div>
                ) : null}
              </div>
              <div style={styles.uploadActions}>
                <button
                  type="button"
                  style={styles.primarySmallButton}
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingField === "logo_url"}
                >
                  {uploadingField === "logo_url" ? "Uploading..." : "Upload"}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                  style={{ display: "none" }}
                  onChange={(event) =>
                    uploadBrandingFile(event.target.files?.[0], "logo_url")
                  }
                />
              </div>
            </div>

            <div style={styles.twoColumnGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Firm name</span>
                <input
                  style={styles.input}
                  value={settings.firm_name}
                  onChange={(event) => updateField("firm_name", event.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Trading name</span>
                <input
                  style={styles.input}
                  value={settings.trading_name}
                  onChange={(event) => updateField("trading_name", event.target.value)}
                />
              </label>
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Address lines</span>
              <textarea
                style={styles.textarea}
                value={settings.address_lines}
                onChange={(event) => updateField("address_lines", event.target.value)}
                placeholder={"Address line 1\nAddress line 2\nCity"}
              />
            </label>

            <div style={styles.threeColumnGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Telephone</span>
                <input
                  style={styles.input}
                  value={settings.telephone}
                  onChange={(event) => updateField("telephone", event.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Email</span>
                <input
                  style={styles.input}
                  value={settings.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Website</span>
                <input
                  style={styles.input}
                  value={settings.website}
                  onChange={(event) => updateField("website", event.target.value)}
                />
              </label>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Footer and governing body details</h2>
                <p style={styles.panelHint}>
                  These details appear near the compiler signature and footer. Leave fields blank if not applicable.
                </p>
              </div>
            </div>

            <div style={styles.twoColumnGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Practitioner / director / partner name</span>
                <input
                  style={styles.input}
                  value={settings.practitioner_name}
                  onChange={(event) =>
                    updateField("practitioner_name", event.target.value)
                  }
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Designation</span>
                <input
                  style={styles.input}
                  value={settings.practitioner_designation}
                  onChange={(event) =>
                    updateField("practitioner_designation", event.target.value)
                  }
                />
              </label>
            </div>

            <div style={styles.twoColumnGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Governing body</span>
                <input
                  style={styles.input}
                  value={settings.governing_body_name}
                  onChange={(event) =>
                    updateField("governing_body_name", event.target.value)
                  }
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Governing body reg no.</span>
                <input
                  style={styles.input}
                  value={settings.governing_body_registration_number}
                  onChange={(event) =>
                    updateField(
                      "governing_body_registration_number",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            <div style={styles.uploadRow}>
              <div>
                <h3 style={styles.uploadTitle}>Governing body logo</h3>
                <p style={styles.uploadText}>
                  Optional. Example: SAIPA / SAICA / SAIBA logo.
                </p>
                {settings.governing_body_logo_url ? (
                  <div style={styles.currentFile}>Governing body logo uploaded</div>
                ) : null}
              </div>
              <button
                type="button"
                style={styles.primarySmallButton}
                onClick={() => governingLogoInputRef.current?.click()}
                disabled={uploadingField === "governing_body_logo_url"}
              >
                {uploadingField === "governing_body_logo_url"
                  ? "Uploading..."
                  : "Upload"}
              </button>
              <input
                ref={governingLogoInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                style={{ display: "none" }}
                onChange={(event) =>
                  uploadBrandingFile(
                    event.target.files?.[0],
                    "governing_body_logo_url",
                  )
                }
              />
            </div>

            <div style={styles.twoColumnGrid}>
              <label style={styles.field}>
                <span style={styles.label}>Second governing body</span>
                <input
                  style={styles.input}
                  value={settings.second_governing_body_name}
                  onChange={(event) =>
                    updateField("second_governing_body_name", event.target.value)
                  }
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Second governing body reg no.</span>
                <input
                  style={styles.input}
                  value={settings.second_governing_body_registration_number}
                  onChange={(event) =>
                    updateField(
                      "second_governing_body_registration_number",
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            <div style={styles.uploadRow}>
              <div>
                <h3 style={styles.uploadTitle}>Second governing body logo</h3>
                <p style={styles.uploadText}>Optional.</p>
                {settings.second_governing_body_logo_url ? (
                  <div style={styles.currentFile}>
                    Second governing body logo uploaded
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                style={styles.primarySmallButton}
                onClick={() => secondGoverningLogoInputRef.current?.click()}
                disabled={uploadingField === "second_governing_body_logo_url"}
              >
                {uploadingField === "second_governing_body_logo_url"
                  ? "Uploading..."
                  : "Upload"}
              </button>
              <input
                ref={secondGoverningLogoInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                style={{ display: "none" }}
                onChange={(event) =>
                  uploadBrandingFile(
                    event.target.files?.[0],
                    "second_governing_body_logo_url",
                  )
                }
              />
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Footer text</span>
              <textarea
                style={styles.textareaSmall}
                value={settings.footer_text}
                onChange={(event) => updateField("footer_text", event.target.value)}
                placeholder="Optional footer text"
              />
            </label>

            <div style={styles.uploadRow}>
              <div>
                <h3 style={styles.uploadTitle}>Optional footer logo / strip</h3>
                <p style={styles.uploadText}>
                  Optional. Text and governing body logos will usually be clearer than a large image strip.
                </p>
                {settings.footer_logo_url ? (
                  <div style={styles.currentFile}>Footer logo / strip uploaded</div>
                ) : null}
              </div>
              <button
                type="button"
                style={styles.primarySmallButton}
                onClick={() => footerLogoInputRef.current?.click()}
                disabled={uploadingField === "footer_logo_url"}
              >
                {uploadingField === "footer_logo_url" ? "Uploading..." : "Upload"}
              </button>
              <input
                ref={footerLogoInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                style={{ display: "none" }}
                onChange={(event) =>
                  uploadBrandingFile(event.target.files?.[0], "footer_logo_url")
                }
              />
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>Preview</h2>
                <p style={styles.panelHint}>
                  This is the layout PracticePilot will use to build the compiler letterhead.
                </p>
              </div>

              <button
                type="button"
                style={styles.saveButton}
                onClick={() => saveSettings()}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "Saved"
                    : "Save firm settings"}
              </button>
            </div>

            <div style={styles.previewPage}>
              <div style={styles.previewHeader}>
                <div style={styles.previewLogoBox}>
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt="Firm logo preview"
                      style={styles.previewLogo}
                    />
                  ) : (
                    <span>LOGO</span>
                  )}
                </div>

                <div style={styles.previewContact}>
                  <strong>{previewFirmName}</strong>
                  {previewAddressLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  {settings.telephone ? <span>Tel: {settings.telephone}</span> : null}
                  {settings.email ? <span>Email: {settings.email}</span> : null}
                  {settings.website ? <span>{settings.website}</span> : null}
                </div>
              </div>

              <div style={styles.previewRule} />

              <div style={styles.previewBody}>
                <strong>Practitioner’s Compilation Report</strong>
                <span>Report text will render here in the normal AFS font.</span>
              </div>

              <div style={styles.previewFooter}>
                <div style={styles.previewPractitioner}>
                  <strong>{previewPractitioner}</strong>
                  <span>{previewDesignation}</span>
                </div>

                <div style={styles.previewBodies}>
                  <div style={styles.previewBodyCard}>
                    <div style={styles.previewLogoLine}>
                      {settings.governing_body_logo_url ? (
                        <img
                          src={settings.governing_body_logo_url}
                          alt="Governing body logo preview"
                          style={styles.previewBodyLogo}
                        />
                      ) : null}

                      {settings.second_governing_body_logo_url ? (
                        <img
                          src={settings.second_governing_body_logo_url}
                          alt="Second governing body logo preview"
                          style={styles.previewBodyLogo}
                        />
                      ) : null}
                    </div>

                    {previewGoverningBodyLine ? (
                      <div style={styles.previewBodyRegistration}>
                        {previewGoverningBodyLine}
                      </div>
                    ) : null}

                    {previewSecondGoverningBodyLine ? (
                      <div style={styles.previewBodyRegistration}>
                        {previewSecondGoverningBodyLine}
                      </div>
                    ) : null}
                  </div>

                  {settings.footer_text ? (
                    <div style={styles.previewFooterText}>{settings.footer_text}</div>
                  ) : null}
                </div>
              </div>
            </div>

            {saveStatus === "error" ? (
              <p style={styles.errorText}>
                Could not save settings. Check Supabase table/bucket setup.
              </p>
            ) : null}
          </section>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eaf0f7",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    background: "#ffffff",
    borderBottom: "1px solid #b8c7d9",
    padding: "16px 16px 15px",
  },
  kicker: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    marginBottom: 6,
  },
  title: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#334155",
    fontSize: 13,
  },
  backButton: {
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 850,
  },
  contentStack: {
    display: "grid",
    gap: 10,
    padding: "10px 0 24px",
  },
  panel: {
    background: "#ffffff",
    borderTop: "1px solid #b8c7d9",
    borderBottom: "1px solid #b8c7d9",
    padding: 12,
    boxShadow: "none",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: 16,
    marginBottom: 10,
  },
  panelTitle: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 900,
  },
  panelHint: {
    margin: "6px 0 0",
    fontSize: 11,
    color: "#475569",
  },
  uploadRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    padding: 9,
    marginBottom: 9,
  },
  uploadTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 900,
  },
  uploadText: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 12,
  },
  uploadActions: {
    display: "flex",
    alignItems: "center",
  },
  currentFile: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: 800,
    color: "#047857",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 8,
  },
  threeColumnGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },
  field: {
    display: "grid",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 900,
    color: "#334155",
  },
  input: {
    width: "100%",
    minHeight: 28,
    border: "1px solid #b8c7d9",
    background: "#ffffff",
    padding: "5px 7px",
    fontSize: 12,
    boxSizing: "border-box",
    outline: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 54,
    border: "1px solid #b8c7d9",
    background: "#ffffff",
    padding: "7px",
    fontSize: 12,
    lineHeight: 1.35,
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  textareaSmall: {
    width: "100%",
    minHeight: 44,
    border: "1px solid #b8c7d9",
    background: "#ffffff",
    padding: "7px",
    fontSize: 12,
    lineHeight: 1.35,
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
    fontFamily: "Arial, Helvetica, sans-serif",
    marginBottom: 8,
  },
  primarySmallButton: {
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  saveButton: {
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    padding: "9px 14px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  mutedText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },
  errorText: {
    margin: "8px 0 0",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 800,
  },
  previewPage: {
    border: "1px solid #94a3b8",
    background: "#ffffff",
    maxWidth: 760,
    minHeight: 320,
    padding: 18,
    boxSizing: "border-box",
  },
  previewHeader: {
    display: "grid",
    gridTemplateColumns: "210px minmax(0, 1fr)",
    gap: 22,
    alignItems: "center",
  },
  previewLogoBox: {
    minHeight: 72,
    border: "1px dashed #94a3b8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 900,
    padding: "10px 10px 4px",
    transform: "translateY(7px)",
  },
  previewLogo: {
    maxWidth: "100%",
    maxHeight: 78,
    objectFit: "contain",
    display: "block",
  },
  previewContact: {
    display: "grid",
    justifyItems: "end",
    gap: 2,
    fontSize: 11,
    lineHeight: 1.25,
    color: "#334155",
    textAlign: "right",
  },
  previewRule: {
    borderTop: "1.5px solid #111827",
    margin: "18px 0 20px",
  },
  previewBody: {
    display: "grid",
    gap: 8,
    fontSize: 12,
    minHeight: 90,
  },
  previewFooter: {
    borderTop: "1px solid #111827",
    marginTop: 34,
    paddingTop: 12,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 210px",
    gap: 20,
    fontSize: 11,
    alignItems: "start",
  },
  previewPractitioner: {
    display: "grid",
    gap: 7,
    lineHeight: 1.25,
  },
  previewBodies: {
    display: "grid",
    justifyItems: "end",
    alignContent: "start",
    gap: 4,
    textAlign: "right",
    lineHeight: 1.2,
    minHeight: 0,
  },
  previewBodyCard: {
    display: "grid",
    justifyItems: "end",
    gap: 2,
  },
  previewLogoLine: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    minHeight: 22,
    marginBottom: 0,
  },
  previewBodyLogo: {
    maxWidth: 92,
    maxHeight: 24,
    objectFit: "contain",
    display: "block",
  },
  previewBodyRegistration: {
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.15,
    marginTop: 0,
  },
  previewFooterText: {
    fontSize: 10.5,
    lineHeight: 1.2,
    color: "#334155",
  },
};
