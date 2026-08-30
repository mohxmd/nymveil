<script lang="ts">
  import type { PageProps } from "./$types";

  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import CreateIdentityForm from "$lib/features/identities/components/create-identity-form.svelte";
  import IdentityCard from "$lib/features/identities/components/identity-card.svelte";
  import type { IdentityFormState } from "$lib/features/identities/types";

  let { data, form }: PageProps = $props();
</script>

<div class="container mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:py-12">
  <header class="grid gap-2">
    <p class="text-sm font-medium text-primary">Dashboard</p>
    <h1 class="text-3xl font-semibold tracking-tight">Your email identities</h1>
    <p class="max-w-2xl text-muted-foreground">
      Create isolated addresses for the services you use and control their lifetime from one place.
    </p>
  </header>

  {#if data.loadError}
    <Alert variant="destructive">
      <AlertTitle>Unable to load identities</AlertTitle>
      <AlertDescription>{data.loadError}</AlertDescription>
    </Alert>
  {/if}

  <section class="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
    <CreateIdentityForm domains={data.domains} form={form as IdentityFormState | null | undefined} />

    <div class="grid gap-4">
      <div class="flex items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">Identities</h2>
          <p class="text-sm text-muted-foreground">{data.identities.length} total</p>
        </div>
      </div>

      {#if data.identities.length === 0}
        <Card>
          <CardHeader>
            <CardTitle>No identities yet</CardTitle>
            <CardDescription>Your created addresses will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">
              Choose a verified domain and create your first identity to get started.
            </p>
          </CardContent>
        </Card>
      {:else}
        <div class="grid gap-4 xl:grid-cols-2">
          {#each data.identities as identity (identity.id)}
            <IdentityCard identity={identity} form={form as IdentityFormState | null | undefined} />
          {/each}
        </div>
      {/if}
    </div>
  </section>
</div>
