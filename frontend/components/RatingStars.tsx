"use client";
import { useState } from "react";

type Props = {
  value: number;
  count?: number;
  readOnly?: boolean;
  onChange?: (score: number) => void;
  size?: "sm" | "md";
};

export default function RatingStars({ value, count, readOnly, onChange, size = "md" }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const effective = hover ?? value;
  const dim = size === "sm" ? "text-base" : "text-xl";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex gap-0.5 ${dim}`} onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)}
            onClick={() => !readOnly && onChange?.(n)}
            className={`transition ${
              n <= effective ? "text-spoon" : "text-black/15"
            } ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-ink/60">
          {value ? value.toFixed(1) : "—"} · {count} vote{count === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
