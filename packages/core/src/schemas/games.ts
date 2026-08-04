import type { OrderGameItem, MatchingGamePair } from "@core-types/games";

export interface OrderGameSchema {
  items: OrderGameItem[];
}

export interface MatchingGameSchema {
  pairs: MatchingGamePair[];
}