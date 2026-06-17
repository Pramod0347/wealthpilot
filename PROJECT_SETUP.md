# WealthPilot — Design System & Implementation Guide

## Overview
WealthPilot is a premium fintech dashboard for personal wealth management. Built with React + TypeScript + Tailwind CSS. Dark-first design with teal accent color. Responsive across all devices.

---

## Typography

### Font Stack
- **UI (Sans)**: Plus Jakarta Sans (geometric, modern)
  - Weights: 400, 500, 600, 700, 800
- **Data (Mono)**: JetBrains Mono (tabular numerals enabled)
  - Weights: 400, 500, 600, 700
  - CSS: `font-feature-settings: "tnum" 1` for all `.font-mono` elements

### Type Scale

| Usage | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|-----------------|
| Page Title (h1) | 28px | 700 | 1.2 | -0.5px |
| Section Title (h2) | 20px | 700 | 1.3 | -0.25px |
| Card Title (h3) | 14px | 600 | 1.4 | 0 |
| Body (p) | 14px | 400 | 1.6 | 0 |
| Small (caption) | 12px | 500 | 1.5 | 0.3px |
| Tiny (label) | 11px | 600 | 1.4 | 0.5px |
| Mono (data) | 13px | 500 | 1.5 | 0 |

---

## Color System

### Accent (Teal)
Primary brand color used for buttons, active states, highlights.

```css
accent-50:   #f0fdfa
accent-100:  #ccfbf1
accent-200:  #99f6e4
accent-300:  #5eead4
accent-400:  #2dd4bf
accent-500:  #14b8a6  /* hover state */
accent-600:  #0d9488  /* primary */
accent-700:  #0f766e  /* active/dark */
accent-800:  #115e59
accent-900:  #134e4a
```

### Semantic Colors
- **Success (Green)**: #10b981 (emerald-600)
- **Warning (Amber)**: #f59e0b
- **Error (Red)**: #f43f5e / #ef4444
- **Info (Blue)**: #0ea5e9 (sky-500)
- **Neutral (Slate)**: #64748b (slate-500)

### Background
- **Light Mode**: #ffffff (white), #f8fafc (slate-50)
- **Dark Mode**: #0f172a (slate-950), #1e293b (slate-800)
- **Card**: #ffffff (light), #1e293b (dark)
- **Hover**: #f1f5f9 (light), #334155 (dark)

### Text
- **Primary**: #0f172a (light), #f1f5f9 (dark)
- **Secondary**: #475569 (slate-600, light), #cbd5e1 (slate-300, dark)
- **Tertiary**: #94a3b8 (slate-400, light), #64748b (slate-500, dark)
- **Disabled**: #cbd5e1 (slate-300, light), #475569 (slate-600, dark)

---

## Spacing & Layout

### Spacing Scale
```
4px   → gap-1
8px   → gap-2
12px  → gap-3
16px  → gap-4
20px  → gap-5
24px  → gap-6
28px  → gap-7
32px  → gap-8
40px  → gap-10
48px  → gap-12
```

### Padding (px/py/p)
- **Compact**: 8px (p-2)
- **Standard**: 12px (p-3)
- **Comfortable**: 16px (p-4)
- **Generous**: 20px (p-5)
- **Spacious**: 24px (p-6)

### Margin & Gaps
- **Between sections**: 20px (gap-5)
- **Between cards**: 16px (gap-4)
- **Between grid items**: 16px (gap-4)
- **Between form fields**: 12px (gap-3)

---

## Border & Corner Radius

### Border Radius
| Size | Usage |
|------|-------|
| 4px (rounded) | Input fields, small buttons, badges |
| 8px (rounded-lg) | Cards, modals, medium buttons |
| 12px (rounded-xl) | Large cards, prominent sections |
| 16px (rounded-2xl) | Hero sections, empty states |
| 20px (rounded-3xl) | Large hero panels |
| 9999px (rounded-full) | Avatars, pills, full-width circles |

### Borders
- **Default**: 1px solid, slate-200 (light) / slate-800 (dark)
- **Strong**: 2px solid, accent-600
- **Subtle**: 0.5px solid, slate-200/60 (light) / slate-800/60 (dark)
- **Ring (focus)**: 2px ring, accent-500/20

---

## Shadows & Elevation

### Shadow Levels
```css
/* Shadow (sm) */
box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05);

/* Shadow (md) */
box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.1);

/* Shadow (lg) */
box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1);

/* Shadow (xl) */
box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1);

/* Shadow (2xl) - modals, dropdowns */
box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
```

### Dark Mode Shadows
- Reduce opacity by 50% and shift color to lighter slate
- Example: `shadow-sm dark:shadow-none`

---

## Components

### Buttons

