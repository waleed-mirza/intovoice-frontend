"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import type { VoiceIconComponent } from "@/components/voice/VoiceIcons";
import { getCategoryDisplayName } from "@/utils/voiceHelpers";
import {
  Music,
  Mic,
  Newspaper,
  Smile,
  BookOpen,
  Trophy,
  Cpu,
  Search,
  Heart,
  Briefcase,
  Star,
  Crescent,
  ChevronLeft,
  ChevronRight,
} from "@/components/voice/VoiceIcons";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface CategoryChipsProps {
  categories: Category[];
  activeSlug?: string;
}

const iconMap: Record<string, VoiceIconComponent> = {
  music: Music,
  mic: Mic,
  newspaper: Newspaper,
  smile: Smile,
  book: BookOpen,
  trophy: Trophy,
  cpu: Cpu,
  search: Search,
  heart: Heart,
  briefcase: Briefcase,
  star: Star,
  religious: Crescent,
  islamic: Crescent,
  "self-help": BookOpen,
  selfhelp: BookOpen,
};

const CategoryChips = ({ categories, activeSlug }: CategoryChipsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [categories]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className="bg-gray-50 z-30 py-3 border-b border-gray-200">
      <div className="relative flex items-center">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-1 z-10 flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-700" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide w-full"
          style={{
            scrollbarWidth: "none",
            paddingLeft: canScrollLeft ? "2.5rem" : "1rem",
            paddingRight: canScrollRight ? "2.5rem" : "1rem",
          }}
        >
          <Link
            href="/"
            className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              !activeSlug
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            All
          </Link>

          {categories.map((category) => {
            const isReligious = category.slug?.toLowerCase() === "religious" || category.slug?.toLowerCase() === "islamic";
            const isSelfHelp = category.slug?.toLowerCase() === "self-help";
            const IconComponent = isReligious ? Crescent : isSelfHelp ? BookOpen : (iconMap[category.icon || ""] || Music);
            const isActive = activeSlug === category.slug;

            return (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <IconComponent className="w-4 h-4" />
                {getCategoryDisplayName(category.name, category.slug)}
              </Link>
            );
          })}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-1 z-10 flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-700" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CategoryChips;
