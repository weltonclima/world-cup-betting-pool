"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";

/** Navegação inferior para dispositivos mobile (oculta em md+). */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-background/95 backdrop-blur-sm md:hidden"
    >
      <ul className="flex h-full items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-label={item.ariaLabel}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-2 px-3 min-h-[44px] min-w-[44px] transition-colors duration-150 motion-reduce:transition-none"
              >
                <Icon
                  size={isActive ? 22 : 20}
                  aria-hidden="true"
                  className={
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                />
                <span
                  className={
                    isActive
                      ? "text-xs font-semibold text-primary"
                      : "text-xs font-medium text-muted-foreground"
                  }
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
