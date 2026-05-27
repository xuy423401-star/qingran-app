/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { Meal, UserProfile, DailyDataMap, FoodItem, WeightRecord } from "./types";

/**
 * Robust Supabase persistence service with full fallback tolerance.
 */

// Helper to convert db naming format to UserProfile
function mapProfileRowToUi(row: any, fallbackProfile: UserProfile): UserProfile {
  let parsedWeightHistory = fallbackProfile.weightHistory;
  if (row.weight_history) {
    try {
      parsedWeightHistory = typeof row.weight_history === "string" 
        ? JSON.parse(row.weight_history) 
        : row.weight_history;
    } catch (e) {
      console.error("Failed to parse weight history JSON", e);
    }
  }

  return {
    targetCalories: row.daily_calorie_target ?? row.target_calories ?? fallbackProfile.targetCalories,
    currentWeight: row.current_weight ?? fallbackProfile.currentWeight,
    targetWeight: row.target_weight ?? fallbackProfile.targetWeight,
    reminderTime: row.reminder_time ?? fallbackProfile.reminderTime,
    streakCount: row.streak_count ?? fallbackProfile.streakCount,
    longestStreak: row.longest_streak ?? fallbackProfile.longestStreak,
    weekRecordsCount: row.week_records_count ?? fallbackProfile.weekRecordsCount,
    hasCheckedInToday: fallbackProfile.hasCheckedInToday, // managed by checkins table
    lastCheckInDate: row.last_check_in_date ?? fallbackProfile.lastCheckInDate,
    totalCheckInDays: row.total_check_in_days ?? fallbackProfile.totalCheckInDays,
    weightHistory: parsedWeightHistory,
  };
}

