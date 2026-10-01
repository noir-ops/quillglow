"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Menu, X, ChevronDown } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"

function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null)
  const [openMobileMenu, setOpenMobileMenu] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // "Start Here" scrolls to the 3-account section when already on the
  // homepage; from any other page the /#audience href navigates there.
  const handleStartHereClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault()
      document.getElementById("audience")?.scrollIntoView({ behavior: "smooth" })
    }
  }

  // "Explore" scrolls to the How It Works section when already on the
  // homepage; from any other page the /#how-it-works href navigates there.
  const handleExploreClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault()
      document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
    }
  }

  const navItems: { label: string; href: string; match: string[]; children?: { label: string; href: string }[] }[] = [
    {
      label: "Explore",
      href: "/#how-it-works",
      match: ["/", "/explore"],
    },
    { label: "Guide", href: "/guide", match: ["/guide"] },
    { label: "Impact Partners", href: "/impact-partners", match: ["/impact-partners", "/partners"] },
    { label: "Store", href: "/shop", match: ["/shop", "/store"] },
  ]

  const isActive = (matchPaths: string[]) =>
    matchPaths.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)))

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "shadow-lg shadow-[#7C3AED]/08"
          : ""
      }`}
      style={
        isScrolled
          ? {
              background: "rgba(255,253,247,0.82)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              borderBottom: "1px solid rgba(124,58,237,0.1)",
            }
          : { background: "transparent" }
      }
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md group-hover:shadow-lg transition-all duration-300"
          >
            <Image src="/icon.png" alt="QuillGlow Logo" width={40} height={40} />
          </div>
          <span className="text-xl font-black text-[#1C1917]" style={{ fontWeight: 900 }}>
            Quill<span className="text-gradient-qg">Glow</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.match)
            return (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => item.children && setOpenDesktopMenu(item.label)}
              onMouseLeave={() => item.children && setOpenDesktopMenu(null)}
            >
              <Link
                href={item.href}
                onClick={item.label === "Explore" ? handleExploreClick : undefined}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors relative group ${
                  active ? "bg-[#EDE9FF] text-[#7C3AED]" : "text-[#6B7280] hover:text-[#7C3AED]"
                }`}
                style={{ fontWeight: 700 }}
              >
                {item.label}
                {item.children && <ChevronDown className="h-3.5 w-3.5" />}
                <span
                  className={`absolute -bottom-0.5 left-3 right-3 h-0.5 bg-[#7C3AED] rounded-full transition-all duration-300 ${
                    active ? "opacity-0" : "w-0 group-hover:w-[calc(100%-1.5rem)] opacity-100"
                  }`}
                />
              </Link>

              <AnimatePresence>
                {item.children && openDesktopMenu === item.label && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-1/2 top-full -translate-x-1/2 pt-3"
                  >
                    <div
                      className="min-w-[200px] overflow-hidden rounded-2xl border bg-white p-2 shadow-xl"
                      style={{ borderColor: "rgba(124,58,237,0.1)" }}
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          className="block rounded-xl px-3 py-2 text-sm font-600 text-[#6B7280] transition-colors hover:bg-[#EDE9FF] hover:text-[#7C3AED]"
                          style={{ fontWeight: 600 }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )
          })}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/auth/login">
            <Button
              variant="ghost"
              size="sm"
              className="font-700 text-[#6B7280] hover:text-[#7C3AED] hover:bg-[#EDE9FF]"
              style={{ fontWeight: 700 }}
            >
              Sign In
            </Button>
          </Link>
          <Link href="/#audience" onClick={handleStartHereClick}>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button
                size="sm"
                className="rounded-full px-6 font-800 shadow-md shadow-[#7C3AED]/25 text-white"
                style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)", fontWeight: 800 }}
              >
                Start Here
              </Button>
            </motion.div>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-[#1C1917]"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden"
          style={{
            background: "rgba(255,253,247,0.96)",
            backdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(124,58,237,0.1)",
          }}
        >
          <nav className="flex flex-col gap-1 px-4 py-6">
            {navItems.map((item) => {
              const active = isActive(item.match)
              return (
              <div key={item.label}>
                <div className={`flex items-center justify-between rounded-xl ${active ? "bg-[#EDE9FF]" : ""}`}>
                  <Link
                    href={item.href}
                    onClick={(e) => {
                      setIsMobileMenuOpen(false)
                      if (item.label === "Explore") handleExploreClick(e)
                    }}
                    className={`px-3 py-2.5 text-sm transition-colors ${active ? "text-[#7C3AED]" : "text-[#6B7280] hover:text-[#7C3AED]"}`}
                    style={{ fontWeight: 700 }}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <button
                      onClick={() => setOpenMobileMenu(openMobileMenu === item.label ? null : item.label)}
                      aria-label={`Toggle ${item.label} submenu`}
                      className="p-2.5 text-[#6B7280]"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${openMobileMenu === item.label ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {item.children && openMobileMenu === item.label && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden pl-4"
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-2 text-sm font-600 text-[#6B7280] hover:text-[#7C3AED] transition-colors"
                          style={{ fontWeight: 600 }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              )
            })}
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full bg-transparent border-[#7C3AED]/25 text-[#7C3AED]">Sign In</Button>
              </Link>
              <Link
                href="/#audience"
                onClick={(e) => {
                  setIsMobileMenuOpen(false)
                  handleStartHereClick(e)
                }}
              >
                <Button
                  className="w-full rounded-full font-800 text-white"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)", fontWeight: 800 }}
                >
                  Start Here
                </Button>
              </Link>
            </div>
          </nav>
        </motion.div>
      )}
    </motion.header>
  )
}

export default Header
export { Header }