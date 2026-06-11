export interface LiveStreamUser {
  id: string;
  name: string;
  username?: string | null;
  profileImg?: string | null;
}

export interface LiveStreamStation {
  id: string;
  name: string;
  handle: string;
  avatarURL?: string | null;
}

export interface LiveStream {
  id: string;
  title: string;
  description?: string | null;
  roomId: string;
  streamId: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  user: LiveStreamUser;
  station?: LiveStreamStation | null;
}

export interface LiveChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  sendTime: number;
  isSelf: boolean;
  isHost?: boolean;
}

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "ended"
  | "error";
