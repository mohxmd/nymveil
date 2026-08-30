<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { Domain, IdentityFormState } from "../types";

  let {
    domains,
    form,
  }: {
    domains: Domain[];
    form: IdentityFormState | null | undefined;
  } = $props();

  let submitting = $state(false);
  const verifiedDomains = $derived(domains.filter((domain) => domain.status === "verified"));
  const actionError = $derived(form?.action === "create" ? form.error : undefined);

  function trackSubmission() {
    submitting = true;

    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      submitting = false;
    };
  }
</script>

<Card>
  <CardHeader>
    <CardTitle>Create an identity</CardTitle>
    <CardDescription>Generate an isolated address for a service or signup.</CardDescription>
  </CardHeader>
  <CardContent>
    {#if verifiedDomains.length === 0}
      <p class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Add and verify a domain before creating an identity.
      </p>
    {:else}
      <form method="POST" action="?/create" use:enhance={trackSubmission} class="grid gap-4">
        <div class="grid gap-2">
          <Label for="identity-domain">Domain</Label>
          <select
            id="identity-domain"
            name="domainId"
            required
            class="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={submitting}
          >
            <option value="">Choose a verified domain</option>
            {#each verifiedDomains as domain (domain.id)}
              <option value={domain.id}>{domain.hostname}</option>
            {/each}
          </select>
        </div>

        <div class="grid gap-2">
          <Label for="identity-label">Label</Label>
          <Input
            id="identity-label"
            name="label"
            required
            maxlength={120}
            placeholder="GitHub account"
            disabled={submitting}
          />
        </div>

        <div class="grid gap-2">
          <Label for="identity-expires-at">Expiration <span class="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="identity-expires-at" name="expiresAt" type="datetime-local" disabled={submitting} />
        </div>

        {#if actionError}
          <p class="text-sm text-destructive" role="alert">{actionError}</p>
        {/if}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create identity"}
        </Button>
      </form>
    {/if}
  </CardContent>
</Card>
