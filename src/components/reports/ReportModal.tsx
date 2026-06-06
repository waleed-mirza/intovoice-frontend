import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { FiFlag, FiX } from "react-icons/fi";
import {
  REPORT_DESCRIPTION_MAX,
  REPORT_REASONS,
  TARGET_LABELS,
  type ReportReasonCode,
  type ReportTargetType,
} from "./reportConfig";
import { useReport } from "./useReport";

export type ReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** Optional preview (e.g. first few words of the reported content). */
  targetPreview?: string;
  /** Called after a successful submission so callers can hide the Report action. */
  onReported?: () => void;
};

/**
 * Reusable report dialog used by post, comment, voice, clip, podcast, taips,
 * and user profile surfaces. Collects a reason + optional description and
 * posts to /report via useReport().
 */
export default function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetPreview,
  onReported,
}: ReportModalProps) {
  const { isSubmitting, submitReport } = useReport();
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setReason(null);
      setDescription("");
    }
  }, [isOpen]);

  const label = TARGET_LABELS[targetType] || "content";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || isSubmitting) return;

    const result = await submitReport({
      targetType,
      targetId,
      reason,
      description: description.trim() || undefined,
    });

    if (result.ok) {
      onReported?.();
      onClose();
    }
  };

  const remaining = REPORT_DESCRIPTION_MAX - description.length;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[120]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-gray-900">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
                      <FiFlag className="h-4 w-4" aria-hidden />
                    </span>
                    Report {label}
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Close"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                    <p className="text-sm text-gray-600">
                      Your report is confidential. Our moderation team will
                      review this {label} and take action if it violates our
                      community guidelines.
                    </p>

                    {targetPreview ? (
                      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <span className="font-medium text-gray-500">
                          Reporting:
                        </span>{" "}
                        <span className="line-clamp-2">{targetPreview}</span>
                      </div>
                    ) : null}

                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium text-gray-900">
                        Why are you reporting this?
                      </legend>
                      <div className="space-y-1.5">
                        {REPORT_REASONS.map((r) => {
                          const active = reason === r.code;
                          return (
                            <label
                              key={r.code}
                              className={[
                                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                active
                                  ? "border-red-500 bg-red-50/60 ring-1 ring-red-500"
                                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              <input
                                type="radio"
                                name="report-reason"
                                value={r.code}
                                checked={active}
                                onChange={() => setReason(r.code)}
                                className="mt-1 h-4 w-4 border-gray-300 text-red-600 focus:ring-red-500"
                              />
                              <span className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">
                                  {r.label}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {r.hint}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="space-y-1">
                      <label
                        htmlFor="report-description"
                        className="flex items-center justify-between text-sm font-medium text-gray-900"
                      >
                        <span>Additional details (optional)</span>
                        <span
                          className={
                            remaining < 0
                              ? "text-xs text-red-600"
                              : "text-xs text-gray-400"
                          }
                        >
                          {remaining}
                        </span>
                      </label>
                      <textarea
                        id="report-description"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={REPORT_DESCRIPTION_MAX}
                        placeholder="Share any context that will help our moderators."
                        className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!reason || isSubmitting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? "Submitting…" : "Submit report"}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
