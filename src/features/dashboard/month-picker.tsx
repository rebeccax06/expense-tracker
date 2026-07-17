"use client";

import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";

export function MonthPicker({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Input
      type="month"
      value={month.slice(0, 7)}
      onChange={(e) => {
        const v = e.target.value;
        if (v) router.push(`${pathname}?month=${v}-01`);
      }}
      className="w-auto"
    />
  );
}
