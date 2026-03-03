export type Nullable<T> = T | null;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | object;

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

export interface CreateTransactionInput {
  userId: number;
  type: string;
  direction: TransactionDirection;
  amountUnits: number;
  balanceAfterUnits?: Nullable<number>;
  description?: Nullable<string>;
  provider?: Nullable<string>;
  providerRef?: Nullable<string>;
  metadata?: JsonValue;
}

export interface WalletTransaction {
  id: number;
  type: string;
  direction: string;
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
  winningLines: JsonValue;
  miniGameTriggered: boolean;
  rewardMode: string;
  gameMode: string;
}

export interface MiniGameHistoryAttachment {
  mode: "legacy" | "ticket";
  played: JsonValue;
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
  reward_mode: string;
  game_mode: string;
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

export interface RequestAuthState {
  user: Nullable<SlotUser>;
  token: string;
  payload: Nullable<JwtUserPayload>;
  invalidToken: boolean;
}

export interface RequestAuthWithUser extends Omit<RequestAuthState, "user"> {
  user: SlotUser;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: unknown;
}
