import Link from "next/link";
import URLInput from "@/components/URLInput";
import RecipeCard from "@/components/RecipeCard";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, recipes] = await Promise.all([
    api.stats().catch(() => ({ recipes_extracted: 0, minutes_saved: 0, hours_saved: 0 })),
    api.listRecipes().catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-16 pt-4">
      <section className="relative grid-cols-1 overflow-hidden rounded-[2.5rem] bg-cream px-6 py-14 sm:px-12 lg:py-20">
        <div className="grain absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="chip">Powered by Claude</span>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] sm:text-6xl">
            Turn Instagram reels into <span className="text-spoon">real recipes.</span>
          </h1>
          <p className="mt-5 text-lg text-ink/70">
            Paste a link. We watch the video, figure out if it's food, and spit out the
            ingredients, quantities and steps. Save them, rate them, cook them.
          </p>
          <div className="mt-8">
            <URLInput />
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-6 text-left sm:grid-cols-3">
            <Stat label="Recipes extracted" value={stats.recipes_extracted.toLocaleString()} />
            <Stat
              label="Hours saved"
              value={stats.hours_saved.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            />
            <Stat label="Avg. extract time" value="~20s" />
          </dl>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl">Latest from the community</h2>
          <Link href="/recipes" className="btn-ghost">Browse all →</Link>
        </div>
        {recipes.length === 0 ? (
          <p className="mt-6 text-ink/60">No recipes yet — be the first to paste one ☝️</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.slice(0, 6).map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[2.5rem] bg-ink px-6 py-14 text-paper sm:px-12">
        <h2 className="font-display text-3xl sm:text-4xl">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <Step n="1" title="Paste a link">
            Drop any instagram.com reel or post URL into the box above.
          </Step>
          <Step n="2" title="We watch it for you">
            The analyzer samples frames and asks Claude whether it's a recipe and, if so,
            to transcribe it.
          </Step>
          <Step n="3" title="Cook, rate, save">
            Get structured ingredients and steps. Rate, comment, bookmark — your kitchen
            is yours.
          </Step>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className="font-display text-4xl">{value}</dd>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-paper/10 p-6">
      <div className="font-display text-5xl text-spoon">{n}</div>
      <h3 className="mt-2 font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm text-paper/70">{children}</p>
    </div>
  );
}
