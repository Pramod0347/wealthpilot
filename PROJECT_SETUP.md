# WealthPilot — Design System & Implementation Guide

## Overview
WealthPilot is a premium fintech dashboard for personal wealth management. Built with React + TypeScript + Tailwind CSS v4. Dark-first design (defaults to dark mode, persisted in localStorage). Teal (#0d9488) as primary accent color.

## Typography

### Font Stack
- **UI (Sans)**: Plus Jakarta Sans — weights 400, 500, 600, 700, 800
- **Data (Mono)**: JetBrains Mono — tabular numerals (`font-feature-settings: "tnum" 1`), weights 400, 500, 600, 700

### Type Scale
| Usage | Class | Size | Weight |
|-------|-------|------|--------|
| Hero metric (₹ values) | `font-mono text-2xl font-bold tabular-nums` | 24px | 700 |
| Card metric | `font-mono text-lg font-bold tabular-nums` | 18px | 700 |
| Section label | `text-[10px] font-semibold uppercase tracking-widest` | 10px | 600 |
| Body text | `text-sm` | 14px | 400 |
| Caption / meta | `text-xs` | 12px | 400–500 |
| Badge / pill | `text-[10px] font-semibold` | 10px | 600 |
| Table header | `text-[11px] font-semibold uppercase tracking-[0.5px]` | 11px | 600 |

---

## Color System

### Accent (Teal)
```
accent-50:   #f0fdfa
accent-100:  #ccfbf1
accent-200:  #99f6e4
accent-300:  #5eead4
accent-400:  #2dd4bf
accent-500:  #14b8a6   ← hover state
accent-600:  #0d9488   ← primary brand color
accent-700:  #0f766e   ← active/dark state
accent-800:  #115e59
accent-900:  #134e4a
```

### Semantic Colors
- **Positive (gain)**: `text-emerald-400` dark / `text-emerald-600` light
- **Negative (loss)**: `text-rose-400` dark / `text-rose-600` light
- **Warning**: `text-amber-400` dark / `text-amber-600` light
- **Info / neutral**: `text-slate-400` dark / `text-slate-500` light

### Page Backgrounds
- **Light page**: `bg-slate-50` (`#f8fafc`)
- **Dark page**: `bg-slate-950` with radial teal glow + gradient to `#0a1628`
- **Dark body CSS**: `background: radial-gradient(circle at top, rgba(13,148,136,0.08), transparent 30%), linear-gradient(180deg, #0f172a 0%, #0a1628 100%)`

### Cards
| Context | Light | Dark |
|---------|-------|------|
| Background | `bg-white` | `dark:bg-slate-900/80` |
| Border | `border-slate-200` | `dark:border-slate-700/50` |
| Inner / nested | `bg-slate-50` | `dark:bg-slate-800/50` |

### Text
| Role | Light | Dark |
|------|-------|------|
| Primary | `text-slate-900` | `dark:text-white` |
| Secondary | `text-slate-600` | `dark:text-slate-300` |
| Tertiary / label | `text-slate-500` | `dark:text-slate-500` |
| Disabled | `text-slate-400` | `dark:text-slate-600` |

---

## Spacing

- **Between page sections**: `space-y-5` (20px)
- **Card padding compact**: `p-4` (mini stat cards)
- **Card padding standard**: `p-5` (list cards)
- **Card padding generous**: `p-6` (chart/overview cards)
- **Between form fields**: `gap-4`

---

## Border Radius

| Token | Usage |
|-------|-------|
| `rounded-lg` (8px) | Input fields, small buttons, icon badges |
| `rounded-xl` (12px) | Drawers, tooltips, pills |
| `rounded-2xl` (16px) | **All cards and panels** (primary card radius) |
| `rounded-full` | Status pills, dots, avatars |

---

## Components

### Cards (Primary Pattern)
```
bg-white dark:bg-slate-900/80
border border-slate-200 dark:border-slate-700/50
rounded-2xl shadow-sm
```

### Section Label (inside cards)
```
text-[10px] font-semibold uppercase tracking-widest
text-slate-500 dark:text-slate-500
```
Always appears at the top of a card section, above the value.

### Mini Stat Card (6-column grid)
```
rounded-2xl border ... bg-white dark:bg-slate-900/80 p-4 shadow-sm
├── LABEL (section label, top)
├── VALUE (font-mono text-lg font-bold, middle)
├── META (text-xs, below value)
└── ICON BADGE (h-7 w-7 rounded-lg bg-*-500/15, bottom-left)
```
Special variant for Card Dues: `border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10`

### Status Pills
```
inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold
```
| Tone | Background | Text |
|------|-----------|------|
| Rose (Overdue) | `bg-rose-500/15` | `text-rose-400` |
| Amber (Due Soon) | `bg-amber-500/15` | `text-amber-400` |
| Emerald (Paid/Good) | `bg-emerald-500/15` | `text-emerald-400` |
| Slate (Info) | `bg-slate-100 dark:bg-slate-800` | `text-slate-600 dark:text-slate-400` |

Each pill has a colored dot: `h-1.5 w-1.5 rounded-full bg-[tone]-400`

### Prices / Info Bar (page top)
```
flex items-center gap-3 rounded-2xl border ... bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm
```
Contains: refresh icon + "Prices last updated" label + datetime value + Live dot (right-aligned)

### Composition Bar (inline in Net Worth card)
```
h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex
```
Segments: each `style={{ width: X%, backgroundColor: color }}`
Legend below: `flex flex-wrap gap-x-4 gap-y-1.5`

### Horizontal Composition Bars (Composition panel)
Each row: `label (w-28) + bar track (flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800) + percentage (w-9 text-right)`

### Performance Chart Card
- Header: label + large value + signed % badge
- Time filters: `rounded-xl bg-slate-100 dark:bg-slate-800 p-1` with active = `bg-white dark:bg-slate-700 shadow-sm`
- Chart: Recharts LineChart, teal line (#0d9488), amber dashed predicted
- "Save Snapshot" link: `text-sm font-medium text-teal-500 dark:text-teal-400` centered below chart with top border

### Buttons

#### Primary
```
inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4
text-sm font-semibold text-white shadow-sm
hover:bg-accent-700 active:bg-accent-800 disabled:opacity-60
```

#### Secondary / Ghost
```
inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700
bg-white dark:bg-slate-800 px-4 text-sm font-semibold
text-slate-600 dark:text-slate-300 shadow-sm
hover:bg-slate-50 dark:hover:bg-slate-700/50
```

### Input / Select / Textarea
```
h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700
bg-white dark:bg-slate-800 px-3 py-2.5 text-sm
text-slate-900 dark:text-slate-100
placeholder:text-slate-400 dark:placeholder:text-slate-500
focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20
```

### Tables
```
thead: bg-slate-50 dark:bg-slate-800/50, border-b border-slate-200 dark:border-slate-700/50
th: text-[11px] font-semibold uppercase tracking-[0.5px] text-slate-500 dark:text-slate-400 px-4 py-3
tbody row: border-b border-slate-100 dark:border-slate-800/80
tbody row hover: bg-slate-50 dark:bg-slate-800/40
td: text-sm px-4 py-3
```

### Toast / Alert Banner
```
flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm
```
Always includes a close (×) button on the right.
| Tone | bg | border | text |
|------|----|--------|------|
| emerald | `bg-emerald-50 dark:bg-emerald-500/10` | `border-emerald-200 dark:border-emerald-500/30` | `text-emerald-800 dark:text-emerald-200` |
| rose | `bg-rose-50 dark:bg-rose-500/10` | `border-rose-200 dark:border-rose-500/30` | `text-rose-800 dark:text-rose-200` |
| amber | `bg-amber-50 dark:bg-amber-500/10` | `border-amber-200 dark:border-amber-500/30` | `text-amber-800 dark:text-amber-100` |

### Edit Drawer (Side Panel)
```
fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm
Panel: max-w-140 w-full h-full flex-col
       border-l border-slate-200 dark:border-slate-800
       bg-white dark:bg-slate-900 shadow-2xl
       slide-in from right (translate-x-full → translate-x-0)
```

---

## Layout

### Page Structure
```
<div class="flex h-screen overflow-hidden">
  <aside> Sidebar (sticky) </aside>
  <div class="flex-1 flex flex-col h-screen">
    <header> Header (sticky, h-16) </header>
    <main class="flex-1 overflow-y-auto">
      <div class="p-5 xl:p-8"> page content </div>
    </main>
  </div>
</div>
```

### Sidebar
- Expanded: `w-65` (260px), `px-4 py-5`
- Collapsed: `w-[68px]`, `px-2 py-4`
- Background: `bg-white dark:bg-slate-900`
- Border: `border-r border-slate-200 dark:border-slate-700/30`
- Nav item height: `h-12.5` (50px)
- Nav text: `text-[15px] font-medium`
- Active item: `bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300`
- Active dot: `h-2 w-2 rounded-full bg-teal-400`
- Logo: `h-13 w-13 rounded-2xl bg-linear-to-br from-accent-400 to-accent-700`

### Header
- Height: `h-16` (64px), sticky top-0 z-40
- Background: `bg-white/80 dark:bg-slate-950/95 backdrop-blur-md`
- Border: `border-b border-slate-200 dark:border-slate-800`
- Contains: page title (left), market chips + live indicator + theme toggle (right)

### Dashboard Grid Layouts
```
Row 1: grid xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]    → Net Worth | Action Center
Row 2: grid xl:grid-cols-6                                     → 6 mini stat cards
Row 3: grid xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]    → Performance | Composition
Row 4: grid xl:grid-cols-3                                     → Accounts | Upcoming | Insights
```

---

## Dark Mode

- **Implementation**: `darkMode: 'class'` in Tailwind, `document.documentElement.classList.toggle('dark')`
- **Persistence**: `localStorage.getItem('wealthpilot-theme')`, defaults to `'dark'`
- **Toggle**: Sun/Moon icon button in header

---

## Icons
- **Library**: Lucide React via `Icon` component wrapper
- **Available names**: `dashboard`, `portfolio`, `stocks`, `banks`, `pfepf`, `cards`, `transactions`, `analytics`, `reports`, `settings`, `search`, `bell`, `calendar`, `refresh`, `sun`, `moon`, `menu`, `close`, `collapse`, `chevronDown`, `chevronUp`, `up`, `down`, `netWorth`, `ai`, `warning`, `due`, `paid`, `more`, `buy`, `alert`, `view`, `remove`, `empty`, `add`, `download`, `edit`
- **Sizes**: `h-3.5 w-3.5` (icon badge), `h-4 w-4` (inline), `h-5 w-5` (buttons/nav)
- **Stroke**: 1.75 default, 2 active, 2.5 bold

---

## Asset Type Color Palette
| Type | Label | Color |
|------|-------|-------|
| Indian Stocks / stock_in | Indian Stocks | `#0d9488` (teal) |
| stock_us | US Stocks | `#38bdf8` (sky) |
| mutual_fund | Mutual Funds | `#a78bfa` (violet) |
| banks | Banks | `#f97316` (orange) |
| etf | ETFs | `#0ea5e9` (sky) |
| cash | Cash | `#f59e0b` (amber) |
| other | Other | `#64748b` (slate) |

---

## Data Formatting
```javascript
// Currency
formatINR(n)       → "₹1,23,456"
formatINRShort(n)  → "₹1.23 L" (≥1L) / "₹12.34 Cr" (≥1Cr)
formatPct(n)       → "12.34%"
formatSignedPct(n) → "+12.34%" / "-5.67%"
getTrendClass(n)   → "text-emerald-400" / "text-rose-400" / "text-slate-400"
```

---

## Tailwind Config (actual)
```typescript
export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
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
    },
  },
}
```

---

## Quick Reference

| Element | Light | Dark | Radius |
|---------|-------|------|--------|
| Page bg | `bg-slate-50` | `bg-slate-950` + gradient | — |
| Card bg | `bg-white` | `dark:bg-slate-900/80` | `rounded-2xl` |
| Card border | `border-slate-200` | `dark:border-slate-700/50` | — |
| Inner card | `bg-slate-50` | `dark:bg-slate-800/50` | `rounded-xl` |
| Primary btn | `bg-accent-600 text-white` | same | `rounded-lg` |
| Input | `bg-white border-slate-200` | `dark:bg-slate-800 dark:border-slate-700` | `rounded-lg` |
| Text primary | `text-slate-900` | `dark:text-white` | — |
| Text muted | `text-slate-500` | `dark:text-slate-400` | — |
| Section label | `text-slate-500` | `dark:text-slate-500` | — |

---

## Implementation Rules

1. **Never** hardcode color hex values — use Tailwind classes or CSS custom properties
2. **Cards always** use `rounded-2xl border border-slate-200 dark:border-slate-700/50`
3. **Card backgrounds**: `bg-white dark:bg-slate-900/80` (not `dark:bg-slate-800`)
4. **Section labels**: `text-[10px] font-semibold uppercase tracking-widest text-slate-500`
5. **Metrics/numbers**: always `font-mono tabular-nums`
6. **Status pills**: always dot + label, `rounded-full`, color from tone (rose/amber/emerald/slate)
7. **Toast/alerts**: always include a close button
8. **Dark mode**: Test every component in dark mode (default mode)
9. **Responsive**: Mobile-first, content stacks on mobile, multi-column on `xl:`
10. **Fonts**: Plus Jakarta Sans (UI) + JetBrains Mono (numbers) loaded from Google Fonts
