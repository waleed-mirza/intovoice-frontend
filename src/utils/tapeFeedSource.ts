import type { Tape } from "@/types/tapes";

export type TapeFeedSource =
  | { type: "global" }
  | { type: "user"; userId: string }
  | { type: "station"; stationId: string };

export const GLOBAL_TAPE_FEED: TapeFeedSource = { type: "global" };

export function tapeFeedSourceToQuery(source: TapeFeedSource): string | undefined {
  if (source.type === "user") return `user:${source.userId}`;
  if (source.type === "station") return `station:${source.stationId}`;
  return undefined;
}

export function feedSourceKey(source: TapeFeedSource): string {
  return tapeFeedSourceToQuery(source) ?? "global";
}

export function tapeHref(tapeId: string, source?: TapeFeedSource): string {
  const from =
    source && source.type !== "global" ? tapeFeedSourceToQuery(source) : undefined;
  return from ? `/tapes/${tapeId}?from=${encodeURIComponent(from)}` : `/tapes/${tapeId}`;
}

export function parseTapeFeedSource(from: string | null | undefined): TapeFeedSource {
  if (!from) return GLOBAL_TAPE_FEED;
  const colon = from.indexOf(":");
  if (colon === -1) return GLOBAL_TAPE_FEED;
  const kind = from.slice(0, colon);
  const id = from.slice(colon + 1);
  if (!id) return GLOBAL_TAPE_FEED;
  if (kind === "user") return { type: "user", userId: id };
  if (kind === "station") return { type: "station", stationId: id };
  return GLOBAL_TAPE_FEED;
}

export function mergeTapeByRecency(tapes: Tape[], tape: Tape): Tape[] {
  if (tapes.some((t) => t.id === tape.id)) return tapes;
  return [...tapes, tape].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function tapeMatchesFeedSource(tape: Tape, source: TapeFeedSource): boolean {
  if (source.type === "user") {
    return tape.userId === source.userId && tape.stationId == null;
  }
  if (source.type === "station") {
    return tape.stationId === source.stationId;
  }
  return true;
}
