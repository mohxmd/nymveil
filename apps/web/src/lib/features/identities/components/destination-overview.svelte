<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import type { Destination, IdentityFormState } from "../types";

  let {
    destinations,
    form,
  }: {
    destinations: Destination[];
    form: IdentityFormState | null | undefined;
  } = $props();

  let submittingId = $state<string | null>(null);
  const destinationError = $derived(
    form?.action === "toggle-destination" ? form.error : undefined,
  );

  const trackSubmission: SubmitFunction = ({ formData }) => {
    const destinationId = formData.get("destinationId");
    submittingId = typeof destinationId === "string" ? destinationId : null;

    return async ({ update }) => {
      await update();
      submittingId = null;
    };
  };
</script>

<Card>
  <CardHeader>
    <CardTitle>Destinations</CardTitle>
    <CardDescription>Choose which connected services can receive routed messages.</CardDescription>
  </CardHeader>
  <CardContent>
    {#if destinations.length === 0}
      <p class="text-sm text-muted-foreground">
        No destinations are connected yet. Provider connection setup will appear here when available.
      </p>
    {:else}
      <div class="grid gap-3">
        {#each destinations as destination (destination.id)}
          <div class="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium">{destination.label}</p>
                <Badge variant="outline">{destination.provider}</Badge>
                {#if !destination.available}
                  <Badge variant="destructive">Unavailable</Badge>
                {/if}
              </div>
              <p class="mt-1 text-sm text-muted-foreground">
                {#if destination.available}
                  This destination is ready to receive routed messages.
                {:else}
                  Provider configuration is unavailable. Connect it before relying on this destination.
                {/if}
              </p>
              {#if destinationError && form?.destinationId === destination.id}
                <p class="mt-2 text-sm text-destructive" role="alert">{destinationError}</p>
              {/if}
            </div>

            <form method="POST" action="?/toggle-destination" use:enhance={trackSubmission}>
              <input type="hidden" name="destinationId" value={destination.id} />
              <input type="hidden" name="enabled" value={destination.enabled ? "false" : "true"} />
              <Button
                type="submit"
                variant={destination.enabled ? "outline" : "secondary"}
                disabled={submittingId === destination.id}
              >
                {#if submittingId === destination.id}
                  Saving…
                {:else if destination.enabled}
                  Disable
                {:else}
                  Enable
                {/if}
              </Button>
            </form>
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
