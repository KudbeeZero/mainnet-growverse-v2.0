// Hand-written types mirroring the backend serializers
// (src/growpodempire/api/serialize.py). The OpenAPI spec carries no body
// schemas, so these are the source of truth for the wire format on the client.

export type GrowthStage =
  | "seed"
  | "germination"
  | "seedling"
  | "vegetative"
  | "flowering"
  | "late_flower"
  | "harvest";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type LineageType = "landrace" | "hybrid" | "bred";

export type ConditionKind =
  | "healthy"
  | "overwatered"
  | "root_rot"
  | "underwatered"
  | "wilting"
  | "nutrient_deficient"
  | "nutrient_burn"
  | "pest_infestation"
  | "mildew"
  | "dead";

export type Severity = "mild" | "moderate" | "severe";

export type NftStatus = "none" | "pending" | "minted" | "failed";

export interface ConditionFlag {
  condition: ConditionKind;
  severity: Severity;
}

export interface Wallet {
  id: string;
  player_id: string;
  balance: number;
  asa_balance: number | null;
  version: number;
}

export interface Player {
  id: string;
  username: string;
  email: string | null;
  algorand_address: string | null;
  xp: number;
  level: number;
  created_at: string | null;
  balance?: number;
  wallet?: Wallet;
  /** Lifetime prestige titles. */
  cannabis_cup_title?: string | null;
  university_title?: string | null;
  /** Returned exactly once, on player creation. */
  api_key?: string;
}

export interface LevelProgress {
  xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next_level: number;
  progress_pct: number;
}

export interface Rank {
  index: number;
  name: string;
  icon: string;
  level_min: number;
  next_level_min: number | null;
}

export interface Badge {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  earned_at: string | null;
}

export interface PlayerProfile {
  rank: Rank;
  level: LevelProgress;
  badges: Badge[];
  medals: Achievement[];
}

export interface GenomeBudDNA {
  bud_height: number;
  max_bud_width: number;
  rows: number;
  calyx_per_row_min: number;
  calyx_per_row_max: number;
  calyx_size_min: number;
  calyx_size_max: number;
  overlap: number;
  pistil_chance: number;
  sugar_leaf_chance: number;
  trichome_density: number;
  anthocyanin: number;
  calyx_hue: number;
  calyx_sat: number;
  pistil_magenta: number;
  foxtail_bias: number;
}

export interface Strain {
  id: string;
  name: string;
  slug: string;
  lineage_type: LineageType;
  rarity: Rarity;
  indica_ratio: number;
  thc_range: [number, number];
  cbd_range: [number, number];
  flowering_days: [number, number];
  yield_range: [number, number];
  difficulty: number;
  terpenes: string[] | null;
  stability: number;
  generation: number;
  parent_a_id: string | null;
  parent_b_id: string | null;
  is_base_catalog: boolean;
  genome: Record<string, { value: number; dominance: string }> | null;
  bud_dna: GenomeBudDNA | null;
  nft_asset_id: number | null;
  nft_status: NftStatus;
}

export type SeedSource = "starter" | "purchased" | "bred" | "market";

export interface Seed {
  id: string;
  strain_id: string;
  quantity: number;
  source: SeedSource;
  feminized: boolean;
}

export type PodTier = "basic" | "standard" | "pro";

export interface Pod {
  id: string;
  player_id: string;
  name: string;
  capacity: number;
  tier: PodTier;
  active: boolean;
  auto_water: boolean;
  auto_feed: boolean;
  // Current environment setpoints (null until the player sets them). Used to
  // seed the grow-chamber climate sliders with the pod's real values.
  temperature: number | null;
  humidity: number | null;
  co2_level: number | null;
  light_intensity: number | null;
  ph_level: number | null;
}

