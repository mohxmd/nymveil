import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

import {
  createIdentityInputSchema,
  destinationListResponseSchema,
  destinationResponseSchema,
  destinationToggleInputSchema,
  domainListResponseSchema,
  identityIdInputSchema,
  identityDestinationListResponseSchema,
  identityListResponseSchema,
  identityResponseSchema,
  identityRouteInputSchema,
  routeResponseSchema,
  updateIdentityInputSchema,
} from "$lib/features/identities/schemas";
import { deliveryAttemptListResponseSchema } from "$lib/features/delivery/schemas";
import type { DeliveryAttempt } from "$lib/features/delivery/types";
import { toIsoDateTime } from "$lib/features/identities/dates";
import type { IdentityDestinationOption, IdentityFormAction } from "$lib/features/identities/types";
import { ApiRequestError, requestJson } from "$lib/server/api/client";

const actionError = "The request could not be completed. Please try again.";
const emptyIdentityDestinations: Record<string, IdentityDestinationOption[]> = {};

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readBoolean(formData: FormData, name: string): boolean | undefined {
  const value = formData.get(name);

  if (value === "true") return true;
  if (value === "false") return false;

  return undefined;
}

function parseExpiration(formData: FormData): { value?: string | null; error?: string } {
  const rawValue = formData.get("expiresAt");

  if (rawValue === null || rawValue === "") return { value: null };

  const value = toIsoDateTime(rawValue);

  return value === undefined ? { error: "Enter a valid expiration date." } : { value };
}

function actionFailure(
  action: IdentityFormAction,
  error: unknown,
  identityId?: string,
  destinationId?: string,
) {
  if (error instanceof ApiRequestError && error.status === 401) {
    redirect(303, "/login");
  }

  const status =
    error instanceof ApiRequestError && error.status >= 400 && error.status < 500 ? 400 : 503;

  return fail(status, {
    action,
    identityId,
    destinationId,
    error: error instanceof ApiRequestError ? error.message : actionError,
  });
}

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const [identityResponse, domainResponse, destinationResponse] = await Promise.all([
      requestJson(fetch, "/api/identities", identityListResponseSchema),
      requestJson(fetch, "/api/domains", domainListResponseSchema),
      requestJson(fetch, "/api/destinations", destinationListResponseSchema),
    ]);
    let deliveryAttempts: DeliveryAttempt[] = [];
    let deliveryError: string | null = null;

    try {
      const deliveryResponse = await requestJson(
        fetch,
        "/api/delivery-attempts?limit=50",
        deliveryAttemptListResponseSchema,
      );
      deliveryAttempts = deliveryResponse.attempts;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        redirect(303, "/login");
      }

      deliveryError = "We couldn't load delivery activity right now.";
    }
    const identityDestinations = await Promise.all(
      identityResponse.identities.map(async (identity) => {
        const response = await requestJson(
          fetch,
          `/api/identities/${encodeURIComponent(identity.id)}/destinations`,
          identityDestinationListResponseSchema,
        );

        return [identity.id, response.destinations] as const;
      }),
    );

    const identityDestinationsById: Record<string, IdentityDestinationOption[]> =
      Object.fromEntries(identityDestinations);

    return {
      identities: identityResponse.identities,
      domains: domainResponse.domains,
      destinations: destinationResponse.destinations,
      identityDestinations: identityDestinationsById,
      deliveryAttempts,
      deliveryError,
      loadError: null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      redirect(303, "/login");
    }

    return {
      identities: [],
      domains: [],
      destinations: [],
      identityDestinations: emptyIdentityDestinations,
      deliveryAttempts: [],
      deliveryError: null,
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

  "toggle-destination": async ({ request, fetch }) => {
    const formData = await request.formData();
    const parsedInput = destinationToggleInputSchema.safeParse({
      id: readText(formData, "destinationId"),
      enabled: readBoolean(formData, "enabled"),
    });

    if (!parsedInput.success) {
      return fail(400, {
        action: "toggle-destination" as const,
        destinationId: readText(formData, "destinationId"),
        error: "The destination setting is invalid.",
      });
    }

    try {
      await requestJson(
        fetch,
        `/api/destinations/${encodeURIComponent(parsedInput.data.id)}`,
        destinationResponseSchema,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled: parsedInput.data.enabled }),
        },
      );

      return {
        action: "toggle-destination" as const,
        destinationId: parsedInput.data.id,
        success: true,
      };
    } catch (error) {
      return actionFailure("toggle-destination", error, undefined, parsedInput.data.id);
    }
  },

  "toggle-route": async ({ request, fetch }) => {
    const formData = await request.formData();
    const parsedInput = identityRouteInputSchema.safeParse({
      identityId: readText(formData, "identityId"),
      destinationId: readText(formData, "destinationId"),
      selected: readBoolean(formData, "selected") ?? false,
    });

    if (!parsedInput.success) {
      return fail(400, {
        action: "toggle-route" as const,
        identityId: readText(formData, "identityId"),
        destinationId: readText(formData, "destinationId"),
        error: "The identity route setting is invalid.",
      });
    }

    const path = `/api/identities/${encodeURIComponent(parsedInput.data.identityId)}/destinations/${encodeURIComponent(parsedInput.data.destinationId)}`;

    try {
      await requestJson(fetch, path, routeResponseSchema, {
        method: parsedInput.data.selected ? "PUT" : "DELETE",
      });

      return {
        action: "toggle-route" as const,
        identityId: parsedInput.data.identityId,
        destinationId: parsedInput.data.destinationId,
        success: true,
      };
    } catch (error) {
      return actionFailure(
        "toggle-route",
        error,
        parsedInput.data.identityId,
        parsedInput.data.destinationId,
      );
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
