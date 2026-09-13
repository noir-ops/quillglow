// Utility functions for theme customization
// Converts between hex colors and OKLCH CSS variables

export interface ThemePalette {
    primary: string
    background: string
    foreground: string
    card: string
    border: string
    accent: string
    muted: string
    "chart-1": string
    "chart-2": string
    "chart-3": string
  }
  
  export interface UserTheme {
    light: ThemePalette
    dark: ThemePalette
  }
  
  // Default QuillGlow theme values (OKLCH format)
  export const DEFAULT_THEME: UserTheme = {
    light: {
      primary: "oklch(0.6 0.22 264)",
      background: "oklch(0.99 0.005 264)",
      foreground: "oklch(0.15 0.01 264)",
      card: "oklch(1 0 0)",
      border: "oklch(0.92 0.005 264)",
      accent: "oklch(0.75 0.15 310)",
      muted: "oklch(0.96 0.005 264)",
      "chart-1": "oklch(0.6 0.22 264)",
      "chart-2": "oklch(0.75 0.15 310)",
      "chart-3": "oklch(0.75 0.12 30)",
    },
    dark: {
      primary: "oklch(0.65 0.22 264)",
      background: "oklch(0.15 0.01 264)",
      foreground: "oklch(0.99 0.005 264)",
      card: "oklch(0.18 0.01 264)",
      border: "oklch(0.25 0.01 264)",
      accent: "oklch(0.7 0.15 310)",
      muted: "oklch(0.25 0.01 264)",
      "chart-1": "oklch(0.65 0.22 264)",
      "chart-2": "oklch(0.7 0.15 310)",
      "chart-3": "oklch(0.7 0.12 30)",
    },
  }
  
  // Convert hex to RGB
  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : null
  }
  
  // Convert RGB to OKLCH (simplified approximation)
  function rgbToOklch(r: number, g: number, b: number): string {
    // Normalize RGB values
    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255
  
    // Convert to linear RGB
    const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    const rLin = toLinear(rNorm)
    const gLin = toLinear(gNorm)
    const bLin = toLinear(bNorm)
  
    // Convert to OKLab
    const l = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin
    const m = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin
    const s = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin
  
    const lCbrt = Math.cbrt(l)
    const mCbrt = Math.cbrt(m)
    const sCbrt = Math.cbrt(s)
  
    const L = 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt
    const a = 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt
    const bOk = 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt
  
    // Convert to OKLCH
    const C = Math.sqrt(a * a + bOk * bOk)
    let H = (Math.atan2(bOk, a) * 180) / Math.PI
    if (H < 0) H += 360
  
    return `oklch(${L.toFixed(2)} ${C.toFixed(2)} ${H.toFixed(0)})`
  }
  
  // Convert OKLCH to approximate hex (for display in color picker)
  function oklchToRgb(oklch: string): { r: number; g: number; b: number } | null {
    const match = oklch.match(/oklch$$([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)$$/)
    if (!match) return null
  
    const L = Number.parseFloat(match[1])
    const C = Number.parseFloat(match[2])
    const H = Number.parseFloat(match[3])
  
    // Convert to OKLab
    const hRad = (H * Math.PI) / 180
    const a = C * Math.cos(hRad)
    const b = C * Math.sin(hRad)
  
    // Convert OKLab to linear RGB
    const lCbrt = L + 0.3963377774 * a + 0.2158037573 * b
    const mCbrt = L - 0.1055613458 * a - 0.0638541728 * b
    const sCbrt = L - 0.0894841775 * a - 1.291485548 * b
  
    const l = lCbrt * lCbrt * lCbrt
    const m = mCbrt * mCbrt * mCbrt
    const s = sCbrt * sCbrt * sCbrt
  
    const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  
    // Convert to sRGB
    const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
  
    const r = Math.round(Math.max(0, Math.min(1, toSrgb(rLin))) * 255)
    const g = Math.round(Math.max(0, Math.min(1, toSrgb(gLin))) * 255)
    const bVal = Math.round(Math.max(0, Math.min(1, toSrgb(bLin))) * 255)
  
    return { r, g, b: bVal }
  }
  
  export function hexToOklch(hex: string): string {
    const rgb = hexToRgb(hex)
    if (!rgb) return "oklch(0.5 0.1 264)"
    return rgbToOklch(rgb.r, rgb.g, rgb.b)
  }
  
  export function oklchToHex(oklch: string): string {
    const rgb = oklchToRgb(oklch)
    if (!rgb) return "#808080"
    return `#${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`
  }
  
  // Apply theme to a container element
  export function applyThemeToElement(element: HTMLElement, palette: ThemePalette, isDark: boolean) {
    // Set CSS variables on the element
    element.style.setProperty("--primary", palette.primary)
    element.style.setProperty("--background", palette.background)
    element.style.setProperty("--foreground", palette.foreground)
    element.style.setProperty("--card", palette.card)
    element.style.setProperty("--card-foreground", palette.foreground)
    element.style.setProperty("--popover", palette.card)
    element.style.setProperty("--popover-foreground", palette.foreground)
    element.style.setProperty("--border", palette.border)
    element.style.setProperty("--input", palette.border)
    element.style.setProperty("--accent", palette.accent)
    element.style.setProperty("--muted", palette.muted)
    element.style.setProperty("--ring", palette.primary)
    element.style.setProperty("--chart-1", palette["chart-1"])
    element.style.setProperty("--chart-2", palette["chart-2"])
    element.style.setProperty("--chart-3", palette["chart-3"])
  
    // Update sidebar colors to match
    element.style.setProperty("--sidebar", palette.card)
    element.style.setProperty("--sidebar-foreground", palette.foreground)
    element.style.setProperty("--sidebar-primary", palette.primary)
    element.style.setProperty("--sidebar-accent", palette.muted)
    element.style.setProperty("--sidebar-border", palette.border)
    element.style.setProperty("--sidebar-ring", palette.primary)
  
    // Derived colors
    if (isDark) {
      element.style.setProperty("--primary-foreground", "oklch(0.15 0.01 264)")
      element.style.setProperty("--secondary-foreground", palette.foreground)
      element.style.setProperty("--muted-foreground", "oklch(0.6 0.01 264)")
      element.style.setProperty("--accent-foreground", "oklch(0.15 0.01 264)")
    } else {
      element.style.setProperty("--primary-foreground", "oklch(1 0 0)")
      element.style.setProperty("--secondary-foreground", palette.foreground)
      element.style.setProperty("--muted-foreground", "oklch(0.5 0.01 264)")
      element.style.setProperty("--accent-foreground", "oklch(1 0 0)")
    }
  }
  
  // Remove custom theme from element
  export function removeThemeFromElement(element: HTMLElement) {
    const properties = [
      "--primary",
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--border",
      "--input",
      "--accent",
      "--muted",
      "--ring",
      "--chart-1",
      "--chart-2",
      "--chart-3",
      "--sidebar",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-accent",
      "--sidebar-border",
      "--sidebar-ring",
      "--primary-foreground",
      "--secondary-foreground",
      "--muted-foreground",
      "--accent-foreground",
    ]
    properties.forEach((prop) => element.style.removeProperty(prop))
  }
  