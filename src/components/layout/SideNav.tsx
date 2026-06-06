"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { NAV_ITEMS } from "./nav-items";

/** Navegação lateral colapsada para desktop (oculta em mobile). */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="Navegação lateral"
      className="hidden md:flex w-16 flex-col border-r border-sidebar-border bg-sidebar sticky top-14 h-[calc(100vh-3.5rem)] py-4 px-2"
    >
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Tooltip>
                <TooltipTrigger render={
                  <Link
                    href={item.href}
                    aria-label={item.ariaLabel}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "flex items-center justify-center p-3 rounded-lg transition-colors duration-150 motion-reduce:transition-none",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ].join(" ")}
                  />
                }>
                  <Icon size={20} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