export interface Plant {
  id: string;
  player_id: string;
  pod_id: string;
  strain_id: string;
  growth_stage: GrowthStage;
  planted_at: string | null;
  height: number;
  health: number;
  water_level: number;
  nutrient_level: number;
  pest_level: number;
  disease_level: number;
  condition_flags: ConditionFlag[];
  is_alive: boolean;
  harvested: boolean;
}

export interface PlantEvent {
  id: string;
  plant_id: string;
  timestamp: string | null;
  event_type: string;
  severity: Severity | null;
  payload: Record<string, unknown> | null;
}

/** Derived scientist readouts exposed on GET .../state. */
export interface PlantMetrics {
  vpd_kpa: number | null;
  dli_mol: number | null;
  ppfd: number | null;
  photoperiod_hours: number | null;
  /** Display-only nutrient PPM (derived from the 0..100 nutrient scalar). */
  nutrient_ppm?: number | null;
  /** Optimal PPM window [min, max] for the plant's current growth stage, or
   *  null outside the fed stages (seed / germination / harvest). */
  stage_targets?: readonly [number, number] | null;
}

/** Lifecycle forecast exposed on GET .../state: where the plant is and when it
 *  reaches the next stage / harvest-readiness (at current health). */
export interface StageForecast {
  stage: GrowthStage;
  stage_index: number;
  stage_count: number;
  age_hours: number | null;
  hours_in_stage: number;
  next_stage: GrowthStage | null;
  stage_progress_pct: number;
  /** Ideal stage length and the current-health-adjusted ("effective") length, in hours. */
  stage_base_hours: number;
  stage_total_hours: number;
  /** Absolute ISO instants so a client countdown stays accurate between polls. */
  next_stage_eta: string | null;
  hours_to_harvest: number;
  harvest_eta: string | null;
  is_harvest_ready: boolean;
}

/** Read-only TrichomeResinGland telemetry (server truth): frost density, head
 * development, and the clear→cloudy→amber ripeness mix + harvest-window advice. */
export interface TrichomeTelemetry {
  active: boolean;
  density: number;          // 0..1 frostiness
  head_development: number; // 0..1
  clear_pct: number;
  cloudy_pct: number;
  amber_pct: number;
  dominant: "clear" | "cloudy" | "amber" | null;
  harvest_window: "not_flowering" | "developing" | "early" | "peak" | "ripe" | "overripe";
  recommendation: string;
}

export interface PlantState extends Plant {
  metrics?: PlantMetrics;
  forecast?: StageForecast;
  trichomes?: TrichomeTelemetry;
  recent_events: PlantEvent[];
}

export type CureStatus = "none" | "curing" | "cured";

export interface Harvest {
  id: string;
  player_id: string;
  plant_id: string;
  strain_id: string;
  weight_g: number;
  quality: number;
  thc_actual: number | null;
  cbd_actual: number | null;
  rarity: Rarity;
  terpenes?: Record<string, number> | null;
  sale_value: number | null;
  sold: boolean;
  cure_status?: CureStatus;
  cure_started_at?: string | null;
  cure_target_hours?: number | null;
  cure_quality_bonus?: number | null;
  harvested_at: string | null;
  nft_asset_id: number | null;
  nft_status: NftStatus;
}

export type ListingItemType = "seed" | "harvest";
export type ListingStatus = "active" | "sold" | "cancelled" | "expired";

export interface Listing {
  id: string;
  seller_id: string;
  item_type: ListingItemType;
  item_ref_id: string;
  quantity: number;
  unit_price: number;
  status: ListingStatus;
  buyer_id: string | null;
  is_auction: boolean;
  min_bid: number | null;
  highest_bid: number | null;
  highest_bidder_id: string | null;
  expires_at: string | null;
}

export interface Contract {
  id: string;
  description: string;
  target_rarity: Rarity | null;
  target_grams: number;
  reward_grow: number;
  reward_xp: number;
  status: "open" | "fulfilled" | "expired";
  deadline_at: string | null;
  fulfilled_at: string | null;
}

export interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string | null;
}

