<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import type { Destination, Identity } from "$lib/features/identities/types";
  import type { DeliveryAttempt, DeliveryAttemptStatus, DeliveryFailureCode } from "../types";

  let {
    attempts,
    identities,
    destinations,
  }: {
    attempts: DeliveryAttempt[];
    identities: Identity[];
    destinations: Destination[];
  } = $props();

  const statusLabels: Record<DeliveryAttemptStatus, string> = {
    pending: "Pending",
    succeeded: "Delivered",
    failed: "Failed",
  };

  const statusVariants = {
    pending: "secondary",
    succeeded: "default",
    failed: "destructive",
  } as const;

  const failureMessages: Record<DeliveryFailureCode, string> = {
    configuration_error: "Provider configuration is unavailable.",
    provider_rejected: "The provider rejected the delivery.",
    provider_rate_limited: "The provider rate-limited the delivery.",
    provider_timeout: "The provider timed out.",
    provider_unavailable: "The provider was unavailable.",
    transport_error: "A transport error prevented delivery.",
    unknown: "The delivery failed for an unknown reason.",
  };

  const identityById = $derived(new Map(identities.map((identity) => [identity.id, identity])));
  const destinationById = $derived(
    new Map(destinations.map((destination) => [destination.id, destination])),
  );

  function formatDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Unknown"
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
  }
</script>

<Card>
  <CardHeader>
    <CardTitle>Recent delivery activity</CardTitle>
    <CardDescription>Delivery metadata only. Message content is not shown here.</CardDescription>
  </CardHeader>
  <CardContent>
    {#if attempts.length === 0}
      <p class="text-sm text-muted-foreground">No delivery attempts have been recorded yet.</p>
    {:else}
      <div class="grid gap-3">
        {#each attempts as attempt (attempt.id)}
          {@const identity = identityById.get(attempt.identityId)}
          {@const destination = destinationById.get(attempt.destinationId)}
          <article class="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariants[attempt.status]}>{statusLabels[attempt.status]}</Badge>
                <Badge variant="outline">{attempt.provider}</Badge>
              </div>
              <p class="mt-3 truncate font-medium">
                {identity?.label ?? "Unknown identity"}
              </p>
              <p class="truncate font-mono text-xs text-muted-foreground">
                {identity?.address ?? attempt.identityId}
              </p>
              <p class="mt-2 text-sm text-muted-foreground">
                Destination: {destination?.label ?? attempt.destinationId}
              </p>
              {#if attempt.errorCode}
                <p class="mt-2 text-sm text-destructive">{failureMessages[attempt.errorCode]}</p>
              {/if}
            </div>
            <dl class="grid gap-1 text-sm sm:text-right">
              <div>
                <dt class="inline text-muted-foreground">Attempted: </dt>
                <dd class="inline">{formatDate(attempt.attemptedAt)}</dd>
              </div>
              {#if attempt.completedAt}
                <div>
                  <dt class="inline text-muted-foreground">Completed: </dt>
                  <dd class="inline">{formatDate(attempt.completedAt)}</dd>
                </div>
              {/if}
            </dl>
          </article>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
