"use client";



import React, { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { X, Loader2, MessageSquare } from "@/components/voice/VoiceIcons";

import Api from "@/lib/axios";

import { useAuth } from "@/providers/AuthProvider";

import VoiceCommentCard from "@/components/comments/VoiceCommentCard";

import VoiceCommentComposer from "@/components/comments/VoiceCommentComposer";

import {

  removeCommentFromTree,

  updateCommentInTree,

} from "@/components/comments/commentTreeUtils";

import type { ReplyTarget, VoiceComment } from "@/components/comments/voiceCommentTypes";

import useVoiceCommentSubmit from "@/components/voice/hooks/useVoiceCommentSubmit";

import type { Tape } from "@/types/tapes";



interface TapeCommentsPanelProps {

  tape: Tape;

  onClose: () => void;

  onCommentCountChange: (delta: number) => void;

  /** embedded = beside player (desktop); overlay = bottom sheet over tape (mobile) */

  variant: "embedded" | "overlay" | "sheet";

}



const MAX_RECORDING_SECONDS = 59;



export default function TapeCommentsPanel({

  tape,

  onClose,

  onCommentCountChange,

  variant,

}: TapeCommentsPanelProps) {

  const router = useRouter();

  const { user, userLoading } = useAuth();

  const [comments, setComments] = useState<VoiceComment[]>([]);

  const [loading, setLoading] = useState(true);

  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);

  const [loadingRepliesFor, setLoadingRepliesFor] = useState<Set<string>>(new Set());

  const listRef = useRef<HTMLDivElement>(null);

  const loginRedirect = `/auth/login?redirect=/tapes/${tape.id}`;



  const { isSending, submitComment } = useVoiceCommentSubmit<VoiceComment>({

    tapeId: tape.id,

    parentId: replyingTo?.threadRootId ?? null,

    maxRecordingSeconds: MAX_RECORDING_SECONDS,

  });



  const loadComments = useCallback(async () => {

    try {

      setLoading(true);

      const res = await Api.get(`/voice/tape/${tape.id}/comments`);

      setComments(res.data.result || []);

    } catch (err) {

      console.error("Failed to load comments:", err);

    } finally {

      setLoading(false);

    }

  }, [tape.id]);



  useEffect(() => {

    loadComments();

  }, [loadComments]);



  useEffect(() => {

    if (variant !== "overlay" && variant !== "sheet") return;

    const onKey = (e: KeyboardEvent) => {

      if (e.key === "Escape") onClose();

    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);

  }, [variant, onClose]);



  const handleSend = async (args: Parameters<typeof submitComment>[0]) => {

    if (userLoading) return false;

    if (!user) {

      router.push(loginRedirect);

      return false;

    }



    const activeReply = replyingTo;

    const result = await submitComment(args);



    if (result) {

      if (activeReply) {

        setComments((prev) =>

          prev.map((c) =>

            c.id === activeReply.threadRootId

              ? {

                  ...c,

                  replies: [...(c.replies || []), { ...result, replies: [] }],

                  replyCount: (c.replyCount ?? c.replies?.length ?? 0) + 1,

                }

              : c

          )

        );

      } else {

        setComments((prev) => [{ ...result, replies: result.replies ?? [] }, ...prev]);

        listRef.current?.scrollTo({ top: 0, behavior: "smooth" });

      }

      onCommentCountChange(1);

      setReplyingTo(null);

      return true;

    }



    return false;

  };



  const handleLike = async (commentId: string) => {

    if (!user) {

      router.push(loginRedirect);

      return;

    }

    try {

      const res = await Api.post(`/voice/comment/${commentId}/like`);

      setComments((prev) =>

        updateCommentInTree(prev, commentId, {

          isLiked: res.data.result.isLiked,

          likeCount: res.data.result.likeCount,

        })

      );

    } catch (err) {

      console.error("Failed to like comment:", err);

    }

  };



  const handleDelete = async (commentId: string) => {
    try {
      await Api.delete(`/voice/comment/${commentId}`);
      setComments((prev) => removeCommentFromTree(prev, commentId));
      onCommentCountChange(-1);
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const handleUpdate = (commentId: string, content: string) => {
    setComments((prev) => updateCommentInTree(prev, commentId, { content }));
  };



  const handleStartReply = (threadRootId: string, targetAuthorName: string) => {

    if (userLoading) return;

    if (!user) {

      router.push(loginRedirect);

      return;

    }

    setReplyingTo({ threadRootId, targetAuthorName });

  };



  const handleLoadMoreReplies = async (commentId: string) => {

    const comment = comments.find((c) => c.id === commentId);

    if (!comment || loadingRepliesFor.has(commentId)) return;



    setLoadingRepliesFor((prev) => new Set(prev).add(commentId));

    try {

      const limit = Math.min(comment.replyCount ?? 50, 50);

      const res = await Api.get(`/voice/comment/${commentId}/replies`, {

        params: { page: 1, limit },

      });

      const allReplies: VoiceComment[] = res.data.result || [];

      setComments((prev) =>

        prev.map((c) => (c.id === commentId ? { ...c, replies: allReplies } : c))

      );

    } catch (err) {

      console.error("Failed to load replies:", err);

    } finally {

      setLoadingRepliesFor((prev) => {

        const next = new Set(prev);

        next.delete(commentId);

        return next;

      });

    }

  };



  const panelBody = (

    <>

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-white">

        <h2 className="font-semibold text-gray-900 text-sm sm:text-base">

          Comments

          <span className="text-gray-500 font-normal ml-1.5">{tape.commentCount}</span>

        </h2>

        <button

          type="button"

          onClick={onClose}

          className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"

          aria-label="Close comments"

        >

          <X className="w-5 h-5" />

        </button>

      </div>



      <div

        ref={listRef}

        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 min-h-0 tape-comments-list"

      >

        {loading ? (

          <div className="flex justify-center py-10">

            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />

          </div>

        ) : comments.length === 0 ? (

          <div className="text-center py-10">

            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-50 flex items-center justify-center">

              <MessageSquare className="w-6 h-6 text-gray-300" />

            </div>

            <p className="text-gray-500 text-sm">No comments yet. Be the first!</p>

          </div>

        ) : (

          <div className="space-y-5">

            {comments.map((comment) => (

              <div key={comment.id} className="space-y-3">

                <VoiceCommentCard

                  comment={comment}

                  currentUserId={user?.id}

                  ownerUserId={tape.userId}

                  onLike={handleLike}

                  onDelete={handleDelete}
                  onUpdate={handleUpdate}

                  onReply={

                    user

                      ? () =>

                          handleStartReply(

                            comment.id,

                            comment.author.username || comment.author.name

                          )

                      : undefined

                  }

                />

                {(comment.replies ?? []).map((reply) => (

                  <VoiceCommentCard

                    key={reply.id}

                    comment={reply}

                    isReply

                    currentUserId={user?.id}

                    ownerUserId={tape.userId}

                    onLike={handleLike}

                    onDelete={handleDelete}
                  onUpdate={handleUpdate}

                    onReply={

                      user

                        ? () =>

                            handleStartReply(

                              comment.id,

                              reply.author.username || reply.author.name

                            )

                        : undefined

                    }

                  />

                ))}

                {(comment.replyCount ?? 0) > (comment.replies?.length ?? 0) && (

                  <button

                    type="button"

                    onClick={() => handleLoadMoreReplies(comment.id)}

                    disabled={loadingRepliesFor.has(comment.id)}

                    className="ml-6 pl-3 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"

                  >

                    {loadingRepliesFor.has(comment.id) ? (

                      <span className="inline-flex items-center gap-1">

                        <Loader2 className="w-3 h-3 animate-spin" />

                        Loading replies…

                      </span>

                    ) : (

                      `View ${(comment.replyCount ?? 0) - (comment.replies?.length ?? 0)} more ${

                        (comment.replyCount ?? 0) - (comment.replies?.length ?? 0) === 1

                          ? "reply"

                          : "replies"

                      }`

                    )}

                  </button>

                )}

              </div>

            ))}

          </div>

        )}

      </div>



      <div className="border-t border-gray-200 p-3 flex-shrink-0 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]">

        <VoiceCommentComposer

          user={user}

          userLoading={userLoading}

          loginRedirect={loginRedirect}

          replyingTo={replyingTo}

          onCancelReply={() => setReplyingTo(null)}

          isSending={isSending}

          onSend={handleSend}

          compact={variant === "embedded" || variant === "overlay"}

        />

      </div>

    </>

  );



  const scrollbarStyles = (

    <style jsx global>{`

      .tape-comments-list {

        scrollbar-width: thin;

        scrollbar-color: #d1d5db transparent;

      }

      .tape-comments-list::-webkit-scrollbar {

        width: 4px;

      }

      .tape-comments-list::-webkit-scrollbar-thumb {

        background: #d1d5db;

        border-radius: 4px;

      }

      @keyframes voiceCommentPulse {

        from {

          transform: scaleY(0.4);

        }

        to {

          transform: scaleY(1);

        }

      }

    `}</style>

  );



  if (variant === "embedded") {

    return (

      <>

        <div

          className="flex flex-col h-full min-h-0 w-[17.5rem] lg:w-[22rem] bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden flex-shrink-0"

          role="region"

          aria-label="Comments"

        >

          {panelBody}

        </div>

        {scrollbarStyles}

      </>

    );

  }



  if (variant === "overlay") {

    return (

      <>

        <div className="md:hidden absolute inset-0 z-40 flex flex-col justify-end pointer-events-none">

          <button

            type="button"

            className="flex-1 min-h-0 w-full pointer-events-auto"

            onClick={onClose}

            aria-label="Close comments"

          />

          <div

            className="relative pointer-events-auto flex flex-col min-h-0 overflow-hidden bg-white rounded-t-2xl shadow-2xl max-h-[min(52dvh,480px)] w-full flex-shrink-0"

            role="dialog"

            aria-label="Comments"

            aria-modal="true"

          >

            <div className="flex flex-col items-center pt-2.5 pb-1 flex-shrink-0">

              <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />

            </div>

            {panelBody}

          </div>

        </div>

        {scrollbarStyles}

      </>

    );

  }



  return (

    <>

      <div className="fixed inset-0 bg-black/55 z-[60]" onClick={onClose} aria-hidden />



      <div

        className="fixed z-[60] bg-white flex flex-col inset-x-0 bottom-0 max-h-[min(88dvh,720px)] rounded-t-2xl shadow-2xl"

        role="dialog"

        aria-label="Comments"

        aria-modal="true"

      >

        <div className="flex flex-col items-center pt-2.5 pb-1 flex-shrink-0">

          <div className="w-10 h-1 rounded-full bg-gray-300" aria-hidden />

        </div>

        {panelBody}

      </div>



      {scrollbarStyles}

    </>

  );

}


