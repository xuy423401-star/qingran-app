/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Camera, Image, Plus, Trash2, Check, Loader2, RefreshCw } from "lucide-react";
import { FoodItem, Meal, MealType } from "../types";
import { getSupabaseUrl, getSupabaseAnonKey } from "../supabaseClient";

const PENDING_MEAL_TITLE = "待确认餐食";
const PENDING_FOOD_NAME = "点击修改食物名称";

const createUuid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)
  );
};

interface PhotoTabProps {
  onSaveMeal: (meal: Meal) => boolean | Promise<boolean>;
  onCancel: () => void;
}

export const PhotoTab: React.FC<PhotoTabProps> = ({ onSaveMeal, onCancel }) => {
  const [selectedMealType, setSelectedMealType] = useState<MealType>("lunch");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [resultSource, setResultSource] = useState<"photo" | "demo" | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [mealTitle, setMealTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual input variables for adding new items
  const [newItemName, setNewItemName] = useState("");
  const [newItemCal, setNewItemCal] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSavingMeal, setIsSavingMeal] = useState(false);



  // Resize image before recognition and saving so mobile storage is not filled by camera originals.
  const resizeImage = (dataUrl: string, maxWidth: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        if (img.width <= maxWidth && dataUrl.length < 450000) {
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement("canvas");
        const ratio = Math.min(1, maxWidth / img.width);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.62));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };
  const recognizeFoodFromPhoto = async (imageBase64: string) => {
    setIsRecognizing(true);
    setResultSource("photo");
    setShowAddForm(false);
    setAiError(null);

    try {
      const compressed = await resizeImage(imageBase64, 960);
      setImagePreview(compressed);
      const funcUrl = `${getSupabaseUrl()}/functions/v1/food-recognize`;
      const anonKey = getSupabaseAnonKey();
      const resp = await fetch(funcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ imageBase64: compressed }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        setAiError(`Edge Function ${resp.status}: ${errText}`);
        throw new Error(errText);
      }

      const respData = await resp.json();
      const items = respData?.items ?? [];

      if (items.length > 0) {
        const parsedItems: FoodItem[] = items.map((it: any) => ({
          id: createUuid(),
          name: it.name || "未知食物",
          calories: typeof it.calories === "number" ? it.calories : 0,
          weightGrams: typeof it.weightGrams === "number" ? it.weightGrams : undefined,
        }));
        setFoodItems(parsedItems);
        const mainName = parsedItems[0]?.name || PENDING_MEAL_TITLE;
        setMealTitle(parsedItems.length > 1 ? mainName + "等" : mainName);
      } else {
        setFoodItems([{
          id: createUuid(),
          name: PENDING_FOOD_NAME,
          calories: 0,
        }]);
        setMealTitle(PENDING_MEAL_TITLE);
      }
    } catch (err: any) {
      setAiError(err?.message || err?.error_description || String(err));
      setFoodItems([{
        id: createUuid(),
        name: PENDING_FOOD_NAME,
        calories: 0,
      }]);
      setMealTitle(PENDING_MEAL_TITLE);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Handle actual file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          recognizeFoodFromPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle clicking take photo/library buttons
  const triggerFileSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle editing values inline
  const handleEditItemName = (id: string, newName: string) => {
    setFoodItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: newName } : item))
    );
  };

  const handleEditItemCalories = (id: string, value: string) => {
    const caloriesNum = parseInt(value, 10) || 0;
    setFoodItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, calories: caloriesNum } : item))
    );
  };

  const handleEditItemWeight = (id: string, value: string) => {
    const weightNum = parseInt(value, 10) || 0;
    setFoodItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, weightGrams: weightNum } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setFoodItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Add custom manual food
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;

    const energy = parseInt(newItemCal, 10) || 0;
    const gVal = newItemWeight ? parseInt(newItemWeight, 10) : undefined;

    const appended: FoodItem = {
      id: createUuid(),
      name: newItemName,
      calories: energy,
      weightGrams: gVal
    };

    setFoodItems((prev) => [...prev, appended]);
    setNewItemName("");
    setNewItemCal("");
    setNewItemWeight("");
    setShowAddForm(false);
  };

  // Calculate sum
  const calculatedSum = foodItems.reduce((acc, it) => acc + it.calories, 0);

  // Trigger Save action
  const handleSaveMealClick = async () => {
    if (isSavingMeal) return;

    if (foodItems.length === 0) {
      alert("本餐列表为空，请先拍照识别或手动添加食物记录！");
      return;
    }

    const hasPendingFood = foodItems.some(
      (item) => item.name.trim() === "" || item.name.trim() === PENDING_FOOD_NAME
    );

    if (hasPendingFood || calculatedSum <= 0) {
      const shouldSave = window.confirm(
        "这条记录还没有填写完整食物名称或热量，确认仍然保存吗？"
      );
      if (!shouldSave) return;
    }

    // Capture standard timestamp
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;

    const defaultCover =
      imagePreview ||
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCQIH8M31p-dCXupdNlbc056-o_SIiUuYcjBua2ypBS77-x4hh4ycu6OvQ-kPVC7R6dfnf2vSo9h6EFc2pQdH8P8Qk7y8ELmO7fm7SnLb_M4v8S-MsDzC8w3zYxaiZAxPTrchQgJhnAtGjphpQacUkFNL5Zb7X-vPiGfGc3WrcWUxKGHyFCJlw4uTXm5pGsM2--kNSsSc4Ii7tZVWZN1E4KJN3CQSwZOOlpMDNgkLIa2518GoE4Px9mSw_zxCxzdSruRWbM7N1FU73J";

    const confirmedFoodNames = foodItems
      .map((item) => item.name.trim())
      .filter((name) => name && name !== PENDING_FOOD_NAME)
      .slice(0, 3);

    const generatedMeal: Meal = {
      id: createUuid(),
      title: mealTitle || (foodItems[0] ? foodItems[0].name : "健康减脂餐"),
      type: selectedMealType,
      time: formattedTime,
      items: foodItems,
      totalCalories: calculatedSum,
      imageUrl: defaultCover,
      tags: confirmedFoodNames.length > 0 ? confirmedFoodNames : ["待确认"]
    };

    setIsSavingMeal(true);
    const accepted = await onSaveMeal(generatedMeal);
    if (!accepted) {
      setIsSavingMeal(false);
    }
  };

  return (
    <div className="flex flex-col pb-24 animate-fade-in text-[#1b1c1a]">
      {/* Invisible file input */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        id="camera-file-uploader"
      />

      {/* Top action layout */}
      <div className="flex justify-between items-center mt-3 mb-6">
        <button
          onClick={onCancel}
          id="btn-photo-cancel"
          className="text-xs font-bold text-[#424843]/75 hover:text-[#1d4f3c] cursor-pointer"
        >
          取消
        </button>
        <span className="text-xs font-extrabold text-[#1d4f3c]/90 bg-[#1d4f3c]/5 px-3 py-1 rounded-full uppercase tracking-wider">
          拍照估卡
        </span>
        <div className="w-8 h-4"></div>
      </div>

      {/* Upload area */}
      <section className="relative group w-full mb-6">
        <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-[#eae8e4]/40 border-2 border-dashed border-[#c1c8c1]/40 flex flex-col items-center justify-center relative shadow-inner">
          {isRecognizing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-fade-in">
              <Loader2 className="w-12 h-12 text-[#1d4f3c] animate-spin mb-3.5" />
              <div className="flex flex-col items-center space-y-1">
                <p className="text-sm font-black text-[#1d4f3c] tracking-wider animate-pulse">
                  AI 正在调用视觉模型识别食物...
                </p>
                <p className="text-[11px] text-[#424843]/60 font-semibold">硅基流动视觉模型分析中，约需3-6秒</p>
              </div>
            </div>
          )}

          {imagePreview ? (
            <div className="absolute inset-0 w-full h-full">
              <img
                src={imagePreview}
                alt="Uploaded Meal Preview"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  setFoodItems([]);
                  setMealTitle("");
                  setResultSource(null);
                  setAiError(null);
                }}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full cursor-pointer transition-all active:scale-90"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#1b1c1a]/5 flex items-center justify-center mb-3">
                <Camera className="w-7 h-7 text-[#1d4f3c]" />
              </div>
              <h4 className="font-display font-extrabold text-sm text-[#1d4f3c] mb-1">
                第一步：导入您的真实餐食
              </h4>
              <p className="text-xs text-[#424843]/60 font-medium">上传照片，AI 自动识别食物并估算热量，可点按修改</p>
            </div>
          )}
        </div>

        {/* Big Buttons */}
        <div className="flex gap-4 mt-5">
          <button
            onClick={triggerFileSelection}
            id="btn-photo-capture"
            className="flex-1 bg-[#1d4f3c] text-white py-3.5 rounded-full flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4 text-[#fe7e4f]" />
            拍照
          </button>
          <button
            onClick={triggerFileSelection}
            id="btn-photo-library"
            className="flex-1 bg-white border border-[#eae8e4] text-[#1d4f3c] py-3.5 rounded-full flex items-center justify-center gap-2 font-bold text-xs hover:bg-[#eae8e4]/30 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Image className="w-4 h-4 text-[#424843]/60" />
            从相册选择
          </button>
        </div>


      </section>
      {/* Recognition Result Sheet */}
      {aiError && (
        <div className="mb-4 p-3 bg-[#ba1a1a]/5 border border-[#ba1a1a]/15 rounded-xl"><p className="text-[11px] font-semibold text-[#ba1a1a]">AI 识别异常: {aiError}</p></div>
      )}
      {foodItems.length > 0 && (
        <section className="bg-white rounded-2xl p-5 border border-[#eae8e4] shadow-[0_4px_20px_rgba(29,79,60,0.02)] space-y-5">
          <div className="flex justify-between items-end pb-3 border-b border-[#eae8e4]">
            <div>
              <span className="text-[10px] font-black tracking-widest text-[#424843]/60 uppercase mb-0.5 block">
                {resultSource === "photo" ? "请确认热量" : "预计热量"}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-[#1d4f3c] tracking-tight">
                  {calculatedSum.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-[#1d4f3c]">kcal</span>
              </div>
            </div>

            {/* Meal classification switcher */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-[#424843]/60 mb-1.5 block">餐次划分</span>
              <div className="flex gap-1 p-0.5 bg-[#fbf9f5] rounded-full border border-[#eae8e4]">
                {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((typeStr) => {
                  const label =
                    typeStr === "breakfast"
                      ? "早餐"
                      : typeStr === "lunch"
                      ? "午餐"
                      : typeStr === "dinner"
                      ? "晚餐"
                      : "加餐";
                  const active = selectedMealType === typeStr;
                  return (
                    <button
                      key={typeStr}
                      onClick={() => setSelectedMealType(typeStr)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                        active
                          ? "bg-[#1d4f3c] text-white shadow-xs"
                          : "text-[#424843]/60 hover:text-[#1d4f3c]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Meals Title Modifier */}
          <div className="flex flex-col gap-1.5 px-1">
            <label className="text-[10px] font-bold text-[#424843]/60">餐食名称自定义</label>
            <input
              type="text"
              value={mealTitle}
              onChange={(e) => setMealTitle(e.target.value)}
              placeholder="例如：自制三文鱼鸡胸肉沙拉"
              className="w-full text-xs font-bold py-1.5 px-3 rounded-lg bg-[#fbf9f5] border border-[#eae8e4] focus:outline-hidden focus:ring-1 focus:ring-[#1d4f3c] text-[#1d4f3c]"
            />
          </div>

          {/* Food breakdown details */}
          <div className="space-y-3 px-1">
            <p className="text-[10px] font-extrabold text-[#424843]/70 uppercase tracking-widest">
              本餐包含食材 (点击文字、克数、热量可直接修改)
            </p>
            <div className="space-y-2.5 divide-y divide-[#eae8e4]/40">
              {foodItems.map((item) => (
                <div key={item.id} className="pt-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 bg-[#a43c12] rounded-full flex-shrink-0" />
                    {/* Food Name editable input */}
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleEditItemName(item.id, e.target.value)}
                      className="bg-transparent border-none p-0 focus:ring-0 focus:border-b focus:border-[#a43c12] font-semibold text-[#1c1d1a] truncate w-28"
                    />
                    {/* Weight editable input */}
                    <div className="flex items-center text-[#424843]/60 text-[10px]">
                      <input
                        type="number"
                        value={item.weightGrams ?? ""}
                        onChange={(e) => handleEditItemWeight(item.id, e.target.value)}
                        placeholder="--"
                        className="bg-transparent border-none p-0 focus:ring-0 w-8 text-center text-[10px] font-medium"
                      />
                      <span>g</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Calorie editable input */}
                    <div className="flex items-center font-bold text-[#1d4f3c]">
                      <input
                        type="number"
                        value={item.calories}
                        onChange={(e) => handleEditItemCalories(item.id, e.target.value)}
                        className="bg-transparent border-none p-0 focus:ring-0 w-12 text-right font-extrabold text-[#1d4f3c]"
                      />
                      <span className="text-[10px] font-normal text-[#424843]/60 ml-0.5">kcal</span>
                    </div>
                    {/* Remove item button */}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-[#424843]/40 hover:text-red-500 p-1"
                      title="删除此项食材"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trigger manual add drawer toggle */}
          {!showAddForm ? (
            <div className="pt-2 text-center">
              <button
                onClick={() => setShowAddForm(true)}
                className="text-xs font-bold text-[#1d4f3c] hover:text-[#a43c12] inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> 手动添加某种食物
              </button>
            </div>
          ) : (
            <form onSubmit={handleAddManualItem} className="bg-[#fbf9f5] border border-[#eae8e4] rounded-xl p-3.5 space-y-3 animate-slide-up">
              <p className="text-[10px] font-bold text-[#424843]/60">手动补填食物</p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="食物名称 (例：鸡蛋)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="bg-white border border-[#eae8e4] text-xs p-1.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1d4f3c]"
                  required
                />
                <input
                  type="number"
                  placeholder="估热量 (例：80) kcal"
                  value={newItemCal}
                  onChange={(e) => setNewItemCal(e.target.value)}
                  className="bg-white border border-[#eae8e4] text-xs p-1.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1d4f3c]"
                  required
                />
                <input
                  type="number"
                  placeholder="克数 (例：60) g"
                  value={newItemWeight}
                  onChange={(e) => setNewItemWeight(e.target.value)}
                  className="bg-white border border-[#eae8e4] text-xs p-1.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#1d4f3c]"
                />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1 bg-[#eae8e4] hover:bg-[#eae8e4]/80 text-[#424843] rounded-md font-bold cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#1d4f3c] text-white rounded-md font-bold cursor-pointer"
                >
                  添加
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Save Button Action Trigger */}
      {aiError && (
        <div className="mb-4 p-3 bg-[#ba1a1a]/5 border border-[#ba1a1a]/15 rounded-xl"><p className="text-[11px] font-semibold text-[#ba1a1a]">AI 识别异常: {aiError}</p></div>
      )}
      {foodItems.length > 0 && (
        <div className="mt-8 mb-12 flex flex-col gap-2 p-1">
          <button
            onClick={handleSaveMealClick}
            disabled={isSavingMeal}
            id="btn-photo-save"
            className="w-full bg-[#1d4f3c] hover:bg-[#1d4f3c]/95 text-white py-4 rounded-xl font-bold text-base shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-wait"
          >
            {isSavingMeal ? (
              <Loader2 className="w-4 h-4 text-[#fe7e4f] animate-spin" />
            ) : (
              <Check className="w-4 h-4 text-[#fe7e4f]" />
            )}
            {isSavingMeal ? "\u4fdd\u5b58\u4e2d..." : "\u4fdd\u5b58\u5230\u4eca\u65e5\u996e\u98df"}
          </button>
          {resultSource === "photo" ? (
            <p className="text-center text-[#424843]/50 text-[10px] font-medium leading-relaxed">
              {foodItems[0]?.name === PENDING_FOOD_NAME
                ? "AI 未能识别，请手动填写食物名称和热量"
                : "AI 已自动识别，可点击名称、克数、热量修改后保存"}
            </p>
          ) : resultSource === "demo" ? (
            <p className="text-center text-[#424843]/50 text-[10px] font-medium leading-relaxed">
              演示结果仅供参考，支持点击文本、数值行进行任意修正与纠错补录
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
