import { apiFetch } from "./client";
import type { Pod, PodTier } from "@/lib/types";

export interface Environment {
  temperature: number;
  humidity: number;
  co2_level: number;
  light_intensity: number;
  ph_level: number;
}

export const pods = {
  list: (playerId: string) =>
    apiFetch<Pod[]>(`/players/${playerId}/pods`, { auth: true }),

  create: (
    playerId: string,
    name: string,
    opts: { capacity?: number; tier?: PodTier; charge?: boolean } = {},
  ) =>
    apiFetch<Pod>(`/players/${playerId}/pods`, {
      method: "POST",
      body: { name, ...opts },
    }),

  upgrade: (playerId: string, podId: string, tier: PodTier) =>
    apiFetch<Pod>(`/players/${playerId}/pods/${podId}/upgrade`, {
      method: "POST",
      body: { tier },
    }),

  setEnvironment: (playerId: string, podId: string, env: Environment) =>
    apiFetch<Pod>(`/players/${playerId}/pods/${podId}/environment`, {
      method: "POST",
      body: env,
    }),

  // Weather is fully server-randomised; the client cannot pick the event/seed.
  rollWeather: (playerId: string, podId: string) =>
    apiFetch<Record<string, unknown>>(`/players/${playerId}/pods/${podId}/weather`, {
      method: "POST",
    }),
};
