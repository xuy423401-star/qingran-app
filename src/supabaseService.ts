/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { Meal, UserProfile, DailyDataMap, FoodItem, WeightRecord } from "./types";

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSafeOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toShortMonthDay(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

function parseTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter((tag) => typeof tag === "string");
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function resolveMealTitle(rawTitle: unknown, items: FoodItem[]): string {
  if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
    return rawTitle.trim();
  }

  const names = items.map((item) => item.name).filter(Boolean);
  if (names.length > 0) {
    return names.join(" / ");
  }

  return "本餐记录";
}

function mapMealItems(rows: any[]): Record<string, FoodItem[]> {
  return (rows || []).reduce<Record<string, FoodItem[]>>((acc, row) => {
    if (!acc[row.meal_id]) acc[row.meal_id] = [];
    acc[row.meal_id].push({
      id: row.id,
      name: row.name,
      weightGrams: toSafeOptionalNumber(row.weight_grams),
      calories: toSafeNumber(row.calories)
    });
    return acc;
  }, {});
}

function mapMealRowToUi(row: any, itemsByMeal: Record<string, FoodItem[]>): Meal {
  const items = itemsByMeal[row.id] || [];

  return {
    id: row.id,
    title: resolveMealTitle(row.title, items),
    type: row.meal_type || row.type || "lunch",
    time: row.time || "",
    imageUrl: row.image_url || undefined,
    tags: parseTags(row.tags),
    totalCalories: toSafeNumber(row.total_calories),
    items
  };
}

function mapProfileRowToUi(row: any, fallbackProfile: UserProfile): UserProfile {
  let parsedWeightHistory = fallbackProfile.weightHistory;
  if (row.weight_history) {
    try {
      parsedWeightHistory = typeof row.weight_history === "string"
        ? JSON.parse(row.weight_history)
        : row.weight_history;
    } catch {
      parsedWeightHistory = fallbackProfile.weightHistory;
    }
  }

  return {
    targetCalories: row.daily_calorie_target ?? row.target_calories ?? fallbackProfile.targetCalories,
    currentWeight: toSafeNumber(row.current_weight, fallbackProfile.currentWeight),
    targetWeight: toSafeNumber(row.target_weight, fallbackProfile.targetWeight),
    reminderTime: row.reminder_time ?? fallbackProfile.reminderTime,
    streakCount: toSafeNumber(row.streak_count, fallbackProfile.streakCount),
    longestStreak: toSafeNumber(row.longest_streak, fallbackProfile.longestStreak),
    weekRecordsCount: toSafeNumber(row.week_records_count, fallbackProfile.weekRecordsCount),
    hasCheckedInToday: fallbackProfile.hasCheckedInToday,
    lastCheckInDate: row.last_check_in_date ?? fallbackProfile.lastCheckInDate,
    totalCheckInDays: toSafeNumber(row.total_check_in_days, fallbackProfile.totalCheckInDays),
    weightHistory: parsedWeightHistory
  };
}

