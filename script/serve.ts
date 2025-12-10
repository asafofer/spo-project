const PORT = 3000;

console.log(`Serving static files at http://localhost:${PORT}`);

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    
    // Default to index.html if root is requested
    let path = url.pathname;
    if (path === "/") path = "/index.html";

    // Resolve file relative to the current directory (script/)
    const file = Bun.file(import.meta.dir + path);

    return new Response(file);
  },
  error() {
    return new Response(null, { status: 404 });
  },
});