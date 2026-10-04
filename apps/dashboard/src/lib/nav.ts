import { Activity, Boxes, LayoutDashboard, ListChecks } from "@lucide/svelte";
import type { Component } from "svelte";

export interface NavItem {
  href: string;
  /** i18n message key for the label. */
  labelKey: string;
  icon: Component;
  /** Matches nested routes, e.g. `/tasks/:id`. */
  match?: (pathname: string) => boolean;
}

export interface NavCategory {
  /** i18n message key for the group label. */
  labelKey: string;
  items: NavItem[];
}

export const navCategories: NavCategory[] = [
  {
    labelKey: "nav.monitor",
    items: [
      {
        href: "/",
        labelKey: "nav.overview",
        icon: LayoutDashboard,
        match: (p) => p === "/",
      },
      {
        href: "/instances",
        labelKey: "nav.instances",
        icon: Activity,
        match: (p) => p.startsWith("/instances"),
      },
    ],
  },
  {
    labelKey: "nav.configuration",
    items: [
      {
        href: "/tasks",
        labelKey: "nav.tasks",
        icon: ListChecks,
        match: (p) => p.startsWith("/tasks"),
      },
      {
        href: "/strategies",
        labelKey: "nav.strategies",
        icon: Boxes,
        match: (p) => p.startsWith("/strategies"),
      },
    ],
  },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  if (item.href === "/") return pathname === "/";
  return pathname.startsWith(item.href);
}
