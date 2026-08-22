"use client";

import type { Category } from "@/lib/types";
import { categoryImage } from "@/lib/categories";

const CATEGORY_GLYPHS = ["✦", "⌁", "↗", "⌂", "▱", "✳"];
const CATEGORY_TONES = [
  "bg-[#e9f6d0]",
  "bg-[#fce8d7]",
  "bg-[#e4eefb]",
  "bg-[#f7e3ee]",
  "bg-[#e7edf0]",
  "bg-[#f5edc8]",
];

export default function CategoryGrid({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category, i) => {
        const img = categoryImage(category.name);
        const isSelected = selectedId === category.id;
        const ring = isSelected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "";
        if (img) {
          return (
            <button
              key={category.id}
              type="button"
              data-category-id={category.id}
              onClick={() => onSelect(category.id)}
              className={`relative flex aspect-[1.55/1] flex-col justify-end overflow-hidden rounded-2xl p-0 text-left transition hover:-translate-y-1 hover:shadow-md ${ring}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <span className="relative px-4 pb-3 pt-6 text-sm font-bold leading-tight text-white">
                {category.name}
              </span>
            </button>
          );
        }
        return (
          <button
            key={category.id}
            type="button"
            data-category-id={category.id}
            onClick={() => onSelect(category.id)}
            className={`flex min-h-32 flex-col justify-between rounded-2xl p-4 text-left transition hover:-translate-y-1 hover:shadow-md ${CATEGORY_TONES[i % CATEGORY_TONES.length]} ${ring}`}
          >
            <span className="text-2xl font-bold">{CATEGORY_GLYPHS[i % CATEGORY_GLYPHS.length]}</span>
            <span className="text-sm font-bold leading-tight">{category.name}</span>
          </button>
        );
      })}
    </div>
  );
}
