"use client";
import { useEffect, useState } from "react";
import RecipeCard from "@/components/RecipeCard";
import { api, type Recipe } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const SORT_OPTIONS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "rating", label: "Top rated" },
];

export default function BrowsePage() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.listRecipes({ q, sort, token }).then(setRecipes).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, sort, token]);

  return (
    <div className="pt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">All recipes</h1>
          <p className="text-ink/60">Extracted by snap2spoon users.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="input"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            className="input sm:max-w-xs"
            placeholder="Search by title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-ink/50">Loading…</p>
      ) : recipes.length === 0 ? (
        <p className="mt-8 text-ink/50">Nothing matches that search.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}
