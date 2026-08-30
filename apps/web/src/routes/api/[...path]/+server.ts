import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { PUBLIC_SERVER_URL } from "$env/static/public";

function createApiUrl(event: RequestEvent): URL {
  const path = event.params.path;

  if (!path) {
    throw new Error("An API path is required.");
  }

  const target = new URL(`/api/${path}`, PUBLIC_SERVER_URL);
  target.search = event.url.search;
  return target;
}

const proxy: RequestHandler = async (event) => {
  const headers = new Headers(event.request.headers);
  headers.delete("host");

  const response = await event.fetch(createApiUrl(event), {
    method: event.request.method,
    headers,
    body: ["GET", "HEAD"].includes(event.request.method) ? undefined : event.request.body,
    redirect: "manual",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
