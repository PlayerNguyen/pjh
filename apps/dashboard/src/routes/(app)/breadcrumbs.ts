export interface Crumb {
  /** i18n message key or literal label. */
  labelKey?: string;
  label?: string;
  href?: string;
}

const segmentLabels: Record<string, string> = {
  tasks: "nav.tasks",
  instances: "nav.instances",
  strategies: "nav.strategies",
};

export function crumbsFor(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ labelKey: "breadcrumb.home", href: "/" }];

  let href = "";
  for (const [index, segment] of segments.entries()) {
    href += `/${segment}`;
    const isLast = index === segments.length - 1;
    const key = segmentLabels[segment];
    crumbs.push(
      key
        ? { labelKey: key, href: isLast ? undefined : href }
        : { label: prettify(segment), href: isLast ? undefined : href },
    );
  }

  return crumbs;
}

export function pageTitleKey(pathname: string): string | undefined {
  if (pathname === "/") return "nav.overview";
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return segmentLabels[last];
}

function prettify(segment: string): string {
  // Shorten opaque ids for readability.
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return segment.slice(0, 8);
  return segment
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