#### Primary (CTA)
```css
background: #0d9488
color: white
padding: 10px 16px (py-2.5 px-4)
border-radius: 8px
font-weight: 600
font-size: 14px
border: none
cursor: pointer
transition: background 200ms

hover: #0f766e
active: #115e59
disabled: #cbd5e1 (slate-300)
```

#### Secondary (Default)
```css
background: transparent
color: #475569 (slate-600)
border: 1px solid #e2e8f0 (slate-200)
padding: 10px 16px
border-radius: 8px
font-weight: 600
font-size: 14px

hover: background #f1f5f9 (slate-50)
dark: color #cbd5e1, border #334155
dark:hover: background #334155
```

#### Ghost (Minimal)
```css
background: transparent
color: #475569
border: none
padding: 8px 12px
font-weight: 500
font-size: 14px

hover: background #f1f5f9
```

### Cards / Panels
```css
background: #ffffff (light) / #1e293b (dark)
border: 1px solid #e2e8f0 (light) / #334155 (dark)
border-radius: 12px
padding: 16px-20px
box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05)
transition: all 200ms
```

**Card Hover State:**
- Shift `box-shadow` to `0 4px 6px -1px rgba(15, 23, 42, 0.1)`
- Lift slightly via `transform: translateY(-2px)`

### Input Fields
```css
border: 1px solid #e2e8f0
border-radius: 8px
padding: 10px 12px
font-size: 14px
font-family: Plus Jakarta Sans
background: #ffffff
color: #0f172a

focus: 
  border-color: #0d9488
  outline: none
  ring: 2px #0d9488/20
  background: #ffffff

dark:
  background: #1e293b
  border-color: #334155
  color: #f1f5f9
```

### Badges / Pills
```css
display: inline-flex
align-items: center
gap: 6px
padding: 4px 10px
border-radius: 9999px (full)
font-size: 11px
font-weight: 600
ring: 1px inset [color]/20
```

**Status Badge Colors:**
- **Paid**: emerald-50 bg, emerald-700 text
- **Due Soon**: amber-50 bg, amber-700 text
- **Overdue**: rose-50 bg, rose-700 text
- **Scheduled**: slate-100 bg, slate-600 text

### Tables
```css
border-collapse: collapse
width: 100%

thead:
  background: #f8fafc (light) / #0f172a (dark)
  border-top: 1px solid #e2e8f0
  border-bottom: 1px solid #e2e8f0

th:
  padding: 12px 16px
  font-size: 11px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.5px
  color: #64748b (light) / #94a3b8 (dark)
  text-align: left

td:
  padding: 12px 16px
  border-bottom: 1px solid #f1f5f9 (light) / #334155 (dark)
  font-size: 14px

tbody tr:hover:
  background: #f8fafc (light) / #334155 (dark)
  transition: background 150ms
```

### Form Sections
```css
margin-bottom: 20px (mb-5)

label:
  display: block
  font-size: 14px
  font-weight: 600
  margin-bottom: 8px (mb-2)
  color: #0f172a

input/select/textarea:
  width: 100%
  /* see Input Fields above */
```

---

## Layout Patterns

### Grid System (Tailwind)
- **2-column (mobile)**: `grid-cols-1 lg:grid-cols-2`
- **3-column (tablet+)**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **4-column (desktop)**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- **Gap between items**: `gap-4` (16px) or `gap-5` (20px)

### Sidebar + Main Layout
```css
display: flex
min-height: 100vh

aside (sidebar):
  width: 232px (expanded) / 68px (collapsed)
  flex-shrink: 0
  border-right: 1px solid #e2e8f0

main:
  flex: 1
  min-width: 0
  overflow-x: hidden
```

### Header (Sticky)
```css
position: sticky
top: 0
z-index: 30
height: 64px (h-16)
display: flex
align-items: center
border-bottom: 1px solid #e2e8f0
background: rgba(255, 255, 255, 0.8)
backdrop-filter: blur(12px)
```

---

## Dark Mode

### Implementation
- **Class-based**: `dark:` prefix in Tailwind
- **Toggle**: Store in localStorage, apply `document.documentElement.classList.toggle('dark')`
- **Persistence**: Read on page load from localStorage

### Dark Mode Adjustments
| Light | Dark |
|-------|------|
| #ffffff | #1e293b |
| #f8fafc | #0f172a |
| #e2e8f0 | #334155 |
| #0f172a | #f1f5f9 |
| #475569 | #cbd5e1 |

---

## Icons

### Icon System
- **Library**: Lucide React (or custom SVG paths)
- **Size**: 16px (h-4 w-4) for inline, 20px (h-5 w-5) for buttons, 24px (h-6 w-6) for large areas
- **Stroke Width**: 1.5 (default), 2 (active), 2.5 (bold)
- **Color**: Inherit from parent (currentColor)

