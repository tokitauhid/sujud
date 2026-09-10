import { useLocation } from "react-router-dom";
import { IonIcon } from "@ionic/react";

interface NavTabItemProps {
  href: string;
  label: string;
  iconOutline: string;
  iconFilled: string;
  statusDot?: "emerald" | "amber" | "bronze";
}

const NavTabItem = ({
  href,
  label,
  iconOutline,
  iconFilled,
  statusDot,
}: NavTabItemProps) => {
  const location = useLocation();
  const isActive =
    location.pathname === href || (href === "/HomePage" && location.pathname === "/");

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none font-mono py-1">
      {/* 1. Feature: Active State Top Accent Line */}
      {isActive && (
        <div className="absolute top-0 left-2 right-2 h-[2.5px] bg-[#10B981] rounded-none" />
      )}

      {/* Icon with Geometric Pill & Status Dot */}
      <div className="relative mt-1">
        <div
          className={`flex items-center justify-center w-8 h-7 rounded-none transition-all ${
            isActive
              ? "bg-[var(--app-surface)] border border-[var(--app-border)] text-white"
              : "text-[#64748B]"
          }`}
        >
          {/* 1. Feature: Outline vs Filled Icon Switching */}
          <IonIcon
            icon={isActive ? iconFilled : iconOutline}
            className={`text-[1.2rem] ${isActive ? "text-white" : "text-[#64748B]"}`}
          />
        </div>

        {/* 2. Feature: Micro-Status Indicator Dot */}
        {statusDot && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-none border border-[var(--app-bg)] ${
              statusDot === "emerald"
                ? "bg-[#10B981]"
                : statusDot === "bronze"
                ? "bg-[#F59E0B]"
                : "bg-[#F59E0B]"
            }`}
          />
        )}
      </div>

      {/* 3. Feature: Monospace Compact Balanced Typography */}
      <div className="flex items-center gap-1 mt-0.5">
        <span
          className={`text-[9px] uppercase tracking-wider font-semibold transition-colors ${
            isActive ? "text-white" : "text-[#94A3B8]"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

export default NavTabItem;
