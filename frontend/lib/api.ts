// Browser: always same-origin /api (proxied by Next.js rewrites).
// Server (SSR): direct to the api-service via cluster DNS / docker network.
const API_URL =
  typeof window === "undefined"
    ? process.env.API_URL_INTERNAL || "http://api:8000"
    : "/api";

export type Ingredient = { name: string; quantity?: string | null; notes?: string | null };

export type Recipe = {
  id: number;
  owner_id: number | null;
  source_url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  servings: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  is_public: boolean;
  created_at: string;
  avg_rating: number;
  rating_count: number;
  comment_count: number;
  bookmarked: boolean;
};

export type User = {
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
  created_at: string;
};
export type PublicConfig = { google_client_id: string | null };
export type Token = { access_token: string; token_type: string; user: User };
export type Comment = { id: number; user_id: number; username: string; body: string; created_at: string };
export type Stats = { recipes_extracted: number; minutes_saved: number; hours_saved: number };

type FetchOpts = { token?: string | null; method?: string; body?: unknown };

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  signup: (email: string, username: string, password: string) =>
    request<Token>("/users/signup", { body: { email, username, password } }),
  login: (email: string, password: string) =>
    request<Token>("/users/login", { body: { email, password } }),
  googleLogin: (idToken: string) =>
    request<Token>("/users/google", { body: { id_token: idToken } }),
  me: (token: string) => request<User>("/users/me", { token }),
  publicConfig: () => request<PublicConfig>("/config"),

  analyze: (url: string, token: string | null) =>
    request<{ is_recipe: boolean; reason: string | null; recipe: Recipe | null }>(
      "/recipes/analyze",
      { body: { url }, token },
    ),

  listRecipes: (opts: { q?: string; sort?: string; mine?: boolean; bookmarked?: boolean; token?: string | null } = {}) => {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.sort) params.set("sort", opts.sort);
    if (opts.mine) params.set("mine", "true");
    if (opts.bookmarked) params.set("bookmarked", "true");
    const qs = params.toString();
    return request<Recipe[]>(`/recipes${qs ? `?${qs}` : ""}`, { token: opts.token });
  },
  getRecipe: (id: number, token?: string | null) => request<Recipe>(`/recipes/${id}`, { token }),
  deleteRecipe: (id: number, token: string) =>
    request<void>(`/recipes/${id}`, { method: "DELETE", token }),

  rate: (id: number, score: number, token: string) =>
    request<void>(`/recipes/${id}/rating`, { method: "PUT", body: { score }, token }),
  listComments: (id: number) => request<Comment[]>(`/recipes/${id}/comments`),
  addComment: (id: number, body: string, token: string) =>
    request<Comment>(`/recipes/${id}/comments`, { body: { body }, token }),

  bookmark: (id: number, token: string) =>
    request<void>(`/bookmarks/${id}`, { method: "PUT", token }),
  unbookmark: (id: number, token: string) =>
    request<void>(`/bookmarks/${id}`, { method: "DELETE", token }),

  stats: () => request<Stats>("/stats"),
};
