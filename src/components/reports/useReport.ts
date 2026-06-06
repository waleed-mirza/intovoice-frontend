import { useCallback, useState } from "react";
import Api from "@/lib/axios";
import Toast from "@/utils/CustomToast";
import type { ReportReasonCode, ReportTargetType } from "./reportConfig";

export type SubmitReportArgs = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReasonCode;
  description?: string;
};

export type SubmitReportResult = {
  ok: boolean;
  alreadyReported: boolean;
  message?: string;
};

/**
 * Thin wrapper around POST /report.
 * Handles loading state, toasts success/error, and surfaces whether
 * the report was a duplicate so the caller can close the modal either way.
 */
export function useReport() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReport = useCallback(
    async (args: SubmitReportArgs): Promise<SubmitReportResult> => {
      setIsSubmitting(true);
      try {
        const res = await Api.post("/report", args);
        const alreadyReported = Boolean(res.data?.alreadyReported);
        const message =
          res.data?.message ||
          (alreadyReported
            ? "You have already reported this content"
            : "Report submitted");
        Toast(alreadyReported ? "success" : "success", message);
        return { ok: true, alreadyReported, message };
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
        const status = axiosErr?.response?.status;
        const serverMessage = axiosErr?.response?.data?.message;
        if (status === 401) {
          Toast("error", "Please sign in to report content");
        } else if (status === 429) {
          Toast(
            "error",
            serverMessage || "Too many reports — please try again later"
          );
        } else if (serverMessage) {
          Toast("error", serverMessage);
        } else {
          Toast("error", "Could not submit report. Please try again.");
        }
        return { ok: false, alreadyReported: false, message: serverMessage };
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return { isSubmitting, submitReport };
}
