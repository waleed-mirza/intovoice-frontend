export interface VoiceCommentAuthor {
  id: string;
  name: string;
  profileImg?: string | null;
  username?: string | null;
}

export interface VoiceComment {
  id: string;
  content: string;
  audioFileURL?: string | null;
  createdAt: string;
  likeCount: number;
  isLiked: boolean;
  parentId?: string | null;
  replyCount?: number;
  replies?: VoiceComment[];
  author: VoiceCommentAuthor;
}

export interface ReplyTarget {
  threadRootId: string;
  targetAuthorName: string;
}
