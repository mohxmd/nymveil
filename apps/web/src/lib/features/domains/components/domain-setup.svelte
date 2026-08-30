<script lang="ts">
  import { enhance } from "$app/forms";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { Domain, DomainFormState } from "../types";

  let {
    domains,
    form,
  }: {
    domains: Domain[];
    form: DomainFormState | null | undefined;
  } = $props();

  let submitting = $state(false);
  const createError = $derived(form?.action === "create-domain" ? form.error : undefined);

  function trackSubmission() {
    submitting = true;

    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      submitting = false;
    };
  }

  function statusLabel(status: Domain["status"]): string {
    if (status === "verified") return "Verified";
    if (status === "revoked") return "Revoked";
    return "Pending setup";
  }

  function statusVariant(status: Domain["status"]): "default" | "destructive" | "outline" {
    if (status === "verified") return "default";
    if (status === "revoked") return "destructive";
    return "outline";
  }
</script>

<Card>
  <CardHeader>
    <CardTitle>Custom domains</CardTitle>
    <CardDescription>Add a domain you control, then verify it before creating identities.</CardDescription>
  </CardHeader>
  <CardContent class="grid gap-6">
    <form method="POST" action="?/create-domain" use:enhance={trackSubmission} class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div class="grid gap-2">
        <Label for="domain-hostname">Domain hostname</Label>
        <Input
          id="domain-hostname"
          name="hostname"
          required
          maxlength={253}
          placeholder="example.com"
          autocomplete="url"
          disabled={submitting}
        />
      </div>
      <Button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add domain"}</Button>
    </form>

    {#if createError}
      <p class="text-sm text-destructive" role="alert">{createError}</p>
    {/if}

    {#if domains.length === 0}
      <p class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No domains have been added yet.
      </p>
    {:else}
      <div class="grid gap-4">
        {#each domains as domain (domain.id)}
          {@const provisioning = form?.domainId === domain.id ? form.verification : undefined}
          {@const domainError = form?.domainId === domain.id && form.action !== "create-domain" ? form.error : undefined}
          <div class="grid gap-4 rounded-lg border p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="break-all font-medium">{domain.hostname}</p>
                <p class="mt-1 text-sm text-muted-foreground">
                  {#if domain.status === "verified"}
                    This domain can be used to create identities.
                  {:else if domain.status === "revoked"}
                    This domain is disabled and cannot receive mail.
                  {:else}
                    Add the verification record below, then verify ownership.
                  {/if}
                </p>
              </div>
              <Badge variant={statusVariant(domain.status)}>{statusLabel(domain.status)}</Badge>
            </div>

            {#if domain.status === "pending"}
              {#if provisioning}
                <div class="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                  <p class="font-medium">Add this DNS record</p>
                  <dl class="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                    <dt class="text-muted-foreground">Type</dt>
                    <dd>{provisioning.type}</dd>
                    <dt class="text-muted-foreground">Name</dt>
                    <dd class="break-all font-mono text-xs">{provisioning.name}</dd>
                    <dt class="text-muted-foreground">Value</dt>
                    <dd class="break-all font-mono text-xs">{provisioning.value}</dd>
                  </dl>
                  <p class="text-xs text-muted-foreground">
                    Keep this token private. It is shown only when the token is created or rotated.
                  </p>
                  <form method="POST" action="?/verify-domain" use:enhance={trackSubmission} class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <input type="hidden" name="domainId" value={domain.id} />
                    <div class="grid gap-2">
                      <Label for={`domain-token-${domain.id}`}>Verification token</Label>
                      <Input id={`domain-token-${domain.id}`} name="verificationToken" required value={provisioning.value} disabled={submitting} />
                    </div>
                    <Button type="submit" disabled={submitting}>{submitting ? "Checking…" : "Verify domain"}</Button>
                  </form>
                </div>
              {:else}
                <form method="POST" action="?/rotate-domain-token" use:enhance={trackSubmission}>
                  <input type="hidden" name="domainId" value={domain.id} />
                  <Button type="submit" variant="outline" disabled={submitting}>Show setup record</Button>
                </form>
              {/if}
            {/if}

            {#if domainError}
              <p class="text-sm text-destructive" role="alert">{domainError}</p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
