"use client";
import { useEffect, useState } from "react";
import { api, type Comment } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export default function Comments({ recipeId }: { recipeId: number }) {
  const { user, token } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listComments(recipeId).then(setItems).catch(() => setItems([]));
  }, [recipeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !body.trim()) return;
    setBusy(true);
    try {
      const c = await api.addComment(recipeId, body.trim(), token);
      setItems((prev) => [c, ...prev]);
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">Comments</h2>
      {user ? (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <textarea
            className="input min-h-[90px]"
            placeholder="Share a tip, a swap, or how it turned out…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" disabled={busy || !body.trim()} className="btn-primary self-end">
            Post comment
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink/60">Log in to leave a comment.</p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {items.length === 0 && <li className="text-sm text-ink/50">No comments yet.</li>}
        {items.map((c) => (
          <li key={c.id} className="rounded-2xl border border-black/5 bg-white p-4">
            <div className="mb-1 flex items-center justify-between text-xs text-ink/60">
              <span className="font-medium">@{c.username}</span>
              <span>{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
