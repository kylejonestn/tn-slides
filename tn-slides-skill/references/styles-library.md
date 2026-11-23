# TN Slides — Style & Theme Library

Pick the style that best fits the presentation's audience and tone, or use the style requested by the user. Set `"theme"` in `deck.json` to the theme ID.

---

## 1. `theme-dept-blue-banner` (Default — Agency & Legislative Briefings)
- **Use when**: Presenting department updates, budget briefings, policy proposals, or legislative reviews.
- **Palette**:
  - Primary Navy: `#002D72`
  - Accent Crimson: `#C8102E`
  - Accent Gold: `#C59B27`
  - Surface: `#FFFFFF` / `#F8FAFC`
  - Body Text: `#1E293B` (WCAG AAA contrast on white)
- **Typography**: `Roboto Slab` / `Permian Slab` headings, `Open Sans` body.
- **Visual Signature**: Deep Tennessee Navy banner covers, crisp white content slides with thin navy/crimson accent rules.

---

## 2. `theme-state-classic` (Formal State & Statutory Reports)
- **Use when**: Presenting official statutory reports, compliance audits, or formal agency-wide briefings.
- **Palette**:
  - Primary Navy: `#002D72`
  - Accent Crimson: `#EE0000` / `#C8102E`
  - Surface: `#FFFFFF`
  - Body Text: `#0F172A`
- **Visual Signature**: Classic white cover with centered emblem/project ID and crimson horizontal divider rule.

---

## 3. `theme-tn-crimson-bold` (High-Impact Executive & Public Launches)
- **Use when**: Launching major initiatives, keynote announcements, or high-energy public-facing decks.
- **Palette**:
  - Primary Crimson: `#B91C1C` / `#C8102E`
  - Secondary Navy: `#002D72`
  - Accent Gold: `#F59E0B`
  - Surface: `#FFFFFF` / `#FFFDF9`
- **Visual Signature**: Bold crimson accent bands, strong stat callouts, high-contrast dark-on-light cards.

---

## 4. `theme-executive-dark` (Modern Keynote / Tech & Strategy)
- **Use when**: Modernizing an internal tech/AI briefing or executive strategy session where a sleek dark aesthetic is preferred.
- **Palette**:
  - Canvas Background: `#0F172A` (Deep Slate)
  - Card Surface: `#1E293B`
  - Primary Accent: `#38BDF8` (Sky) & `#C59B27` (Gold)
  - Body Text: `#F8FAFC` (WCAG AAA contrast on dark slate)
- **Visual Signature**: Dark-mode slides with crisp high-contrast cards and subtle gold/sky highlights.

---

> **Adding Custom Styles Later**: Copy any block above, give it a new `theme-*` ID, define its hex tokens, and add the matching CSS variables in `scripts/build_deck.mjs`.
