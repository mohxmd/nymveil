<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import type { IdentityStatus } from "../types";

  let { status }: { status: IdentityStatus } = $props();

  const labels: Record<IdentityStatus, string> = {
    active: "Active",
    expired: "Expired",
    torched: "Torched",
  };

  const variants = {
    active: "default",
    expired: "secondary",
    torched: "destructive",
  } as const;
</script>

<Badge variant={variants[status]}>{labels[status]}</Badge>
