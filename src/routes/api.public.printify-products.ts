import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/printify-products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { fetchPrintifyProductById, fetchPrintifyProducts } = await import(
          "@/lib/printify.server"
        );
        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        try {
          const body = id
            ? { product: await fetchPrintifyProductById(id) }
            : { products: await fetchPrintifyProducts() };

          return Response.json(body, {
            headers: {
              "Cache-Control": "no-store, max-age=0",
            },
          });
        } catch (e) {
          console.error("Printify API route failed", e);
          return Response.json(id ? { product: null } : { products: [] }, {
            status: 200,
            headers: {
              "Cache-Control": "no-store, max-age=0",
            },
          });
        }
      },
    },
  },
});