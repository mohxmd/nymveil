import { authClient } from "@nymveil/auth/client";
import { createSignal, onSettled } from "solid-js";

export { authClient };

export function useSession() {
  const [session, setSession] = createSignal(authClient.useSession.get());
  onSettled(() => authClient.useSession.subscribe(setSession));
  return session;
}
