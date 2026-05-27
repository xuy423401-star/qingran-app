/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, X, Flame } from "lucide-react";
import { DailyDataMap, UserProfile, Meal } from "../types";

const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface CalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dailyData: DailyDataMap;
  userProfile: UserProfile;
}

export const CalendarDrawer: React.FC<CalendarDrawerProps> = ({
  isOpen,
  onClose,
  dailyData,
  userProfile,
}) => {
  const todayDateObj = new Date();
  const [currentDate, setCurrentDate] = useState(todayDateObj);
  
  // Format today's string to match exactly
  const todayStr = getDateString(todayDateObj);

  // Selected date inside drawer to show day details - default to today
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  if (!isOpen) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Days calculations
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const totalDays = endOfMonth.getDate();
  const startDayOfWeek = startOfMonth.getDay(); // Sunday=0, Monday=1...

  // Monday to Sunday alignment padding
  // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const adjustedStartOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Generate date list with padding
  const dateCells: { dayNumber: number | null; dateString: string | null }[] = [];
  
  // Pad with nulls for leading empty slots before the 1st day of the month
  for (let i = 0; i < adjustedStartOffset; i++) {
    dateCells.push({ dayNumber: null, dateString: null });
  }

  // Add all the days of the month
  for (let d = 1; d <= totalDays; d++) {
    const formattedDateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    dateCells.push({
      dayNumber: d,
      dateString: formattedDateStr
    });
  }

  // Day list helper header labels
  const daysOfWeekLabels = ["一", "二", "三", "四", "五", "六", "日"];

  // Selected day detail mapping
  const selectedLog = dailyData[selectedDateStr] || { meals: [] as Meal[], hasCheckedIn: false, totalCalories: 0 };
  const targetCals = userProfile.targetCalories;

  return (
    <div className="fixed inset-0 z-50 bg-[#112d22]/40 backdrop-blur-xs flex items-end justify-center transition-opacity" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[88%] animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle Drag Bar Indicator */}
        <div className="w-full flex justify-center py-2.5">
          <div className="w-10 h-1 bg-[#eae8e4] rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="flex justify-between items-center px-6 pb-2.5 border-b border-[#eae8e4]/50">
          <div>
            <h3 className="font-display font-extrabold text-base text-[#1d4f3c]">本月打卡</h3>
            <p className="text-[10px] text-[#424843]/60 font-semibold tracking-wide">回顾与回顾您的极简减脂历程</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-2.5 text-xs text-[#424843] bg-[#eae8e4] hover:bg-[#eae8e4]/80 rounded-full font-bold cursor-pointer flex items-center gap-1 text-[11px]"
          >
            <X className="w-3 h-3" /> 关闭
          </button>
        </div>

        {/* Calendar Body Area */}
        <div className="p-5 pb-4 bg-[#fbf9f5]/50 border-b border-[#eae8e4]/40">
          {/* Month Navigator Header Selector */}
          <div className="flex justify-between items-center mb-4 px-2">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 rounded-full bg-white border border-[#eae8e4] text-[#1d4f3c] hover:bg-[#eae8e4]/20 active:scale-90 cursor-pointer transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-display font-black text-sm text-[#1d4f3c] select-none">
              {year}年{(month + 1).toString().padStart(2, "0")}月
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 rounded-full bg-white border border-[#eae8e4] text-[#1d4f3c] hover:bg-[#eae8e4]/20 active:scale-90 cursor-pointer transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels Header rows */}
          <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-bold text-[#424843]/50 uppercase tracking-widest mb-2">
            {daysOfWeekLabels.map((lbl) => (
              <div key={lbl}>{lbl}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-x-1.5 gap-y-2 text-center">
            {dateCells.map((cell, idx) => {
              if (cell.dayNumber === null || cell.dateString === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const dStr = cell.dateString;
              const logVal = dailyData[dStr];
              
              // Determine check-in state indicators
              const hasCheckedIn = logVal?.hasCheckedIn ?? false;
              const hasMeals = (logVal?.meals ?? []).length > 0;
              const totCalories = logVal?.totalCalories ?? 0;
              const hasExceeded = totCalories > targetCals;

              const isSelected = selectedDateStr === dStr;
              const isToday = dStr === todayStr;

              // Styles matching user requests:
              // - 已打卡日期显示深绿色圆点 (Solid dark green background with white text)
              // - 有饮食记录但未完成打卡的日期显示浅绿色圆点 (Transparent deep-green background tint with green text)
              // - 热量超过每日目标的日期显示珊瑚橙小点 (Tiny coral dot indicator)
              // - 今天用深绿色描边突出
              
              let cellBg = "hover:bg-[#eae8e4]/43 text-[#1b1c1a]";
              let textStyle = "font-black text-xs text-[#1d4f3c]";

              if (hasCheckedIn) {
                cellBg = "bg-[#1d4f3c] text-white rounded-full shadow-inner shadow-[#112d22]/10";
                textStyle = "font-black text-xs text-white";
              } else if (hasMeals) {
                cellBg = "bg-[#1d4f3c]/12 text-[#1d4f3c] rounded-full";
                textStyle = "font-extrabold text-xs text-[#1d4f3c]";
              }

              // Apply active selected item border overlay
              let borderStyles = "";
              if (isToday) {
                borderStyles = "border border-2 border-[#1d4f3c]";
              }
              if (isSelected) {
                // Keep selected high-contrast bounding feedback
                borderStyles = `ring-2 ring-offset-1 ring-[#a43c12] ${borderStyles}`;
              }

              return (
                <button
                  key={dStr}
                  onClick={() => setSelectedDateStr(dStr)}
                  className={`aspect-square flex flex-col items-center justify-center relative p-1.5 rounded-full select-none transition-all active:scale-90 cursor-pointer ${cellBg} ${borderStyles}`}
                >
                  <span className={textStyle}>{cell.dayNumber}</span>
                  
                  {/* Coral orange small dot when calories exceeded */}
                  {hasExceeded && (
                    <span 
                      className={`absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#fe7e4f] shadow-xs ${hasCheckedIn ? "border border-white" : ""}`}
                      title="热量已超额"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Panel Section (Lower half of the drawer) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-[#a43c12] rounded-full" />
              <h4 className="font-display font-black text-sm text-[#1d4f3c]">
                {selectedDateStr === todayStr
                  ? `今天 (${todayStr.split("-")[1]}月${todayStr.split("-")[2]}日)`
                  : `${selectedDateStr.split("-")[1]}月${selectedDateStr.split("-")[2]}日 打卡日志`
                }
              </h4>
            </div>

            {/* Check-in Status labels */}
            {selectedLog.hasCheckedIn ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#1d4f3c]/10 text-[#1d4f3c] rounded-full text-[10px] font-black border border-[#1d4f3c]/15">
                <CheckCircle2 className="w-3.5 h-3.5" />
                本日已完成打卡
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#424843]/10 text-[#424843]/70 rounded-full text-[10px] font-extrabold">
                <AlertCircle className="w-3.5 h-3.5" />
                本日未打卡
              </span>
            )}
          </div>

          {/* Quick calorific statistics segment */}
          <div className="bg-[#fbf9f5] border border-[#eae8e4] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#424843]/60 mb-0.5">摄入热量 / 每日基准目标值</p>
              <p className="text-sm font-black text-[#1d4f3c]">
                {selectedLog.totalCalories.toLocaleString()} / <span className="text-xs font-normal text-[#424843]/70">{targetCals} kcal</span>
              </p>
            </div>
            
            {selectedLog.totalCalories > targetCals ? (
              <span className="text-[10px] font-black uppercase text-[#a43c12] tracking-wider flex items-center gap-1 px-2.5 py-1 bg-[#a43c12]/5 rounded-full animate-pulse">
                热量明显超标
              </span>
            ) : selectedLog.totalCalories > 0 ? (
              <span className="text-[10px] font-black uppercase text-[#1d4f3c] tracking-wider bg-[#1d4f3c]/5 px-2.5 py-1 rounded-full">
                处于安全阈值内
              </span>
            ) : null}
          </div>

          {/* Meal record items listings */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-[#424843]/60">餐食详情登记</h5>
            
            {(!selectedLog.meals || selectedLog.meals.length === 0) ? (
              <div className="bg-[#fbf9f5]/20 border border-dashed border-[#c1c8c1]/40 py-8 rounded-xl text-center">
                <p className="text-xs text-[#424843]/60 font-semibold">这天还没有饮食记录</p>
              </div>
            ) : (
              <div className="space-y-2.5 divide-y divide-[#eae8e4]/30">
                {selectedLog.meals.map((meal, index) => {
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
                      className={`text-xs flex items-center gap-3 ${index > 0 ? "pt-2.5" : ""}`}
                    >
                      {/* Meal image thumbnail */}
                      {meal.imageUrl ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#eae8e4]/60 border border-[#eae8e4]">
                          <img src={meal.imageUrl} alt={meal.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-[#eae8e4]/30 border border-dashed border-[#c1c8c1]/40 flex items-center justify-center">
                          <span className="text-[#c1c8c1] text-lg">&#x1f372;</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 bg-[#1d4f3c]/5 text-[9px] font-black text-[#1d4f3c] rounded-md tracking-wider flex-shrink-0">
                            {translatedType}
                          </span>
                          <span className="font-bold text-[#1d4f3c] truncate">
                            {meal.title}
                          </span>
                        </div>
                        <span className="font-extrabold text-[#1d4f3c] flex-shrink-0 ml-2">
                          {meal.totalCalories} kcal
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
