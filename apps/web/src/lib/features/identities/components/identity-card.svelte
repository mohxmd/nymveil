<script lang="ts">
  import { enhance } from "$app/forms";
  import type { SubmitFunction } from "@sveltejs/kit";
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { formatDate, toDateTimeLocal } from "../dates";
  import type { Identity, IdentityFormState } from "../types";
  import IdentityStatusBadge from "./identity-status-badge.svelte";

  let {
    identity,
    form,
  }: {
    identity: Identity;
    form: IdentityFormState | null | undefined;
  } = $props();

  let updateSubmitting = $state(false);
  let torchSubmitting = $state(false);
  let dialogOpen = $state(false);

  const updateError = $derived(
    form?.action === "update" && form.identityId === identity.id ? form.error : undefined,
  );
  const torchError = $derived(
    form?.action === "torch" && form.identityId === identity.id ? form.error : undefined,
  );
  const isMutable = $derived(identity.status === "active");

  const trackUpdate: SubmitFunction = () => {
    updateSubmitting = true;

    return async ({ update }) => {
      await update();
      updateSubmitting = false;
    };
  };

  const trackTorch: SubmitFunction = () => {
    torchSubmitting = true;

    return async ({ update, result }) => {
      await update();
      torchSubmitting = false;
      if (result.type === "success") dialogOpen = false;
    };
  };
</script>

<Card class="h-full">
  <CardHeader>
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <CardTitle class="truncate">{identity.label}</CardTitle>
        <CardDescription class="mt-1 break-all font-mono text-xs">{identity.address}</CardDescription>
      </div>
      <IdentityStatusBadge status={identity.status} />
    </div>
  </CardHeader>

  <CardContent class="grid gap-5">
    <dl class="grid gap-3 text-sm">
      <div class="flex items-center justify-between gap-4">
        <dt class="text-muted-foreground">Expires</dt>
        <dd class="text-right">{formatDate(identity.expiresAt)}</dd>
      </div>
      <div class="flex items-center justify-between gap-4">
        <dt class="text-muted-foreground">Created</dt>
        <dd class="text-right">{formatDate(identity.createdAt)}</dd>
      </div>
    </dl>

    {#if isMutable}
      <form method="POST" action="?/update" use:enhance={trackUpdate} class="grid gap-3 border-t pt-4">
        <input type="hidden" name="id" value={identity.id} />
        <div class="grid gap-2">
          <Label for={`label-${identity.id}`}>Label</Label>
          <Input id={`label-${identity.id}`} name="label" value={identity.label} maxlength={120} required disabled={updateSubmitting} />
        </div>
        <div class="grid gap-2">
          <Label for={`expires-at-${identity.id}`}>Expiration</Label>
          <Input id={`expires-at-${identity.id}`} name="expiresAt" type="datetime-local" value={toDateTimeLocal(identity.expiresAt)} disabled={updateSubmitting} />
        </div>
        {#if updateError}
          <p class="text-sm text-destructive" role="alert">{updateError}</p>
        {/if}
        <Button type="submit" variant="outline" disabled={updateSubmitting}>
          {updateSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    {:else}
      <p class="border-t pt-4 text-sm text-muted-foreground">
        This identity is {identity.status} and can no longer be changed.
      </p>
    {/if}
  </CardContent>

  {#if identity.status !== "torched"}
    <CardFooter class="grid gap-3">
      <form id={`torch-${identity.id}`} method="POST" action="?/torch" use:enhance={trackTorch}>
        <input type="hidden" name="id" value={identity.id} />
      </form>

      <AlertDialog bind:open={dialogOpen}>
        <AlertDialogTrigger type="button" class="w-full" disabled={torchSubmitting}>
          Torch identity
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Torch this identity?</AlertDialogTitle>
            <AlertDialogDescription>
              <span class="font-mono">{identity.address}</span> will stop receiving mail permanently. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {#if torchError}
            <p class="text-sm text-destructive" role="alert">{torchError}</p>
          {/if}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={`torch-${identity.id}`} variant="destructive" disabled={torchSubmitting}>
              {torchSubmitting ? "Torching…" : "Torch identity"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardFooter>
  {/if}
</Card>
