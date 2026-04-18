import { notFound } from "next/navigation";
import RecipeView from "@/components/RecipeView";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  try {
    const recipe = await api.getRecipe(id);
    return (
      <div className="pt-4">
        <RecipeView initial={recipe} />
      </div>
    );
  } catch {
    notFound();
  }
}