export interface Achievement {
  key: string;
  description: string;
  reward: number;
  unlocked: boolean;
  claimed: boolean;
}

export interface LeaderboardEntry {
  player_id: string;
  username: string;
  value: number;
}

export type LeaderboardKind = "richest" | "breeders" | "harvests" | "level";

/** Error body shape returned by the API on failures. */
export interface ApiErrorBody {
  error: string;
}

// ---- Strain knowledge / provenance / lineage (the trust + GenBank layer) ----

export interface StrainKnowledge {
  strain_id: string;
  name: string;
  slug: string;
  rarity: Rarity;
  lineage_type: LineageType;
  is_base_catalog: boolean;
  in_knowledge_base: boolean;
  /** Free-form encyclopedia entry from data/strain_knowledge.yaml. */
  knowledge: Record<string, unknown> | null;
  note?: string;
}

export interface Provenance {
  strain_id: string;
  verifiable: boolean;
  verified?: boolean;
  rng_seed?: number;
  parent_a_id?: string | null;
  parent_b_id?: string | null;
  bred_at?: string | null;
  max_value_delta?: number;
  mismatched_traits?: string[];
  method?: string;
  reason?: string;
}

export interface LineageNode {
  strain_id: string;
  name: string;
  generation: number;
  rarity: Rarity;
  verified?: boolean;
  rng_seed?: number;
  parent_a_id?: string | null;
  parent_b_id?: string | null;
  root?: boolean;
  is_base_catalog?: boolean;
}

export interface Lineage {
  strain_id: string;
  fully_verified: boolean;
  node_count: number;
  root_count: number;
  truncated: boolean;
  lineage: LineageNode[];
}

// ---- AI Master Grower ----

export interface CareSuggestion {
  action: string;
  urgency: "now" | "soon" | "optional";
  reason: string;
}

export interface AdvisorReport {
  provider: string;
  summary: string;
  severity: "healthy" | "minor" | "serious" | "critical" | Severity;
  diagnosis: string;
  suggestions: CareSuggestion[];
}

export interface AutoCareResult {
  plant: Plant;
  actions_taken: Array<Record<string, unknown>>;
  spent: number;
  remaining: number;
}

// ---- First-Time-User-Experience (guided tutorial) ----

export type FtueStep =
  | "welcome"
  | "plant"
  | "water"
  | "environment"
  | "grow"
  | "harvest"
  | "completed";

export interface FtueStatus {
  step: FtueStep;
  plant_id: string | null;
  completed: boolean;
  completed_at: string | null;
}

// ---- Seasonal Cannabis Cup ----

export interface Cup {
  id: string;
  edition: string;
  season: string;
  title: string;
  status: "open" | "judged" | string;
  entry_fee: number;
  prize_pool: number;
  starts_at: string | null;
  ends_at: string | null;
  judged_at: string | null;
  winner_id: string | null;
  champion_strain_id: string | null;
}

export interface CupEntry {
  id: string;
  cup_id: string;
  player_id: string;
  strain_id: string;
  strain_name: string;
  score: number;
  rank: number | null;
  prize_grow: number;
  submitted_at: string | null;
}

export interface CupCurrent {
  cup: Cup | null;
  standings?: CupEntry[];
}

export interface CupEnterResult {
  cup_id: string;
  edition: string;
  entry_id: string;
  score: number;
  balance: number;
}

export interface HallOfFameEntry {
  edition?: string;
  season?: string;
  title?: string;
  winner_id?: string | null;
  winner?: string | null;
  champion_strain?: string | null;
  champion_strain_id?: string | null;
  judged_at?: string | null;
  [k: string]: unknown;
}

// ---- GrowPod University ----

export type CourseStatus = "available" | "locked" | "enrolled" | "completed";

export interface CourseProgress {
  study_hours_remaining: number;
  practical_met: boolean;
  practical: string;
}

