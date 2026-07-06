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
import { seasonal } from "./seasonal";
import { store } from "./store";
import { turbo } from "./turbo";
import { health } from "./health";
import { waitlist } from "./waitlist";
import { nft } from "./nft";
import { nftMarket } from "./nft-marketplace";
import { stakes } from "./nft-staking";
import { flags } from "./flags";

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
  seasonal,
  store,
  turbo,
  health,
  waitlist,
  nft,
  nftMarket,
  stakes,
  flags,
};

export { ApiError } from "./client";
export type { TurboState } from "./turbo";
export type { StrainFilters } from "./strains";
export type { Environment } from "./pods";
