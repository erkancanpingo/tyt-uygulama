"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKLER = [
  { href: "/", etiket: "Panel" },
  { href: "/gunluk", etiket: "Günlük Giriş" },
  { href: "/rapor", etiket: "Aksama Raporu" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 text-sm">
      {NAV_LINKLER.map((link) => {
        const aktif = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              aktif
                ? "rounded-full bg-neutral-900 px-4 py-1.5 font-medium text-white dark:bg-white dark:text-neutral-900"
                : "rounded-full px-4 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-white"
            }
          >
            {link.etiket}
          </Link>
        );
      })}
    </nav>
  );
}
