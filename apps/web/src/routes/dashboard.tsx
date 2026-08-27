import { useNavigate } from "@solidjs/router";
import { createEffect, Show } from "solid-js";

import { useSession } from "~/lib/auth-client";

export default function Dashboard() {
  const navigate = useNavigate();
  const session = useSession();

  createEffect(
    () => !session().isPending && !session().data,
    (shouldRedirect) => {
      if (shouldRedirect) {
        navigate("/login", { replace: true });
      }
    },
  );

  return (
    <Show when={!session().isPending && session().data} fallback={<p>Loading...</p>}>
      <div>
        <h1>Dashboard</h1>
        <p>Welcome {session().data?.user.name}</p>
      </div>
    </Show>
  );
}
