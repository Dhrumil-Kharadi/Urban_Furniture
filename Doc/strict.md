# FarmXpert — Strict Development Guidelines

> **This document is the single source of truth for all frontend development rules.**
> Every contributor (human or AI) **must** read and follow this before writing any code.

---

## Table of Contents

1. [Color System — Root Variables Only](#1-color-system--root-variables-only)
2. [Multilingual Service Flow](#2-multilingual-service-flow)
3. [Design Language — Neumorphism](#3-design-language--neumorphism)
4. [Typography System](#4-typography-system)
5. [File & Component Conventions](#5-file--component-conventions)
6. [Enforcement Checklist](#6-enforcement-checklist)

---

## 1. Color System — Root Variables Only

### 1.1 The Rule

> **Every color used anywhere in the project MUST reference a CSS custom property defined in `:root` inside `src/app/globals.css`.**

**Never** use:
- Hardcoded hex values (e.g., `#000080`, `#F3F5F7`)
- Hardcoded `rgb()` / `rgba()` / `hsl()` values
- Tailwind utility classes for color

**Always** use:
```css
/* ✅ CORRECT */
color: var(--accent-primary);
background: var(--bg-raised);
box-shadow: 8px 8px 16px var(--nm-shadow-dark);

/* ❌ WRONG */
color: #000080;
background: #FFFFFF;
box-shadow: 8px 8px 16px rgba(0, 0, 80, 0.08);
```

### 1.2 The Frozen Palette

The project uses the **Frozen Lake** palette. These are the four core values — **do not change them**:

| Token                 | Value     | Role               |
|-----------------------|-----------|--------------------|
| `--color-primary`     | `#c2c8cd` | Primary neutral    |
| `--color-secondary`   | `#000080` | Navy accent        |
| `--color-tertiary`    | `#c0ccd6` | Tertiary tone      |
| `--color-quaternary`  | `#6D8196` | Muted slate        |

All other variables in `:root` are **derived** from these four core colors. They must not be modified arbitrarily.

### 1.3 Adding New Colors

If a new component needs a color that doesn't yet exist as a variable:

1. **Check first** — scan `globals.css` for an existing variable that fits.
2. **If none exists**, add a new `--<component>-<property>` variable to the `:root` block in `globals.css`.
3. The new variable's value **must** be derived from the four core palette colors (same hue, adjusted alpha / lightness).
4. **Never** introduce a hue outside the Frozen Lake family.

```css
/* ✅ Adding a new variable — derived from core palette */
:root {
  /* ... existing variables ... */
  --sidebar-bg: #F3F5F7;                     /* Same as --bg-base */
  --sidebar-border: rgba(0, 0, 128, 0.10);   /* Same hue as --color-secondary */
}
```

### 1.4 What You Must NOT Do

- ❌ Change any existing `:root` variable value
- ❌ Override `:root` variables in component CSS (except for clearly scoped themes, which must be approved)
- ❌ Use `!important` to override color variables
- ❌ Introduce colors from outside the Frozen Lake family (no reds, greens, oranges, etc. unless explicitly added to `:root` with team approval)

---

## 2. Multilingual Service Flow

### 2.1 The Rule

> **Before building any new page, component, or feature that displays text, you MUST complete the full multilingual service flow first.**

The project ships three locales: **English (`en`)**, **Hindi (`hi`)**, and **Gujarati (`gu`)**.

### 2.2 Required Steps — In Order

```
Step 1  →  Add keys to src/messages/en.json
Step 2  →  Add keys to src/messages/hi.json
Step 3  →  Add keys to src/messages/gu.json
Step 4  →  Use useTranslations() hook in the component
Step 5  →  Build the UI with t('key') calls
```

**Never** write a component with inline English strings and "plan to add translations later."

### 2.3 Message File Structure

Messages are organized by **namespace** (top-level keys). Every new page/section gets its own namespace:

```json
// src/messages/en.json
{
  "dashboard": {
    "title": "Farm Dashboard",
    "sidebar": {
      "overview": "Overview",
      "analytics": "Analytics"
    }
  }
}
```

The same structure **must** be mirrored exactly in `hi.json` and `gu.json`.

### 2.4 Component Usage Pattern

```jsx
'use client';

import { useTranslations } from 'next-intl';

export default function Dashboard() {
  const t = useTranslations('dashboard');

  return (
    <h1>{t('title')}</h1>
  );
}
```

### 2.5 Navigation — Always Use i18n-Aware Imports

```jsx
// ✅ CORRECT — locale prefix is handled automatically
import { Link } from '@/i18n/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';

// ❌ WRONG — breaks locale routing
import Link from 'next/link';
import { useRouter } from 'next/navigation';
```

### 2.6 Adding a New Locale

1. Add the BCP-47 code to the `locales` array in `src/i18n/routing.js`.
2. Create `src/messages/<code>.json` with all existing keys translated.
3. Add a label entry in every locale's `languageSwitcher` namespace.
4. No component code changes needed — the `LanguageSwitcher` auto-discovers from `routing.js`.

### 2.7 What You Must NOT Do

- ❌ Hardcode any user-facing string in JSX
- ❌ Create a page/component before the message keys exist in **all three** locale files
- ❌ Import `Link`, `useRouter`, or `usePathname` from `next/link` or `next/navigation`
- ❌ Add a locale without adding its corresponding message file

---

## 3. Design Language — Neumorphism

### 3.1 Landing Page & Dashboard — Neo-Morphism (Minimalist)

> **The landing page and dashboard MUST follow a minimalist neumorphic design language.**

Neumorphism in this project means:

- **Soft raised surfaces** — elements appear gently extruded from the background
- **Dual shadow system** — every raised element gets both a dark shadow and a light shadow
- **Subtle depth** — no harsh drop shadows, no flat design
- **Inset interactions** — hover/active states use `inset` shadows to simulate pressing

### 3.2 Shadow Token System

Always use the defined neumorphic shadow variables:

```css
/* Raised (default state) */
box-shadow: 8px 8px 16px var(--nm-shadow-dark),
            -4px -4px 10px var(--nm-shadow-light);

/* Pressed / Active / Hover */
box-shadow: inset 4px 4px 8px var(--nm-inset-dark),
            inset -3px -3px 6px var(--nm-inset-light);
```

| Variable             | Purpose              |
|----------------------|----------------------|
| `--nm-shadow-dark`   | Dark outer shadow    |
| `--nm-shadow-light`  | Light outer shadow   |
| `--nm-inset-dark`    | Dark inset shadow    |
| `--nm-inset-light`   | Light inset shadow   |

### 3.3 Surface Hierarchy

| Level         | Variable       | Usage                          |
|---------------|----------------|--------------------------------|
| Base          | `--bg-base`    | Page background (`#F3F5F7`)    |
| Surface       | `--bg-surface` | Alternating sections           |
| Raised        | `--bg-raised`  | Cards, buttons, inputs         |
| Card          | `--bg-card`    | Floating card elements         |

### 3.4 Design Rules

1. **Cards & containers** — always use `--bg-raised` with dual neumorphic shadows and a subtle border (`--border-subtle`).
2. **Buttons** — primary buttons use `--btn-primary-bg` with glow shadow; secondary buttons use neumorphic raised style.
3. **Hover states** — transition from raised shadows to inset shadows for a "press" effect.
4. **Border radius** — keep consistent: `6px` for buttons, `12-14px` for cards, `20-28px` for large containers.
5. **Glow accents** — use sparingly via `--glow-primary` and `--glow-strong`.
6. **No flat design** — every interactive/card element must have the neumorphic shadow pair.

### 3.5 Other Pages

Pages that are **not** the landing page or dashboard (e.g., auth, settings, profile) should still maintain visual consistency:
- Use the same color variables
- Use the same font system
- Use subtle neumorphic shadows where appropriate (inputs, cards)
- Maintain the minimalist aesthetic — no visual clutter

---

## 4. Typography System

### 4.1 The Rule

> **All pages — current and future — MUST use the project's two-font system. No other fonts are allowed.**

### 4.2 Font Stack

| Font       | Import                                                                                                            | Role            | Usage                                                 |
|------------|-------------------------------------------------------------------------------------------------------------------|-----------------|-------------------------------------------------------|
| **Orbitron** | `@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&display=swap')` | Display / Heading | Titles, numbers, section eyebrows, badges, hero text |
| **Sora**     | `@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&display=swap')`     | Body / UI        | Body text, descriptions, labels, buttons, nav links  |

### 4.3 Assignment Rules

```css
/* Headings, titles, accent numbers */
font-family: 'Orbitron', monospace;

/* Body text, descriptions, UI controls */
font-family: 'Sora', sans-serif;
```

### 4.4 Weight Scale

| Weight | Orbitron Usage                    | Sora Usage                        |
|--------|-----------------------------------|-----------------------------------|
| 300    | —                                 | Descriptions, secondary text      |
| 400    | Base text (rarely used)           | Body text, nav links              |
| 500    | —                                 | Labels, badges, switcher          |
| 600    | Eyebrows, sub-headings            | Buttons, emphasized body          |
| 700    | Section titles, card headings     | —                                 |
| 900    | Hero title, section main titles   | —                                 |

### 4.5 Size Scale (Reference)

| Element             | Size                           | Font      |
|---------------------|--------------------------------|-----------|
| Hero title          | `clamp(2.4rem, 5vw, 4rem)`    | Orbitron  |
| Section title       | `clamp(1.8rem, 3vw, 2.8rem)`  | Orbitron  |
| Section eyebrow     | `0.65rem`                      | Orbitron  |
| Body text           | `0.92–0.95rem`                 | Sora      |
| Small labels        | `0.65–0.72rem`                 | Sora      |
| Tiny labels         | `0.42–0.45rem`                 | Sora      |
| Buttons             | `0.85rem`                      | Sora      |
| Nav links           | `0.82rem`                      | Sora      |

### 4.6 What You Must NOT Do

- ❌ Import or use any font other than Orbitron and Sora
- ❌ Use browser-default fonts (Arial, Times, etc.)
- ❌ Use the `Inter` font (it is preloaded in `layout.js` for future potential use but is **not** the active design font)
- ❌ Use `font-family` values without the fallback (always include `monospace` or `sans-serif`)
- ❌ Invent new font sizes — stay within the scale above or introduce a new step with team approval
- ❌ Use `font-weight` values not listed in the weight scale

---

## 5. File & Component Conventions

### 5.1 CSS Files

| File                           | Scope                               |
|--------------------------------|--------------------------------------|
| `src/app/globals.css`          | `:root` color variables **ONLY**     |
| `src/styles/landingpage.css`   | Landing page component styles        |
| `src/styles/navbar.css`        | Navbar styles                        |
| `src/styles/footer.css`        | Footer styles                        |
| `src/styles/<feature>.css`     | New features get their own CSS file  |

**Rules:**
- New features/pages → create a new CSS file in `src/styles/`.
- Import it in `src/app/layout.js` so it's available globally.
- Never add color definitions outside `globals.css`.

### 5.2 Component Files

- Components live in `src/components/`.
- Page-specific sub-components go in `src/components/<page>/` (e.g., `src/components/landingpage/`).
- Every component must be a `.jsx` file.
- Every component that renders text must use `useTranslations()`.

### 5.3 New Page Checklist

Before a new page is considered ready for development:

```
□  Message keys added to en.json, hi.json, gu.json
□  New CSS file created in src/styles/ (if needed)
□  CSS file imported in src/app/layout.js
□  All colors use var(--*) from :root
□  Fonts are only Orbitron and Sora
□  Neumorphic shadows follow the token system
□  Navigation uses @/i18n/navigation imports
□  Component uses useTranslations() — no hardcoded strings
```

---

## 6. Enforcement Checklist

Use this checklist in every code review and before every merge:

### Colors
- [ ] No hardcoded hex/rgb/rgba/hsl values in CSS or inline styles
- [ ] All colors reference `var(--*)` from `globals.css`
- [ ] No `:root` variable values have been modified
- [ ] New colors (if any) are derived from the Frozen Lake palette
- [ ] New color variables are added to `globals.css` `:root` block

### Multilingual
- [ ] All user-facing strings use `useTranslations()` / `t('key')`
- [ ] Keys exist in **all three** locale files (`en.json`, `hi.json`, `gu.json`)
- [ ] `Link`, `useRouter`, `usePathname` imported from `@/i18n/navigation`
- [ ] No inline English (or any language) strings in JSX

### Design
- [ ] Landing page & dashboard follow neumorphic shadow system
- [ ] Cards use dual shadows (`--nm-shadow-dark` + `--nm-shadow-light`)
- [ ] Hover/active states use inset shadows
- [ ] Surface hierarchy respected (`--bg-base` → `--bg-surface` → `--bg-raised`)
- [ ] Border radius values are consistent with existing design

### Typography
- [ ] Only `Orbitron` and `Sora` fonts are used
- [ ] Correct font assigned (Orbitron = headings, Sora = body)
- [ ] Font weights are from the defined scale
- [ ] Fallback families included (`monospace` / `sans-serif`)
- [ ] Font sizes follow the established scale

---

> **Last Updated:** 2026-08-09
