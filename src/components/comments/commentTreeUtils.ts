import type { VoiceComment } from "./voiceCommentTypes";

export function updateCommentInTree(
  comments: VoiceComment[],
  commentId: string,
  patch: Partial<Pick<VoiceComment, "isLiked" | "likeCount" | "content">>
): VoiceComment[] {
  return comments.map((c) => {
    if (c.id === commentId) {
      return { ...c, ...patch };
    }
    if (c.replies?.some((r) => r.id === commentId)) {
      return {
        ...c,
        replies: c.replies.map((r) => (r.id === commentId ? { ...r, ...patch } : r)),
      };
    }
    return c;
  });
}

export function removeCommentFromTree(
  comments: VoiceComment[],
  commentId: string
): VoiceComment[] {
  return comments
    .filter((c) => c.id !== commentId)
    .map((c) => {
      const hadReply = c.replies?.some((r) => r.id === commentId);
      if (!hadReply) return c;
      return {
        ...c,
        replies: c.replies!.filter((r) => r.id !== commentId),
        replyCount: Math.max(0, (c.replyCount ?? c.replies!.length) - 1),
      };
    });
}
