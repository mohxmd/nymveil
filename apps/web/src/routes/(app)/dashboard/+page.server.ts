import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

import {
  createIdentityInputSchema,
  domainListResponseSchema,
  identityIdInputSchema,
  identityListResponseSchema,
  identityResponseSchema,
  updateIdentityInputSchema,
} from "$lib/features/identities/schemas";
import { toIsoDateTime } from "$lib/features/identities/dates";
import { ApiRequestError, requestJson } from "$lib/server/api/client";

const actionError = "The request could not be completed. Please try again.";

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseExpiration(formData: FormData): { value?: string | null; error?: string } {
  const rawValue = formData.get("expiresAt");

  if (rawValue === null || rawValue === "") return { value: null };

  const value = toIsoDateTime(rawValue);

  return value === undefined ? { error: "Enter a valid expiration date." } : { value };
}

function actionFailure(action: "create" | "update" | "torch", error: unknown, identityId?: string) {
  if (error instanceof ApiRequestError && error.status === 401) {
    redirect(303, "/login");
  }

  const status =
    error instanceof ApiRequestError && error.status >= 400 && error.status < 500 ? 400 : 503;

  return fail(status, {
    action,
    identityId,
    error: error instanceof ApiRequestError ? error.message : actionError,
  });
}

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const [identityResponse, domainResponse] = await Promise.all([
      requestJson(fetch, "/api/identities", identityListResponseSchema),
      requestJson(fetch, "/api/domains", domainListResponseSchema),
    ]);

    return {
      identities: identityResponse.identities,
      domains: domainResponse.domains,
      loadError: null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      redirect(303, "/login");
    }

    return {
      identities: [],
      domains: [],
      loadError: "We couldn't load your identities right now.",
    };
  }
};

export const actions: Actions = {
  create: async ({ request, fetch }) => {
    const formData = await request.formData();
    const parsedInput = createIdentityInputSchema.safeParse({
      domainId: readText(formData, "domainId"),
      label: readText(formData, "label"),
    });
    const expiration = parseExpiration(formData);

    if (!parsedInput.success || expiration.error) {
      return fail(400, {
        action: "create" as const,
        error: expiration.error ?? "Choose a domain and enter a label.",
      });
    }

    try {
      await requestJson(fetch, "/api/identities", identityResponseSchema, {
        method: "POST",
        body: JSON.stringify({ ...parsedInput.data, expiresAt: expiration.value }),
      });

      return { action: "create" as const, success: true };
    } catch (error) {
      return actionFailure("create", error);
    }
  },

  update: async ({ request, fetch }) => {
    const formData = await request.formData();
    const id = readText(formData, "id");
    const parsedInput = updateIdentityInputSchema.safeParse({
      id,
      label: readText(formData, "label"),
    });
    const expiration = parseExpiration(formData);

    if (!parsedInput.success || expiration.error) {
      return fail(400, {
        action: "update" as const,
        identityId: id,
        error: expiration.error ?? "Enter a valid label.",
      });
    }

    try {
      await requestJson(
        fetch,
        `/api/identities/${encodeURIComponent(parsedInput.data.id)}`,
        identityResponseSchema,
        {
          method: "PATCH",
          body: JSON.stringify({ label: parsedInput.data.label, expiresAt: expiration.value }),
        },
      );

      return { action: "update" as const, identityId: id, success: true };
    } catch (error) {
      return actionFailure("update", error, id);
    }
  },

  torch: async ({ request, fetch }) => {
    const formData = await request.formData();
    const id = readText(formData, "id");
    const parsedInput = identityIdInputSchema.safeParse({ id });

    if (!parsedInput.success) {
      return fail(400, {
        action: "torch" as const,
        identityId: id,
        error: "The identity id is invalid.",
      });
    }

    try {
      await requestJson(
        fetch,
        `/api/identities/${encodeURIComponent(parsedInput.data.id)}/torch`,
        identityResponseSchema,
        {
          method: "POST",
        },
      );

      return { action: "torch" as const, identityId: id, success: true };
    } catch (error) {
      return actionFailure("torch", error, id);
    }
  },
};
