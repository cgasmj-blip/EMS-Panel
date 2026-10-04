import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Deployed function source is maintained in Supabase. This repository copy documents
// the feature entrypoint; production is notify-new-visitor-request.
Deno.serve(() => new Response(JSON.stringify({ error: "Use deployed Supabase function" }), {
  status: 501,
  headers: { "Content-Type": "application/json" },
}));
