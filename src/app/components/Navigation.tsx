"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { getUser, logout, UserProfile } from "@/app/lib/auth";

function hashInterests(interests: string[]): string {
  return interests.sort().join('|').toLowerCase();
}

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [colorTheme, setColorTheme] = useState<"default" | "blue" | "green" | "purple">("default");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hasForYouUpdate, setHasForYouUpdate] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem("rb_theme") as "light" | "dark" | null;
    const savedColor = localStorage.getItem("rb_color") as "default" | "blue" | "green" | "purple" | null;
    
    if (savedTheme) setTheme(savedTheme);
    if (savedColor) setColorTheme(savedColor);
    
    applyTheme(savedTheme || "dark", savedColor || "default");
    
    // Load user profile and check for For You updates
    const currentUser = getUser();
    setUser(currentUser);
    checkForYouUpdate(currentUser);
  }, []);
  
  // Re-check for updates when returning to the app or when pathname changes
  useEffect(() => {
    const currentUser = getUser();
    if (currentUser) {
      checkForYouUpdate(currentUser);
    }
  }, [pathname]);
  
  const checkForYouUpdate = (currentUser: UserProfile | null) => {
    if (!currentUser) {
      setHasForYouUpdate(false);
      return;
    }
    
    const university = (currentUser.university || "").toLowerCase();
    if (!university.includes("ubc")) {
      setHasForYouUpdate(false);
      return;
    }
    
    const currentHash = hashInterests(currentUser.interests || []);
    const lastHash = currentUser.lastInterestsHash || "";
    const lastView = currentUser.lastForYouView;
    const today = new Date().toISOString().slice(0, 10);
    const lastViewDate = lastView ? lastView.slice(0, 10) : "";
    
    // Show notification if:
    // 1. Interests changed since last view, OR
    // 2. It's a new day since last view
    const interestsChanged = currentHash !== lastHash && lastHash !== "";
    const newDay = lastViewDate !== today && lastViewDate !== "";
    const neverViewed = !lastView;
    
    setHasForYouUpdate(interestsChanged || newDay || neverViewed);
  };

  const applyTheme = (newTheme: "light" | "dark", newColor: string) => {
    document.documentElement.setAttribute("data-theme", newTheme);
    document.documentElement.setAttribute("data-color", newColor);
    // Dispatch custom event so other components can react to theme changes
    window.dispatchEvent(new CustomEvent("themeChange", { detail: { theme: newTheme, color: newColor } }));
  };

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("rb_theme", newTheme);
    applyTheme(newTheme, colorTheme);
  };

  const handleColorChange = (newColor: "default" | "blue" | "green" | "purple") => {
    setColorTheme(newColor);
    localStorage.setItem("rb_color", newColor);
    applyTheme(theme, newColor);
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (href: string) => {
    setIsTransitioning(true);
    setTimeout(() => {
      router.push(href);
      setIsOpen(false);
      setIsTransitioning(false);
    }, 300);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setShowAccount(false);
    handleNavigation("/");
  };

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/10 shadow-lg">
      <div className="mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
        <button
          onClick={() => handleNavigation("/")}
          className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent hover:from-violet-300 hover:to-cyan-300 transition-all duration-300"
        >
          ResearchBridge
        </button>
        <button
          onClick={toggleMenu}
          className="p-2 rounded-lg hover:bg-white/10 transition-all duration-300 text-2xl"
          aria-label="Toggle menu"
        >
          {isOpen ? "✕" : "☰"}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-white/10 bg-black/95 backdrop-blur-xl animate-fadeIn">
          <div className="mx-auto max-w-7xl px-6 py-6 space-y-1">
            <button
              onClick={() => handleNavigation("/discover")}
              className="block w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white/90 hover:text-white font-medium"
            >
              Discover Researchers
            </button>
            <button
              onClick={() => handleNavigation("/professors")}
              className="block w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white/90 hover:text-white font-medium"
            >
              UBC Professors
            </button>
            <button
              onClick={() => handleNavigation("/resume-analyzer")}
              className="block w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white/90 hover:text-white font-medium"
            >
              Resume Analyzer
            </button>
            <button
              onClick={() => handleNavigation("/for-you")}
              className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white/90 hover:text-white font-medium"
            >
              <span>For You</span>
              {hasForYouUpdate && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold shadow-lg">
                  1
                </span>
              )}
            </button>
            <button
              onClick={() => handleNavigation("/opportunities")}
              className="block w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white/90 hover:text-white font-medium"
            >
              Opportunities
            </button>
            <button
              onClick={() => handleNavigation("/my-list")}
              className="block w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white/90 hover:text-white font-medium"
            >
              My Lists
            </button>

            <div className="border-t border-white/10 mt-4 pt-4">
              <button
                onClick={() => setShowAccount(!showAccount)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white font-semibold"
              >
                <span>{user ? `Account (${user.firstName})` : "Sign In"}</span>
                <span className="text-xs">{user && (showAccount ? "▼" : "▶")}</span>
              </button>

              {user && showAccount && (
                <div className="mt-2 px-4 space-y-3 animate-fadeIn">
                  {user.age && <div className="text-sm text-white/60 py-1">Age: {user.age}</div>}
                  {user.university && <div className="text-sm text-white/60 py-1">University: {user.university}</div>}
                  {user.interests.length > 0 && (
                    <div className="text-sm text-white/60 py-1">
                      Interests: {user.interests.join(", ")}
                    </div>
                  )}
                  <button
                    onClick={() => handleNavigation("/settings")}
                    className="w-full px-4 py-2 text-sm border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                  >
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-sm border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-all duration-300"
                  >
                    Sign Out
                  </button>
                </div>
              )}

              {!user && (
                <div className="mt-2 px-4 space-y-2 animate-fadeIn">
                  <button
                    onClick={() => handleNavigation("/auth")}
                    className="w-full px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:from-violet-500 hover:to-purple-500 transition-all duration-300 font-semibold shadow-lg"
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={() => handleNavigation("/login")}
                    className="w-full px-4 py-2 text-sm border border-white/20 bg-white/5 backdrop-blur-sm rounded-lg hover:bg-white/10 hover:border-white/30 transition-all duration-300"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 mt-4 pt-4">
              <button
                onClick={() => setShowAppearance(!showAppearance)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-300 text-white font-semibold"
              >
                <span>Appearance</span>
                <span className="text-xs">{showAppearance ? "▼" : "▶"}</span>
              </button>

              {showAppearance && (
                <div className="mt-2 px-4 space-y-4 animate-fadeIn">
                  <div>
                    <div className="text-sm text-white/60 mb-3">Theme Mode</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleThemeChange("dark")}
                        className={`px-4 py-3 text-sm rounded-xl transition-all duration-300 font-medium ${
                          theme === "dark"
                            ? "bg-gradient-to-r from-violet-600 to-purple-600 border-2 border-violet-500 shadow-lg shadow-violet-500/30"
                            : "bg-zinc-900 border border-white/20 hover:border-white/40"
                        }`}
                      >
                        🌙 Dark
                      </button>
                      <button
                        onClick={() => handleThemeChange("light")}
                        className={`px-4 py-3 text-sm rounded-xl transition-all duration-300 font-medium ${
                          theme === "light"
                            ? "bg-white text-black border-2 border-gray-300 shadow-lg"
                            : "bg-gray-200 text-gray-800 border border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        ☀️ Light
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-white/60 mb-3">Color Accent</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleColorChange("default")}
                        className={`px-4 py-3 text-sm rounded-xl transition-all duration-300 font-medium ${
                          colorTheme === "default"
                            ? "bg-white/10 border-2 border-white/40 shadow-lg"
                            : "bg-white/5 border border-white/20 hover:border-white/30"
                        }`}
                      >
                        Default
                      </button>
                      <button
                        onClick={() => handleColorChange("blue")}
                        className={`px-4 py-3 text-sm rounded-xl transition-all duration-300 font-medium ${
                          colorTheme === "blue"
                            ? "bg-blue-600 border-2 border-blue-400 text-white shadow-lg shadow-blue-500/30"
                            : "bg-blue-950 border border-blue-800 text-blue-300 hover:border-blue-600"
                        }`}
                      >
                        Blue
                      </button>
                      <button
                        onClick={() => handleColorChange("green")}
                        className={`px-4 py-3 text-sm rounded-xl transition-all duration-300 font-medium ${
                          colorTheme === "green"
                            ? "bg-green-600 border-2 border-green-400 text-white shadow-lg shadow-green-500/30"
                            : "bg-green-950 border border-green-800 text-green-300 hover:border-green-600"
                        }`}
                      >
                        Green
                      </button>
                      <button
                        onClick={() => handleColorChange("purple")}
                        className={`px-4 py-3 text-sm rounded-xl transition-all duration-300 font-medium ${
                          colorTheme === "purple"
                            ? "bg-purple-600 border-2 border-purple-400 text-white shadow-lg shadow-purple-500/30"
                            : "bg-purple-950 border border-purple-800 text-purple-300 hover:border-purple-600"
                        }`}
                      >
                        Purple
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
