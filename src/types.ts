/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FoodItem {
  id: string;
  name: string;
  weightGrams?: number;
  calories: number;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Meal {
  id: string;
  title: string;          // e.g. "牛油果水波蛋吐司" or "本餐合计"
  type: MealType;
  time: string;           // e.g. "08:30 AM" or "12:15 PM"
  items: FoodItem[];      // Detailed breakdown of food items in this meal
  totalCalories: number;  // Combined kcal sum
  imageUrl?: string;      // Premium image hotlink
  tags?: string[];        // High level tags like ["高蛋�?, "健康油脂"]
}

export interface WeightRecord {
  date: string;  // e.g. "05-21", "05-22", etc.
  weight: number; // weight in kg
}

export interface DailyLog {
  meals: Meal[];
  hasCheckedIn: boolean;
  totalCalories: number;
}

export type DailyDataMap = Record<string, DailyLog>;

export interface UserProfile {
  targetCalories: number; // e.g. 1450 kcal
  currentWeight: number;  // e.g. 64.5 kg
  targetWeight: number;   // e.g. 58.0 kg
  weightHistory: WeightRecord[];
  reminderTime: string;   // e.g. "20:30"
  streakCount: number;    // e.g. 12
  longestStreak: number;  // e.g. 15
  weekRecordsCount: number; // e.g. 6 (days of this week populated with record)
  totalCheckInDays: number; // all-time total unique days with check-in
  hasCheckedInToday: boolean; // Has tapped "完成今日打卡"
  lastCheckInDate: string | null; // Tracked date of last check-in
}
