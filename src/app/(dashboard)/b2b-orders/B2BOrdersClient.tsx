"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { createB2BOrderAction, updateB2BOrderPaymentAction, updateB2BOrderStatusAction } from "@/actions/b2b";

interface B2BOrdersClientProps {
  orders: any[];
  inventory: any[];
  userRole: string;
  userId: string;
}

export default function B2BOrdersClient({ orders, inventory, userRole, userId }: B2BOrdersClientProps) {
  const [selectedPesticide, setSelectedPesticide] = useState("");
  const [qty, setQty] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPesticide || !qty || parseInt(qty) <= 0) {
      alert("Select a pesticide and valid quantity.");
      return;
    }
    
    setIsSubmitting(true);
    const fd = new FormData();
    fd.append("pesticide_id", selectedPesticide);
    fd.append("qty", qty);
    
    const res = await createB2BOrderAction(fd);
    setIsSubmitting(false);
    
    if (res.error) {
      alert("Error: " + res.error);
    } else {
      alert("Your bulk order has been successfully placed.");
      setQty("");
      setSelectedPesticide("");
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    const res = await updateB2BOrderStatusAction(orderId, status);
    if (res.error) alert("Error: " + res.error);
  };

  const handleAddPayment = async (orderId: string, maxAmount: number) => {
    const amtStr = prompt(`Enter payment amount to record (Max: ₹${maxAmount}):`);
    if (!amtStr) return;
    const amt = parseInt(amtStr);
    if (isNaN(amt) || amt <= 0 || amt > maxAmount) {
      alert("Invalid Amount");
      return;
    }

    const res = await updateB2BOrderPaymentAction(orderId, amt);
    if (res.error) alert("Error: " + res.error);
  };

  return (
    <div className="space-y-6">
      {/* Place Order Section */}
      {(userRole === "Dealer" || userRole === "SuperDistributor") && (
        <Card>
          <CardHeader>
            <CardTitle>Place New Bulk Order</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePlaceOrder} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Pesticide / Fertilizer</label>
                <Select value={selectedPesticide} onValueChange={(val) => setSelectedPesticide(val || "")} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Product" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} - ₹{item.rate_per_unit}/unit
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-32">
                <label className="text-sm font-medium">Quantity</label>
                <Input 
                  type="number" 
                  min="1" 
                  value={qty} 
                  onChange={(e) => setQty(e.target.value)} 
                  placeholder="Qty" 
                  required 
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Place Order
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order Details</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Amount & Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const isSeller = (userRole === "Admin" && !order.seller_id) || order.seller_id === userId;
                  const isPending = order.status === "Pending";
                  const balance = Number(order.balance_amount);

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm">
                        {new Date(order.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.pesticide?.name}</div>
                        <div className="text-xs text-gray-500">Qty: {order.qty} @ ₹{order.rate_snapshot}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {isSeller ? (order.buyer?.name || "Unknown") : "Me"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isSeller ? (order.buyer?.role || "Buyer") : "Placed to " + (order.seller?.name || "Super Admin")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono font-medium">Total: ₹{Number(order.total_amount).toLocaleString()}</div>
                        {balance > 0 ? (
                          <div className="text-xs text-red-600 font-mono mt-0.5">Bal: ₹{balance.toLocaleString()}</div>
                        ) : (
                          <div className="text-xs text-green-700 font-mono mt-0.5">Paid In Full</div>
                        )}
                        <span className={`inline-block px-2 py-0.5 mt-2 text-xs font-medium rounded-full border ${
                          order.status === "Pending" ? "border-yellow-400 text-yellow-700 bg-yellow-50" :
                          order.status === "Dispatched" ? "border-blue-400 text-blue-700 bg-blue-50" :
                          order.status === "Completed" ? "border-green-400 text-green-700 bg-green-50" : "border-gray-400"
                        }`}>
                          {order.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {isSeller && isPending && (
                            <Button size="sm" onClick={() => handleUpdateStatus(order.id, "Dispatched")}>
                              Dispatch
                            </Button>
                          )}
                          {!isSeller && order.status === "Dispatched" && (
                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(order.id, "Completed")}>
                              Mark Received
                            </Button>
                          )}
                          {isSeller && balance > 0 && (
                            <Button size="sm" variant="secondary" onClick={() => handleAddPayment(order.id, balance)}>
                              Record Payment
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                      No B2B orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
