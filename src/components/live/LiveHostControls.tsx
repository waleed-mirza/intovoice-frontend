"use client";

import React, { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Mic } from "@/components/voice/VoiceIcons";
import { FiMicOff } from "react-icons/fi";

interface LiveHostControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onEnd: () => Promise<void>;
  ending?: boolean;
}

const LiveHostControls = ({
  isMuted,
  onToggleMute,
  onEnd,
  ending = false,
}: LiveHostControlsProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleEnd = async () => {
    await onEnd();
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <button
          type="button"
          onClick={onToggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? "bg-gray-300 text-gray-700" : "bg-black text-white hover:bg-gray-800"
          }`}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? (
            <FiMicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={ending}
          className="text-sm font-medium text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          End broadcast
        </button>
      </div>

      <Transition appear show={confirmOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => !ending && setConfirmOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
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
                <Dialog.Panel className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    End broadcast?
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-600">
                    Listeners will be disconnected. This broadcast will not be
                    saved.
                  </p>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      disabled={ending}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleEnd}
                      disabled={ending}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {ending ? "Ending…" : "End broadcast"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default LiveHostControls;
