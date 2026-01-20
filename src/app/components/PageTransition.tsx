"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(false);
  }, [pathname]);

  const handleNavigation = (href: string) => {
    if (href !== pathname) {
      setIsTransitioning(true);
      setTimeout(() => {
        router.push(href);
      }, 300);
    }
  };

  return (
    <div
      style={{
        opacity: isTransitioning ? 0 : 1,
        transition: "opacity 0.3s ease-in-out",
      }}
    >
      {children}
    </div>
  );
}
