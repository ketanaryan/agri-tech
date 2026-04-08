"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

interface FarmerSearchInputProps {
  defaultValue?: string;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
}

export function FarmerSearchInput({
  defaultValue = "",
  placeholder = "Search by name or farmer ID…",
  totalCount,
  filteredCount,
}: FarmerSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  const updateUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    updateUrl(val);
  };

  const handleClear = () => {
    setQuery("");
    updateUrl("");
  };

  const isSearching = !!query;

  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      <div className="relative">
        <Search
          className={`absolute left-3 top-2.5 h-4 w-4 transition-colors ${
            isPending ? "text-green-500 animate-pulse" : "text-gray-400"
          }`}
        />
        <Input
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="pl-9 pr-9 h-9 text-sm"
          id="farmer-search"
        />
        {isSearching && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-0.5 h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Result hint */}
      {isSearching && filteredCount !== undefined && totalCount !== undefined && (
        <p className="text-xs text-gray-500">
          {filteredCount === 0 ? (
            <span className="text-orange-500">No farmers match &ldquo;{query}&rdquo;</span>
          ) : (
            <>
              <span className="font-medium text-green-700">{filteredCount}</span> of {totalCount} farmers
            </>
          )}
        </p>
      )}
    </div>
  );
}
