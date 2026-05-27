/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CheckSquare, Camera, User } from "lucide-react";

export type TabType = "home" | "photo" | "me";

interface BottomNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-[#eae8e4]/80 shadow-[0_-4px_20px_rgba(29,79,60,0.02)]">
      <div className="max-w-md mx-auto flex justify-around items-center py-2.5 px-4">
        {/* 打卡 tab */}
        <button
          onClick={() => onTabChange("home")}
          id="btn-nav-home"
          className={`flex flex-col items-center justify-center py-1 flex-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === "home"
              ? "text-[#a43c12] scale-102 font-semibold"
              : "text-[#424843] opacity-60 hover:opacity-100"
          }`}
        >
          <CheckSquare className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-medium tracking-wider">打卡</span>
        </button>

        {/* 拍照 tab */}
        <button
          onClick={() => onTabChange("photo")}
          id="btn-nav-photo"
          className={`flex flex-col items-center justify-center py-1 flex-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === "photo"
              ? "text-[#a43c12] scale-102 font-semibold"
              : "text-[#424843] opacity-60 hover:opacity-100"
          }`}
        >
          <Camera className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-medium tracking-wider">拍照</span>
        </button>

        {/* 我的 tab */}
        <button
          onClick={() => onTabChange("me")}
          id="btn-nav-me"
          className={`flex flex-col items-center justify-center py-1 flex-1 transition-all active:scale-95 cursor-pointer ${
            activeTab === "me"
              ? "text-[#a43c12] scale-102 font-semibold"
              : "text-[#424843] opacity-60 hover:opacity-100"
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-medium tracking-wider">我的</span>
        </button>
      </div>
    </nav>
  );
};
