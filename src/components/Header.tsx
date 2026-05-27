/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Calendar, User } from "lucide-react";

interface HeaderProps {
  onProfileClick?: () => void;
  title?: string;
  showBack?: boolean;
  onBackClick?: () => void;
  onCalendarClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onProfileClick,
  title = "轻燃",
  showBack = false,
  onBackClick,
  onCalendarClick,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#fbf9f5]/95 backdrop-blur-md border-b border-[#eae8e4]/50 py-4 px-5 flex items-center justify-between">
      {showBack ? (
        <button
          onClick={onBackClick}
          id="hdr-back-btn"
          className="p-1 px-2 -ml-1 rounded-full hover:bg-[#eae8e4]/40 active:scale-95 transition-all text-[#163826] flex items-center justify-center cursor-pointer"
        >
          <span className="text-sm font-medium">返回</span>
        </button>
      ) : (
        <div 
          onClick={onCalendarClick}
          id="hdr-calendar-btn"
          className="flex items-center gap-1.5 text-[#1d4f3c] cursor-pointer hover:opacity-85 transition-opacity p-1.5 -m-1.5 rounded-full"
        >
          <Calendar className="w-5 h-5 animate-pulse" />
        </div>
      )}

      <h1 className="font-display font-bold text-lg tracking-wide text-[#1d4f3c] text-center select-none">
        {title}
      </h1>

<div className="w-8 h-8"></div>
    </header>
  );
};
