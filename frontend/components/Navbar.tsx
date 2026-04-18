"use client";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-ink text-paper text-lg font-bold">
          s2
        </span>
        <span className="font-display text-xl tracking-tight">snap2spoon</span>
      </Link>

      <nav className="flex items-center gap-2 text-sm">
        <Link href="/recipes" className="btn-ghost">Browse</Link>
        {user ? (
          <>
            <Link href="/dashboard" className="btn-ghost">
              My kitchen
            </Link>
            <span className="hidden sm:flex items-center gap-2 text-ink/60">
              {user.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-7 w-7 rounded-full border border-black/10 object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              @{user.username}
            </span>
            <button onClick={logout} className="btn-ghost">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="btn-ghost">Log in</Link>
            <Link href="/signup" className="btn-primary">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}
