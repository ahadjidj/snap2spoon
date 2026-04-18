"use client";
import { useState } from "react";
import type { Recipe } from "@/lib/api";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import RatingStars from "./RatingStars";
import Comments from "./Comments";

export default function RecipeView({ initial }: { initial: Recipe }) {
  const { user, token } = useAuth();
  const [recipe, setRecipe] = useState<Recipe>(initial);
  const [saving, setSaving] = useState(false);

  async function rate(score: number) {
    if (!token) return;
    await api.rate(recipe.id, score, token);
    setRecipe((r) => ({
      ...r,
      avg_rating: (r.avg_rating * r.rating_count + score) / (r.rating_count + 1),
      rating_count: r.rating_count + 1,
    }));
  }

  async function toggleBookmark() {
    if (!token) return;
    setSaving(true);
    try {
      if (recipe.bookmarked) await api.unbookmark(recipe.id, token);
      else await api.bookmark(recipe.id, token);
      setRecipe((r) => ({ ...r, bookmarked: !r.bookmarked }));
    } finally {
      setSaving(false);
    }
  }

  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);

  return (
    <article className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div className="card overflow-hidden">
        <div className="relative aspect-[4/5] w-full bg-cream">
          {recipe.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/thumbnail?url=${encodeURIComponent(recipe.thumbnail_url)}`} alt={recipe.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl">🍳</div>
          )}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2 text-xs">
          {recipe.tags.map((t) => (
            <span key={t} className="chip">#{t}</span>
          ))}
        </div>
        <h1 className="mt-3 font-display text-4xl leading-tight">{recipe.title}</h1>
        {recipe.description && <p className="mt-3 text-ink/70">{recipe.description}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-ink/70">
          {recipe.prep_minutes != null && <span>Prep · {recipe.prep_minutes} min</span>}
          {recipe.cook_minutes != null && <span>Cook · {recipe.cook_minutes} min</span>}
          {total > 0 && <span>Total · {total} min</span>}
          {recipe.servings && <span>Serves · {recipe.servings}</span>}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <RatingStars value={recipe.avg_rating} count={recipe.rating_count} readOnly />
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink/60">Your vote:</span>
              <RatingStars value={0} onChange={rate} />
            </div>
          ) : null}
          {user && (
            <button onClick={toggleBookmark} disabled={saving} className="btn-ghost">
              {recipe.bookmarked ? "★ Saved" : "☆ Save"}
            </button>
          )}
          <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-sm underline text-ink/60">
            Original video ↗
          </a>
        </div>

        <section className="mt-8">
          <h2 className="font-display text-2xl">Ingredients</h2>
          <ul className="mt-3 space-y-2">
            {recipe.ingredients.length === 0 && (
              <li className="text-sm text-ink/50">No ingredients detected.</li>
            )}
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3">
                <span className="min-w-[90px] font-medium text-spoon">
                  {ing.quantity || "—"}
                </span>
                <span className="flex-1">
                  {ing.name}
                  {ing.notes && <span className="ml-2 text-ink/50 text-sm">({ing.notes})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl">Steps</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {recipe.steps.length === 0 && (
              <li className="text-sm text-ink/50">No steps detected.</li>
            )}
            {recipe.steps.map((s, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-2xl border border-black/5 bg-white px-4 py-4 leading-relaxed"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ink text-paper text-xs font-semibold">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <Comments recipeId={recipe.id} />
      </div>
    </article>
  );
}
