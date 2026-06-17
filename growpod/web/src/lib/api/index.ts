import { players } from "./players";
import { strains } from "./strains";
import { seeds } from "./seeds";
import { pods } from "./pods";
import { plants } from "./plants";
import { breeding } from "./breeding";
import { market } from "./market";
import { contracts } from "./contracts";
import { leaderboards } from "./leaderboards";
import { wallet } from "./wallet";
import { advisor } from "./advisor";
import { harvests } from "./harvests";
import { cup } from "./cup";
import { university } from "./university";
import { ftue } from "./ftue";

export const api = {
  players,
  strains,
  seeds,
  pods,
  plants,
  breeding,
  market,
  contracts,
  leaderboards,
  wallet,
  advisor,
  harvests,
  cup,
  university,
  ftue,
};

export { ApiError } from "./client";
export type { StrainFilters } from "./strains";
export type { Environment } from "./pods";
