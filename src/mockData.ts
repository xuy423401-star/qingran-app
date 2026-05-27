/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Meal, UserProfile } from "./types";

export const DEFAULT_USER_PROFILE: UserProfile = {
  targetCalories: 1450,
  currentWeight: 0,
  targetWeight: 0,
  weightHistory: [],
  reminderTime: "20:30",
  streakCount: 0,
  longestStreak: 0,
  weekRecordsCount: 0,
  totalCheckInDays: 0,
  hasCheckedInToday: false,
  lastCheckInDate: null
};

export const INITIAL_MEALS: Meal[] = [];

export const INITIAL_DAILY_DATA: Record<string, { meals: Meal[]; hasCheckedIn: boolean; totalCalories: number }> = {};

export interface AISimulationCase {
  id: string;
  foodName: string;
  imageUrl: string;
  items: { name: string; calories: number; weightGrams: number }[];
  tags: string[];
}

export const MOCK_AI_CASES: AISimulationCase[] = [
  {
    id: "ai-1",
    foodName: "香煎三文鱼藜麦糙米饭",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCQIH8M31p-dCXupdNlbc056-o_SIiUuYcjBua2ypBS77-x4hh4ycu6OvQ-kPVC7R6dfnf2vSo9h6EFc2pQdH8P8Qk7y8ELmO7fm7SnLb_M4v8S-MsDzC8w3zYxaiZAxPTrchQgJhnAtGjphpQacUkFNL5Zb7X-vPiGfGc3WrcWUxKGHyFCJlw4uTXm5pGsM2--kNSsSc4Ii7tZVWZN1E4KJN3CQSwZOOlpMDNgkLIa2518GoE4Px9mSw_zxCxzdSruRWbM7N1FU73J",
    items: [
      { name: "香煎三文鱼", calories: 312, weightGrams: 150 },
      { name: "混合藜麦饭", calories: 165, weightGrams: 100 },
      { name: "牛油果半个", calories: 65, weightGrams: 80 }
    ],
    tags: ["优质油脂", "高蛋白质"]
  },
  {
    id: "ai-2",
    foodName: "香嫩鸡胸肉烤时蔬",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAC7kZzEx8sGAo5a5MkxZgAAtXBVygK4HqadyhmOtY4NQy1fS8YRYpScwZ2nGmLL-0TgEgGXQcmCT60prvy3jxdwuy-y3SSHz4983ebVEOpn89zIJKgmXuJcqsvxcLjhIbGMk65PmUGufK2E6f9XyANlv_suHvd2evMO9z3kN3OaVewdsLyrSmptqDOOb34YY2fHcvMT0NF6pLRJy6Ftscg3ZrBWsRASzsGtA3iAiSuWlPdt7FmRnLLQVk29otiaFvVn6SmUqh4gfBX",
    items: [
      { name: "黑椒煎鸡胸肉", calories: 260, weightGrams: 180 },
      { name: "香烤蒸红薯", calories: 110, weightGrams: 120 },
      { name: "低卡清炒西兰花", calories: 45, weightGrams: 100 }
    ],
    tags: ["低脂高蛋白", "优质碳水"]
  },
  {
    id: "ai-3",
    foodName: "草莓希腊酸奶麦片碗",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB9L5XSq_jM_Cy2iJMpZUN0cC9NlguGdxzCuF6f8LtRQeX9tSRKNt4zpFsQ3Fic41tN7TSrkVrJxttfDmMb_9xGxDKrLA0C-AM3FNDqae3A7Q-btg2fNugPXd9L1UiOqw88fKtC7Yy2hEmJPg2HDWTGd0-DO1hnfde266eDqNZ_LThiMeqPaM6bmp_5Tev3PCN_1o1JilLd81N_pWCkpS_Ha4I7lCD6pA-bM0_SKZQWJKgr4lf2jtvm44O-yLqZZE5Pyjl8B83sesal",
    items: [
      { name: "脱脂无糖希腊酸奶", calories: 120, weightGrams: 200 },
      { name: "高纤维燕麦片", calories: 140, weightGrams: 40 },
      { name: "新鲜草莓与蓝莓", calories: 60, weightGrams: 80 }
    ],
    tags: ["益生菌", "排毒抗氧化"]
  }
];
