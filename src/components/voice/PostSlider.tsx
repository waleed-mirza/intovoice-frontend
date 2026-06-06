"use client";

import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "@/components/voice/VoiceIcons";
import VoicePostCard from "./VoicePostCard";

interface VoicePost {
  id: string;
  title: string;
  thumbnailURL: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  station: {
    id: string;
    name: string;
    handle: string;
    avatarURL?: string;
  };
}

interface PostSliderProps {
  title: string;
  posts: VoicePost[];
  showAll?: string;
}

const PostSlider = ({ title, posts, showAll }: PostSliderProps) => {
  const sliderRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (sliderRef.current) {
      const scrollAmount = sliderRef.current.clientWidth * 0.8;
      sliderRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!posts || posts.length === 0) return null;

  return (
    <section className="mb-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {showAll && (
          <a
            href={showAll}
            className="text-gray-900 hover:text-gray-600 text-sm font-medium"
          >
            See all
          </a>
        )}
      </div>

      {/* Slider Container */}
      <div className="relative group/slider">
        {/* Left Arrow - positioned at thumbnail center (320px * 0.5625 / 2 ≈ 90px) */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-[90px] -translate-y-1/2 z-10 w-10 h-10 bg-white/90 shadow-lg rounded-full flex items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-white"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>

        {/* Audios */}
        <div
          ref={sliderRef}
          className="w-full flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex-shrink-0 w-[280px] sm:w-[300px] lg:w-[320px] snap-start"
            >
              <VoicePostCard post={post} />
            </div>
          ))}
        </div>

        {/* Right Arrow - positioned at thumbnail center */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-[90px] -translate-y-1/2 z-10 w-10 h-10 bg-white/90 shadow-lg rounded-full flex items-center justify-center opacity-0 group-hover/slider:opacity-100 transition-opacity hover:bg-white"
        >
          <ChevronRight className="w-6 h-6 text-gray-700" />
        </button>
      </div>
    </section>
  );
};

export default PostSlider;
