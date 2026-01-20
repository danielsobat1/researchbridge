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
    <nav style={{ backgroundColor: "var(--card-bg)", padding: "12px 16px", borderBottom: "1px solid var(--border)", opacity: isTransitioning ? 0.5 : 1, transition: "opacity 0.3s ease-in-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => handleNavigation("/")}
          style={{ textDecoration: "none", color: "var(--foreground)", fontSize: 18, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}
        >
          ResearchBridge
        </button>
        <button
          onClick={toggleMenu}
          style={{
            background: "none",
            border: "none",
            color: "var(--foreground)",
            fontSize: 24,
            cursor: "pointer",
            padding: "4px 8px",
          }}
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: 12, paddingBottom: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <button
            onClick={() => handleNavigation("/discover")}
            style={{ display: "block", color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
          >
            Discover Researchers
          </button>
          <button
            onClick={() => handleNavigation("/professors")}
            style={{ display: "block", color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
          >
            UBC Professors
          </button>
          <button
            onClick={() => handleNavigation("/resume-analyzer")}
            style={{ display: "block", color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
          >
            Resume Analyzer
          </button>
          <button
            onClick={() => handleNavigation("/for-you")}
            style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
          >
            <span>For You</span>
            {hasForYouUpdate && (
              <span style={{ 
                display: "inline-flex", 
                alignItems: "center", 
                justifyContent: "center", 
                width: 18, 
                height: 18, 
                borderRadius: "50%", 
                backgroundColor: "#ef4444", 
                color: "white", 
                fontSize: 11, 
                fontWeight: 600,
                lineHeight: 1
              }}>
                1
              </span>
            )}
          </button>
          <button
            onClick={() => handleNavigation("/opportunities")}
            style={{ display: "block", color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
          >
            Opportunities
          </button>
          <button
            onClick={() => handleNavigation("/my-list")}
            style={{ display: "block", color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
          >
            My Lists
          </button>

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
            <button
              onClick={() => setShowAccount(!showAccount)}
              style={{ display: "block", color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", fontWeight: 600 }}
            >
              {user ? `Account (${user.firstName})` : "Sign In"} {(user && showAccount) ? "▼" : user ? "▶" : ""}
            </button>

            {user && showAccount && (
              <div style={{ paddingLeft: 16, marginTop: 8 }}>
                {user.age && <div style={{ fontSize: 13, color: "var(--foreground)", padding: "4px 0" }}>Age: {user.age}</div>}
                {user.university && <div style={{ fontSize: 13, color: "var(--foreground)", padding: "4px 0" }}>University: {user.university}</div>}
                {user.interests.length > 0 && (
                  <div style={{ fontSize: 13, color: "var(--foreground)", padding: "4px 0" }}>
                    Interests: {user.interests.join(", ")}
                  </div>
                )}
                <button
                  onClick={() => handleNavigation("/settings")}
                  style={{ display: "block", marginTop: 8, marginBottom: 8, padding: "6px 12px", fontSize: 13, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--foreground)", borderRadius: 6, cursor: "pointer", width: "100%" }}
                >
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  style={{ display: "block", padding: "6px 12px", fontSize: 13, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--foreground)", borderRadius: 6, cursor: "pointer", width: "100%" }}
                >
                  Sign Out
                </button>
              </div>
            )}

            {!user && (
              <div style={{ paddingLeft: 16, marginTop: 8 }}>
                <button
                  onClick={() => handleNavigation("/auth")}
                  style={{ display: "block", marginBottom: 8, padding: "6px 12px", fontSize: 13, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--foreground)", borderRadius: 6, cursor: "pointer", width: "100%" }}
                >
                  Sign Up
                </button>
                <button
                  onClick={() => handleNavigation("/login")}
                  style={{ display: "block", padding: "6px 12px", fontSize: 13, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--foreground)", borderRadius: 6, cursor: "pointer", width: "100%" }}
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
            <button
              onClick={() => setShowAppearance(!showAppearance)}
              style={{ display: "block", color: "var(--foreground)", textDecoration: "none", padding: "8px 0", fontSize: 15, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", fontWeight: 600 }}
            >
              Appearance {showAppearance ? "▼" : "▶"}
            </button>

            {showAppearance && (
              <div style={{ paddingLeft: 16, marginTop: 8 }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--foreground) 70%, transparent)", marginBottom: 6 }}>Theme Mode</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleThemeChange("dark")}
                      style={{
                        flex: 1,
                        padding: "6px 12px",
                        fontSize: 13,
                        border: theme === "dark" ? "2px solid #fff" : "1px solid #555",
                        background: theme === "dark" ? "#333" : "#1a1a1a",
                        color: "#fff",
                        borderRadius: 6,
                        cursor: "pointer"
                      }}
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => handleThemeChange("light")}
                      style={{
                        flex: 1,
                        padding: "6px 12px",
                        fontSize: 13,
                        border: theme === "light" ? "2px solid #000" : "1px solid #ddd",
                        background: theme === "light" ? "#e0e0e0" : "#f5f5f5",
                        color: "#000",
                        borderRadius: 6,
                        cursor: "pointer"
                      }}
                    >
                      Light
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--foreground) 70%, transparent)", marginBottom: 6 }}>Color Theme</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      onClick={() => handleColorChange("default")}
                      style={{
                        padding: "8px",
                        fontSize: 12,
                        border: colorTheme === "default" ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: "var(--input-bg)",
                        color: "var(--foreground)",
                        borderRadius: 6,
                        cursor: "pointer"
                      }}
                    >
                      Default
                    </button>
                    <button
                      onClick={() => handleColorChange("blue")}
                      style={{
                        padding: "8px",
                        fontSize: 12,
                        border: colorTheme === "blue" ? "2px solid #3b82f6" : "1px solid var(--border)",
                        background: "#1e3a8a",
                        color: "#93c5fd",
                        borderRadius: 6,
                        cursor: "pointer"
                      }}
                    >
                      Blue
                    </button>
                    <button
                      onClick={() => handleColorChange("green")}
                      style={{
                        padding: "8px",
                        fontSize: 12,
                        border: colorTheme === "green" ? "2px solid #10b981" : "1px solid var(--border)",
                        background: "#065f46",
                        color: "#6ee7b7",
                        borderRadius: 6,
                        cursor: "pointer"
                      }}
                    >
                      Green
                    </button>
                    <button
                      onClick={() => handleColorChange("purple")}
                      style={{
                        padding: "8px",
                        fontSize: 12,
                        border: colorTheme === "purple" ? "2px solid #a855f7" : "1px solid var(--border)",
                        background: "#6b21a8",
                        color: "#d8b4fe",
                        borderRadius: 6,
                        cursor: "pointer"
                      }}
                    >
                      Purple
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