function toShortMonthDay(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

export const supabaseService = {
  /**
   * Fetch profiles for a specific authenticated user
   */
  async fetchProfile(userId: string, fallbackProfile: UserProfile): Promise<UserProfile> {
    if (!isSupabaseConfigured || !supabase) return fallbackProfile;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Supabase profiles table fetch error (falling back):", error.message);
        return fallbackProfile;
      }

      if (!data) {
        // If profile doesn't exist yet, insert the fallback one
        await this.saveProfile(userId, fallbackProfile);
        return fallbackProfile;
      }

      return mapProfileRowToUi(data, fallbackProfile);
    } catch (err) {
      console.warn("Unhandled error fetching profile (falling back):", err);
      return fallbackProfile;
    }
  },

  /**
   * Save user profiles
   */
  async saveProfile(userId: string, profile: UserProfile): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const dbPayload = {
        id: userId,
        daily_calorie_target: profile.targetCalories,
        current_weight: profile.currentWeight,
        target_weight: profile.targetWeight,
        reminder_time: profile.reminderTime,
        streak_count: profile.streakCount,
        longest_streak: profile.longestStreak,
        week_records_count: profile.weekRecordsCount,
        total_check_in_days: profile.totalCheckInDays,
        last_check_in_date: profile.lastCheckInDate,
        weight_history: profile.weightHistory
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(dbPayload, { onConflict: "id" });

      if (error) {
        console.warn("Supabase profiles upsert error:", error.message);
      }
    } catch (err) {
      console.warn("Unhandled profiles save error:", err);
    }
  },

  /**
   * Fetch today's meals for the dashboard
   */
  async fetchTodayMeals(userId: string, dateStr: string): Promise<Meal[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      // 1. Fetch meals for this day
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

      // 2. Fetch all corresponding meal_items
      const mealIds = mealsData.map((m) => m.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from("meal_items")
        .select("*")
        .in("meal_id", mealIds);

      if (itemsError) {
        console.warn("Supabase meal_items query error:", itemsError.message);
      }

      const itemsGroupedByMeal = (itemsData || []).reduce<Record<string, FoodItem[]>>((acc, row) => {
        if (!acc[row.meal_id]) acc[row.meal_id] = [];
        acc[row.meal_id].push({
          id: row.id,
          name: row.name,
          weightGrams: row.weight_grams ?? undefined,
          calories: row.calories ?? 0
        });
        return acc;
      }, {});

      // 3. Assemble and return UI meals
      return mealsData.map<Meal>((m) => {
        let parsedTags: string[] = [];
        if (m.tags) {
          try {
            parsedTags = typeof m.tags === "string" ? JSON.parse(m.tags) : m.tags;
          } catch {
            parsedTags = Array.isArray(m.tags) ? m.tags : [];
          }
        }

        return {
          id: m.id,
          title: m.title || itemsGroupedByMeal[m.id]?.map((item) => item.name).join("、") || "本餐记录",
          type: m.meal_type || m.type || "lunch",
          time: m.time || "",
          imageUrl: m.image_url || undefined,
          tags: parsedTags,
          totalCalories: m.total_calories || 0,
          items: itemsGroupedByMeal[m.id] || []
        };
      });
    } catch (err) {
      console.warn("Unhandled today's meals query error:", err);
      return [];
    }
  },

  /**
   * Save a newly identified meal and its food items
   */
  async saveMeal(userId: string, dateStr: string, meal: Meal): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      // 1. Write the meal record
      const mealRow = {
        id: meal.id,
        user_id: userId,
        log_date: dateStr,
        meal_type: meal.type,
        image_url: meal.imageUrl || null,
        total_calories: meal.totalCalories,
        created_at: new Date().toISOString()
      };

      const { error: mealError } = await supabase
        .from("meals")
        .upsert(mealRow);

      if (mealError) {
        console.warn("Supabase save meal row error:", mealError.message);
        return false;
      }

      // 2. Write meal_items associated with this meal
      if (meal.items && meal.items.length > 0) {
        const itemRows = meal.items.map((it) => ({
          id: it.id,
          meal_id: meal.id,
          name: it.name,
          calories: it.calories
        }));

        // Delete any existing items for this meal to avoid primary key conflicts on update
        await supabase.from("meal_items").delete().eq("meal_id", meal.id);

        const { error: itemsError } = await supabase
          .from("meal_items")
          .insert(itemRows);

        if (itemsError) {
          console.warn("Supabase batch save meal_items error:", itemsError.message);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.warn("Unhandled error saving meal records to Supabase:", err);
      return false;
    }
  },

  /**
   * Delete a dietary meal and cascade its children food items
   */
  async deleteMeal(userId: string, mealId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      // Cascade deleting is normally handled in schema, but we do client-side guard as well just in case.
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

  /**
   * Fetch today's checkin status
   */
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

      return data?.is_completed ?? false;
    } catch (err) {
      console.warn("Unhandled error fetching checkin status:", err);
      return false;
    }
  },

  /**
   * Save check-in status
   */
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

  /**
   * Fetch recent weight logs for the profile trend chart.
   */
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
          weight: Number(row.weight)
        }))
        .filter((record) => Number.isFinite(record.weight));
    } catch (err) {
      console.warn("Unhandled error fetching weight logs:", err);
      return [];
    }
  },

  /**
   * Upsert today's weight log so the chart survives across devices.
   */
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

  /**
   * Assemble complete DailyDataMap for the left side calendar overlay view
   */
  async fetchDailyDataMap(userId: string, localFallbackMap: DailyDataMap): Promise<DailyDataMap> {
    if (!isSupabaseConfigured || !supabase) return localFallbackMap;

    try {
      // 1. Fetch all checkins for caller user
      const { data: checkinsData, error: ciError } = await supabase
        .from("checkins")
        .select("*")
        .eq("user_id", userId);

      if (ciError) {
        console.warn("Supabase fetch checkins list failed (reverting to fallback map):", ciError.message);
        return localFallbackMap;
      }

      // 2. Fetch all meals for caller user
      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", userId);

      if (mealsError) {
        console.warn("Supabase fetch meals list failed:", mealsError.message);
        return localFallbackMap;
      }

      // 3. Fetch all associated meal items for caller user via a join-free in select
      let itemsGroupedByMeal: Record<string, FoodItem[]> = {};
      if (mealsData && mealsData.length > 0) {
        const mealIds = mealsData.map((m) => m.id);
        const { data: itemsData, error: itemsError } = await supabase
          .from("meal_items")
          .select("*")
          .in("meal_id", mealIds);

        if (itemsError) {
          console.warn("Supabase fetch meal_items lost list:", itemsError.message);
        } else if (itemsData) {
          itemsGroupedByMeal = itemsData.reduce<Record<string, FoodItem[]>>((acc, row) => {
            if (!acc[row.meal_id]) acc[row.meal_id] = [];
            acc[row.meal_id].push({
              id: row.id,
              name: row.name,
              weightGrams: row.weight_grams ?? undefined,
              calories: row.calories ?? 0
            });
            return acc;
          }, {});
        }
      }

      // Map structure creation
      const mergedMap: DailyDataMap = {};

      // Seed with initial / fallback dates so historical records also present nicely
      Object.keys(localFallbackMap).forEach((dateStr) => {
        mergedMap[dateStr] = {
          meals: [],
          hasCheckedIn: false,
          totalCalories: 0
        };
      });

      // Insert checkins
      (checkinsData || []).forEach((row) => {
        const rowDate = row.log_date || row.date;
        if (!mergedMap[rowDate]) {
          mergedMap[rowDate] = { meals: [], hasCheckedIn: false, totalCalories: 0 };
        }
        mergedMap[rowDate].hasCheckedIn = row.is_completed ?? row.has_checked_in ?? false;
      });

      // Insert meals with food items grouped
      (mealsData || []).forEach((m) => {
        const mealDate = m.log_date || m.date;
        if (!mergedMap[mealDate]) {
          mergedMap[mealDate] = { meals: [], hasCheckedIn: false, totalCalories: 0 };
        }

        let parsedTags: string[] = [];
        if (m.tags) {
          try {
            parsedTags = typeof m.tags === "string" ? JSON.parse(m.tags) : m.tags;
          } catch {
            parsedTags = Array.isArray(m.tags) ? m.tags : [];
          }
        }

        const uiMeal: Meal = {
          id: m.id,
          title: m.title || itemsGroupedByMeal[m.id]?.map((item) => item.name).join("、") || "本餐记录",
          type: m.meal_type || m.type || "lunch",
          time: m.time || "",
          imageUrl: m.image_url || undefined,
          tags: parsedTags,
          totalCalories: m.total_calories || 0,
          items: itemsGroupedByMeal[m.id] || []
        };

        mergedMap[mealDate].meals.push(uiMeal);
      });

      // Recalculate total combined calories per date
      Object.keys(mergedMap).forEach((dateKey) => {
        const dLog = mergedMap[dateKey];
        dLog.totalCalories = dLog.meals.reduce((total, meal) => total + meal.totalCalories, 0);
      });

      return mergedMap;
    } catch (err) {
      console.warn("Unhandled exception building dynamic daily data map (reverting to fallback map):", err);
      return localFallbackMap;
    }
  }
};
