"use client";

import type { CSSProperties } from "react";

/**
 * PracticePilot Design System
 *
 * Colour has meaning:
 * - navy = structure / hierarchy
 * - blue = action / selected / link
 * - green = complete / active / good
 * - amber = attention / due soon
 * - red = overdue / destructive / error
 * - grey = inactive / supporting / N/A
 *
 * Keep working areas white and page backgrounds warm/quiet.
 * Avoid decorative colour where the colour does not communicate state.
 */
export const PP = {
  color: {
    navy950: "#08172A",
    navy900: "#10233A",
    navy800: "#17324D",
    navy700: "#23435F",

    blue700: "#174DB7",
    blue600: "#2457D6",
    blue500: "#2F6DE1",
    blue100: "#EAF2FF",
    blue050: "#F7FBFF",

    green700: "#287447",
    green600: "#3F8F5B",
    green100: "#EAF6EE",
    green050: "#F4FBF6",

    amber700: "#9A6200",
    amber600: "#C48612",
    amber100: "#FFF4DF",
    amber050: "#FFF9ED",

    red700: "#A83C32",
    red600: "#C94A3A",
    red100: "#FDECEA",
    red050: "#FFF7F6",

    text: "#10233A",
    textMuted: "#61707C",
    textSoft: "#798893",

    page: "#F6F5F1",
    panel: "#FFFFFF",
    panelSoft: "#F7F9FA",
    panelBlue: "#EEF3F6",

    border: "#D8DEE5",
    borderStrong: "#BCC8D3",
    divider: "#E7EAEC",

    inactive: "#8A98A3",
    inactiveBg: "#EEF1F3",
  },

  font: {
    family: "'Aptos', 'Segoe UI', Arial, sans-serif",
  },

  radius: {
    none: 0,
    tiny: 2,
    small: 4,
  },

  shadow: {
    none: "none",
    focus: "0 0 0 2px rgba(36,87,214,0.12)",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    xxl: 30,
  },
} as const;

export const ppPage: CSSProperties = {
  minHeight: "100vh",
  background: PP.color.page,
  color: PP.color.text,
  fontFamily: PP.font.family,
};

export const ppPanel: CSSProperties = {
  background: PP.color.panel,
  border: `1px solid ${PP.color.border}`,
  borderRadius: PP.radius.none,
  boxShadow: PP.shadow.none,
};

export const ppPrimaryButton: CSSProperties = {
  minHeight: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 13px",
  border: `1px solid ${PP.color.blue600}`,
  borderRadius: PP.radius.none,
  background: PP.color.blue600,
  color: "#FFFFFF",
  textDecoration: "none",
  fontSize: 11,
  fontWeight: 850,
  cursor: "pointer",
};

export const ppSecondaryButton: CSSProperties = {
  minHeight: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 13px",
  border: `1px solid ${PP.color.borderStrong}`,
  borderRadius: PP.radius.none,
  background: PP.color.panel,
  color: PP.color.text,
  textDecoration: "none",
  fontSize: 11,
  fontWeight: 850,
  cursor: "pointer",
};

export const ppTableHeader: CSSProperties = {
  background: PP.color.navy900,
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: 850,
};

export const ppInput: CSSProperties = {
  minHeight: 32,
  border: `1px solid ${PP.color.borderStrong}`,
  borderRadius: PP.radius.none,
  background: PP.color.panel,
  color: PP.color.text,
  fontFamily: PP.font.family,
  fontSize: 11,
  outline: "none",
};

export function ppStatusTone(
  tone: "success" | "attention" | "danger" | "info" | "neutral"
): CSSProperties {
  const map = {
    success: {
      background: PP.color.green100,
      color: PP.color.green700,
      border: `1px solid #B9DEC6`,
    },
    attention: {
      background: PP.color.amber100,
      color: PP.color.amber700,
      border: `1px solid #E8CB8A`,
    },
    danger: {
      background: PP.color.red100,
      color: PP.color.red700,
      border: `1px solid #E7B8B2`,
    },
    info: {
      background: PP.color.blue100,
      color: PP.color.blue700,
      border: `1px solid #BBD0F6`,
    },
    neutral: {
      background: PP.color.inactiveBg,
      color: PP.color.inactive,
      border: `1px solid ${PP.color.border}`,
    },
  };

  return {
    ...map[tone],
    display: "inline-flex",
    alignItems: "center",
    minHeight: 22,
    padding: "0 7px",
    borderRadius: PP.radius.none,
    fontSize: 9,
    fontWeight: 850,
  };
}
