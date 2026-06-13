export interface TapeUser {
  id: string;
  name: string;
  profileImg?: string;
  username?: string;
}

export interface TapeStation {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string;
  userId?: string;
}

export interface Tape {
  id: string;
  userId: string;
  stationId?: string | null;
  caption: string;
  thumbnailURL: string;
  audioURL: string;
  duration: number;
  likes: string[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  user: TapeUser;
  station?: TapeStation | null;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isSubscribed?: boolean;
  isOwner?: boolean;
}

export interface TapeComment {
  id: string;
  tapeId?: string;
  authorId: string;
  content: string;
  audioFileURL?: string | null;
  parentId?: string | null;
  likes: string[];
  createdAt: string;
  author: TapeUser;
  likeCount: number;
  isLiked: boolean;
  replyCount: number;
  replies?: TapeComment[];
}
