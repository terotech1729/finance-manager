import { Icon } from "./Icons";

export type NavItem = {
  href: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => React.ReactElement;
};
export type NavGroup = { title: string; items: NavItem[] };

/** Grouped by area of life rather than by feature, so the finance tools are one part
 *  of the portal rather than the whole of it. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Today",
    items: [
      { href: "/", label: "Home", icon: Icon.Dashboard },
      { href: "/recommend", label: "What should I pay with?", icon: Icon.Zap },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/transactions", label: "Transactions", icon: Icon.Transaction },
      { href: "/bills", label: "Bills", icon: Icon.Card },
      { href: "/spend", label: "Spend analyzer", icon: Icon.Dashboard },
      { href: "/milestones", label: "Milestones", icon: Icon.Sparkles },
    ],
  },
  {
    title: "Travel",
    items: [{ href: "/travel", label: "Trips & routes", icon: Icon.Plane }],
  },
  {
    title: "Notes",
    items: [{ href: "/notes", label: "Notes", icon: Icon.Note }],
  },
  {
    title: "Investing",
    items: [
      { href: "/investments", label: "Holdings", icon: Icon.Trophy },
      { href: "/portfolio", label: "Net worth", icon: Icon.Dashboard },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/cards", label: "Cards", icon: Icon.Card },
      { href: "/claims", label: "Benefit claims", icon: Icon.Sparkles },
      { href: "/debit", label: "Debit & GyFTR", icon: Icon.Trophy },
      { href: "/vouchers", label: "Vouchers & GCs", icon: Icon.Trophy },
      { href: "/cashkaro", label: "Cashkaro rates", icon: Icon.Zap },
      { href: "/network-perks", label: "Network perks", icon: Icon.Plane },
      { href: "/redemptions", label: "Redemptions", icon: Icon.Plane },
      { href: "/settings", label: "Settings", icon: Icon.Settings },
    ],
  },
];

export function isActive(path: string, href: string): boolean {
  return path === href || (href !== "/" && path.startsWith(href));
}

/** Label for the current route — shared by the mobile header and the title bar. */
export function sectionLabelFor(path: string): string {
  return NAV_GROUPS.flatMap((g) => g.items).find((it) => isActive(path, it.href))?.label ?? "Overview";
}
