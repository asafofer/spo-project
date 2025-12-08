// Mock endpoint server for collecting Prebid events (Bun + TypeScript)
import { initDatabase, saveEvents } from "./db/db";

const PORT = 3001;

interface PrebidEvent {
  eventType: string;
  [key: string]: any;
}

interface ServerResponse {
  success: boolean;
  received?: number;
  error?: string;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    // Enable CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/events") {
      try {
        const events = (await req.json()) as PrebidEvent[];
        console.log("[Server] Received events:", events.length);

        events.forEach((event: PrebidEvent, index: number) => {
          console.log(
            `[Server Event ${index + 1}] ${event.eventType}:`,
            JSON.stringify(event, null, 2)
          );
        });

        // Save events to database
        try {
          await saveEvents(events);
        } catch (dbError) {
          console.error("[Server] Error saving to database:", dbError);
        }

        const response: ServerResponse = {
          success: true,
          received: events.length,
        };

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[Server] Error parsing events:", error);
        const response: ServerResponse = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };

        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const response: ServerResponse = {
      success: false,
      error: "Not found",
    };

    return new Response(JSON.stringify(response), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
});

// Initialize database on startup
initDatabase()
  .then(() => {
    console.log(
      `[Server] Mock endpoint listening on http://localhost:${PORT}/events`
    );
  })
  .catch((error) => {
    console.error("[Server] Failed to initialize database:", error);
    process.exit(1);
  });
