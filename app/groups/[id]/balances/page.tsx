"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import SFLoaderOverlay from "@/components/SFLoaderOverlay";

type Balance = {
  userId: string;
  name: string;
  netPaise: number;
};

type Payment = {
  payer: Balance;
  receiver: Balance;
  amountPaise: number;
};

export default function BalancesPage() {
  const { id } = useParams();

  const [balances, setBalances] = useState<Balance[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [meResponse, balancesResponse, recurringResponse] = await Promise.all([
        fetch("/api/me"),
        fetch(`/api/groups/${id}/balances`),
        // Same endpoint the group and /recurring pages read from — shown
        // here as a read-only list so an upcoming/active recurring charge
        // is visible even before it's generated a real expense (which is
        // what actually moves these balances).
        fetch(`/api/groups/${id}/recurring`),
      ]);

      const me = await meResponse.json();
      const balanceData = await balancesResponse.json();

      setCurrentUserId(me.userId);
      setBalances(balanceData);
      if (recurringResponse.ok) setRecurringTemplates(await recurringResponse.json());
    } catch (error) {
      console.error("Failed to load balances:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();

    // Refetch balances immediately when the user comes back to this
    // tab/page — e.g. after running due recurring expenses, or
    // pausing/deleting a template, on /recurring, or after settling a
    // payment on /settle, either of which can change who owes whom.
    // Mirrors the same refetch-on-focus pattern used on the group and
    // settle pages so this page doesn't show stale numbers.
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        loadData();
      }
    }
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    return () => {
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
    };
  }, [loadData]);

  const creditors = balances.filter((b) => b.netPaise > 0);
  const debtors = balances.filter((b) => b.netPaise < 0);
  const settled = balances.filter((b) => b.netPaise === 0);

  function formatAmount(paise: number) {
    return `₹${(Math.abs(paise) / 100).toFixed(2)}`;
  }

  function displayName(user: Balance) {
    return user.userId === currentUserId
      ? `${user.name} (me)`
      : user.name;
  }

  /**
   * Calculate who pays whom.
   */
  function calculatePayments(): Payment[] {
    const debtorsCopy = debtors.map((user) => ({
      ...user,
      remaining: Math.abs(user.netPaise),
    }));

    const creditorsCopy = creditors.map((user) => ({
      ...user,
      remaining: user.netPaise,
    }));

    const payments: Payment[] = [];

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (
      debtorIndex < debtorsCopy.length &&
      creditorIndex < creditorsCopy.length
    ) {
      const debtor = debtorsCopy[debtorIndex];
      const creditor = creditorsCopy[creditorIndex];

      const amount = Math.min(
        debtor.remaining,
        creditor.remaining
      );

      if (amount > 0) {
        payments.push({
          payer: debtor,
          receiver: creditor,
          amountPaise: amount,
        });
      }

      debtor.remaining -= amount;
      creditor.remaining -= amount;

      if (debtor.remaining === 0) {
        debtorIndex++;
      }

      if (creditor.remaining === 0) {
        creditorIndex++;
      }
    }

    return payments;
  }

  const payments = calculatePayments();

  function getPaymentDescription(
    payer: Balance,
    receiver: Balance,
    amountPaise: number
  ) {
    const payerIsMe = payer.userId === currentUserId;
    const receiverIsMe = receiver.userId === currentUserId;

    if (payerIsMe) {
      return `You need to pay ${receiver.name} ${formatAmount(
        amountPaise
      )}`;
    }

    if (receiverIsMe) {
      return `${payer.name} needs to pay you ${formatAmount(
        amountPaise
      )}`;
    }

    return `${payer.name} needs to pay ${
      receiver.name
    } ${formatAmount(amountPaise)}`;
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <SFLoaderOverlay visible={loading} label="Loading balances" />

      <div className="mx-auto w-full max-w-xl px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Who owes what
            </h1>
            <RefreshButton onRefresh={loadData} label="Refreshing balances" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/groups/${id}`}
              className="text-gray-500 transition hover:text-gray-900"
            >
              ← Back to group
            </Link>

            <span className="text-gray-300">|</span>

            <Link
              href={`/groups/${id}/settle`}
              className="text-gray-500 transition hover:text-gray-900"
            >
              Settle up →
            </Link>

            <span className="text-gray-300">|</span>

            <Link
              href={`/groups/${id}/recurring`}
              className="text-gray-500 transition hover:text-gray-900"
            >
              Recurring expenses
            </Link>
          </div>
        </div>

        {/* Active recurring templates — read-only, informational only.
            These haven't generated a real expense yet, so they don't
            affect the balances above; this just makes sure an upcoming
            recurring charge isn't a surprise. */}
        {recurringTemplates.filter((t: any) => t.active).length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
              Upcoming recurring charges
            </p>
            <div className="flex flex-col gap-1.5">
              {recurringTemplates
                .filter((t: any) => t.active)
                .map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900">{t.description}</span>
                    <span className="text-gray-500">
                      ₹{(t.amountPaise / 100).toFixed(2)}
                      {t.nextRunAt && ` · next run ${new Date(t.nextRunAt).toLocaleDateString()}`}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Everyone settled */}
        {balances.length > 0 &&
          creditors.length === 0 &&
          debtors.length === 0 && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
              <p className="text-lg font-semibold text-green-800">
                🎉 Everyone is settled up!
              </p>

              <p className="mt-1 text-sm text-green-700">
                No one owes anything right now.
              </p>
            </div>
          )}

        {/* ============================= */}
        {/* TO PAY */}
        {/* ============================= */}

        {payments.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              To pay
            </h2>

            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {payments.map((payment, index) => {
                const {
                  payer,
                  receiver,
                  amountPaise,
                } = payment;

                const payerIsMe =
                  payer.userId === currentUserId;

                const receiverIsMe =
                  receiver.userId === currentUserId;

                return (
                  <div
                    key={`${payer.userId}-${receiver.userId}-${index}`}
                    className="py-5"
                  >
                    {/* Person → pays → Person */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <strong className="text-gray-900">
                          {payerIsMe
                            ? `${payer.name} (me)`
                            : payer.name}
                        </strong>

                        <span className="text-gray-400">
                          →
                        </span>

                        <span className="text-xs font-medium text-gray-500">
                          pays
                        </span>

                        <span className="text-gray-400">
                          →
                        </span>

                        <strong className="text-gray-900">
                          {receiverIsMe
                            ? `${receiver.name} (me)`
                            : receiver.name}
                        </strong>
                      </div>

                      {/* Always negative because this is a payment */}
                      <span className="shrink-0 text-base font-bold text-red-500">
                        -{formatAmount(amountPaise)}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="mt-1.5 text-xs leading-5 text-gray-500">
                      {getPaymentDescription(
                        payer,
                        receiver,
                        amountPaise
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ============================= */}
        {/* TO RECEIVE */}
        {/* ============================= */}

        {creditors.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              To receive money
            </h2>

            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {creditors.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between gap-4 py-5"
                >
                  <div className="min-w-0">
                    <strong className="text-sm text-gray-900">
                      {displayName(user)}
                    </strong>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Paid more than their share — others owe
                      them
                    </p>
                  </div>

                  <span className="shrink-0 text-base font-bold text-green-600">
                    +{formatAmount(user.netPaise)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============================= */}
        {/* SETTLED */}
        {/* ============================= */}

        {settled.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              Settled up
            </h2>

            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {settled.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between py-4 text-sm opacity-50"
                >
                  <span>{displayName(user)}</span>

                  <span className="text-gray-500">
                    ✓ all clear
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============================= */}
        {/* SUMMARY */}
        {/* ============================= */}

        {(creditors.length > 0 ||
          debtors.length > 0) && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-sm font-semibold text-gray-900">
              How to read this
            </p>

            <p className="mt-2 text-xs leading-5 text-gray-500">
              <span className="font-semibold text-green-600">
                Green (+)
              </span>{" "}
              = this person is owed money.
            </p>

            <p className="mt-2 text-xs leading-5 text-gray-500">
              <span className="font-semibold text-red-500">
                Red (-)
              </span>{" "}
              = this person needs to pay.
            </p>

            <p className="mt-2 text-xs leading-5 text-gray-500">
              Go to{" "}
              <strong className="text-gray-700">
                Settle up
              </strong>{" "}
              to record payments and clear balances.
            </p>
          </div>
        )}

        {/* ============================= */}
        {/* NO DATA */}
        {/* ============================= */}

        {!loading && balances.length === 0 && (
          <div className="mt-6 rounded-xl border border-gray-200 p-5 text-sm text-gray-500">
            No balance information available.
          </div>
        )}
      </div>
    </main>
  );
}