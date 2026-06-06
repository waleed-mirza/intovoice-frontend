// Shared constants for the report feature.
// Keep the codes in sync with into-backend/routes/report/index.ts and
// into-admin-panel/lib/reports.ts.

export type ReportTargetType = "voice_post" | "voice_comment";

export type ReportReasonCode =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "violence"
  | "sexual_content"
  | "self_harm"
  | "misinformation"
  | "intellectual_property"
  | "other";

export const REPORT_REASONS: {
  code: ReportReasonCode;
  label: string;
  hint: string;
}[] = [
  {
    code: "spam",
    label: "Spam or misleading",
    hint: "Repetitive, promotional, or clickbait content.",
  },
  {
    code: "harassment",
    label: "Harassment or bullying",
    hint: "Targeted insults, threats, or intimidation.",
  },
  {
    code: "hate_speech",
    label: "Hate speech",
    hint: "Attacks on protected groups or identities.",
  },
  {
    code: "violence",
    label: "Violence or dangerous acts",
    hint: "Promotes, glorifies, or threatens physical harm.",
  },
  {
    code: "sexual_content",
    label: "Nudity or sexual content",
    hint: "Adult or sexually explicit material.",
  },
  {
    code: "self_harm",
    label: "Self-harm or suicide",
    hint: "Encourages or depicts self-harm.",
  },
  {
    code: "misinformation",
    label: "False information",
    hint: "Deliberately misleading or fabricated claims.",
  },
  {
    code: "intellectual_property",
    label: "Copyright or impersonation",
    hint: "Stolen work or pretending to be someone else.",
  },
  {
    code: "other",
    label: "Something else",
    hint: "Describe the issue in the notes below.",
  },
];

export const TARGET_LABELS: Record<ReportTargetType, string> = {
  voice_post: "voice post",
  voice_comment: "voice comment",
};

export const REPORT_DESCRIPTION_MAX = 1000;
