"use client";

import React, { useEffect, useRef } from "react";

interface WaveformProps {
  isPlaying: boolean;
  color?: string;
  /** Max bar height as a fraction of canvas height (default 0.42) */
  maxHeightRatio?: number;
}

interface Bar {
  height: number;
  velocity: number; // Downward velocity for gravity
  targetHeight: number;
}

const Waveform: React.FC<WaveformProps> = ({ isPlaying, color = "#111827", maxHeightRatio = 0.42 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<Bar[]>([]);
  
  // Simulation State
  const timeRef = useRef<number>(0);
  const energyRef = useRef({ bass: 0, mid: 0, treble: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configuration
    const GAP = 3;
    const MIN_BAR_WIDTH = 2;
    const GRAVITY = 1.2; // Downward acceleration
    const BOUNCE = 0.3; // Elasticity

    // Mutable bar count — recalculated on each resize
    let BAR_COUNT = barsRef.current.length || 60;

    // Resize handler — also recomputes BAR_COUNT so bars always fit
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent && canvas) {
        const logicalWidth = parent.clientWidth;
        const logicalHeight = parent.clientHeight;

        // Compute how many bars fit: barWidth >= MIN_BAR_WIDTH
        // logicalWidth = BAR_COUNT * (barWidth + GAP) - GAP
        // → BAR_COUNT = floor((logicalWidth + GAP) / (MIN_BAR_WIDTH + GAP))
        const safeWidth = Math.max(0, Number.isFinite(logicalWidth) ? logicalWidth : 0);
        const safeHeight = Math.max(0, Number.isFinite(logicalHeight) ? logicalHeight : 0);
        const newCount = Math.max(
          10,
          Math.floor((safeWidth + GAP) / (MIN_BAR_WIDTH + GAP))
        );

        const barCountChanged = newCount !== BAR_COUNT;
        const barsMissing = barsRef.current.length === 0 || barsRef.current.length !== newCount;
        if (barCountChanged || barsMissing) {
          BAR_COUNT = newCount;
          barsRef.current = new Array(BAR_COUNT).fill(null).map(() => ({
            height: 5,
            velocity: 0,
            targetHeight: 0,
          }));
        }

        canvas.width = safeWidth * 2;
        canvas.height = safeHeight * 2;
        canvas.style.width = `${safeWidth}px`;
        canvas.style.height = `${safeHeight}px`;
        ctx.setTransform(2, 0, 0, 2, 0, 0); // setTransform so resize can run each frame without compounding
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      if (!ctx || !canvas) return;

      resize(); // Pick up dimensions after first layout (fixes first-load)

      const width = canvas.width / 2;
      const height = canvas.height / 2;

      // Skip until canvas has valid size and bars are initialized (fixes first-load IndexSizeError)
      const minSize = 8;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < minSize || height < minSize || BAR_COUNT < 1 || barsRef.current.length !== BAR_COUNT) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const barWidth = (width - GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      if (!Number.isFinite(barWidth) || barWidth <= 0) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Gradient Fill
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color); // Full opacity
      ctx.fillStyle = gradient;

      // --- SIMULATION ---
      
      if (isPlaying) {
        timeRef.current += 0.05;

        // 1. Update Zone Energy (Simulate Music Bands)
        // Decay energy
        energyRef.current.bass *= 0.90;
        energyRef.current.mid *= 0.92;
        energyRef.current.treble *= 0.85;

        // Randomly add energy (Beats/Notes)
        if (Math.random() < 0.05) energyRef.current.bass = Math.min(1.0, energyRef.current.bass + 0.8); // Kick
        if (Math.random() < 0.15) energyRef.current.mid = Math.min(1.0, energyRef.current.mid + 0.4);   // Vocals/Synth
        if (Math.random() < 0.30) energyRef.current.treble = Math.min(1.0, energyRef.current.treble + 0.3); // Hats

        barsRef.current.forEach((bar, i) => {
          // Determine which frequency band this bar belongs to
          const ratio = i / BAR_COUNT;
          let zoneEnergy = 0;
          let noise = 0;

          if (ratio < 0.25) { // Bass
            zoneEnergy = energyRef.current.bass;
            // Slow, rolling sine waves for bass
            noise = Math.sin(timeRef.current * 2 + i * 0.15) * 0.5 + 0.5;
          } else if (ratio < 0.75) { // Mids
            zoneEnergy = energyRef.current.mid;
            // Faster movement for mids
            noise = Math.sin(timeRef.current * 4 + i * 0.25) * 0.5 + 0.5;
          } else { // Treble
            zoneEnergy = energyRef.current.treble;
            // Jittery noise for highs
            noise = Math.random();
          }

          // Calculate "music" target height
          // Base height + (Energy * Noise * MaxHeight)
          const musicHeight = 4 + (zoneEnergy * noise * (height * maxHeightRatio));

          // Apply "Kick" effect to all bars slightly
          const kick = energyRef.current.bass * 0.12 * height * Math.min(1, maxHeightRatio / 0.42);
          
          bar.targetHeight = Math.max(0, musicHeight + kick);
        });

      } else {
        // Idle Animation
        timeRef.current += 0.015;
        barsRef.current.forEach((bar, i) => {
          const wave = Math.sin(timeRef.current + i * 0.1);
          bar.targetHeight = Math.max(0, 6 + wave * 4);
        });
      }

      // --- PHYSICS ENGINE ---
      
      barsRef.current.forEach((bar, i) => {
        // If target is higher, snap up (Attack)
        // If target is lower, fall with gravity (Decay)

        if (bar.targetHeight > bar.height) {
          // Instant attack with slight smoothing
          bar.height += (bar.targetHeight - bar.height) * 0.85;
          bar.velocity = 0;
        } else {
          // Gravity fall
          bar.velocity += GRAVITY;
          bar.height -= bar.velocity * 0.08;
          if (bar.height < bar.targetHeight) {
            bar.height = bar.targetHeight;
            bar.velocity *= -BOUNCE;
          }
        }
        // Clamp height so draw inputs are always valid (avoids negative radius on first load)
        bar.height = Math.max(0, bar.height);
        if (!Number.isFinite(bar.height)) bar.height = 0;

        // Draw — only call roundRect with valid dimensions (avoids first-load arcTo errors)
        const drawHeight = Math.max(0, bar.height);
        if (barWidth > 0 && drawHeight >= 0) {
          const x = i * (barWidth + GAP);
          const y = (height - bar.height) / 2;
          const drawRadius = Math.max(0, Math.min(barWidth / 2, drawHeight / 2));
          roundRect(ctx, x, y, barWidth, drawHeight, drawRadius);
        }
      });

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, color, maxHeightRatio]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};

// Helper for rounded rectangles — arcTo requires non-negative radius; clamp defensively.
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  let r = Number.isFinite(radius) ? radius : 0;
  if (r < 0) r = 0;
  r = Math.min(r, width / 2, height / 2);
  if (!Number.isFinite(r) || r < 0) r = 0;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fill();
}

export default Waveform;