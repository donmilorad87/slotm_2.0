export type Nullable<T> = T | null;

/** Mapped type: extract only the keys whose values are nullable. */
export type NullableKeys<T extends object> = {
  [K in keyof T]: null extends T[K] ? K : never;
}[keyof T];

/** Pick only the nullable fields from an interface. */
export type NullableFields<T extends object> = Pick<T, NullableKeys<T>>;

/** Make all nullable fields required (non-null). */
export type WithRequiredNullables<T extends object> = Omit<T, NullableKeys<T>> & {
  [K in NullableKeys<T>]: NonNullable<T[K]>;
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

/** Permissive JSON-serializable type for inputs that will be JSON.stringify'd.
 *  Uses `object` because TS interfaces lack implicit index signatures for JsonObject. */
export type JsonInput = JsonPrimitive | JsonInput[] | object;

export interface SlotUser {
  id: number;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  balanceUnits: number;
  stripeCustomerId: Nullable<string>;
  defaultPaymentMethodId: Nullable<string>;
  firstName: Nullable<string>;
  lastName: Nullable<string>;
  profilePicture: Nullable<string>;
  createdAt: string;
  updatedAt: string;
}

/** Omit sensitive fields for API responses / template rendering. */
export type PublicSlotUser = Omit<SlotUser, "passwordHash" | "passwordSalt">;

/** Indexed access: extract the type of any SlotUser field. */
export type SlotUserField<K extends keyof SlotUser> = SlotUser[K];

export interface SlotSession {
  id: string;
  userId: number;
  userAgent: Nullable<string>;
  ipAddress: Nullable<string>;
  createdAt: string;
  expiresAt: string;
}

export interface SessionWithUser {
  session: SlotSession;
  user: SlotUser;
}

export type TransactionDirection = "credit" | "debit";

export type TransactionType =
  | "slot_spin_bet"
  | "slot_spin_win"
  | "slot_minigame_bet"
  | "slot_minigame_win"
  | "wallet_topup";

/** Template literal Extract: transaction subtypes derived from the union. */
export type BetTransactionType = Extract<TransactionType, `${string}_bet`>;
export type WinTransactionType = Extract<TransactionType, `${string}_win`>;
export type TopupTransactionType = Exclude<TransactionType, BetTransactionType | WinTransactionType>;

/** Conditional type: map a transaction type to its valid direction. */
export type DirectionForType<T extends TransactionType> =
  T extends BetTransactionType ? "debit"
  : T extends WinTransactionType ? "credit"
  : TransactionDirection;

export type GameModeName = "numbers" | "roman" | "fruits" | "animals" | "emoji";
export type RewardModeName = "single" | "multi";

const GAME_MODE_NAMES: readonly GameModeName[] = ["numbers", "roman", "fruits", "animals", "emoji"];
const REWARD_MODE_NAMES: readonly RewardModeName[] = ["single", "multi"];
const TRANSACTION_TYPES: readonly TransactionType[] = [
  "slot_spin_bet", "slot_spin_win", "slot_minigame_bet", "slot_minigame_win", "wallet_topup",
];

export function isGameModeName(value: unknown): value is GameModeName {
  return typeof value === "string" && (GAME_MODE_NAMES as readonly string[]).includes(value);
}

export function isRewardModeName(value: unknown): value is RewardModeName {
  return typeof value === "string" && (REWARD_MODE_NAMES as readonly string[]).includes(value);
}

export function isTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

const TRANSACTION_DIRECTIONS: readonly TransactionDirection[] = ["credit", "debit"];

export function isTransactionDirection(value: unknown): value is TransactionDirection {
  return typeof value === "string" && (TRANSACTION_DIRECTIONS as readonly string[]).includes(value);
}

export interface CreateTransactionInput {
  userId: number;
  type: TransactionType;
  direction: TransactionDirection;
  amountUnits: number;
  balanceAfterUnits?: Nullable<number>;
  description?: Nullable<string>;
  provider?: Nullable<string>;
  providerRef?: Nullable<string>;
  metadata?: JsonInput;
}

export interface WalletTransaction {
  id: number;
  type: TransactionType;
  direction: TransactionDirection;
  amount_units: number;
  amount_coins: number;
  signed_amount_coins: number;
  description: string;
  provider: string;
  provider_ref: string;
  metadata: JsonValue;
  created_at: string;
}

export interface SaveSpinInput {
  betTransactionId: Nullable<number>;
  winTransactionId: Nullable<number>;
  reels: number[];
  grid: string[] | null;
  activeLines: number[];
  betPerLine: number;
  totalBet: number;
  totalPayout: number;
  jokerEnabled: boolean;
  jokerPosition: Nullable<number>;
  jokerCost: number;
  winningLines: JsonInput;
  miniGameTriggered: boolean;
  rewardMode: RewardModeName;
  gameMode: GameModeName;
}

export interface MiniGameHistoryAttachment {
  mode: "legacy" | "ticket";
  played: JsonInput;
  drawnNumbers: number[];
  totalBet: number;
  totalPayout: number;
  netResult: number;
}

export interface UserHistoryItem {
  id: string;
  reels: JsonValue;
  active_lines: number;
  bet_per_line: number;
  total_bet: number;
  total_payout: number;
  net_result: number;
  joker_enabled: boolean;
  mini_game_triggered: boolean;
  reward_mode: RewardModeName;
  game_mode: GameModeName;
  timestamp: string;
}

export interface UserStats {
  user_id: number;
  total_spins: number;
  total_wagered: number;
  total_won: number;
  total_net: number;
  wins: number;
  losses: number;
  win_rate: number;
  biggest_win: number;
  biggest_loss: number;
  mini_games_triggered: number;
}

export interface JwtUserPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
  aud?: string | string[];
  iss?: string;
  [key: string]: unknown;
}

/** Type guard: narrows a JWT payload (or any object) to JwtUserPayload by checking the required `sub` field. */
export function isJwtUserPayload(value: unknown): value is JwtUserPayload {
  return typeof value === "object" && value !== null && typeof (value as Record<string, unknown>).sub === "string";
}

export interface RequestAuthState {
  user: Nullable<SlotUser>;
  token: string;
  payload: Nullable<JwtUserPayload>;
  invalidToken: boolean;
}

export interface RequestAuthWithUser extends Omit<RequestAuthState, "user" | "payload" | "invalidToken"> {
  user: SlotUser;
  payload: JwtUserPayload;
  invalidToken: false;
}

export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export interface ApiError {
  readonly success: false;
  readonly message: string;
  readonly errors?: ReadonlyArray<{ readonly msg: string; readonly [key: string]: unknown }>;
}

/** Union of all possible API response shapes for a given data type. */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/** The required (non-optional) keys of CreateTransactionInput. */
export type RequiredTransactionFields = Pick<
  CreateTransactionInput,
  "userId" | "type" | "direction" | "amountUnits"
>;

/** Generic paginated page response data shape shared by wallet and game history. */
export interface PaginatedPageData<T> {
  readonly total: number;
  readonly page: number;
  readonly total_pages: number;
  readonly has_more: boolean;
  readonly items: readonly T[];
}

/** API response data: auth redirect + token. */
export interface AuthRedirectData {
  redirect: string;
  token: string;
}

/** API response data: wallet balance. */
export interface BalanceData {
  balance_coins: number;
  balance_units: number;
}

/** API response data: Stripe session URL. */
export interface StripeUrlData {
  url: string | undefined;
}
