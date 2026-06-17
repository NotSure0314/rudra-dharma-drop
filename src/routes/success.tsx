import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { fulfillCheckout } from "@/lib/stripe.functions";

const searchSchema = z.object({
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/success")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Order Received — Rudra" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuccessPage,
  errorComponent: ({ reset }) => (
    <FallbackMessage title="Something went wrong" reset={reset} />
  ),
  notFoundComponent: () => <FallbackMessage title="Order not found" />,
});

function SuccessPage() {
  const { session_id } = Route.useSearch();
  const fulfill = useServerFn(fulfillCheckout);
  const m = useMutation({
    mutationFn: (sid: string) => fulfill({ data: { session_id: sid } }),
  });

  useEffect(() => {
    if (session_id) {
      try {
        localStorage.removeItem("rudra_cart_v1");
      } catch {}
      m.mutate(session_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id]);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center border border-border bg-card p-10">
        <p className="font-display text-5xl text-amber mb-6">॥ ॐ ॥</p>
        <h1 className="font-display text-3xl text-bone mb-4">
          Your offering is received
        </h1>
        {!session_id && (
          <p className="text-muted-foreground text-sm">
            No checkout session was provided.
          </p>
        )}
        {m.isPending && (
          <p className="text-muted-foreground text-sm">Sealing the order…</p>
        )}
        {m.isSuccess && (
          <>
            <p className="text-bone text-sm mt-2">
              Payment confirmed. We've passed your order to the artisans.
            </p>
            {m.data?.orderId && (
              <p className="text-muted-foreground text-xs mt-3">
                Order #{m.data.orderId.slice(0, 8)}
              </p>
            )}
          </>
        )}
        {m.isError && (
          <p className="text-destructive text-xs mt-2">
            {(m.error as Error)?.message ?? "Could not finalize the order"}
          </p>
        )}
        <Link
          to="/"
          className="inline-block mt-10 border border-amber text-amber px-8 py-3 text-xs uppercase tracking-[0.3em] hover:bg-amber hover:text-primary-foreground transition-colors"
        >
          Return to the temple
        </Link>
      </div>
    </main>
  );
}

function FallbackMessage({ title, reset }: { title: string; reset?: () => void }) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="font-display text-2xl text-bone mb-4">{title}</h1>
        <div className="flex gap-3 justify-center">
          {reset && (
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="border border-border text-bone px-6 py-2 text-xs uppercase tracking-[0.3em]"
            >
              Try again
            </button>
          )}
          <Link
            to="/"
            className="border border-amber text-amber px-6 py-2 text-xs uppercase tracking-[0.3em]"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
