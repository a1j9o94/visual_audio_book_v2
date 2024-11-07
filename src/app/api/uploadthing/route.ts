import { createRouteHandler } from "uploadthing/next";
import { uploadRouter } from "~/server/storage";

// Export routes for Next.js App Router
export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
}); 