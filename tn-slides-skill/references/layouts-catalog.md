# TN Slides — Layouts Catalog & `deck.json` Schema

## `deck.json` Top-Level Schema

```json
{
  "deckTitle": "Q3 Broadband Expansion Update",
  "theme": "theme-dept-blue-banner",
  "aspectRatio": "16:9",
  "slides": [
    {
      "layout": "layout-cover-blue-banner",
      "kicker": "STATE OF TENNESSEE",
      "title": "Q3 Broadband Expansion Update",
      "body": "Connecting Rural Communities Across 95 Counties\nOctober 2026 Briefing",
      "authorName": "Jane Doe, Commissioner",
      "authorDate": "October 2026",
      "watermarkIcon": "fa-solid fa-landmark",
      "mediaUrl": "",
      "mediaAlt": "",
      "isDecorative": true,
      "citation": "",
      "notes": "Welcome everyone to the Q3 briefing."
    }
  ]
}
```

---

## Layout Selection Guide

| Layout ID | Best For | Key `slide` Fields |
| :--- | :--- | :--- |
| `layout-cover-blue-banner` | Opening title slide (blue band) | `title`, `kicker`, `body` (subtitle lines), `authorName`, `authorDate` |
| `layout-cover-state-classic` | Formal white cover with red rule | `title`, `kicker`, `body`, `authorName`, `authorDate` |
| `layout-title-hero` | Clean centered hero opener | `title`, `kicker`, `body` |
| `layout-agenda` | Numbered meeting agenda (3–5 items) | `title`, `kicker`, `body` (one item per line) |
| `layout-section-break` | Bold chapter divider | `title`, `kicker`, `watermarkIcon` |
| `layout-pillars-3` | 3 equal strategic pillars/cards | `title`, `kicker`, `body` (`Title: Description` per line, 3 lines) |
| `layout-pillars-4` | 4 equal strategic pillars/cards | `title`, `kicker`, `body` (`Title: Description` per line, 4 lines) |
| `layout-process-flow` | 3–4 sequential steps (with arrows) | `title`, `kicker`, `body` (`Step Name: Action` per line) |
| `layout-timeline` | 3–5 chronological milestones | `title`, `kicker`, `body` (`Q1 2026: Milestone` per line) |
| `layout-comparison` | Side-by-side Before vs. After | `title`, `kicker`, `body` (`Before: ...` / `After: ...` lines) |
| `layout-bento-3` | 3-card summary grid | `title`, `kicker`, `body` (3–4 lines) |
| `layout-stat-callout` | Single big hero metric | `statNumber` (e.g. `"94%"`), `statLabel`, `title`, `body` |
| `layout-quote` | Executive quote or testimonial | `quote`, `quoteAuthor`, `kicker` |
| `layout-split` | Bullets + Photo/Graphic (side-by-side) | `title`, `body`, `mediaUrl`, `mediaAlt` (required if `isDecorative: false`), `isDecorative` |
| `layout-split-50` | 50/50 split text & visual | `title`, `body`, `mediaUrl`, `mediaAlt`, `isDecorative` |
| `layout-chart-bar` | Horizontal bar chart + paired table | `title`, `chartData` (`[{ label, value }]`), `chartCaption` |
| `layout-chart-kpi` | 3–4 KPI metric cards | `title`, `chartData` (`[{ label, value }]`) |
| `layout-data-table` | Accessible structured data table | `title`, `tableHeaders` (`[]`), `tableRows` (`[[]]`) |
| `layout-thank-you` | Closing slide + contact info | `title` (`"THANK YOU"`), `body`, `authorName`, `authorDate` |

---

## WCAG 2.1 AA Accessibility Rules (Mandatory)
1. **Alt Text**: Every slide with `mediaUrl` and `isDecorative: false` **must** have a non-empty, meaningful `mediaAlt` string. Never use filenames (`image1.png`) as alt text.
2. **Decorative Watermarks**: `watermarkIcon` (e.g. `fa-solid fa-landmark`, `fa-solid fa-network-wired`, `fa-solid fa-shield-halved`, `fa-solid fa-chart-line`) is always rendered with `aria-hidden="true"`.
3. **Reading Order**: Keep semantic order `kicker → title → body/cards/table → media → citation`.