### Common Icons Used
- grid, briefcase, trending, card, swap, bars, file, settings
- search, bell, sun, moon, plus, chevronLeft, chevronDown, chevronUp
- arrowUp, arrowDown, calendar, check, wallet, logout, filter, download
- inbox, dots, menu, x, refresh, trash, cart, eye, alert, clock, sparkles

---

## Responsive Design

### Breakpoints (Tailwind)
- **sm**: 640px (tablets)
- **md**: 768px (small laptops)
- **lg**: 1024px (desktops)
- **xl**: 1280px (large desktops)
- **2xl**: 1536px (ultra-wide)

### Mobile-First Strategy
1. Default (mobile) styles
2. Add `sm:`, `md:`, `lg:` prefixes for larger screens
3. Hide elements with `hidden` + `lg:flex` (show on desktop)
4. Use flex/grid for responsive wrapping

### Mobile Optimizations
- **Touch targets**: min 44px × 44px
- **Sidebar**: Hidden by default, drawer on mobile
- **Cards**: Full-width on mobile, multi-column on desktop
- **Tables**: Horizontal scroll or collapse on mobile

---

## Animation & Transitions

### Transition Defaults
```css
transition: all 150ms ease-in-out
transition: background 200ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Common Animations
- **Hover**: `hover:bg-slate-50 hover:scale-105 transition`
- **Focus**: Ring effect (2px solid accent-500/20)
- **Loading**: `animate-pulse` (opacity 0.5→1)
- **Entrance**: `opacity-0 → opacity-100` over 200ms
- **Menu**: Slide from `translateX(-100%)` to `translateX(0)`

### Avoid
- Animations on scroll
- Decorative infinite loops (unless explicitly marked)
- `transform` + `box-shadow` combo (performance)

---

## Data Formatting

### Currency (INR)
```javascript
const formatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function formatINR(n) {
  return "₹" + formatter.format(n);
}

function formatINRShort(n) {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  return formatINR(n);
}
```

### Percentages
```javascript
function formatPct(n, withSign = true) {
  const s = withSign && n > 0 ? "+" : "";
  return s + n.toFixed(2) + "%";
}
```

### Color Coding
- **Positive (gain/profit)**: #10b981 (emerald-600)
- **Negative (loss)**: #f43f5e (rose-600)
- **Neutral (0%)**: #64748b (slate-500)

---

## File Structure (React + TypeScript)

```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Icon.tsx
│   │   └── Input.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── MainLayout.tsx
│   ├── charts/
│   │   ├── LineChart.tsx
│   │   └── DonutChart.tsx
│   └── dashboard/
│       ├── SummaryCards.tsx
│       ├── PerformanceCard.tsx
│       ├── HoldingsTable.tsx
│       └── CreditCards.tsx
├── types/
│   ├── index.ts
│   └── api.ts
├── utils/
│   ├── formatters.ts
│   ├── colors.ts
│   └── constants.ts
├── hooks/
│   ├── useDarkMode.ts
│   └── useResponsive.ts
├── App.tsx
├── globals.css
└── tailwind.config.ts
```

---

## Tailwind Config

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        accent: {
          50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4",
          400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e",
          800: "#115e59", 900: "#134e4a",
        },
      },
      spacing: {
        "safe-top": "max(env(safe-area-inset-top), 0px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## Quick Reference

| Element | Light BG | Light Border | Dark BG | Dark Border | Accent |
|---------|----------|--------------|---------|-------------|--------|
| Page | #ffffff | — | #0f172a | — | — |
| Card | #ffffff | #e2e8f0 | #1e293b | #334155 | #0d9488 |
| Button | #0d9488 | — | #0d9488 | — | white text |
| Input | #ffffff | #e2e8f0 | #1e293b | #334155 | #0d9488 on focus |
| Text (primary) | #0f172a | — | #f1f5f9 | — | — |
| Text (secondary) | #475569 | — | #cbd5e1 | — | — |

---

## Notes for Implementation

1. **Never use** hardcoded color hex values — always use Tailwind classes or CSS custom properties
2. **Spacing**: Use gap/p/m classes, never inline styles
3. **Fonts**: Ensure Plus Jakarta Sans + JetBrains Mono are imported via Google Fonts
4. **Dark mode**: Test every component in both light and dark modes
5. **Responsive**: Mobile-first approach; test on 375px, 768px, 1024px viewports
6. **Accessibility**: Min contrast ratio 4.5:1 for text; focus states on all interactive elements
7. **Performance**: Lazy-load heavy components; use `next/image` or optimization
8. **Icons**: Use Lucide React or custom SVG with `currentColor` for theme support
