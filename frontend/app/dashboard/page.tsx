"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RecipeCard from "@/components/RecipeCard";
import URLInput from "@/components/URLInput";
import { api, type Recipe } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

type Tab = "mine" | "bookmarks";

export default function DashboardPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("mine");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [working, setWorking] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    setWorking(true);
    api
      .listRecipes({ token, mine: tab === "mine", bookmarked: tab === "bookmarks" })
      .then(setRecipes)
      .finally(() => setWorking(false));
  }, [tab, token]);

  if (!user) return null;

  return (
    <div className="pt-4">
      <h1 className="font-display text-4xl">Hi @{user.username}</h1>
      <p className="text-ink/60">Your kitchen. Paste another video or revisit a saved one.</p>

      <div className="mt-6">
        <URLInput />
      </div>

      <div className="mt-10 flex gap-2 border-b border-black/10">
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>My recipes</TabBtn>
        <TabBtn active={tab === "bookmarks"} onClick={() => setTab("bookmarks")}>Bookmarks</TabBtn>
      </div>

      {working ? (
        <p className="mt-8 text-ink/50">Loading…</p>
      ) : recipes.length === 0 ? (
        <p className="mt-8 text-ink/50">
          {tab === "mine" ? "You haven't extracted any recipes yet." : "No bookmarks yet."}
        </p>
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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium transition ${
        active ? "border-b-2 border-ink text-ink" : "text-ink/50 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
