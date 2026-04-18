import Link from "next/link";
import type { Recipe } from "@/lib/api";
import RatingStars from "./RatingStars";

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-cream">
        {recipe.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/thumbnail?url=${encodeURIComponent(recipe.thumbnail_url)}`}
            alt={recipe.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🍳</div>
        )}
        {recipe.bookmarked && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-2 py-1 text-xs font-medium text-paper backdrop-blur">
            Saved
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-5">
        <h3 className="font-display text-xl leading-tight">{recipe.title}</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink/60">
          {total > 0 && <span>⏱ {total} min</span>}
          {recipe.servings && <span>🍽 {recipe.servings}</span>}
          <span>💬 {recipe.comment_count}</span>
        </div>
        <RatingStars value={recipe.avg_rating} count={recipe.rating_count} readOnly size="sm" />
      </div>
    </Link>
  );
}
