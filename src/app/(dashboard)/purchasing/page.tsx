"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";
import { PDFButton } from "./PDFButton";

interface Booking {
  id: string;
  qty: number;
  replacement_qty: number;
  rate_snapshot: number;
  total_amount: number;
  booking_amount: number;
  balance_amount: number;
  created_at: string;
  farmer: {
    id: string;
    name: string;
    unique_id: string;
    phone: string;
    address: string;
  };
  item: {
    id: string;
    name: string;
    rate_per_unit: number;
  };
}

export default function PurchasingPage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(false);
    setBookings([]);

    try {
      const res = await fetch(
        `/api/purchasing/search?q=${encodeURIComponent(query.trim())}`
      );
      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error ?? `Server returned ${res.status}`);
      } else {
        setBookings(json.bookings ?? []);
        setSearched(true);
      }
    } catch (err: any) {
      setError(err?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearched(false);
    setBookings([]);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Purchasing &amp; Delivery</h1>

      <Card>
        <CardHeader>
          <CardTitle>Search Farmer</CardTitle>
          <CardDescription>
            Enter the last 3 digits of the Farmer&apos;s Token ID to locate their
            pending order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 012"
                className="pl-10 text-lg"
                pattern="\d{1,4}"
                title="Enter digit ID"
                required
              />
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Find Order"
              )}
            </Button>
            {(searched || error) && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleClear}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {searched && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Search Results</h2>
          {bookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {bookings.map((b) => (
                <Card key={b.id} className="border-l-4 border-l-yellow-400">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-lg flex justify-between">
                      {b.farmer?.name}
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {b.farmer?.unique_id}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div className="text-gray-500">Item:</div>
                      <div className="font-medium text-right">
                        {b.item?.name}
                      </div>

                      <div className="text-gray-500">Rate (at booking):</div>
                      <div className="font-medium text-right text-gray-700 font-mono">
                        &#8377;{b.rate_snapshot || (b.qty ? (b.total_amount / b.qty) : b.item?.rate_per_unit)}
                        {b.rate_snapshot > 0 && b.rate_snapshot !== b.item?.rate_per_unit && (
                          <span className="ml-1 text-xs text-amber-600" title="Rate has changed since booking">
                            ⚠️ current: ₹{b.item?.rate_per_unit}
                          </span>
                        )}
                      </div>

                      <div className="text-gray-500">Ordered Qty:</div>
                      <div className="font-medium text-right">{b.qty}</div>

                      {(b.replacement_qty ?? 0) > 0 && (
                        <>
                          <div className="text-emerald-600 text-xs">🌱 Replacement (free):</div>
                          <div className="text-right text-emerald-600 text-xs font-medium">+{b.replacement_qty}</div>
                          <div className="text-gray-500 text-xs">Total Delivered:</div>
                          <div className="text-right text-xs font-semibold">{b.qty + (b.replacement_qty ?? 0)}</div>
                        </>
                      )}
                    </div>

                    <div className="border-t pt-3 grid grid-cols-2 gap-y-2 text-sm">
                      <div className="text-gray-500">Total Amount:</div>
                      <div className="text-right font-mono">
                        &#8377;{b.total_amount}
                      </div>

                      <div className="text-gray-500">Advance (10%):</div>
                      <div className="text-right text-green-700 font-mono">
                        - &#8377;{b.booking_amount}
                      </div>

                      <div className="text-gray-900 font-bold mt-2">
                        Balance Due:
                      </div>
                      <div className="text-right text-lg font-bold text-red-600 font-mono mt-2">
                        &#8377;{b.balance_amount}
                      </div>
                    </div>

                    <div className="pt-4">
                      <PDFButton booking={b} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border rounded border-dashed text-gray-500">
              No pending orders found for Farmer ID ending in &quot;{query}&quot;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
