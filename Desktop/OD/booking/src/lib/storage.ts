import type { RankingData } from '@/types/booking';

const STORAGE_KEY = 'booking_ranking_history';
const MAX_HISTORY = 10;

export interface HistoryItem {
  id: string;
  hotelId: string;
  hotelName: string;
  location: string;
  checkinDate: string;
  checkoutDate: string;
  position: number | null;
  price: number | null;
  timestamp: number;
  data: RankingData;
}

export function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveToHistory(
  hotelId: string,
  location: string,
  checkinDate: string,
  checkoutDate: string,
  data: RankingData
): void {
  if (typeof window === 'undefined') return;

  try {
    const history = getHistory();

    // Check if same hotel + location + dates already exists
    const existingIndex = history.findIndex(
      (item) =>
        item.hotelId === hotelId &&
        item.location === location &&
        item.checkinDate === checkinDate &&
        item.checkoutDate === checkoutDate
    );

    const newItem: HistoryItem = {
      id: `${hotelId}-${Date.now()}`,
      hotelId,
      hotelName: data.hotelDetails?.name || 'ไม่ทราบชื่อ',
      location,
      checkinDate,
      checkoutDate,
      position: data.searchPosition.position,
      price: data.priceComparison.yourPrice,
      timestamp: Date.now(),
      data,
    };

    if (existingIndex !== -1) {
      // Update existing entry
      history[existingIndex] = newItem;
    } else {
      // Add new entry at the beginning
      history.unshift(newItem);
    }

    // Keep only the last MAX_HISTORY items
    const trimmedHistory = history.slice(0, MAX_HISTORY);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

export function getFromHistory(
  hotelId: string,
  location: string,
  checkinDate: string,
  checkoutDate: string
): HistoryItem | null {
  const history = getHistory();

  return (
    history.find(
      (item) =>
        item.hotelId === hotelId &&
        item.location === location &&
        item.checkinDate === checkinDate &&
        item.checkoutDate === checkoutDate
    ) || null
  );
}

export function deleteFromHistory(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const history = getHistory();
    const filtered = history.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete from history:', error);
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
}
