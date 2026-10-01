"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

import { money } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import Suppliers from "./suppliers";

// Types

type Customer = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
  state: string;
};

type OrderItem = {
  id: string;
  name: string;
  option: string;
  qty: number;
  priceCents: number;
};

type Order = {
  id: string;
  customer: Customer;
  items: OrderItem[];
  total: number;
  status: string;
  tracking: string;
  createdAt: string;
};

// Allowed order status changes

const nextStatuses: Record<string, string[]> = {
  test_received: ["test_processing", "test_cancelled"],
  test_processing: ["test_shipped", "test_cancelled"],
  test_shipped: ["test_delivered"],
  test_delivered: [],
  test_cancelled: [],
};

function formatStatus(status: string) {
  return status.replace("test_", "").replaceAll("_", " ");
}

export default function Admin() {
  // Page state

  const [orders, setOrders] = useState<Order[]>([]);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Load orders

  async function loadOrders() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/orders", {
        cache: "no-store",
      });

      const data = await response.json();

      if (response.status === 401) {
        setAuthed(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error);
      }

      setOrders(data.orders);
      setAuthed(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to load orders.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  // Admin sign-in

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    setBusy(true);
    setError("");

    try {
      const formData = new FormData(form);
      const key = formData.get("key");

      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      form.reset();
      await loadOrders();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  // Update an order

  async function updateOrder(
    event: FormEvent<HTMLFormElement>,
    orderId: string,
  ) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: orderId,
          status: formData.get("status"),
          tracking: formData.get("tracking") || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      await loadOrders();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update order.",
      );
    } finally {
      setBusy(false);
    }
  }

  // Admin sign-out

  async function logout() {
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sign-out failed.");
      }

      setAuthed(false);
      setOrders([]);
    } catch {
      setError("Could not sign out. Please try again.");
    }
  }

  return (
    <>
      <div className="announcement">
        Local test admin · No live payments or supplier fulfilment
      </div>

      <header className="flex flex-wrap items-center justify-between gap-5 border-b px-[5%] py-5 lg:gap-7 lg:py-6">
        <Link className="brand" href="/">
          yuwazac
          <span>style.</span>
        </Link>

        <Link href="/">← Storefront</Link>

        {authed && (
          <button type="button" className="text-link" onClick={logout}>
            Sign out
          </button>
        )}
      </header>

      <main className="admin mx-auto my-10 w-full max-w-[1100px] px-4 sm:px-6">
        <h1>Store admin</h1>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {loading && <p role="status">Loading…</p>}

        {/* Sign-in form */}

        {!loading && !authed && (
          <form className="login-form" onSubmit={login}>
            <h2>Sign in locally</h2>

            <p>
              Use the ADMIN_KEY generated in your private .env.local file by npm
              run setup.
            </p>

            <label>
              Admin key
              <input
                type="password"
                name="key"
                required
                autoComplete="current-password"
              />
            </label>

            <Button type="submit" disabled={busy} variant="store">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}

        {/* Admin dashboard */}

        {!loading && authed && (
          <>
            <Suppliers />

            <div className="section-heading">
              <h2>Test orders ({orders.length})</h2>

              <button type="button" className="text-link" onClick={loadOrders}>
                Refresh
              </button>
            </div>

            {orders.length === 0 && (
              <div className="empty">
                <h3>No orders yet.</h3>
                <p>Place a test order from the storefront, then refresh.</p>
              </div>
            )}

            {orders.map((order) => {
              const availableStatuses = nextStatuses[order.status] ?? [];

              return (
                <article className="order-card" key={order.id}>
                  <div className="section-heading">
                    <h3>
                      {order.customer.name} · {money(order.total)}
                    </h3>

                    <span className="order-status">
                      Test · {formatStatus(order.status)}
                    </span>
                  </div>

                  <p className="order-id">{order.id}</p>

                  <p className="muted">
                    {new Date(order.createdAt).toLocaleString()}
                    {" · "}
                    Payment simulated · Supplier not submitted
                  </p>

                  {/* Ordered products */}

                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id + item.option}>
                        {item.qty} × {item.name}
                        {" · "}
                        {item.option}
                        {" · "}
                        {money(item.priceCents)}
                      </li>
                    ))}
                  </ul>

                  {/* Customer delivery details */}

                  <details>
                    <summary>Delivery details</summary>

                    <p>
                      {order.customer.address}, {order.customer.postcode}{" "}
                      {order.customer.city}, {order.customer.state}, Malaysia
                    </p>

                    <p>
                      {order.customer.email}
                      {" · "}
                      {order.customer.phone}
                    </p>
                  </details>

                  {order.tracking && <p>Test tracking: {order.tracking}</p>}

                  {/* Order status update form */}

                  {availableStatuses.length > 0 && (
                    <form
                      className="order-update grid grid-cols-1 items-end gap-x-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"
                      onSubmit={(event) => updateOrder(event, order.id)}
                    >
                      <label>
                        Next test status
                        <select className="store-select" name="status">
                          {availableStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatStatus(status)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Test tracking reference
                        <input
                          name="tracking"
                          maxLength={100}
                          placeholder="Required for shipped"
                        />
                      </label>

                      <Button type="submit" disabled={busy} variant="store">
                        Update
                      </Button>
                    </form>
                  )}
                </article>
              );
            })}
          </>
        )}
      </main>
    </>
  );
}
