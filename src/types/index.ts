export type Currency = "coins" | "gems";

export interface UserProfile {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  coins: number;
  gems: number;
  gamesPlayed: number;
  gamesWon: number;
  isAdmin: boolean;
  isVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface ShopItemDTO {
  id: string;
  name: string;
  description?: string | null;
  gameId: string;
  category: string;
  priceCoins: number;
  priceGems: number;
  imageUrl?: string | null;
}

export interface PromoCodeResult {
  success: boolean;
  message: string;
  coins?: number;
  gems?: number;
}
