"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Api from "@/lib/axios";
import { Loader2, Plus, CassetteTape, ChevronUp, ChevronDown } from "@/components/voice/VoiceIcons";
import { useAuth } from "@/providers/AuthProvider";
import TapeSlide from "./TapeSlide";
import TapeCommentsPanel from "./TapeCommentsPanel";
import type { Tape } from "@/types/tapes";
import { TAPE_FEED_SHELL, TAPE_SLIDE_SHELL } from "@/utils/tapeLayout";
import {
  GLOBAL_TAPE_FEED,
  mergeTapeByRecency,
  tapeMatchesFeedSource,
  feedSourceKey,
  tapeHref,
  type TapeFeedSource,
} from "@/utils/tapeFeedSource";
import {
  TAPE_FEED_PAGE_SIZE,
  TAPE_FEED_PREFETCH_REMAINING,
} from "@/utils/tapeFeedConstants";
import { consumeTapeFeedSeed } from "@/utils/tapeFeedCache";

interface TapeFeedProps {
  initialTapeId?: string;
  feedSource?: TapeFeedSource;
}

const VIEWED_KEY = "tape_views_session";

function getViewedSet(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markViewed(id: string) {
  if (typeof sessionStorage === "undefined") return;
  const set = getViewedSet();
  set.add(id);
  sessionStorage.setItem(VIEWED_KEY, JSON.stringify(Array.from(set)));
}

async function fetchFeedPage(source: TapeFeedSource, pageNum: number, limit: number) {
  switch (source.type) {
    case "user":
      return Api.get(`/voice/tape/user/${source.userId}`, {
        params: { page: pageNum, limit },
      });
    case "station":
      return Api.get(`/voice/tape/station/${source.stationId}`, {
        params: { page: pageNum, limit },
      });
    default:
      return Api.get("/voice/tape/feed", { params: { page: pageNum, limit } });
  }
}

function feedCacheKey(source: TapeFeedSource, tapeId?: string) {
  return `${feedSourceKey(source)}:${tapeId ?? ""}`;
}

export default function TapeFeed({
  initialTapeId,
  feedSource = GLOBAL_TAPE_FEED,
}: TapeFeedProps) {
  const router = useRouter();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const touchStartRef = useRef<{ y: number; x: number; scrollTop: number } | null>(null);
  const prefetchingRef = useRef(false);
  const seedCacheRef = useRef<{
    key: string;
    seed: ReturnType<typeof consumeTapeFeedSeed>;
  } | null>(null);

  const resolveSeed = useCallback(
    (source: TapeFeedSource, tapeId?: string) => {
      const key = feedCacheKey(source, tapeId);
      if (seedCacheRef.current?.key === key) return seedCacheRef.current.seed;
      const seed =
        source.type !== "global" ? consumeTapeFeedSeed(source, tapeId) : null;
      seedCacheRef.current = { key, seed };
      return seed;
    },
    []
  );

  const bootSeed = resolveSeed(feedSource, initialTapeId);

  const [tapes, setTapes] = useState<Tape[]>(() => bootSeed?.tapes ?? []);
  const [loading, setLoading] = useState(() => !bootSeed);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(() => bootSeed?.page ?? 1);
  const [hasMore, setHasMore] = useState(() => bootSeed?.hasMore ?? true);
  const [activeId, setActiveId] = useState<string | null>(() =>
    bootSeed ? initialTapeId ?? bootSeed.tapes[0]?.id ?? null : null
  );
  const [commentsTapeId, setCommentsTapeId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeIndex = activeId ? tapes.findIndex((t) => t.id === activeId) : -1;

  const updateTape = useCallback((tapeId: string, updates: Partial<Tape>) => {
    setTapes((prev) =>
      prev.map((t) => (t.id === tapeId ? { ...t, ...updates } : t))
    );
  }, []);

  const handleTapeDelete = useCallback((tapeId: string) => {
    setTapes((prev) => {
      const idx = prev.findIndex((t) => t.id === tapeId);
      const next = prev.filter((t) => t.id !== tapeId);
      setActiveId((current) => {
        if (current !== tapeId) return current;
        return next[idx]?.id ?? next[idx - 1]?.id ?? null;
      });
      return next;
    });
    setCommentsTapeId((id) => (id === tapeId ? null : id));
  }, []);

  const loadFeed = useCallback(
    async (pageNum: number, append: boolean, ensureTapeId?: string) => {
      try {
        if (append) setLoadingMore(true);
        else {
          setLoading(true);
          setLoadError(null);
        }

        const res = await fetchFeedPage(feedSource, pageNum, TAPE_FEED_PAGE_SIZE);
        let batch: Tape[] = res.data.result || [];
        const pagination = res.data.pagination;

        if (!append && ensureTapeId && !batch.some((t) => t.id === ensureTapeId)) {
          try {
            const tapeRes = await Api.get(`/voice/tape/${ensureTapeId}`);
            const tape: Tape = tapeRes.data.result;
            if (
              feedSource.type === "global" ||
              tapeMatchesFeedSource(tape, feedSource)
            ) {
              batch = mergeTapeByRecency(batch, tape);
            }
          } catch {
            console.error("Tape not found for deep link");
          }
        }

        setTapes((prev) => {
          if (!append) return batch;
          const ids = new Set(prev.map((t) => t.id));
          return [...prev, ...batch.filter((t) => !ids.has(t.id))];
        });
        if (!append) {
          setActiveId((current) =>
            batch.length > 0 ? ensureTapeId ?? current ?? batch[0].id : current
          );
        }
        setHasMore(pagination?.hasMore ?? false);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to load tapes:", err);
        if (!append) {
          setLoadError("Could not load tapes. Check your connection and try again.");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [feedSource]
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    prefetchingRef.current = false;

    const initialize = async () => {
      setLoadError(null);
      const seed = resolveSeed(feedSource, initialTapeId);

      if (seed && !cancelled) {
        setTapes(seed.tapes);
        setPage(seed.page);
        setHasMore(seed.hasMore);
        setActiveId(initialTapeId ?? seed.tapes[0]?.id ?? null);
        setLoading(false);
        return;
      }

      if (cancelled) return;
      setTapes([]);
      setPage(1);
      setHasMore(true);
      setActiveId(null);
      setLoading(true);
      await loadFeed(1, false, initialTapeId);
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [feedSource, initialTapeId, loadFeed, resolveSeed]);

  useEffect(() => {
    if (!initialTapeId || tapes.length === 0) return;
    const el = slideRefs.current.get(initialTapeId);
    if (el) {
      el.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      setActiveId(initialTapeId);
    }
  }, [initialTapeId, tapes]);

  // Keep the URL in sync with the visible tape (shareable link, no full navigation).
  useEffect(() => {
    if (!activeId || typeof window === "undefined") return;
    const next = tapeHref(activeId, feedSource);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [activeId, feedSource]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || tapes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const id = entry.target.getAttribute("data-tape-id");
            if (id) setActiveId(id);
          }
        });
      },
      { root: container, threshold: [0.55] }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tapes]);

  useEffect(() => {
    if (!hasMore || loadingMore || prefetchingRef.current || !activeId) return;
    const idx = tapes.findIndex((t) => t.id === activeId);
    if (idx < 0 || idx < tapes.length - TAPE_FEED_PREFETCH_REMAINING) return;

    prefetchingRef.current = true;
    void loadFeed(page + 1, true).finally(() => {
      prefetchingRef.current = false;
    });
  }, [activeId, tapes, hasMore, loadingMore, page, loadFeed]);

  useEffect(() => {
    if (commentsTapeId && activeId && commentsTapeId !== activeId) {
      setCommentsTapeId(null);
    }
  }, [activeId, commentsTapeId]);

  useEffect(() => {
    if (!commentsTapeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCommentsTapeId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentsTapeId]);

  const toggleComments = useCallback((tapeId: string) => {
    setCommentsTapeId((prev) => (prev === tapeId ? null : tapeId));
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const tape = tapes[index];
      if (!tape) return;
      const el = slideRefs.current.get(tape.id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [tapes]
  );

  const handleFeedTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = {
      y: touch.clientY,
      x: touch.clientX,
      scrollTop: containerRef.current?.scrollTop ?? 0,
    };
  };

  const handleFeedTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || commentsTapeId) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const deltaY = touch.clientY - start.y;
    const deltaX = touch.clientX - start.x;
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;

    const container = containerRef.current;
    const nativeScrolled =
      container && Math.abs(container.scrollTop - start.scrollTop) > 12;

    // Fallback snap when native scroll did not move (common on some mobile browsers)
    if (!nativeScrolled && Math.abs(deltaY) >= 48) {
      if (deltaY < 0) scrollToIndex(activeIndex + 1);
      else scrollToIndex(activeIndex - 1);
    }
  };

  const handleView = useCallback(
    async (tapeId: string) => {
      const viewed = getViewedSet();
      if (viewed.has(tapeId)) return;
      markViewed(tapeId);
      try {
        const res = await Api.post(`/voice/tape/${tapeId}/view`);
        updateTape(tapeId, { viewCount: res.data.result.viewCount });
      } catch {
        // non-critical
      }
    },
    [updateTape]
  );

  const handleCommentCountChange = (tapeId: string, delta: number) => {
    setTapes((prev) =>
      prev.map((t) =>
        t.id === tapeId
          ? { ...t, commentCount: Math.max(0, t.commentCount + delta) }
          : t
      )
    );
  };

  const feedShell = (content: React.ReactNode) => (
    <div className={TAPE_FEED_SHELL}>{content}</div>
  );

  const isUserFeed = feedSource.type === "user";
  const isStationFeed = feedSource.type === "station";
  const isScopedFeed = isUserFeed || isStationFeed;

  const feedTitle = isUserFeed
    ? "Personal Tapes"
    : isStationFeed
      ? "Station Tapes"
      : "Tapes";
  const feedSubtitle = isScopedFeed
    ? "Scroll up or down through this creator's clips"
    : "Scroll up or down for the next clip";

  if (loading) {
    return feedShell(
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadError) {
    return feedShell(
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <CassetteTape className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Could not load tapes</h2>
        <p className="text-gray-500 mb-6 max-w-sm text-sm">{loadError}</p>
        <button
          type="button"
          onClick={() => loadFeed(1, false, initialTapeId)}
          className="px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (tapes.length === 0) {
    return feedShell(
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <CassetteTape className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {isScopedFeed ? "No tapes here" : "No tapes yet"}
        </h2>
        <p className="text-gray-500 mb-6 max-w-sm text-sm">
          {isUserFeed
            ? "This creator hasn't published personal tapes yet."
            : isStationFeed
              ? "This station doesn't have any tapes yet."
              : "Short audio clips up to 59 seconds. Be the first to publish a tape."}
        </p>
        {!isScopedFeed && (
          user ? (
          <Link
            href="/tapes/upload"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium text-sm"
          >
            <Plus className="w-5 h-5" />
            Create a tape
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/auth/login?redirect=/tapes/upload")}
            className="px-6 py-2.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors font-medium text-sm"
          >
            Sign in to create
          </button>
        )
        )}
      </div>
    );
  }

  const commentsTape = commentsTapeId
    ? tapes.find((t) => t.id === commentsTapeId) ?? null
    : null;

  return (
    <>
      <div className={TAPE_FEED_SHELL}>
        <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* Desktop/tablet feed header */}
        <div className="absolute top-0 inset-x-0 z-30 hidden md:flex items-center justify-between px-4 py-3 bg-gradient-to-b from-gray-50 from-0% via-gray-50/25 via-45% to-transparent to-85% pointer-events-none">
          <div className="pointer-events-auto min-w-0">
            <h1 className="text-sm font-bold text-gray-900 tracking-tight">{feedTitle}</h1>
            <p className="text-[11px] text-gray-500">{feedSubtitle}</p>
          </div>
          {user && !isScopedFeed && (
            <Link
              href="/tapes/upload"
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black text-white rounded-full text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </Link>
          )}
        </div>

        {/* Mobile: floating create only */}
        {user && !isScopedFeed && (
          <Link
            href="/tapes/upload"
            className="md:hidden absolute top-3 left-3 z-30 inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/80 backdrop-blur-sm text-white rounded-full text-xs font-medium hover:bg-black transition-colors shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            Create
          </Link>
        )}

        {/* Scroll snap feed */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 basis-0 overflow-y-auto overscroll-y-contain snap-y snap-mandatory scroll-smooth tape-feed-scroll touch-pan-y"
          onTouchStart={handleFeedTouchStart}
          onTouchEnd={handleFeedTouchEnd}
        >
          {tapes.map((tape) => (
            <div
              key={tape.id}
              data-tape-id={tape.id}
              className={TAPE_SLIDE_SHELL}
              ref={(el) => {
                if (el) slideRefs.current.set(tape.id, el);
                else slideRefs.current.delete(tape.id);
              }}
            >
              <TapeSlide
                tape={tape}
                isActive={activeId === tape.id}
                commentsOpen={commentsTapeId === tape.id}
                onTapeUpdate={updateTape}
                onToggleComments={toggleComments}
                onCloseComments={() => setCommentsTapeId(null)}
                onCommentCountChange={(delta) => handleCommentCountChange(tape.id, delta)}
                onView={handleView}
                onTapeDelete={handleTapeDelete}
              />
            </div>
          ))}
          {loadingMore && (
            <div className="h-16 flex items-center justify-center snap-start">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}
        </div>

        {/* Tablet/desktop prev/next navigation */}
        <div className="hidden md:flex absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-2">
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex <= 0}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-sm transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            aria-label="Previous tape"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex >= tapes.length - 1}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-sm transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            aria-label="Next tape"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {commentsTape && (
          <TapeCommentsPanel
            variant="overlay"
            tape={commentsTape}
            onClose={() => setCommentsTapeId(null)}
            onCommentCountChange={(delta) => handleCommentCountChange(commentsTape.id, delta)}
          />
        )}
        </div>
      </div>

      <style jsx global>{`
        .tape-feed-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }
        .tape-feed-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
}
