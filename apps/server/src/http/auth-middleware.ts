import { ApiError } from "./errors";
import { serverFactory, type AuthInstance } from "./types";

export function requireSession(auth: AuthInstance) {
  return serverFactory.createMiddleware(async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      throw new ApiError("unauthenticated", 401, "Authentication is required.");
    }

    c.set("session", session);
    c.set("user", session.user);
    await next();
  });
}
