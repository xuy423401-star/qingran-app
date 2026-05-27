/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CheckCircle2, ChevronRight, Info, Plus, Sparkles, Camera, Trash2 } from "lucide-react";
import { Meal, UserProfile } from "../types";

interface HomeTabProps {
  userProfile: UserProfile;
  meals: Meal[];
  onCheckIn: () => void;
  onNavigateToPhoto: () => void;
  onDeleteMeal: (mealId: string) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  userProfile,
  meals,
  onCheckIn,
  onNavigateToPhoto,
  onDeleteMeal,
}) => {
  const [selectedMealDetail, setSelectedMealDetail] = useState<Meal | null>(null);

  // Totals calculations
  const totalIngested = meals.reduce((sum, m) => sum + m.totalCalories, 0);
  const target = userProfile.targetCalories;
  const remaining = target - totalIngested;
  const percentOfTarget = target > 0 ? Math.min(100, Math.round((totalIngested / target) * 100)) : 0;

  // Circular progress ring helper values
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentOfTarget / 100) * circumference;

  return (
    <div className="flex flex-col pb-24 animate-fade-in">
      {/* 1. Streak Segment */}
      <section className="mt-6 mb-8 text-center flex flex-col items-center">
        <p className="text-xs uppercase tracking-widest font-bold text-[#424843]/60 mb-1">STREAK</p>
        <h2 className="font-display font-extrabold text-4xl text-[#1d4f3c] mb-3 leading-tight flex items-center justify-center gap-2">
          已坚持 <span className="text-[#a43c12] text-5xl font-black">{userProfile.streakCount}</span> 天
        </h2>
        
        {userProfile.hasCheckedInToday ? (
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1d4f3c]/10 text-[#1d4f3c] border border-[#1d4f3c]/20 transition-all scale-100">
            <CheckCircle2 className="w-4 h-4 text-[#1d4f3c]" />
            <span className="text-xs font-bold">今天已打卡</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#a43c12]/10 text-[#a43c12] border border-[#a43c12]/20 animate-pulse">
            <Info className="w-4 h-4 text-[#a43c12]" />
            <span className="text-xs font-semibold">今天还没完成记录</span>
          </div>
        )}
      </section>

      {/* 2. Punch-in Main Trigger Button */}
      <div className="mb-8 px-1">
        <button
          onClick={onCheckIn}
          id="btn-main-checkin"
          className={`w-full py-4.5 rounded-2xl font-bold text-base shadow-sm hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            userProfile.hasCheckedInToday
              ? "bg-[#eae8e4] text-[#424843] border border-[#c1c8c1]/30"
              : "bg-[#1d4f3c] text-white"
          }`}
        >
          {userProfile.hasCheckedInToday ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-[#1d4f3c]" />
              今日打卡已完成・加油
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-[#fe7e4f]" />
              完成今日打卡
            </>
          )}
        </button>
      </div>

      {/* 3. Bento Calorie Status Dashboard */}
      <section className="grid grid-cols-2 gap-4 mb-8">
        {/* Total card */}
        <div className="col-span-2 bg-white p-5 rounded-2xl border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#424843]/70 mb-1">今日摄入热量</p>
            <p className="text-2xl font-black text-[#1d4f3c] tracking-tight">
              {totalIngested.toLocaleString()} <span className="text-sm font-normal text-[#424843]/50">kcal</span>
            </p>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                className="text-[#1d4f3c]/10"
                cx="32"
                cy="32"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4.5"
              />
              <circle
                className="text-[#a43c12]"
                cx="32"
                cy="32"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-black text-[#a43c12]">{percentOfTarget}%</span>
            </div>
          </div>
        </div>

        {/* Remaining Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)]">
          <p className="text-xs font-bold text-[#424843]/70 mb-1">
            {remaining >= 0 ? "剩余热量" : "超出热量"}
          </p>
          <p className={`text-2xl font-black tracking-tight ${remaining >= 0 ? "text-[#1d4f3c]" : "text-[#a43c12]"}`}>
            {Math.abs(remaining).toLocaleString()}{" "}
            <span className="text-xs font-normal text-[#424843]/50">kcal</span>
          </p>
        </div>

        {/* Goal Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)]">
          <p className="text-xs font-bold text-[#424843]/70 mb-1">目标额度</p>
          <p className="text-2xl font-black text-[#1d4f3c] tracking-tight">
            {target.toLocaleString()}{" "}
            <span className="text-xs font-normal text-[#424843]/50">kcal</span>
          </p>
        </div>
      </section>

      {/* 4. Meals Records List Section */}
      <section className="space-y-4">
        <div className="flex justify-between items-end px-1">
          <h3 className="font-display font-black text-lg text-[#1d4f3c]">今日饮食记录</h3>
          <span 
            onClick={onNavigateToPhoto} 
            className="text-xs font-bold text-[#a43c12] cursor-pointer hover:underline flex items-center gap-0.5"
          >
            去拍照记录 <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        {meals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#eae8e4] p-8 text-center flex flex-col items-center justify-center shadow-[0_4px_20px_rgba(29,79,60,0.02)]">
            <div className="w-12 h-12 rounded-full bg-[#1d4f3c]/5 flex items-center justify-center mb-3">
              <Camera className="w-5 h-5 text-[#1d4f3c]" />
            </div>
            <p className="text-xs text-[#424843]/70 font-semibold mb-3">今天还没记录饮食哦，快拍个照识别一下吧</p>
            <button
              onClick={onNavigateToPhoto}
              id="btn-empty-take-photo"
              className="bg-[#1d4f3c] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              模拟 AI 拍照记录
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {meals.map((meal) => {
              const translatedType =
                meal.type === "breakfast"
                  ? "早餐"
                  : meal.type === "lunch"
                  ? "午餐"
                  : meal.type === "dinner"
                  ? "晚餐"
                  : "加餐";

              return (
                <div
                  key={meal.id}
                  className="flex items-center gap-3 p-3 px-3.5 bg-white rounded-2xl hover:bg-[#f5f3ef]/40 transition-colors border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] group"
                >
                  {meal.imageUrl && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#eae8e4]/60 flex-shrink-0 cursor-pointer" onClick={() => setSelectedMealDetail(meal)}>
                      <img
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        src={meal.imageUrl}
                        alt={meal.title}
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="flex-grow min-w-0 cursor-pointer" onClick={() => setSelectedMealDetail(meal)}>
                    <div className="flex justify-between items-start">
                      <div className="truncate">
                        <h4 className="font-bold text-sm text-[#1d4f3c] truncate">
                          {translatedType} · {meal.title}
                        </h4>
                        <p className="text-[11px] text-[#424843]/60 font-medium">
                          {meal.time}
                        </p>
                      </div>
                    </div>
                    {meal.tags && meal.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {meal.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-[#1d4f3c]/5 text-[10px] font-bold text-[#1d4f3c]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1.5 text-[10px] text-[#424843]/50">
                        {meal.items.map((it) => it.name).join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2.5 pl-1">
                    <span className="font-display font-extrabold text-sm text-[#1d4f3c]" onClick={() => setSelectedMealDetail(meal)}>
                      {meal.totalCalories} <span className="text-[9px] font-normal text-[#424843]/60">kcal</span>
                    </span>
                    <button
                      onClick={() => onDeleteMeal(meal.id)}
                      title="删除记录"
                      className="p-1.5 rounded-lg hover:bg-[#ba1a1a]/10 hover:text-[#ba1a1a] transition-all text-[#424843]/40 active:scale-90"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Floating Action Camera Button */}
      <button
        onClick={onNavigateToPhoto}
        title="AI 拍照记录"
        id="btn-fab-camera"
        className="fixed bottom-24 right-5 w-14 h-14 bg-[#a43c12] hover:bg-[#a43c12]/95 active:scale-90 transition-transform shadow-lg shadow-[#a43c12]/20 text-white rounded-full flex items-center justify-center z-40 cursor-pointer pointer-events-auto"
      >
        <Camera className="w-6 h-6" />
      </button>

      {/* Details breakdown sliding dialog */}
      {selectedMealDetail && (
        <div className="fixed inset-0 z-50 bg-[#112d22]/40 backdrop-blur-sm flex items-end justify-center transition-opacity" onClick={() => setSelectedMealDetail(null)}>
          <div 
            className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl space-y-5 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#a43c12] tracking-wider">今日饮食详情</span>
                <h3 className="font-display font-extrabold text-base text-[#1d4f3c]">
                  {selectedMealDetail.title}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedMealDetail(null)}
                className="p-1 px-2.5 text-xs text-[#424843] bg-[#eae8e4] hover:bg-[#eae8e4]/80 rounded-full font-bold cursor-pointer"
              >
                关闭
              </button>
            </div>

            {selectedMealDetail.imageUrl && (
              <div className="w-full h-40 rounded-2xl overflow-hidden bg-[#eae8e4]/60">
                <img
                  className="w-full h-full object-cover"
                  src={selectedMealDetail.imageUrl}
                  alt={selectedMealDetail.title}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-[#424843]/80">AI 识别清单 ({selectedMealDetail.time})</p>
              <div className="divide-y divide-[#eae8e4]">
                {selectedMealDetail.items.map((item) => (
                  <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#1d4f3c]">
                      {item.name} {item.weightGrams ? <span className="font-normal text-[#424843]/50">({item.weightGrams}g)</span> : null}
                    </span>
                    <span className="font-extrabold text-[#1d4f3c]">{item.calories} kcal</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1d4f3c]/5 p-3.5 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-[#1d4f3c]">合计摄入估值</span>
              <span className="text-sm font-black text-[#1d4f3c]">{selectedMealDetail.totalCalories} kcal</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