export interface CatalogCourse {
  key: string;
  name: string;
  department: string | null;
  credits: number | null;
  level_req: number;
  duration_hours: number | null;
  tuition: number;
  prereqs: string[];
  perks: Record<string, unknown>;
  lecture_topic: string | null;
}

export interface CatalogDegree {
  key: string;
  name: string;
  tier: string | null;
  title: string | null;
  required_courses: string[];
  perks: Record<string, unknown>;
  xp_reward: number;
}

export interface UniversityCatalog {
  departments: Record<string, string>;
  courses: CatalogCourse[];
  degrees: CatalogDegree[];
}

export interface TranscriptCourse extends CatalogCourse {
  practical: Record<string, unknown> | null;
  status: CourseStatus;
  progress: CourseProgress | null;
  requires_exam: string | null;
  exams: CourseExamState[];
}

// ----- assessments / exams ---------------------------------------------------

export type AssessmentItemType = "mcq" | "multi" | "tf" | "numeric" | "drag_sort";

/** Client-safe exam item — answer keys/feedback are stripped server-side. */
export interface ExamItem {
  id: string;
  type: AssessmentItemType;
  stem: string;
  objective: number | null;
  choices?: string[];        // mcq | multi
  prompt_keys?: string[];    // drag_sort — left-hand prompts
  options?: string[];        // drag_sort — pool of right-hand options
}

export interface Exam {
  id: string;
  title: string;
  pass: number;              // 0..1 gate
  items: ExamItem[];
}

export interface ExamResultItem {
  id: string;
  type: AssessmentItemType;
  correct: boolean;
  objective: number | null;
  explain: string | null;
}

export interface ExamResult {
  total: number;
  correct_count: number;
  score: number;             // 0..1
  percent: number;
  passed: boolean;
  pass_threshold: number;
  items: ExamResultItem[];
}

export interface ExamAttempt {
  attempts: number;
  best_score: number;
  passed: boolean;
}

export interface ExamSubmission {
  result: ExamResult;
  attempt: ExamAttempt;
}

/** Per-exam state surfaced in the transcript. */
export interface CourseExamState {
  exam_id: string;
  title: string;
  pass: number;
  attempts: number;
  best_score: number;
  passed: boolean;
}

/** A student's answer to one item: index | indices | bool | number | pairing. */
export type ExamResponse =
  | number
  | number[]
  | boolean
  | Record<string, string>;

export interface TranscriptDegree extends CatalogDegree {
  completed_required: string[];
  earned: boolean;
  claimable: boolean;
}

export interface Transcript {
  player_id: string;
  title: string | null;
  departments: Record<string, string>;
  courses: TranscriptCourse[];
  degrees: TranscriptDegree[];
}

