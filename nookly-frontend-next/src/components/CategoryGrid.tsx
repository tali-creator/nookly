"use client";

import type { Category } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
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

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category, i) => {
        const img = categoryImage(category.name);
        const href = `/category/${category.id}`;
        if (img) {
          return (
            <Link
              key={category.id}
              href={href}
              className="relative flex aspect-[1.55/1] flex-col justify-end overflow-hidden rounded-2xl p-0 text-left transition hover:-translate-y-1 hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image
                src={img}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className="object-cover"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <span className="relative px-4 pb-3 pt-6 text-sm font-bold leading-tight text-white">
                {category.name}
              </span>
            </Link>
          );
        }
        return (
          <Link
            key={category.id}
            href={href}
            className={`flex min-h-32 flex-col justify-between rounded-2xl p-4 text-left transition hover:-translate-y-1 hover:shadow-md ${CATEGORY_TONES[i % CATEGORY_TONES.length]}`}
          >
            <span className="text-2xl font-bold">{CATEGORY_GLYPHS[i % CATEGORY_GLYPHS.length]}</span>
            <span className="text-sm font-bold leading-tight">{category.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
