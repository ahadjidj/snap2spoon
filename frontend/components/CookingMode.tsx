"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/api";

export default function CookingMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const total = recipe.steps.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);
  const next = useCallback(() => {
    if (isLast) onClose();
    else setStep((s) => Math.min(total - 1, s + 1));
  }, [isLast, onClose, total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Lock page scroll behind the overlay and focus the primary control.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nextRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Keep the screen on while cooking (hands are usually busy). Best-effort:
  // unsupported browsers just ignore it, and the lock is re-acquired when the
  // tab becomes visible again because the browser releases it on hide.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    async function acquire() {
      try {
        const l = await navigator.wakeLock?.request("screen");
        if (cancelled) l?.release();
        else lock = l ?? null;
      } catch {
        // Denied (e.g. low battery) — nothing to do.
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") acquire();
    }
    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking mode: ${recipe.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-paper"
    >
      <header className="flex items-center gap-4 border-b border-black/5 px-4 py-3 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Cooking mode</p>
          <h2 className="truncate font-display text-lg">{recipe.title}</h2>
        </div>
        {recipe.ingredients.length > 0 && (
          <button
            onClick={() => setShowIngredients((v) => !v)}
            aria-expanded={showIngredients}
            className="btn-ghost px-4 py-2"
          >
            {showIngredients ? "Hide ingredients" : "Ingredients"}
          </button>
        )}
        <button onClick={onClose} aria-label="Exit cooking mode" className="btn-ghost px-4 py-2">
          ✕
        </button>
      </header>

      <div className="h-1 w-full bg-cream">
        <div
          className="h-full bg-spoon transition-all duration-300"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>

      <div className="relative flex min-h-0 flex-1">
        <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
          <div className="w-full max-w-3xl">
            <p className="text-sm font-semibold text-spoon">
              Step {step + 1} of {total}
            </p>
            <p aria-live="polite" className="mt-4 font-display text-3xl leading-snug sm:text-4xl lg:text-5xl">
              {recipe.steps[step]}
            </p>
          </div>
        </main>

        {showIngredients && (
          // Overlays the step on small screens; sits beside it on large ones.
          <aside className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto border-l border-black/5 bg-white p-6 shadow-card lg:static lg:shadow-none">
            <h3 className="font-display text-xl">Ingredients</h3>
            <ul className="mt-4 space-y-3">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="min-w-[80px] font-medium text-spoon">{ing.quantity || "—"}</span>
                  <span className="flex-1">
                    {ing.name}
                    {ing.notes && <span className="ml-1 text-ink/50">({ing.notes})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-black/5 px-4 py-4 sm:px-8">
        <button onClick={prev} disabled={isFirst} className="btn-ghost flex-1 py-4 text-base sm:flex-none sm:px-10">
          ← Previous
        </button>
        <span className="hidden flex-1 text-center text-xs text-ink/40 sm:block">
          Use ← → keys · Esc to exit
        </span>
        <button ref={nextRef} onClick={next} className="btn-primary flex-1 py-4 text-base sm:flex-none sm:px-10">
          {isLast ? "Done ✓" : "Next →"}
        </button>
      </footer>
    </div>
  );
}
