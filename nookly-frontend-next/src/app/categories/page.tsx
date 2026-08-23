"use client";

import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import CategoryGrid from "@/components/CategoryGrid";
import { apiGet } from "@/lib/api";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ categories: Category[] }>("/categories")
      .then((res) => {
        if (!cancelled) setCategories(res.data.categories || []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <h1 className="font-mono text-3xl font-bold tracking-[-0.05em] sm:text-4xl">
            All categories
          </h1>
          <p className="mt-3 text-muted-foreground">
            Browse trusted local pros by category.
          </p>
          {loading ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
              Loading categories…
            </div>
          ) : categories.length ? (
            <CategoryGrid categories={categories} />
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-border py-14 text-center text-muted-foreground">
              Could not load categories.
            </div>
          )}
        </section>
      </main>
    </>
  );
}
