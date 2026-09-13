"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Calendar,
  Brain,
  FileText,
  BarChart3,
  Moon,
  Sun,
  LogOut,
  Sparkles,
  Heart,
  Search,
  User,
  Settings,
  Timer,
  FileQuestion,
  MoreHorizontal,
  X,
  Gamepad2,
  ClipboardList,
  Users,
  GraduationCap,
  Palette,
  Network,
  BookOpenCheck,
  Headphones,
  Medal,
  ChevronLeft,
  ChevronRight,
  Zap,
  Target,
  TrendingUp,
  Compass,
  Trophy,
  ShoppingBag,
  Award,
  Wallet,
  MessageSquare,
} from "lucide-react"
import { NotificationBell } from "@/components/dashboard/notification-bell"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useStudyStore } from "@/lib/store/study-store"
import { createBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ChristmasLogoText } from "@/components/christmas-logo"
import { StudyTogetherModal } from "@/components/study-together-modal"
import { ThemeStudio } from "@/components/theme-studio/theme-studio"
import { useUserTheme } from "@/hooks/use-user-theme"
import { GlobalTimerWidget } from "@/components/global-timer/global-timer-widget"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useStudyStore()
  const router = useRouter()
  const supabase = createBrowserClient()

  const [isGenius, setIsGenius] = useState<boolean | null>(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [showStudyTogetherModal, setShowStudyTogetherModal] = useState(false)
  const [studyTogetherEnabled, setStudyTogetherEnabled] = useState(true)
  const [showThemeStudio, setShowThemeStudio] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useUserTheme()

  // Instantly load sidebar collapse state, no flash
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed")
    if (saved !== null) setCollapsed(saved === "true")
  }, [])

  const toggleSidebar = useCallback(async () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem("sidebar_collapsed", String(next))
    // Persist to Supabase in background
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from("profiles")
          .update({ sidebar_collapsed: next })
          .eq("id", user.id)
      }
    } catch {
      // LocalStorage already persisted, non-critical
    }
  }, [collapsed])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  useEffect(() => {
    let ignore = false
    async function fetchSubscription() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsGenius(false)
        return
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("plan_type")
        .eq("user_id", user.id)
        .maybeSingle()
      if (!ignore) {
        if (data && data.plan_type === "genius") {
          setIsGenius(true)
        } else {
          setIsGenius(false)
        }
      }
    }
    fetchSubscription()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    async function fetchStudyTogetherPreference() {
      try {
        const response = await fetch("/api/preferences/study-together")
        const data = await response.json()
        if (!ignore) {
          setStudyTogetherEnabled(data.enabled ?? true)
        }
      } catch (error) {
        console.error("[v0] Error fetching study-together preference:", error)
      }
    }
    fetchStudyTogetherPreference()
    return () => {
      ignore = true
    }
  }, [])

  /**
   * Primary navigation per spec §29: HOME / LEARN / OPPORTUNITIES / STORE /
   * AI / ACCOUNT. Every existing feature is nested under one of these — the
   * feature-heavy flat menu becomes a platform-oriented one without removing
   * anything students currently rely on.
   */
  /**
   * Primary navigation per "Proposed Student Navigation — V2".
   *
   * Eight sections, using the Consolidated Menu names from that table:
   * Today / Learn / Prepare / Opportunities / Resources / AI Hub /
   * Progress / Account.
   *
   * Every previously-reachable destination is still reachable. Where V2 lists
   * a section's contents but the platform has extra tools not named in the
   * table (WriteReal, EchoMind, Study Together, Focus Timer, Stress Relief),
   * those are placed in the closest matching section rather than dropped —
   * per the standing instruction not to remove features in this phase.
   */
  /**
   * Primary navigation. Consolidation rules applied here:
   *  - Every AI chat lives under AI HUB and appears nowhere else.
   *  - Notes + Revision are one entry; Stress Relief + Focus Timer are one entry.
   *  - Analytics / Leaderboard / Rewards moved out of HOME into PROGRESS.
   * Pages are never removed — only their menu entries are combined.
   */
  const navGroups = [
    {
      label: "Home",
      href: "/dashboard",
      icon: Home,
      items: [
        { href: "/dashboard", icon: Home, label: "Dashboard" },
        { href: "/study-agent", icon: Zap, label: "Study Agent", isNew: true },
        { href: "/family-mentors", icon: Users, label: "Family & Mentors" },
        { href: "/search", icon: Search, label: "Browse" },
      ],
    },
    {
      label: "Learn",
      href: "/learn",
      icon: Compass,
      items: [
        // Notes + Revision combined into a single entry.
        { href: "/notes", icon: FileText, label: "Revision & Notes" },
        { href: "/flashcards", icon: Brain, label: "Flashcards" },
        { href: "/mind-map", icon: Network, label: "Mind Maps", isNew: true },
        { href: "/audio-overview", icon: Headphones, label: "Audio", isNew: true },
        { href: "/tools/writereal", icon: FileQuestion, label: "WriteReal", isNew: true },
      ],
    },
    {
      label: "Prepare",
      href: "/prepare",
      icon: Target,
      items: [
        { href: "/planner", icon: Calendar, label: "Study Plan" },
        { href: "/prepare", icon: Target, label: "Exam Readiness", isNew: true },
        { href: "/exam-generator", icon: FileQuestion, label: "Practice Exams" },
        { href: "/mock-exam", icon: ClipboardList, label: "Mock MCQ Exam" },
      ],
    },
    {
      label: "Opportunities",
      href: "/opportunities",
      icon: GraduationCap,
      items: [
        // Two distinct, real filtered views — each links to a different
        // opportunity_type set (see app/(outcomes)/opportunities/page.tsx),
        // not both pointing at the same unfiltered landing page.
        { href: "/opportunities?type=scholarship", icon: GraduationCap, label: "Scholarships" },
        { href: "/opportunities?type=program", icon: Award, label: "STEAM Programs", isNew: true },
        { href: "/my-applications", icon: FileText, label: "My Applications", isNew: true },
      ],
    },
    {
      label: "Resources",
      href: "/shop",
      icon: ShoppingBag,
      items: [
        { href: "/ambassador", icon: Award, label: "Ambassador Program" },
        { href: "/shop", icon: ShoppingBag, label: "Store" },
        { href: "/study-together", icon: Users, label: "Study Together" },
      ],
    },
    {
      label: "AI Hub",
      href: "/tutor",
      icon: Sparkles,
      items: [
        { href: "/tutor", icon: GraduationCap, label: "Study AI" },
        { href: "/learn", icon: Compass, label: "Sprout AI", isNew: true },
        { href: "/echomind", icon: Sparkles, label: "EchoMind", isNew: true },
      ],
    },
    {
      label: "Progress",
      href: "/grow",
      icon: TrendingUp,
      items: [
        { href: "/grow", icon: TrendingUp, label: "Grow", isNew: true },
        { href: "/analytics", icon: BarChart3, label: "Analytics" },
        { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
        { href: "/grow#achievements", icon: Medal, label: "Rewards & Achievements" },
      ],
    },
    {
      label: "Account",
      href: "/profile",
      icon: User,
      items: [
        { href: "/profile", icon: User, label: "Profile" },
        { href: "/wallet", icon: Wallet, label: "Wallet" },
        { href: "/mentor", icon: MessageSquare, label: "Mentor" },
        { href: "/upgrade", icon: Zap, label: "Subscription" },
        { href: "/settings", icon: Settings, label: "Settings" },
      ],
    },
  ]

  const navItems = navGroups.flatMap((g) => g.items)

  // V2 primary navigation, bottom bar. Only four fit alongside the "More"
  // button, so these are the four sections a student uses daily; Resources,
  // AI Hub, Progress and Account live under More.
  const mobileMainNav = [
    { href: "/dashboard", icon: Home, label: "Dashboard" },
    { href: "/learn", icon: Compass, label: "Learn" },
    { href: "/prepare", icon: Target, label: "Prepare" },
    { href: "/opportunities", icon: GraduationCap, label: "Opportunities" },
  ]

  // Derived from navGroups rather than hand-maintained. The mobile menu had
  // previously drifted into a flat alphabetical list that no longer matched the
  // desktop sections; deriving it makes that class of drift impossible.
  //
  // Routes with no home in the V2 section table are appended under "More" so
  // nothing becomes unreachable.
  // ALL groups, not just the ones missing from the bottom bar. The bottom bar
  // links to a section's landing page (e.g. /learn), which is not an index of
  // that section's tools — so filtering those groups out here would leave
  // Notes, Flashcards, Mind Maps and the rest with no route on mobile at all.
  const mobileMoreGroups = [
    ...navGroups.map((g) => ({ label: g.label, items: g.items })),
    {
      label: "More",
      items: [
        { href: "/schedule", icon: ClipboardList, label: "Schedule" },
        { href: "/zen-runner", icon: Gamepad2, label: "Zen Runner" },
      ],
    },
  ]


  const filteredNavItems = navItems.filter((item) => studyTogetherEnabled || item.href !== "/study-together")
  const filteredMobileMainNav = mobileMainNav.filter((item) => studyTogetherEnabled || item.href !== "/study-together")

  return (
    <div id="app-theme-root" className="min-h-screen bg-background">
      <StudyTogetherModal open={showStudyTogetherModal} onOpenChange={setShowStudyTogetherModal} />
      <ThemeStudio open={showThemeStudio} onOpenChange={setShowThemeStudio} />

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 inset-x-0 bg-card border-b border-border z-50 h-14">
        <div className="flex items-center justify-between h-full px-4">
          <Link href="/dashboard" className="flex-shrink-0">
            <ChristmasLogoText isGenius={isGenius || false} />
          </Link>
          <div className="flex-1 flex justify-center px-2">
            <div className="flex items-center gap-1.5">
              <GlobalTimerWidget />
              {/* Focus lives beside the timer rather than in the Prepare menu —
                  it's a mode you enter while studying, not something you plan. */}
              <Link
                href="/timer"
                aria-label="Focus"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Timer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Focus</span>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <NotificationBell />
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowThemeStudio(true)}>
              <Palette className="h-5 w-5" />
            </Button>
            {/* Profile and Settings intentionally removed from this header:
                they duplicated the Account section in the navigation, which is
                the single place account options now live. Theme, upgrade and
                sign-out remain because they are not navigation destinations. */}
            {isGenius === false && (
              <Button asChild variant="ghost" size="icon" className="text-primary">
                <Link href="/upgrade">
                  <Sparkles className="h-5 w-5" />
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleSignOut} className="flex-1 bg-transparent">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <TooltipProvider delayDuration={0}>
      <aside
        className={`hidden md:fixed md:inset-y-0 md:flex md:flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "md:w-16" : "md:w-64"
        }`}
      >
        <div className="flex flex-col flex-grow border-r border-border bg-card pt-5 pb-4 overflow-y-auto overflow-x-hidden">
          {/* Logo + toggle button row */}
          <div className={`flex items-center flex-shrink-0 px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
            {!collapsed && (
              <Link href="/dashboard" className="flex-1 min-w-0">
                <ChristmasLogoText isGenius={isGenius || false} />
              </Link>
            )}
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-accent transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          {/* Logo when collapsed */}
          {collapsed && (
            <div className="flex justify-center px-3 mt-1">
              <Link href="/dashboard">
                <span className="text-primary font-bold text-lg">Q</span>
              </Link>
            </div>
          )}
          {/* Timer widget — hide when collapsed */}
          {!collapsed && (
            <div className="mt-4 px-3">
              <div className="flex items-center gap-1.5">
                <GlobalTimerWidget />
                <Link
                  href="/timer"
                  aria-label="Focus"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Timer className="h-3.5 w-3.5" />
                  Focus
                </Link>
              </div>
            </div>
          )}

          <nav className="mt-4 flex-1 px-2 space-y-1">
            {navGroups.map((group) => {
              const groupItems = group.items.filter(
                (item) => studyTogetherEnabled || item.href !== "/study-together",
              )
              const groupActive = groupItems.some(
                (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
              )

              // Collapsed rail: show one icon per GROUP, not per feature —
              // otherwise the rail is as long as the old flat menu was.
              if (collapsed) {
                return (
                  <Tooltip key={group.label}>
                    <TooltipTrigger asChild>
                      <Link
                        href={group.href}
                        className={`group flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          groupActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <group.icon className="h-5 w-5 flex-shrink-0" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{group.label}</TooltipContent>
                  </Tooltip>
                )
              }

              return (
                <div key={group.label} className="mb-3">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                  {groupItems.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(item.href + "/")
                    return (
                      <Link
                        key={`${group.label}-${item.href}`}
                        href={item.href}
                        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.isNew && (
                          <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            NEW
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}

            {/* Ambassador, Profile and Settings previously lived here as a
                separate footer block. They are now items in the Account
                section above, so this duplicated them in the sidebar. */}
          </nav>
          {/* Upgrade button */}
          {isGenius === false && (
            <div className="px-2 mb-4">
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild className="w-full px-0" variant="default" size="icon">
                      <Link href="/upgrade">
                        <Sparkles className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Upgrade to Genius</TooltipContent>
                </Tooltip>
              ) : (
                <Button asChild className="w-full" variant="default">
                  <Link href="/upgrade">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade to Genius
                  </Link>
                </Button>
              )}
            </div>
          )}
          {/* Bottom action buttons */}
          <div className={`flex-shrink-0 flex border-t border-border p-3 ${collapsed ? "flex-col gap-2 items-center" : "gap-2"}`}>
            {collapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setShowThemeStudio(true)} className="bg-transparent hover:bg-accent/40">
                      <Palette className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Theme</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={toggleTheme} className="bg-transparent hover:bg-accent/40">
                      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{theme === "light" ? "Dark mode" : "Light mode"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleSignOut} className="hover:bg-accent/40">
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" onClick={() => setShowThemeStudio(true)} className="hover:bg-accent/40 bg-transparent">
                  <Palette className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={toggleTheme} className="flex-1 hover:bg-accent/40 bg-transparent">
                  {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={handleSignOut} className="hover:bg-accent/40">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>
      </TooltipProvider>

      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <div className="relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/50 shadow-lg shadow-black/10 dark:shadow-black/30 px-2 py-2">
          <div className="flex justify-around items-center relative">
            {filteredMobileMainNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "text-primary scale-105"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "drop-shadow-sm" : ""}`} />
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? "font-semibold" : ""}`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}

            <button
              onClick={() => setIsMoreOpen(true)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 ${
                isMoreOpen
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800/50"
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] mt-1 font-medium">More</span>
            </button>
          </div>
        </div>
      </nav>

      {isMoreOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
          isMoreOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-t-3xl border-t border-x border-white/20 dark:border-gray-700/50 shadow-2xl max-h-[70vh] overflow-hidden">
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-6 pb-4">
            <h3 className="text-lg font-semibold text-foreground">More Options</h3>
            <button
              onClick={() => setIsMoreOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="px-4 pb-8 overflow-y-auto max-h-[50vh]">
            <div className="grid grid-cols-4 gap-2">
              {mobileMoreGroups.map((group) => {
                const items = group.items.filter(
                  (i: any) => studyTogetherEnabled || i.href !== "/study-together",
                )
                if (items.length === 0) return null
                return (
                  <div key={group.label} className="col-span-full">
                    <p className="px-1 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {items.map((item: any) => {
                        const isActive =
                          pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                          <Link
                            key={`${group.label}-${item.href}`}
                            href={item.href}
                            onClick={() => setIsMoreOpen(false)}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
                            }`}
                          >
                            <div
                              className={`relative p-3 rounded-xl ${
                                isActive ? "bg-primary/20" : "bg-gray-100 dark:bg-gray-800"
                              }`}
                            >
                              <item.icon className="h-5 w-5" />
                              {item.isNew && (
                                <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-primary text-primary-foreground px-1 py-0.5 rounded-full leading-none">
                                  NEW
                                </span>
                              )}
                            </div>
                            <span className="mt-2 text-[11px] font-medium text-center leading-tight">
                              {item.label}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <button
                onClick={() => {
                  setIsMoreOpen(false)
                  setShowThemeStudio(true)
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
              >
                <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <Palette className="h-5 w-5" />
                </div>
                <span className="text-xs mt-2 font-medium text-center leading-tight">Theme</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                {isGenius === false && (
                  <Button asChild className="flex-1" variant="default">
                    <Link href="/upgrade" onClick={() => setIsMoreOpen(false)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Upgrade
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 hover:bg-accent/40 dark:hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 bg-transparent"
                  onClick={toggleTheme}
                >
                  {theme === "light" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                  {theme === "light" ? "Dark" : "Light"}
                </Button>
                <Button
                  variant="outline"
                  className="hover:bg-accent/40 dark:hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 bg-transparent"
                  onClick={() => {
                    handleSignOut()
                    setIsMoreOpen(false)
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${
          collapsed ? "md:pl-16" : "md:pl-64"
        }`}
      >
        <main className="flex-1 pt-14 md:pt-0 pb-28 md:pb-8">{children}</main>
      </div>
    </div>
  )
}

const handleSignOut = async () => {
  const supabase = createBrowserClient()
  await supabase.auth.signOut()
  window.location.href = "/auth/login"
}