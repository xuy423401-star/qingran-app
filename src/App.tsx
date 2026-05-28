/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./components/Header";
import { BottomNavBar, TabType } from "./components/BottomNavBar";
import { HomeTab } from "./components/HomeTab";
import { PhotoTab } from "./components/PhotoTab";
import { MeTab } from "./components/MeTab";
import { CalendarDrawer } from "./components/CalendarDrawer";
import { Meal, UserProfile, DailyDataMap } from "./types";
import { DEFAULT_USER_PROFILE, INITIAL_MEALS, INITIAL_DAILY_DATA } from "./mockData";
import { Check, Sparkles } from "lucide-react";
import { supabase } from "./supabaseClient";
import { supabaseService } from "./supabaseService";

const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateString = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getTodayString = () => getDateString(new Date());
const getTodayMonthDayString = () => {
  const today = new Date();
  return `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const TODAY_STR = getTodayString();
const LOCAL_STORAGE_KEYS = [
  "qingran_daily_data_v1",
  "qingran_user_profile",
  "qingran_meals_log"
];
const LEGACY_DEMO_DATES = ["2026-05-22", "2026-05-23", "2026-05-24", "2026-05-25", "2026-05-26", "2026-05-27"];
const LEGACY_DEMO_MEAL_IDS = new Set(["meal-1", "meal-2", "meal-3", "meal-old-1", "meal-old-2", "meal-old-3"]);

const safeReadJson = <T,>(key: string): T | null => {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.warn(`Failed to parse ${key}; resetting this local cache.`, error);
    localStorage.removeItem(key);
    return null;
  }
};

const hasLegacyDemoProfile = (profile: Partial<UserProfile> | null) => {
  if (!profile) return false;

  const firstWeightRecord = profile.weightHistory?.[0];
  return (
    profile.streakCount === 12 &&
    profile.longestStreak === 15 &&
    profile.weekRecordsCount === 6 &&
    profile.currentWeight === 64.5 &&
    profile.targetWeight === 58 &&
    firstWeightRecord?.date === "05-21" &&
    firstWeightRecord?.weight === 66.2
  );
};

const hasLegacyDemoDailyData = (dailyMap: DailyDataMap | null) => {
  if (!dailyMap) return false;

  const demoDateCount = LEGACY_DEMO_DATES.filter((dateStr) => Boolean(dailyMap[dateStr])).length;
  const demoTodayTotal = dailyMap["2026-05-27"]?.totalCalories === 980;
  const hasDemoMeal = Object.values(dailyMap).some((log) =>
    log?.meals?.some((meal) => LEGACY_DEMO_MEAL_IDS.has(meal.id))
  );

  return demoDateCount >= 3 || demoTodayTotal || hasDemoMeal;
};

const hasLegacyDemoMeals = (mealsList: Meal[] | null) => {
  return Boolean(mealsList?.some((meal) => LEGACY_DEMO_MEAL_IDS.has(meal.id)));
};

const shouldResetLegacyGuestData = (
  profile: Partial<UserProfile> | null,
  dailyMap: DailyDataMap | null,
  mealsList: Meal[] | null
) => {
  return hasLegacyDemoProfile(profile) || hasLegacyDemoDailyData(dailyMap) || hasLegacyDemoMeals(mealsList);
};

const clearLocalAppData = () => {
  LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

const getCachedTodayCheckedIn = () => {
  const cachedDailyData = safeReadJson<DailyDataMap>("qingran_daily_data_v1");
  const cachedProfile = safeReadJson<UserProfile>("qingran_user_profile");

  return Boolean(
    cachedDailyData?.[TODAY_STR]?.hasCheckedIn ||
    cachedProfile?.hasCheckedInToday ||
    cachedProfile?.lastCheckInDate === TODAY_STR
  );
};

const calculateCurrentStreak = (dailyMap: DailyDataMap, todayStr: string) => {
  let cursor = parseDateString(todayStr);
  let streak = 0;

  if (!dailyMap[todayStr]?.hasCheckedIn) {
    cursor = addDays(cursor, -1);
  }

  while (streak < 3660) {
    const cursorStr = getDateString(cursor);
    if (!dailyMap[cursorStr]?.hasCheckedIn) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
};

const calculateLongestStreak = (dailyMap: DailyDataMap) => {
  const checkedDates = Object.entries(dailyMap)
    .filter(([, log]) => log?.hasCheckedIn)
    .map(([dateStr]) => dateStr)
    .sort();

  let longest = 0;
  let current = 0;
  let previousDate: Date | null = null;

  checkedDates.forEach((dateStr) => {
    const date = parseDateString(dateStr);
    const isConsecutive = previousDate && getDateString(addDays(previousDate, 1)) === dateStr;

    current = isConsecutive ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousDate = date;
  });

  return longest;
};

const countCurrentWeekRecords = (dailyMap: DailyDataMap, todayStr: string) => {
  const today = parseDateString(todayStr);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDays(today, mondayOffset);
  let count = 0;

  for (let i = 0; i < 7; i += 1) {
    const dateStr = getDateString(addDays(monday, i));
    const log = dailyMap[dateStr];
    if (log?.hasCheckedIn || (log?.meals?.length ?? 0) > 0) {
      count += 1;
    }
  }

  return count;
};

const countTotalCheckInDays = (dailyMap: DailyDataMap) => {
  return Object.values(dailyMap).filter((log) => log?.hasCheckedIn).length;
};

const applyDailyStatsToProfile = (
  profile: UserProfile,
  dailyMap: DailyDataMap,
  hasCheckedInToday: boolean
): UserProfile => {
  const currentStreak = calculateCurrentStreak(dailyMap, TODAY_STR);
  const longestStreak = calculateLongestStreak(dailyMap);

  return {
    ...profile,
    streakCount: currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    weekRecordsCount: countCurrentWeekRecords(dailyMap, TODAY_STR),
    totalCheckInDays: countTotalCheckInDays(dailyMap),
    hasCheckedInToday
  };
};

const mergeMealsById = (primaryMeals: Meal[], secondaryMeals: Meal[]) => {
  const seen = new Set<string>();
  const merged: Meal[] = [];

  [...primaryMeals, ...secondaryMeals].forEach((meal) => {
    if (!meal?.id || seen.has(meal.id)) return;
    seen.add(meal.id);
    merged.push(meal);
  });

  return merged;
};

const hasInlineImage = (meal: Meal) => typeof meal.imageUrl === "string" && meal.imageUrl.startsWith("data:");

const stripInlineImages = (mealList: Meal[]) =>
  mealList.map((meal) => (hasInlineImage(meal) ? { ...meal, imageUrl: undefined } : meal));

const writeJsonToLocalStorage = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to persist ${key} to localStorage.`, error);
    return false;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [meals, setMeals] = useState<Meal[]>(INITIAL_MEALS);
  const [dailyData, setDailyData] = useState<DailyDataMap>(INITIAL_DAILY_DATA);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const toastTimerRef = useRef<number | null>(null);

  const getActiveUserId = async () => {
    if (!supabase) return sessionUser?.id ?? null;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("Could not refresh current Supabase user:", error.message);
    }

    const activeUser = data.user ?? sessionUser ?? null;
    if (activeUser && activeUser.id !== sessionUser?.id) {
      setSessionUser(activeUser);
    }

    return activeUser?.id ?? null;
  };

  const loadLocalSnapshot = () => {
    let currentDailyData = safeReadJson<DailyDataMap>("qingran_daily_data_v1") || INITIAL_DAILY_DATA;
    let storedProfile = safeReadJson<UserProfile>("qingran_user_profile");
    const storedMeals = safeReadJson<Meal[]>("qingran_meals_log");

    if (shouldResetLegacyGuestData(storedProfile, currentDailyData, storedMeals)) {
      clearLocalAppData();
      currentDailyData = INITIAL_DAILY_DATA;
      storedProfile = null;
    }

    const fallbackMeals = Array.isArray(storedMeals) ? storedMeals : [];
    const todayLogFromMap = currentDailyData[TODAY_STR];
    const todayMealsFromMap = Array.isArray(todayLogFromMap?.meals) ? todayLogFromMap.meals : [];
    const todayMeals = todayMealsFromMap.length > 0 ? todayMealsFromMap : fallbackMeals;
    const todayCheckedIn = Boolean(
      todayLogFromMap?.hasCheckedIn ||
      storedProfile?.hasCheckedInToday ||
      storedProfile?.lastCheckInDate === TODAY_STR
    );
    const todayTotalCalories = todayMeals.reduce((sum, meal) => sum + (Number(meal.totalCalories) || 0), 0);
    const normalizedDailyData: DailyDataMap = {
      ...currentDailyData,
      [TODAY_STR]: {
        meals: todayMeals,
        hasCheckedIn: todayCheckedIn,
        totalCalories: todayTotalCalories
      }
    };
    const nextProfile = storedProfile
      ? { ...DEFAULT_USER_PROFILE, ...storedProfile }
      : DEFAULT_USER_PROFILE;

    return {
      dailyData: normalizedDailyData,
      meals: todayMeals,
      profile: nextProfile,
      hasCheckedInToday: todayCheckedIn
    };
  };

  const applyLocalSnapshotToState = () => {
    const localSnapshot = loadLocalSnapshot();
    localStorage.setItem("qingran_daily_data_v1", JSON.stringify(localSnapshot.dailyData));
    localStorage.setItem("qingran_user_profile", JSON.stringify(localSnapshot.profile));
    localStorage.setItem("qingran_meals_log", JSON.stringify(localSnapshot.meals));

    setDailyData(localSnapshot.dailyData);
    setMeals(localSnapshot.meals);
    setUserProfile(
      applyDailyStatsToProfile(localSnapshot.profile, localSnapshot.dailyData, localSnapshot.hasCheckedInToday)
    );
  };

  // Load data for the specified user or fallback to guest model
  const loadData = async (userId: string | null) => {
    try {
      if (userId && supabase) {
        const localSnapshot = loadLocalSnapshot();
        const dbProfile = await supabaseService.fetchProfile(userId, DEFAULT_USER_PROFILE);
        const todayCheckedIn = await supabaseService.fetchCheckInStatus(userId, TODAY_STR);
        const dbMeals = await supabaseService.fetchTodayMeals(userId, TODAY_STR);
        const dbDailyMap = await supabaseService.fetchDailyDataMap(userId, INITIAL_DAILY_DATA);
        const dbWeightLogs = await supabaseService.fetchWeightLogs(userId);

        const mergedMeals = mergeMealsById(localSnapshot.meals, dbMeals);
        const hasCloudMeals = dbMeals.length > 0;
        const hasLocalMeals = localSnapshot.meals.length > 0;
        const resolvedMeals = mergedMeals.length > 0 ? mergedMeals : dbMeals;
        const resolvedTodayCheckedIn = Boolean(
          todayCheckedIn ||
          localSnapshot.hasCheckedInToday ||
          getCachedTodayCheckedIn()
        );
        const todayCalories = resolvedMeals.reduce((sum, meal) => sum + (Number(meal.totalCalories) || 0), 0);
        const normalizedDailyMap = {
          ...dbDailyMap,
          [TODAY_STR]: {
            meals: resolvedMeals,
            hasCheckedIn: resolvedTodayCheckedIn,
            totalCalories: todayCalories
          }
        };
        const latestWeightLog = dbWeightLogs[dbWeightLogs.length - 1];
        const profileWithCloudWeight = {
          ...dbProfile,
          currentWeight: latestWeightLog?.weight ?? dbProfile.currentWeight,
          weightHistory: dbWeightLogs.length > 0 ? dbWeightLogs : dbProfile.weightHistory
        };

        if (resolvedTodayCheckedIn && !todayCheckedIn) {
          await supabaseService.saveCheckInStatus(userId, TODAY_STR, true);
        }

        // Cloud has not caught up yet: keep local records in UI and backfill once.
        if (hasLocalMeals && resolvedMeals.length > dbMeals.length) {
          const backfilled = await supabaseService.saveMealsBatch(userId, TODAY_STR, resolvedMeals);
          if (!backfilled.ok) {
            console.warn("Cloud backfill failed, keeping local data as source of truth for now.", backfilled.message);
          }
        }

        localStorage.setItem("qingran_daily_data_v1", JSON.stringify(normalizedDailyMap));
        localStorage.setItem("qingran_meals_log", JSON.stringify(resolvedMeals));

        setUserProfile(applyDailyStatsToProfile(profileWithCloudWeight, normalizedDailyMap, resolvedTodayCheckedIn));
        setMeals(resolvedMeals);
        setDailyData(normalizedDailyMap);
      } else {
        applyLocalSnapshotToState();
      }
    } catch (e) {
      console.warn("Failed to retrieve dataset comfortably, fallback to static values working fine:", e);
      applyLocalSnapshotToState();
    }
  };

  // Auth session listener
  useEffect(() => {
    if (supabase) {
      // Get initial authentication credentials
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSessionUser(session?.user ?? null);
      });

      // Bind listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSessionUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Reload dataset whenever user toggles
  useEffect(() => {
    loadData(sessionUser?.id ?? null);
  }, [sessionUser]);

  // Save to localStorage and keep daily data map in sync
  const saveProfile = async (updatedProfile: UserProfile, currentMealsList?: Meal[]) => {
    const activeMeals = currentMealsList !== undefined ? currentMealsList : meals;
    const totalCalSum = activeMeals.reduce((sum, m) => sum + m.totalCalories, 0);
    const nextMap = {
      ...dailyData,
      [TODAY_STR]: {
        meals: activeMeals,
        hasCheckedIn: updatedProfile.hasCheckedInToday,
        totalCalories: totalCalSum
      }
    };
    const profileToSave = applyDailyStatsToProfile(updatedProfile, nextMap, updatedProfile.hasCheckedInToday);

    setDailyData(nextMap);
    setUserProfile(profileToSave);
    localStorage.setItem("qingran_daily_data_v1", JSON.stringify(nextMap));
    localStorage.setItem("qingran_user_profile", JSON.stringify(profileToSave));

    // Cloud saving integration
    if (sessionUser?.id) {
      try {
        await supabaseService.saveProfile(sessionUser.id, profileToSave);
      } catch (err) {
        console.warn("Could not save profile preferences to Supabase:", err);
      }
    }
  };

  const saveMeals = (updatedMeals: Meal[]) => {
    const totalCalSum = updatedMeals.reduce((sum, m) => sum + (Number(m.totalCalories) || 0), 0);
    const todayHasCheckedIn = Boolean(
      dailyData[TODAY_STR]?.hasCheckedIn ||
      userProfile.hasCheckedInToday ||
      userProfile.lastCheckInDate === TODAY_STR ||
      getCachedTodayCheckedIn()
    );

    const buildSnapshot = (mealList: Meal[]) => {
      const nextMap = {
        ...dailyData,
        [TODAY_STR]: {
          meals: mealList,
          hasCheckedIn: todayHasCheckedIn,
          totalCalories: totalCalSum
        }
      };
      const nextProfile = applyDailyStatsToProfile(userProfile, nextMap, todayHasCheckedIn);

      return { mealList, nextMap, nextProfile };
    };

    const persistSnapshot = (snapshot: ReturnType<typeof buildSnapshot>) => {
      const lightMealsCache = stripInlineImages(snapshot.mealList);
      const lightDailyMap = {
        ...snapshot.nextMap,
        [TODAY_STR]: {
          ...snapshot.nextMap[TODAY_STR],
          meals: lightMealsCache
        }
      };
      const wroteDailyData = writeJsonToLocalStorage("qingran_daily_data_v1", lightDailyMap);
      const wroteProfile = writeJsonToLocalStorage("qingran_user_profile", snapshot.nextProfile);
      const wroteMealsCache = writeJsonToLocalStorage("qingran_meals_log", lightMealsCache);

      return wroteDailyData && wroteProfile && wroteMealsCache;
    };

    let snapshot = buildSnapshot(updatedMeals);
    let droppedImages = false;
    let persisted = persistSnapshot(snapshot);

    if (!persisted && updatedMeals.some(hasInlineImage)) {
      const imageLightMeals = stripInlineImages(updatedMeals);
      snapshot = buildSnapshot(imageLightMeals);
      droppedImages = true;
      persisted = persistSnapshot(snapshot);
    }

    if (!persisted) {
      return { ok: false, droppedImages };
    }

    setMeals(snapshot.mealList);
    setDailyData(snapshot.nextMap);
    setUserProfile(snapshot.nextProfile);

    return { ok: true, droppedImages };
  };

  // Toast notifier helper
  const triggerToast = (msg: string, durationMs = 3600) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToastMessage(msg);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  };

  // 1. Action: Complete punch-in toggle
  const handleCheckIn = async () => {
    if (userProfile.hasCheckedInToday) {
      // Undo check-in for playground friendliness
      const updated: UserProfile = {
        ...userProfile,
        hasCheckedInToday: false,
        streakCount: Math.max(0, userProfile.streakCount - 1),
        lastCheckInDate: null
      };
      await saveProfile(updated);
      if (sessionUser?.id) {
        await supabaseService.saveCheckInStatus(sessionUser.id, TODAY_STR, false);
      }
      triggerToast("已取消今日打卡状态 🌿");
    } else {
      // Complete check-in, increment streak
      const updated: UserProfile = {
        ...userProfile,
        hasCheckedInToday: true,
        streakCount: userProfile.streakCount + 1,
        longestStreak: Math.max(userProfile.longestStreak, userProfile.streakCount + 1),
        lastCheckInDate: TODAY_STR
      };
      await saveProfile(updated);
      if (sessionUser?.id) {
        await supabaseService.saveCheckInStatus(sessionUser.id, TODAY_STR, true);
      }
      triggerToast("打卡成功！坚持就是胜利 🎉");
    }
  };

  // 2. Action: Register newly recognized diet meals from PhotoTab
  const handleSaveMeal = async (newMeal: Meal) => {
    const nextMealsForSave = [newMeal, ...meals];
    const localSaveResult = saveMeals(nextMealsForSave);

    if (!localSaveResult.ok) {
      triggerToast("\u672c\u5730\u7a7a\u95f4\u4e0d\u8db3\uff0c\u8fd9\u6761\u9910\u98df\u8fd8\u6ca1\u6709\u4fdd\u5b58\u6210\u529f");
      return;
    }

    setActiveTab("home");
    triggerToast(
      localSaveResult.droppedImages
        ? `\u9910\u98df\u5df2\u4fdd\u5b58\uff0c\u4f46\u56fe\u7247\u56e0\u672c\u5730\u7a7a\u95f4\u4e0d\u8db3\u672a\u4fdd\u7559 (+${newMeal.totalCalories} kcal)`
        : `\u672c\u5730\u4fdd\u5b58\u6210\u529f\uff0c\u6b63\u5728\u4e0a\u4f20\u4e91\u7aef (+${newMeal.totalCalories} kcal)`
    );

    void (async () => {
      const activeUserIdForSync = await getActiveUserId();
      if (!activeUserIdForSync) {
        triggerToast("\u5df2\u4fdd\u5b58\u5230\u672c\u5730\uff0c\u5f53\u524d\u672a\u767b\u5f55\u4e91\u7aef\u8d26\u53f7", 5200);
        return;
      }

      const savedToCloud = await supabaseService.saveMeal(activeUserIdForSync, TODAY_STR, newMeal);
      if (!savedToCloud.ok) {
        triggerToast(`\u672c\u5730\u5df2\u4fdd\u5b58\uff0c\u4e91\u7aef\u4e0a\u4f20\u5931\u8d25\uff1a${savedToCloud.message || "\u8bf7\u68c0\u67e5 Supabase"}`, 6200);
        return;
      }

      triggerToast(`\u4e91\u7aef\u4e0a\u4f20\u6210\u529f (+${newMeal.totalCalories} kcal)`, 5200);
    })();

    return;

    const activeUserId = await getActiveUserId();
    if (!activeUserId) {
      triggerToast("本地已保存，但当前未登录云端账号，请先到我的页面登录");
      setActiveTab("home");
      return;
    }

    const savedToCloudResult = await supabaseService.saveMeal(activeUserId, TODAY_STR, newMeal);
    if (!savedToCloudResult.ok) {
      triggerToast(`本地已保存，云端失败：${savedToCloudResult.message || "请检查 Supabase 表或 RLS"}`);
      setActiveTab("home");
      return;
    }

    triggerToast(`已添加并同步到云端 (+${newMeal.totalCalories} kcal)`);
    setActiveTab("home");
    return;

    const updatedMeals = [newMeal, ...meals];
    await saveMeals(updatedMeals);

    if (sessionUser?.id) {
      try {
        const savedToCloud = await supabaseService.saveMeal(sessionUser.id, TODAY_STR, newMeal);
        if (!savedToCloud) {
          triggerToast("本地已保存，但云端同步失败，请检查 Supabase 表结构/RLS");
          return;
        }
      } catch (err) {
        console.warn("Offline/Cloud Sync saved meal query anomaly:", err);
        triggerToast("本地已保存，但云端同步失败，请稍后重试");
        return;
      }
    }

    // Notify user
    triggerToast(`已添加这餐到今日饮食 🍽️ (+${newMeal.totalCalories} kcal)`);
    // Back to dashboard
    setActiveTab("home");
  };

  // 3. Action: Delete a logged dietary meal
  const handleDeleteMeal = async (mealId: string) => {
    const updatedMeals = meals.filter((m) => m.id !== mealId);
    const localSaveResult = saveMeals(updatedMeals);
    if (!localSaveResult.ok) {
      triggerToast("\u672c\u5730\u7a7a\u95f4\u4e0d\u8db3\uff0c\u5220\u9664\u540e\u7684\u6570\u636e\u672a\u80fd\u5199\u5165");
      return;
    }

    if (sessionUser?.id) {
      try {
        await supabaseService.deleteMeal(sessionUser.id, mealId);
      } catch (err) {
        console.warn("Offline/Cloud Sync delete meal query anomaly:", err);
      }
    }
    triggerToast("已成功删除该餐记录");
  };

  // 4. Action: Save custom health adjustments (weight, targets, reminder)
  const handleUpdateProfile = async (updated: UserProfile) => {
    const todayMonthDay = getTodayMonthDayString();
    const shouldRecordWeight = updated.currentWeight > 0;
    const historyWithoutToday = updated.weightHistory.filter((record) => record.date !== todayMonthDay);
    const normalizedProfile = {
      ...updated,
      weightHistory: shouldRecordWeight
        ? [...historyWithoutToday, { date: todayMonthDay, weight: updated.currentWeight }].slice(-10)
        : historyWithoutToday
    };

    await saveProfile(normalizedProfile);
    if (sessionUser?.id && normalizedProfile.currentWeight > 0) {
      await supabaseService.saveWeightLog(sessionUser.id, TODAY_STR, normalizedProfile.currentWeight);
    }
    triggerToast(sessionUser?.id ? "参数与体重已同步到云端 🍃" : "参数已保存在本地 🍃");
  };

  // 5. Action: Download Backup state values as formatted plain text .json file
  const handleExportData = () => {
    try {
      const stateBackup = {
        exportedAt: new Date().toISOString(),
        profile: userProfile,
        dietLogs: meals
      };

      const jsonStr = JSON.stringify(stateBackup, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;
      tempLink.download = `qingran_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      
      triggerToast("打卡数据已成功打包导出 📥");
    } catch (err) {
      console.error(err);
      triggerToast("导出失败，请重试");
    }
  };

  // Dynamic header titles based on selection
  const getHeaderTitle = () => {
    switch (activeTab) {
      case "home":
        return "轻燃打卡";
      case "photo":
        return "AI 拍照记录";
      case "me":
        return "我的状态";
      default:
        return "轻燃";
    }
  };

  return (
    <div className="min-h-screen bg-[#eae8e4]/50 flex items-center justify-center font-sans">
      {/* 
        Aesthetic Phone Shell wrapper for desktop. 
        Expands fully to seamless cover on actual mobile devices.
      */}
      <div className="w-full sm:max-w-md min-h-screen sm:min-h-[850px] sm:h-[880px] sm:max-h-[92%] sm:rounded-[40px] sm:border-[10px] sm:border-[#30312e] bg-[#fbf9f5] shadow-2xl flex flex-col overflow-hidden relative sm:my-4">
        
        {/* Simulating physical Notch / status bar space on desktops */}
        <div className="hidden sm:flex bg-[#30312e] text-white/50 text-[10px] items-center justify-between px-8 py-1.5 font-bold tracking-tight select-none">
          <span>09:41</span>
          <div className="w-24 h-4 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-1 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-camera-green/10"></span>
          </div>
          <div className="flex items-center gap-1">
            <span>5G</span>
            <div className="w-4 h-2 bg-white/40 rounded-xs"></div>
          </div>
        </div>

        {/* Dynamic header navigation */}
        <Header
          title={getHeaderTitle()}
          showBack={activeTab === "photo"}
          onBackClick={() => setActiveTab("home")}
          onProfileClick={() => setActiveTab("me")}
          onCalendarClick={() => setIsCalendarOpen(true)}
        />

        {/* Prime scrollable tabs interface */}
        <main className="flex-1 overflow-y-auto px-5 pt-2 pb-24 no-scrollbar relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="h-full"
            >
              {activeTab === "home" && (
                <HomeTab
                  userProfile={userProfile}
                  meals={meals}
                  onCheckIn={handleCheckIn}
                  onNavigateToPhoto={() => setActiveTab("photo")}
                  onDeleteMeal={handleDeleteMeal}
                />
              )}

              {activeTab === "photo" && (
                <PhotoTab
                  onSaveMeal={handleSaveMeal}
                  onCancel={() => setActiveTab("home")}
                />
              )}

              {activeTab === "me" && (
                <MeTab
                  userProfile={userProfile}
                  onUpdateProfile={handleUpdateProfile}
                  onExportData={handleExportData}
                  sessionUser={sessionUser}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Global Floating Toast Notifier */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute bottom-20 left-4 right-4 z-50 bg-[#1d4f3c]/95 backdrop-blur-xs text-white p-3.5 rounded-xl shadow-lg border border-[#fe7e4f]/20 flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded-full bg-[#fe7e4f]/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-[#fe7e4f]" />
              </div>
              <p className="text-xs font-bold leading-tight">{toastMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic footer Navbar */}
        <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* History Calendar Bottom Sheet Drawer */}
        <CalendarDrawer
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          dailyData={dailyData}
          userProfile={userProfile}
        />
      </div>
    </div>
  );
}
