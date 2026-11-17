import { useSyncExternalStore } from "react"
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Icons ---
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"

import {
  getThemePreference,
  resolveTheme,
  setThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/theme"

/**
 * The toolbar's own light/dark switch. It reads and writes the same store as
 * the header control, so the two can never drift apart; it flips between
 * explicit light and dark, while "System" stays available in the header.
 */
export function ThemeToggle() {
  const preference = useSyncExternalStore(
    subscribeToTheme,
    getThemePreference,
    () => "system" as ThemePreference
  )
  const isDarkMode = resolveTheme(preference) === "dark"

  return (
    <Button
      onClick={() => setThemePreference(isDarkMode ? "light" : "dark")}
      aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
      variant="ghost"
    >
      {isDarkMode ? (
        <MoonStarIcon className="tiptap-button-icon" />
      ) : (
        <SunIcon className="tiptap-button-icon" />
      )}
    </Button>
  )
}
