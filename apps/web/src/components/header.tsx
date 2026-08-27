import { For } from "solid-js";

import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ];

  return (
    <div>
      <div class="flex flex-row items-center justify-between px-2 py-1">
        <nav class="flex gap-4 text-lg">
          <For each={links}>{(link) => <a href={link.to}>{link.label}</a>}</For>
        </nav>
        <div class="flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
