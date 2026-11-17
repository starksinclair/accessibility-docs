import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getThemePreference,
  setThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function Icon({ theme }: { theme: ThemePreference }) {
  const common = {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: "false" as const,
  };

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="3.6" />
        <path d="M10 2.4v1.8M10 15.8v1.8M17.6 10h-1.8M4.2 10H2.4M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3M15.4 15.4l-1.3-1.3M5.9 5.9L4.6 4.6" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M16.3 11.6A6.8 6.8 0 0 1 8.4 3.7a6.8 6.8 0 1 0 7.9 7.9Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2.6" y="4" width="14.8" height="10" rx="1.6" />
      <path d="M7 17.2h6" />
    </svg>
  );
}

/**
 * Three-way colour theme control.
 *
 * Built as a radiogroup rather than a cycling button so the current choice is
 * always visible and announced, and so "System" is reachable directly instead
 * of by tabbing through the other two. Roving tabindex keeps it to a single
 * tab stop, with arrow keys moving between options (APG radio group pattern).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreference,
    () => "system" as ThemePreference
  );
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(0, OPTIONS.findIndex((o) => o.value === preference))
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shouldFocus = useRef(false);

  useEffect(() => {
    if (shouldFocus.current) {
      refs.current[focusIndex]?.focus();
      shouldFocus.current = false;
    }
  }, [focusIndex]);

  const move = (delta: number) => {
    const next = (focusIndex + delta + OPTIONS.length) % OPTIONS.length;
    shouldFocus.current = true;
    setFocusIndex(next);
    setThemePreference(OPTIONS[next].value);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        shouldFocus.current = true;
        setFocusIndex(0);
        setThemePreference(OPTIONS[0].value);
        break;
      case "End":
        event.preventDefault();
        shouldFocus.current = true;
        setFocusIndex(OPTIONS.length - 1);
        setThemePreference(OPTIONS[OPTIONS.length - 1].value);
        break;
    }
  };

  return (
    <div
      className={`theme-toggle${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label="Colour theme"
      onKeyDown={onKeyDown}
    >
      {OPTIONS.map((option, index) => {
        const checked = preference === option.value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === focusIndex ? 0 : -1}
            className="theme-toggle-option"
            onClick={() => {
              setFocusIndex(index);
              setThemePreference(option.value);
            }}
          >
            <Icon theme={option.value} />
            <span className="theme-toggle-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
