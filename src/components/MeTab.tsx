/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Download, Bell, Flame, Activity, Weight, Settings, Check, Edit2, Info, LogIn, UserPlus, LogOut, Loader2, Mail, Lock } from "lucide-react";
import { UserProfile, WeightRecord } from "../types";
import { supabase } from "../supabaseClient";

async function withAuthTimeout<T>(promise: PromiseLike<T>, timeoutMs = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("请求超时，请检查网络、Supabase 配置或稍后重试。"));
      }, timeoutMs);
    })
  ]);
}

interface MeTabProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onExportData: () => void;
  sessionUser: any;
}

export const MeTab: React.FC<MeTabProps> = ({
  userProfile,
  onUpdateProfile,
  onExportData,
  sessionUser,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setAuthError("请输入邮箱和密码。");
      return;
    }
    if (password.length < 6) {
      setAuthError("密码至少需要 6 位。");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");

    try {
      if (!supabase) {
        throw new Error("Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.");
      }

      if (isLoginMode) {
        const { error } = await withAuthTimeout(
          supabase.auth.signInWithPassword({ email: cleanEmail, password })
        );
        if (error) throw error;
        setAuthSuccess("登录成功，正在同步云端数据。");
        setEmail("");
        setPassword("");
      } else {
        const { data, error } = await withAuthTimeout(
          supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: window.location.origin
            }
          })
        );
        if (error) throw error;
        if (data.session) {
          setAuthSuccess("注册成功，已登录并开始同步云端数据。");
        } else {
          setAuthSuccess("注册成功，请到邮箱确认后再回来登录。");
          setIsLoginMode(true);
        }
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      setAuthError(err.message || "服务暂时不可用，请稍后重试");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const { error } = await withAuthTimeout(supabase.auth.signOut());
      if (error) throw error;
      setAuthSuccess("已退出登录，正在切回本地模式");
      setTimeout(() => setAuthSuccess(""), 3000);
    } catch (err: any) {
      setAuthError(err.message || "退出登录遇到错误");
    } finally {
      setAuthLoading(false);
    }
  };
  
  // Edited values
  const [targetCalories, setTargetCalories] = useState(userProfile.targetCalories.toString());
  const [currentWeight, setCurrentWeight] = useState(userProfile.currentWeight.toString());
  const [targetWeight, setTargetWeight] = useState(userProfile.targetWeight.toString());
  const [reminderTime, setReminderTime] = useState(userProfile.reminderTime);

  // Submit and save updated info
  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    const cW = parseFloat(currentWeight) || userProfile.currentWeight;
    const tW = parseFloat(targetWeight) || userProfile.targetWeight;
    const tC = parseInt(targetCalories, 10) || userProfile.targetCalories;

    // Check if current weight has changed, if so register it in history
    let newHistory = [...userProfile.weightHistory];
    const todayStr = new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }).replace("/", "-");
    
    // Check if today already has a record, update or append
    const existingIdx = newHistory.findIndex((h) => h.date === todayStr);
    if (existingIdx !== -1) {
      newHistory[existingIdx] = { date: todayStr, weight: cW };
    } else {
      // Keep only up to last 7-10 records to make sure spark trend is clean
      if (newHistory.length >= 10) {
        newHistory.shift();
      }
      newHistory.push({ date: todayStr, weight: cW });
    }

    const updatedProfile: UserProfile = {
      ...userProfile,
      currentWeight: cW,
      targetWeight: tW,
      targetCalories: tC,
      reminderTime: reminderTime,
      weightHistory: newHistory
    };

    onUpdateProfile(updatedProfile);
    setIsEditing(false);
  };

  // Generate lightweight aesthetic SVG path for the Spark Weight Trend Line
  const generateSparklineSvg = (history: WeightRecord[]) => {
    if (history.length < 2) return null;

    const width = 160;
    const height = 48;
    const padding = 6;

    const weights = history.map((h) => h.weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const weightRange = maxWeight - minWeight === 0 ? 1 : maxWeight - minWeight;

    // Map each data point to svg coordinates
    const points = history.map((item, index) => {
      const x = padding + (index / (history.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((item.weight - minWeight) / weightRange) * (height - 2 * padding);
      return { x, y, weight: item.weight, date: item.date };
    });

    // Create curved line using cubic beziers or standard polyline
    const pathD = points.reduce((acc, p, index) => {
      if (index === 0) return `M ${p.x} ${p.y}`;
      // Smooth spline interpolation
      const prev = points[index - 1];
      const cx1 = prev.x + (p.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (p.x - prev.x) / 2;
      const cy2 = p.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
    }, "");

    return { points, pathD, width, height };
  };

  const sparkline = generateSparklineSvg(userProfile.weightHistory);

  return (
    <div className="flex flex-col pb-24 animate-fade-in text-[#1b1c1a]">
      {/* 1. Header Profile segment */}
      <section className="flex flex flex-col items-center text-center mt-6 mb-7 space-y-1">
        <h2 className="font-display font-black text-xl text-[#1d4f3c]">我的打卡状态</h2>
        <p className="text-xs text-[#424843]/65 font-medium tracking-wide">静然生活，由心而始</p>
      </section>

      {/* Supabase Authenticated / Unauthenticated minimal status card */}
      <section className="mb-6">
        {sessionUser ? (
          <div className="bg-[#1d4f3c]/5 border border-[#1d4f3c]/20 rounded-2xl p-4 flex items-center justify-between text-xs hover:scale-[1.01] transition-transform">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#1d4f3c] flex items-center justify-center text-white font-bold uppercase shrink-0 select-none">
                {sessionUser.email?.slice(0, 2) || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#424843]/60">已登录云端账户</p>
                <p className="font-extrabold text-[#1d4f3c] truncate">{sessionUser.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={authLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#a43c12]/10 hover:bg-[#a43c12]/20 text-[#a43c12] rounded-full font-bold cursor-pointer transition-colors disabled:opacity-50 text-[11px]"
            >
              {authLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
              退出
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border-2 border-[#1d4f3c]/15 p-5 shadow-[0_4px_24px_rgba(29,79,60,0.04)] space-y-4 hover:border-[#1d4f3c]/30 transition-all duration-300">
            <div className="flex justify-between items-center pb-2.5 border-b border-[#eae8e4]">
              <div className="flex items-center gap-1.5 text-[#1d4f3c]">
                <Settings className="w-4.5 h-4.5 text-[#a43c12]" />
                <h3 className="font-display font-black text-sm">云端打卡同步登录</h3>
              </div>
              <span className="text-[9px] font-black tracking-widest text-[#a43c12] uppercase px-2 py-0.5 bg-[#a43c12]/10 rounded-md">
                游客模式
              </span>
            </div>

            <p className="text-[11px] text-[#424843]/70 font-semibold leading-relaxed">
              登录账户将您的打卡数据即时托管至 Supabase 云数据库。如未登录将保存在本地 LocalStorage 中。
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {/* Email field */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#424843]/50 font-medium">
                  <Mail className="w-3.5 h-3.5" />
                </span>
                <input
                  type="email"
                  placeholder="电子邮箱地址"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 bg-[#fbf9f5] border border-[#eae8e4] rounded-xl font-medium text-[#1d4f3c] focus:outline-none focus:border-[#1d4f3c]/60 focus:ring-1 focus:ring-[#1d4f3c]/30 transition-all"
                  required
                />
              </div>

              {/* Password field */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#424843]/50 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  placeholder="账户登录密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 bg-[#fbf9f5] border border-[#eae8e4] rounded-xl font-medium text-[#1d4f3c] focus:outline-none focus:border-[#1d4f3c]/60 focus:ring-1 focus:ring-[#1d4f3c]/30 transition-all"
                  required
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-1 text-xs">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#1d4f3c] hover:bg-[#1d4f3c]/95 text-white py-2 rounded-xl font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isLoginMode ? (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      极简登录
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      注册极简新账号
                    </>
                  )}
                </button>

                {/* Switch Login Mode link */}
                <div className="text-center mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginMode(!isLoginMode);
                      setAuthError("");
                      setAuthSuccess("");
                    }}
                    className="text-[10px] font-bold text-[#a43c12] hover:underline cursor-pointer"
                  >
                    {isLoginMode ? "新用户？去注册您的打卡账号 🌿" : "已有账户？立即去登录 ✨"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Auth Feedback Info banner */}
        {(authError || authSuccess) && (
          <div className={`mt-3 p-3 rounded-xl border text-[11px] font-bold ${
            authError 
              ? "bg-[#a43c12]/5 border-[#a43c12]/20 text-[#a43c12]" 
              : "bg-[#1d4f3c]/5 border-[#1d4f3c]/20 text-[#1d4f3c]"
          }`}>
            {authError || authSuccess}
          </div>
        )}
      </section>

      {/* 2. Stats Bento Layout */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] flex flex-col justify-between h-32 hover:scale-[1.01] active:scale-[0.99] transition-transform">
          <span className="text-[11px] font-bold text-[#424843]/60 mb-1">累计打卡</span>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-3xl text-[#1d4f3c]">{userProfile.totalCheckInDays}</span>
            <span className="text-[10px] font-bold text-[#424843]/60">天</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] flex flex-col justify-between h-32 hover:scale-[1.01] active:scale-[0.99] transition-transform">
          <span className="text-[11px] font-bold text-[#424843]/60 mb-1">连续打卡</span>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-3xl text-[#a43c12]">{userProfile.streakCount}</span>
            <span className="text-[10px] font-bold text-[#424843]/60">天</span>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white p-5 rounded-2xl border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] flex flex-col justify-between h-32 hover:scale-[1.01] active:scale-[0.99] transition-transform">
          <span className="text-[11px] font-bold text-[#424843]/60 mb-1">本周记录天数</span>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-3xl text-[#1d4f3c]">{userProfile.weekRecordsCount}</span>
            <span className="text-[10px] font-bold text-[#424843]/60">天</span>
          </div>
        </div>
      </section>

      {/* 3. Aesthetic Weight History Trend Section */}
      <section className="bg-white rounded-2xl p-5 border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] mb-8 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-[#1d4f3c] uppercase tracking-wider mb-0.5">最近体重变化趋势</h3>
            <p className="text-[10px] text-[#424843]/60 font-medium">每日摄入打卡后绘制的小趋势</p>
          </div>
          {sparkline && (
            <div className="text-right">
              <span className="text-xs font-extrabold text-[#1d4f3c]">{userProfile.currentWeight}kg</span>
              <span className="text-[9px] block text-[#424843]/50">最新测重</span>
            </div>
          )}
        </div>

        <div className="bg-[#fbf9f5] border border-[#eae8e4]/60 rounded-xl p-4 flex items-center justify-between h-20 relative">
          {sparkline ? (
            <>
              {/* Svg Trend line */}
              <div className="flex items-center flex-grow">
                <svg width={sparkline.width} height={sparkline.height} className="overflow-visible">
                  {/* Subtle Grid horizontal Line */}
                  <line x1="0" y1="24" x2={sparkline.width} y2="24" stroke="#eae8e4" strokeDasharray="3 3" />
                  
                  {/* Elegant curved path */}
                  <path
                    d={sparkline.pathD}
                    fill="none"
                    stroke="#a43c12"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Pulsing focal point on the latest reading */}
                  {sparkline.points.length > 0 && (
                    <circle
                      cx={sparkline.points[sparkline.points.length - 1].x}
                      cy={sparkline.points[sparkline.points.length - 1].y}
                      r="4"
                      fill="#a43c12"
                    />
                  )}
                </svg>
              </div>

              {/* Min and max info logs */}
              <div className="flex flex-col justify-between text-[10px] text-[#424843]/70 font-semibold h-full pl-3 border-l border-[#eae8e4] w-24">
                <div className="flex justify-between">
                  <span>起始:</span>
                  <span className="font-bold">{userProfile.weightHistory[0]?.weight} kg</span>
                </div>
                <div className="flex justify-between text-[#a43c12]">
                  <span>目标:</span>
                  <span className="font-bold">{userProfile.targetWeight} kg</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#424843]/50 text-center w-full font-medium">尚未添加足够的体重数据节点</p>
          )}
        </div>
      </section>

      {/* 4. Settings Card list */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#424843]/60">基本信息与偏好</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-[#a43c12] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" /> 修改设置
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveInfo} className="bg-white border-2 border-[#1d4f3c]/20 rounded-2xl p-5 space-y-4 shadow-lg animate-slide-up">
            <div className="flex justify-between items-center pb-2 border-b border-[#eae8e4]">
              <span className="text-xs font-black text-[#1d4f3c]">修改健康状态参数</span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-[#424843] hover:text-[#1d4f3c]"
              >
                取消
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Calories Target Input */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#424843]/85">每日参考热量目标 (kcal)</label>
                <input
                  type="number"
                  value={targetCalories}
                  onChange={(e) => setTargetCalories(e.target.value)}
                  className="w-full p-2 bg-[#fbf9f5] border border-[#eae8e4] rounded-lg font-bold text-[#1d4f3c]"
                  required
                />
              </div>

              {/* Current Weight Input */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#424843]/85">当前测定体重 (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="w-full p-2 bg-[#fbf9f5] border border-[#eae8e4] rounded-lg font-bold text-[#1d4f3c]"
                  required
                />
              </div>

              {/* Target Weight Input */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#424843]/85">期望瘦身目标体重 (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full p-2 bg-[#fbf9f5] border border-[#eae8e4] rounded-lg font-bold text-[#1d4f3c]"
                  required
                />
              </div>

              {/* Reminder Time Input */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#424843]/85">每日打卡提醒时刻</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full p-2 bg-[#fbf9f5] border border-[#eae8e4] rounded-lg font-bold text-[#1d4f3c]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#1d4f3c] hover:bg-[#1d4f3c]/95 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              保存参数设置
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] divide-y divide-[#eae8e4]">
            {/* Target Calories details */}
            <div className="flex items-center justify-between p-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1d4f3c]/5 flex items-center justify-center">
                  <Flame className="w-4.5 h-4.5 text-[#1d4f3c]" />
                </div>
                <span className="text-xs font-bold text-[#424843]/80">每日参考热量</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-display font-bold text-base text-[#1d4f3c]">
                  {userProfile.targetCalories.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#424843]/60 pb-0.5">kcal</span>
              </div>
            </div>

            {/* Current Weight details */}
            <div className="flex items-center justify-between p-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1d4f3c]/5 flex items-center justify-center">
                  <Weight className="w-4.5 h-4.5 text-[#1d4f3c]" />
                </div>
                <span className="text-xs font-bold text-[#424843]/80">当前体重</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-display font-bold text-base text-[#1d4f3c]">
                  {userProfile.currentWeight}
                </span>
                <span className="text-[10px] text-[#424843]/60 pb-0.5">kg</span>
              </div>
            </div>

            {/* Target Weight details */}
            <div className="flex items-center justify-between p-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#a43c12]/5 flex items-center justify-center">
                  <Activity className="w-4.5 h-4.5 text-[#a43c12]" />
                </div>
                <span className="text-xs font-bold text-[#424843]/80">目标体重</span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="font-display font-bold text-base text-[#1d4f3c]">
                  {userProfile.targetWeight}
                </span>
                <span className="text-[10px] text-[#424843]/60 pb-0.5">kg</span>
              </div>
            </div>

            {/* Reminder Moment details */}
            <div className="flex items-center justify-between p-4 px-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1d4f3c]/5 flex items-center justify-center">
                  <Bell className="w-4.5 h-4.5 text-[#1d4f3c]" />
                </div>
                <span className="text-xs font-bold text-[#424843]/80">打卡提醒时间</span>
              </div>
              <span className="text-xs font-bold text-[#1d4f3c]">{userProfile.reminderTime}</span>
            </div>
          </div>
        )}
      </section>

      {/* 5. Clean Export button & Footer credits */}
      <section className="pt-8 flex flex-col items-center gap-6">
        <button
          onClick={onExportData}
          id="btn-profile-export"
          className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#c1c8c1] text-xs font-bold text-[#424843] hover:bg-[#eae8e4]/30 active:scale-95 transition-all cursor-pointer shadow-xs bg-white"
        >
          <Download className="w-3.5 h-3.5 text-[#a43c12]" />
          备份导出打卡数据 (JSON)
        </button>

        <p className="text-[10px] font-bold text-[#c1c8c1] uppercase tracking-widest text-center leading-relaxed">
          QingRan Wellness v2.4.0
          <br />
          <span className="font-normal capitalize mt-0.5 inline-block opacity-75">极简减脂打卡工具 🌿</span>
        </p>
      </section>
    </div>
  );
};