export const supabaseService = {
  async fetchProfile(userId: string, fallbackProfile: UserProfile): Promise<UserProfile> {
    if (!isSupabaseConfigured || !supabase) return fallbackProfile;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Supabase profiles table fetch error:", error.message);
        return fallbackProfile;
      }

      if (!data) {
        await this.saveProfile(userId, fallbackProfile);
        return fallbackProfile;
      }

      return mapProfileRowToUi(data, fallbackProfile);
    } catch (err) {
      console.warn("Unhandled error fetching profile:", err);
      return fallbackProfile;
    }
  },

  async saveProfile(userId: string, profile: UserProfile): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const payload = {
        id: userId,
        daily_calorie_target: toSafeNumber(profile.targetCalories),
        current_weight: toSafeNumber(profile.currentWeight),
        target_weight: toSafeNumber(profile.targetWeight),
        reminder_time: profile.reminderTime,
        streak_count: toSafeNumber(profile.streakCount),
        longest_streak: toSafeNumber(profile.longestStreak),
        week_records_count: toSafeNumber(profile.weekRecordsCount),
        total_check_in_days: toSafeNumber(profile.totalCheckInDays),
        last_check_in_date: profile.lastCheckInDate,
        weight_history: profile.weightHistory
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) {
        console.warn("Supabase profiles upsert error:", error.message);
      }
    } catch (err) {
      console.warn("Unhandled profiles save error:", err);
    }
  },

  async fetchTodayMeals(userId: string, dateStr: string): Promise<Meal[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", dateStr)
        .order("created_at", { ascending: false });

      if (mealsError) {
        console.warn("Supabase meals query error:", mealsError.message);
        return [];
      }
      if (!mealsData || mealsData.length === 0) return [];

      const mealIds = mealsData.map((m) => m.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from("meal_items")
        .select("*")
        .in("meal_id", mealIds);

      if (itemsError) {
        console.warn("Supabase meal_items query error:", itemsError.message);
      }

      const itemsByMeal = mapMealItems(itemsData || []);
      return mealsData.map((row) => mapMealRowToUi(row, itemsByMeal));
    } catch (err) {
      console.warn("Unhandled today's meals query error:", err);
      return [];
    }
  },

  async saveMeal(userId: string, dateStr: string, meal: Meal): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const mealRow = {
        id: meal.id,
        user_id: userId,
        log_date: dateStr,
        title: meal.title || null,
        meal_type: meal.type,
        time: meal.time || null,
        image_url: meal.imageUrl || null,
        total_calories: toSafeNumber(meal.totalCalories),
        created_at: new Date().toISOString()
      };

      const { error: mealError } = await supabase
        .from("meals")
        .upsert(mealRow, { onConflict: "id" });

      if (mealError) {
        console.warn("Supabase save meal row error:", mealError.message);
        return false;
      }

      const items = Array.isArray(meal.items) ? meal.items : [];
      if (items.length === 0) {
        return true;
      }

      const itemRows = items.map((it) => ({
        id: it.id,
        meal_id: meal.id,
        name: it.name,
        calories: toSafeNumber(it.calories),
        weight_grams: toSafeOptionalNumber(it.weightGrams) ?? null
      }));

      await supabase.from("meal_items").delete().eq("meal_id", meal.id);
      const { error: itemsError } = await supabase.from("meal_items").insert(itemRows);
      if (itemsError) {
        console.warn("Supabase batch save meal_items error:", itemsError.message);
        return false;
      }

      return true;
    } catch (err) {
      console.warn("Unhandled error saving meal records to Supabase:", err);
      return false;
    }
  },

  async saveMealsBatch(userId: string, dateStr: string, meals: Meal[]): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    if (!Array.isArray(meals) || meals.length === 0) return true;

    try {
      for (const meal of meals) {
        const ok = await this.saveMeal(userId, dateStr, meal);
        if (!ok) return false;
      }
      return true;
    } catch (err) {
      console.warn("Unhandled error batch syncing meals:", err);
      return false;
    }
  },

  async deleteMeal(userId: string, mealId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      await supabase.from("meal_items").delete().eq("meal_id", mealId);
      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", mealId)
        .eq("user_id", userId);

      if (error) {
        console.warn("Supabase delete meal error:", error.message);
      }
    } catch (err) {
      console.warn("Unhandled error deleting meal row:", err);
    }
  },

  async fetchCheckInStatus(userId: string, dateStr: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const { data, error } = await supabase
        .from("checkins")
        .select("is_completed")
        .eq("user_id", userId)
        .eq("log_date", dateStr)
        .maybeSingle();

      if (error) {
        console.warn("Supabase fetch check-in status error:", error.message);
        return false;
      }

      return Boolean(data?.is_completed);
    } catch (err) {
      console.warn("Unhandled error fetching checkin status:", err);
      return false;
    }
  },

  async saveCheckInStatus(userId: string, dateStr: string, hasCheckedIn: boolean): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const payload = {
        user_id: userId,
        log_date: dateStr,
        is_completed: hasCheckedIn
      };

      const { error } = await supabase
        .from("checkins")
        .upsert(payload, { onConflict: "user_id,log_date" });

      if (error) {
        console.warn("Supabase set check-in status error:", error.message);
      }
    } catch (err) {
      console.warn("Unhandled error saving checkin status:", err);
    }
  },

  async fetchWeightLogs(userId: string): Promise<WeightRecord[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from("weight_logs")
        .select("log_date, weight")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(10);

      if (error) {
        console.warn("Supabase fetch weight logs error:", error.message);
        return [];
      }

      return (data || [])
        .slice()
        .reverse()
        .map((row) => ({
          date: toShortMonthDay(row.log_date),
          weight: toSafeNumber(row.weight)
        }))
        .filter((record) => Number.isFinite(record.weight));
    } catch (err) {
      console.warn("Unhandled error fetching weight logs:", err);
      return [];
    }
  },

  async saveWeightLog(userId: string, dateStr: string, weight: number): Promise<void> {
    if (!isSupabaseConfigured || !supabase || !Number.isFinite(weight) || weight <= 0) return;

    try {
      const { error } = await supabase
        .from("weight_logs")
        .upsert(
          {
            user_id: userId,
            log_date: dateStr,
            weight,
            updated_at: new Date().toISOString()
          },
          { onConflict: "user_id,log_date" }
        );

      if (error) {
        console.warn("Supabase save weight log error:", error.message);
      }
    } catch (err) {
      console.warn("Unhandled error saving weight log:", err);
    }
  },

  async fetchDailyDataMap(userId: string, localFallbackMap: DailyDataMap): Promise<DailyDataMap> {
    if (!isSupabaseConfigured || !supabase) return localFallbackMap;

    try {
      const { data: checkinsData, error: checkinsError } = await supabase
        .from("checkins")
        .select("*")
        .eq("user_id", userId);

      if (checkinsError) {
        console.warn("Supabase fetch checkins list failed:", checkinsError.message);
        return localFallbackMap;
      }

      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", userId);

      if (mealsError) {
        console.warn("Supabase fetch meals list failed:", mealsError.message);
        return localFallbackMap;
      }

      let itemsByMeal: Record<string, FoodItem[]> = {};
      if (mealsData && mealsData.length > 0) {
        const mealIds = mealsData.map((m) => m.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from("meal_items")
          .select("*")
          .in("meal_id", mealIds);

        if (itemsError) {
          console.warn("Supabase fetch meal_items failed:", itemsError.message);
        } else {
          itemsByMeal = mapMealItems(itemsData || []);
        }
      }

      const mergedMap: DailyDataMap = {};
      Object.keys(localFallbackMap).forEach((dateStr) => {
        mergedMap[dateStr] = {
          meals: [],
          hasCheckedIn: false,
          totalCalories: 0
        };
      });

      (checkinsData || []).forEach((row) => {
        const rowDate = row.log_date || row.date;
        if (!mergedMap[rowDate]) {
          mergedMap[rowDate] = { meals: [], hasCheckedIn: false, totalCalories: 0 };
        }
        mergedMap[rowDate].hasCheckedIn = Boolean(row.is_completed ?? row.has_checked_in);
      });

      (mealsData || []).forEach((row) => {
        const rowDate = row.log_date || row.date;
        if (!mergedMap[rowDate]) {
          mergedMap[rowDate] = { meals: [], hasCheckedIn: false, totalCalories: 0 };
        }
        mergedMap[rowDate].meals.push(mapMealRowToUi(row, itemsByMeal));
      });

      Object.keys(mergedMap).forEach((dateKey) => {
        const log = mergedMap[dateKey];
        log.totalCalories = log.meals.reduce((total, meal) => total + toSafeNumber(meal.totalCalories), 0);
      });

      return mergedMap;
    } catch (err) {
      console.warn("Unhandled exception building daily data map:", err);
      return localFallbackMap;
    }
  }
};
