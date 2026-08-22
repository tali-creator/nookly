"use client";

import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";
import { categoryImage, categoryDescription } from "@/lib/categories";

const ROTATE_MS = 10000;

export default function ServiceShowcase({ categories }: { categories: Category[] }) {
  const slides = categories
    .map((c) => ({ category: c, img: categoryImage(c.name) }))
    .filter((s) => s.img);

  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function goTo(i: number) {
    setIndex(((i % slides.length) + slides.length) % slides.length);
  }

  useEffect(() => {
    if (slides.length <= 1) return;
    timer.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [slides.length]);

  if (!slides.length) {
    return (
      <div className="relative aspect-[1.02] overflow-hidden rounded-[2rem] bg-[#dcebc9]" />
    );
  }

  return (
    <div className="relative aspect-[1.02] overflow-hidden rounded-[2rem] bg-[#dcebc9]">
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s) => (
          <div key={s.category.id} className="relative h-full w-full shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.img} alt={s.category.name} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pb-6 pl-6 pr-16 pt-14">
              <p className="text-lg font-bold leading-tight text-white">{s.category.name}</p>
              <p className="mt-1 text-sm leading-snug text-white/90">{categoryDescription(s.category.name)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.category.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
