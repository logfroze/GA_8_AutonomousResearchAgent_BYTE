import { Link } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Desk" },
  { to: "/samples", label: "Samples" },
  { to: "/method", label: "Method" },
] as const;

export function SiteHeader({ current }: { current: "desk" | "samples" | "method" }) {
  return (
    <header className="border-b border-rule bg-surface/90">
      {/* Top B.Y.T.E Internship Breadcrumb Header */}
      <div className="border-b border-rule/70 bg-bg-subtle/70 py-2.5 px-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base text-ink">
            <span className="font-medium text-muted">B.Y.T.E Arithmatrix Generative AI Internship.</span>
            <span className="text-rule-strong hidden sm:inline">/</span>
            <span className="font-semibold text-ink">Task 8</span>
          </div>
          <span className="text-[0.72rem] font-medium tracking-wide text-muted uppercase hidden md:inline">
            Autonomous Research Agent
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link to="/" className="flex min-h-11 items-center gap-3 no-underline">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-pine text-pine-fg" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="13.5" cy="13.5" r="6.25" stroke="currentColor" strokeWidth="2.6" />
              <line x1="18.2" y1="18.2" x2="25.2" y2="25.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[1.05rem] font-semibold tracking-tight text-ink">
              Research Agent
            </span>
            <span className="block text-[0.7rem] font-medium tracking-[0.14em] text-muted uppercase">
              BYTE AVIP 2026
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
          {links.map((link) => {
            const active =
              (current === "desk" && link.to === "/") ||
              (current === "samples" && link.to === "/samples") ||
              (current === "method" && link.to === "/method");
            return (
              <Link
                key={link.to}
                to={link.to}
                className={
                  "inline-flex min-h-11 items-center rounded-[10px] px-3 font-medium no-underline transition-colors duration-150 " +
                  (active ? "bg-bg-subtle text-ink" : "text-muted hover:bg-bg-subtle hover:text-ink")
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
