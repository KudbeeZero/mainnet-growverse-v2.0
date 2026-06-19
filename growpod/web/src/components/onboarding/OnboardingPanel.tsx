"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import type { Player } from "@/lib/types";

type Tab = "create" | "import";

export function OnboardingPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [createdKey, setCreatedKey] = useState<{ player: Player; key: string } | null>(null);

  if (createdKey) {
    return <ApiKeyReveal player={createdKey.player} apiKey={createdKey.key} />;
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader
        title="Welcome to GrowPod Empire"
        subtitle="Create a grower account to start cultivating."
      />
      <div className="mb-4 flex gap-2">
        <TabButton active={tab === "create"} onClick={() => setTab("create")}>
          New account
        </TabButton>
        <TabButton active={tab === "import"} onClick={() => setTab("import")}>
          I have a key
        </TabButton>
      </div>
      {tab === "create" ? (
        <CreateForm onCreated={(player, key) => setCreatedKey({ player, key })} />
      ) : (
        <ImportForm />
      )}

      {/* Offline escape hatch: lets the player reach the grow loop even when the
          backend login is unavailable (no raw 404). Local-only, clearly labeled. */}
      <div className="mt-4 border-t border-ink-700 pt-4">
        <p className="mb-2 text-center text-xs text-gray-400">
          Cloud login not connected yet?
        </p>
        <Button variant="secondary" className="w-full" onClick={() => router.push("/demo")}>
          ▶ Play Demo Grow (offline)
        </Button>
      </div>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-grow-700 text-white" : "bg-ink-700 text-gray-300 hover:bg-ink-600"
      }`}
    >
      {children}
    </button>
  );
}

function CreateForm({
  onCreated,
}: {
  onCreated: (player: Player, key: string) => void;
}) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const mutation = useMutation<Player, ApiError>({
    mutationFn: () => api.players.create(username, email || undefined),
    onSuccess: (player) => {
      if (!player.api_key) {
        toast.error("No API key returned");
        return;
      }
      onCreated(player, player.api_key);
    },
    onError: (e) =>
      toast.error(`${e.message} — or use “Play Demo Grow (offline)” below.`),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Username">
        <TextInput
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="greenthumb"
          required
        />
      </Field>
      <Field label="Email (optional)">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Button type="submit" className="w-full" loading={mutation.isPending}>
        Create account
      </Button>
    </form>
  );
}

function ImportForm() {
  const { login } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [playerId, setPlayerId] = useState("");
  const [apiKey, setApiKey] = useState("");

  const mutation = useMutation<Player, ApiError>({
    // Validate the typed key directly — no session exists yet, so we pass it
    // explicitly rather than relying on localStorage (which is still empty).
    mutationFn: () => api.players.get(playerId.trim(), apiKey.trim()),
    onSuccess: (player) => {
      login(player.id, apiKey.trim());
      toast.success(`Welcome back, ${player.username}`);
      router.replace("/dashboard");
    },
    onError: (e) =>
      toast.error(
        e.status === 403
          ? "That API key doesn't match this Player ID"
          : `Sign in failed: ${e.message} — or use “Play Demo Grow (offline)” below.`,
      ),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <Field label="Player ID">
        <TextInput value={playerId} onChange={(e) => setPlayerId(e.target.value)} required />
      </Field>
      <Field label="API key">
        <TextInput value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={mutation.isPending}>
        Sign in
      </Button>
    </form>
  );
}

function ApiKeyReveal({ player, apiKey }: { player: Player; apiKey: string }) {
  const { login } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success("API key copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  }

  function enter() {
    login(player.id, apiKey);
    // Brand-new accounts begin in the guided first-grow tutorial.
    router.replace("/ftue");
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader
        title={`Account created — ${player.username}`}
        subtitle="Save your API key now. It is shown only once."
      />
      <div className="space-y-3">
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-400">Player ID</span>
          <code className="block break-all rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-xs">
            {player.id}
          </code>
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-400">API key</span>
          <code className="block break-all rounded-md border border-amber-700 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
            {apiKey}
          </code>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copy}>
            {copied ? "Copied ✓" : "Copy key"}
          </Button>
          <Button className="flex-1" onClick={enter}>
            I&apos;ve saved it — enter the game
          </Button>
        </div>
        <p className="text-[11px] text-gray-500">
          You started with 500 GC. Use this key + player ID to sign in from another device.
        </p>
      </div>
    </Card>
  );
}
