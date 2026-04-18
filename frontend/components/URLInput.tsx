"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Recipe } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export default function URLInput() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notRecipeReason, setNotRecipeReason] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotRecipeReason(null);
    if (!url.includes("instagram.com")) {
      setError("Please paste a link from instagram.com");
      return;
    }
    setLoading(true);
    try {
      const res = await api.analyze(url, token);
      if (res.is_recipe && res.recipe) {
        const r: Recipe = res.recipe;
        router.push(`/recipes/${r.id}`);
      } else {
        setNotRecipeReason(res.reason || "We couldn't find a recipe in that video.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="url"
          required
          placeholder="Paste an Instagram reel or post URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary sm:w-auto">
          {loading ? "Reading the video…" : "Extract recipe"}
        </button>
      </div>
      {loading && (
        <p className="mt-3 text-sm text-ink/60">
          Downloading frames and asking our AI what's cooking. This usually takes 10–30 seconds.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {notRecipeReason && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-cream p-4 text-sm text-ink/80">
          <strong className="font-semibold">No recipe found.</strong> {notRecipeReason}
        </div>
      )}
    </form>
  );
}
