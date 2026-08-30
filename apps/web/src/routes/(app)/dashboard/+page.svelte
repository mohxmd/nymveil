<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<div>
  <h1>Dashboard</h1>
  <p>Welcome {data.user.name}</p>
</div>