export interface Enrollment {
  id: string;
  player_id: string;
  course_key: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface LectureReport {
  provider: string;
  title: string;
  summary: string;
  content: string;
  key_takeaways: string[];
  quiz_question: string;
  audio_url?: string;
}

export interface CaptionCue {
  start_s: number;
  end_s: number;
  text: string;
}

export interface UniversityProgress {
  kxp: number;
  streak_count: number;
  freeze_tokens: number;
  last_study_date: string | null;
  next_nudge: string | null;
}

export interface Scholar {
  id: string;
  username: string;
  kxp: number;
  streak_count: number;
}

export interface MasterGrowerCitation {
  source: string;
  snippet: string;
}

export interface MasterGrowerReport {
  answer: string;
  citations: MasterGrowerCitation[];
  suggested_actions: string[];
  refused: boolean;
  disclaimer: string;
}

export interface PresenterVideo {
  provider: string;
  avatar_id: string;
  presenter_name: string;
  audio_hash: string;
  backend: string;
  video_url: string | null;
  poster_url: string | null;
  duration_s: number;
  captions: CaptionCue[];
}

// ---- Agent Campus: centralized learner model + roadmap + admissions (Phase 6) ----

export type LearnerLevel = "beginner" | "intermediate" | "advanced";
export type LearnerRisk = "none" | "at_risk";

/** The engagement slice merged into the learner read model (no nudge here —
 *  that lives on the separate /university/progress endpoint). */
export interface LearnerEngagement {
  kxp: number;
  streak_count: number;
  freeze_tokens: number;
  last_study_date: string | null;
}

/** The centralized learner read model: NON-economic mastery / prefs / risk merged
 *  with the engagement slice. `mastery_by_skill` maps skill_id -> 0..1 score. */
export interface LearnerProfile {
  mastery_by_skill: Record<string, number>;
  misconceptions: Record<string, unknown>;
  preferred_format: string | null;
  goals: string | null;
  experience_level: LearnerLevel;
  risk_level: LearnerRisk;
  updated_at: string | null;
  engagement: LearnerEngagement;
}

/** One scheduled skill in the learning path. `day` is 1-based. */
export interface RoadmapStep {
  skill_id: string;
  name: string;
  domain: string;
  day: number;
  prerequisites: string[];
}

/** An ordered, prerequisite-respecting learning path for a learner. */
export interface RoadmapPlan {
  horizon_days: number;
  steps: RoadmapStep[];
  skipped_mastered: string[];
  rationale: string;
  mastery_by_skill: Record<string, number>;
}

export interface AdmissionsChoice {
  id: string;
  label: string;
  /** Department weights (scoring questions) — present on most questions. */
  weights?: Record<string, number>;
  /** Starting level — present only on the experience question. */
  level?: LearnerLevel;
}

export interface AdmissionsQuestion {
  id: string;
  prompt: string;
  choices: AdmissionsChoice[];
}

export interface AdmissionsQuiz {
  quiz: AdmissionsQuestion[];
}

/** The Admissions agent's intake recommendation. `track` is ordered real course keys. */
export interface AdmissionsRecommendation {
  school: string;
  department: string;
  track: string[];
  level: LearnerLevel;
  rationale: string;
}

/** POST /university/admissions result: the recommendation + the merged profile. */
export interface AdmissionsResult {
  recommendation: AdmissionsRecommendation;
  profile: LearnerProfile;
}

export interface SeasonalStrain {
  id: string;
  strain_id: string;
  strain_name: string;
  strain_rarity: string;
  strain_thc_max: number | null;
  strain_terpenes: string[];
  available_month: string;
  price_gc: number;
  is_current: boolean;
}

// --- Faction + launch waitlist (public, NON-economic pre-launch funnel) ---
export interface Faction {
  id: string;
  name: string;
  color: string;
  crest: string;
  tagline: string;
  lore: string;
}
export interface FactionsResponse {
  factions: Faction[];
}
export interface WaitlistStandings {
  factions: Record<string, number>;
  total: number;
}
export interface WaitlistSignup {
  id: string;
  faction: string;
  algorand_address: string | null;
  email: string | null;
  engagement_points: number;
  source: string;
  created_at: string | null;
}

// ---- NFT Marketplace & Staking ----

export type NFTAssetStatus = "pending" | "minted" | "failed" | "listed" | "staking" | "traded";
export type NFTListingStatus = "active" | "sold" | "cancelled" | "expired";
export type StakingStatus = "active" | "complete" | "withdrawn";

export interface NFTAsset {
  asset_id: number;
  owner_address: string;
  game_item_id: string;
  ipfs_hash: string;
  status: NFTAssetStatus;
  metadata?: {
    name?: string;
    description?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
    [k: string]: unknown;
  } | null;
  minted_at?: string;
}

export interface NFTListing {
  listing_id: string;
  asset_id: number;
  seller: string;
  price_ualgos: string;
  created_at: string;
  expires_at: string | null;
  status?: NFTListingStatus;
}

export interface StakingLock {
  lock_id: string;
  asset_id: number;
  status: StakingStatus;
  cure_started_at: string;
  cure_ends_at: string;
  progress_pct: number;
  time_remaining_seconds: number;
  rewards_amount: string;
  can_claim: boolean;
}
