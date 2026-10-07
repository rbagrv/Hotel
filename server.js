// server.js — websim backend for RB Hotel PMS.
//
// This backend only provides a small identity helper for the project owner to
// sign in. Any persistent document store has been removed: THIS SYSTEM USES
// ONLY Firebase Firestore + local IndexedDB. The websim database (env.DB /
// /api/db) is NEVER used.
//
// Routes:
//   GET    /api/auth/whoami               -> { user_id, username, isOwner }
//
// This file is self-contained: no imports, only the Cloudflare Workers API.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- Identity helper ----
    if (request.method === "GET" && path === "/api/auth/whoami") {
      const userId = request.headers.get("x-websim-user-id") || null;
      const username = request.headers.get("x-websim-username") || null;
      const ownerId = request.headers.get("x-websim-project-owner-id") || null;
      return Response.json({
        user_id: userId,
        username,
        isOwner: !!(userId && userId === ownerId),
      });
    }

    return new Response("Not found", { status: 404 });
  },
};