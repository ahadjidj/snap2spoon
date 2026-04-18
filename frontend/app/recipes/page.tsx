"use client";
import { useEffect, useState } from "react";
import RecipeCard from "@/components/RecipeCard";
import { api, type Recipe } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export default function BrowsePage() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.listRecipes({ q, token }).then(setRecipes).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, token]);

  return (
    <div className="pt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">All recipes</h1>
          <p className="text-ink/60">Extracted by snap2spoon users.</p>
        </div>
        <input
          className="input sm:max-w-xs"
          placeholder="Search by title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
