"use client";

import React from "react";

interface UploadProgressBarProps {
  label: string;
  percent: number;
  className?: string;
}

export default function UploadProgressBar({
  label,
  percent,
  className = "",
}: UploadProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
      <div className="flex justify-between text-sm text-gray-700 mb-2">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-black transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
