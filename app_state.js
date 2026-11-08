/**
 * State of Tennessee Presentation Studio - State Management & Layout Catalog
 * Manages presentation data, aspect ratios, county map presets, and approved layout templates.
 */
'use strict';

// --- 1. STATE MANAGEMENT ---
var rawJsonEl = document.getElementById('tn-presentation-data');
var appData = JSON.parse(rawJsonEl.textContent);
var currentSlideIndex = 0;
var isPresenting = false;
var fileHandle = null;
var pendingImageUpload = null;
var isDirty = false;

// Laser & Pen Annotation State
var isLaserActive = false;
var isPenActive = false;
var isDrawing = false;
var penColor = '#BA0C2F'; // TN Crimson
var penSize = 4;
var annotationsBySlide = {};

// Presenter Console & Black Screen State
var isBlackScreen = false;
var presenterWindow = null;

// State of Tennessee Grand Division Regional Presets
var TN_MAP_PRESETS = {
  'fy26-jobs': {
    metricTitle: "FY26 Grand Division Capital Investments & Job Creation",
    caption: "State of Tennessee Regional Capital Project Allocation & New Jobs Created",
    prefix: "$",
    unit: "M",
    selectedDivision: "all",
    divisions: {
      west: {
        name: "West Tennessee",
        countiesCount: 21,
        metros: ["Memphis", "Jackson", "Dyersburg"],
        value: "5,620",
        secondary: "14,850 New Jobs (30.8%)",
        highlight: "BlueOval City megasite & Mississippi River logistics corridor"
      },
      middle: {
        name: "Middle Tennessee",
        countiesCount: 41,
        metros: ["Nashville", "Clarksville", "Murfreesboro"],
        value: "8,410",
        secondary: "28,400 New Jobs (46.2%)",
        highlight: "State Capitol, healthcare technology & advanced manufacturing"
      },
      east: {
        name: "East Tennessee",
        countiesCount: 33,
        metros: ["Knoxville", "Chattanooga", "Tri-Cities"],
        value: "4,180",
        secondary: "19,250 New Jobs (23.0%)",
        highlight: "Oak Ridge National Laboratory, TVA energy & high-tech research"
      }
    }
  },
  'bwc-dispute': {
    metricTitle: "Workers' Compensation Dispute Resolution & Settlement Performance",
    caption: "Bureau of Workers' Compensation (BWC) Average Case Resolution & Mediation Success",
    prefix: "",
    unit: "%",
    selectedDivision: "all",
    divisions: {
      west: {
        name: "West Tennessee",
        countiesCount: 21,
        metros: ["Memphis", "Jackson"],
        value: "88.4",
        secondary: "Avg 42 Days to Settlement",
        highlight: "Memphis regional office serving Shelby and Mississippi delta counties"
      },
      middle: {
        name: "Middle Tennessee",
        countiesCount: 41,
        metros: ["Nashville", "Clarksville", "Murfreesboro"],
        value: "92.6",
        secondary: "Avg 38 Days to Settlement",
        highlight: "Central adjudication office & expedited ombudsman program"
      },
      east: {
        name: "East Tennessee",
        countiesCount: 33,
        metros: ["Knoxville", "Chattanooga", "Tri-Cities"],
        value: "90.1",
        secondary: "Avg 40 Days to Settlement",
        highlight: "Knoxville and Chattanooga mediation suites with virtual hearings"
      }
    }
  },
  'county-distress': {
    metricTitle: "Targeted Community Opportunity Grants Across Tennessee",
    caption: "Tennessee Department of Economic & Community Development (TNECD) Targeted Funding",
    prefix: "$",
    unit: "M",
    selectedDivision: "all",
    divisions: {
      west: {
        name: "West Tennessee",
        countiesCount: 21,
        metros: ["Memphis", "Jackson"],
        value: "42.5",
        secondary: "9 Tier-4 At-Risk Counties",
        highlight: "Delta regional authority broadband & industrial water infrastructure"
      },
      middle: {
        name: "Middle Tennessee",
        countiesCount: 41,
        metros: ["Nashville", "Clarksville"],
        value: "31.8",
        secondary: "4 Tier-4 At-Risk Counties",
        highlight: "Rural downtown revitalization and workforce training centers"
      },
      east: {
        name: "East Tennessee",
        countiesCount: 33,
        metros: ["Knoxville", "Chattanooga", "Tri-Cities"],
        value: "58.2",
        secondary: "11 Tier-4 At-Risk Counties",
        highlight: "Appalachian Regional Commission coal-impacted community redevelopment"
      }
    }
  }
};

// State Strategic Priorities & Pillars Engine (Department-Agnostic)
const TN_PILLAR_PRESETS = {
  3: [
    { title: "Operational Excellence", desc: "Modernizing citizen services, streamlining administrative turnaround, and expanding digital infrastructure across all 95 counties.", icon: "landmark" },
    { title: "Workforce Alignment", desc: "Connecting state education, clinical training, and apprenticeship pathways to high-wage Tennessee industries.", icon: "chart-line" },
    { title: "Resource Stewardship", desc: "Upholding Triple-A fiscal discipline, low debt burdens, and transparent taxpayer governance.", icon: "shield-check" }
  ],
  4: [
    { title: "Citizen-Focused Service", desc: "Enhancing digital self-service portals, reducing wait times, and elevating customer satisfaction.", icon: "landmark" },
    { title: "Talent & Retention", desc: "Investing in state workforce upskilling, competitive compensation, and leadership succession.", icon: "bullseye" },
    { title: "Data & Modernization", desc: "Modernizing legacy IT systems with enterprise cloud standards and proactive cybersecurity.", icon: "chart-line" },
    { title: "Fiscal Stewardship", desc: "Maintaining structurally balanced budgets, robust reserve funds, and long-term taxpayer value.", icon: "shield-check" }
  ]
};

// Helper to intelligently split natural language bullets into Title and Description
function splitNaturalLineIntoTitleDesc(line, fallbackTitle) {
  const cleanLine = (line || '')
    .replace(/^#{1,4}\s*/, '')
    .replace(/^[0-9]+[\.\)]\s*/, '')
    .replace(/^[•\-\*✦■★]\s*/, '')
    .trim();
  if (!cleanLine) return { title: fallbackTitle, desc: '' };

  // 1. Explicit pipe delimiter
  if (cleanLine.includes('|')) {
    const parts = cleanLine.split('|').map(s => s.trim());
    return { title: parts[0] || fallbackTitle, desc: parts.slice(1).join(' | ') };
  }
  // 2. Colon separator: "Title: Description"
  if (cleanLine.includes(':')) {
    const parts = cleanLine.split(':').map(s => s.trim());
    return { title: parts[0] || fallbackTitle, desc: parts.slice(1).join(': ') };
  }
  // 3. Em-dash or en-dash or space-hyphen-space: "Title - Description"
  if (/\s+[–—\-]\s+/.test(cleanLine)) {
    const parts = cleanLine.split(/\s+[–—\-]\s+/).map(s => s.trim());
    return { title: parts[0] || fallbackTitle, desc: parts.slice(1).join(' — ') };
  }
  // 4. If short line (<= 40 chars), entire line is title
  if (cleanLine.length <= 40 && !cleanLine.includes(',')) {
    return { title: cleanLine, desc: '' };
  }
  // 5. Natural sentence splitting: break at first comma or period, or first 4-5 words
  const sentenceMatch = cleanLine.match(/^([^,\.\;]+)[,\.\;]\s*(.*)$/);
  if (sentenceMatch && sentenceMatch[1].length <= 45 && sentenceMatch[2].length > 0) {
    return { title: sentenceMatch[1].trim(), desc: sentenceMatch[2].trim() };
  }
  // 6. Split by words: take first 4 words as title (up to 32 chars)
  const words = cleanLine.split(/\s+/);
  if (words.length > 5) {
    const titleWords = words.slice(0, 4).join(' ');
    const descWords = words.slice(4).join(' ');
    return { title: titleWords, desc: descWords };
  }
  return { title: cleanLine, desc: '' };
}

function parsePillarsContent(bodyText, count) {
  const defaultList = TN_PILLAR_PRESETS[count] || TN_PILLAR_PRESETS[3];
  if (!bodyText || !bodyText.trim()) {
    return defaultList;
  }

  const blocks = bodyText.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);
  let parsed = [];

  if (blocks.length >= count) {
    parsed = blocks.slice(0, count).map((b, i) => {
      const bLines = b.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const firstLine = bLines[0];
      const rest = bLines.slice(1).join(' ').replace(/^[•\-\*]\s*/, '').trim();
      const splitResult = splitNaturalLineIntoTitleDesc(firstLine, defaultList[i]?.title || `Pillar ${i + 1}`);
      const desc = (splitResult.desc + (rest ? (splitResult.desc ? ' ' : '') + rest : '')).trim();
      return {
        title: splitResult.title || defaultList[i]?.title || `Pillar ${i + 1}`,
        desc: desc || defaultList[i]?.desc || '',
        icon: defaultList[i]?.icon || 'landmark'
      };
    });
  } else {
    const rawLines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    parsed = rawLines.slice(0, count).map((line, i) => {
      const splitResult = splitNaturalLineIntoTitleDesc(line, defaultList[i]?.title || `Pillar ${i + 1}`);
      return {
        title: splitResult.title || defaultList[i]?.title || `Pillar ${i + 1}`,
        desc: splitResult.desc || defaultList[i]?.desc || '',
        icon: defaultList[i]?.icon || 'landmark'
      };
    });
  }

  while (parsed.length < count) {
    const idx = parsed.length;
    parsed.push(defaultList[idx] || {
      title: `Priority 0${idx + 1}`,
      desc: 'Strategic division objective and implementation roadmap.',
      icon: 'landmark'
    });
  }

  return parsed;
}

function getPillarIconSvg(iconName) {
  if (iconName === 'chart-line') {
    return `<svg role="img" aria-label="Growth Pathway" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
  }
  if (iconName === 'shield-check') {
    return `<svg role="img" aria-label="Governance and Stewardship" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`;
  }
  if (iconName === 'bullseye') {
    return `<svg role="img" aria-label="Strategic Objective" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
  }
  return `<svg role="img" aria-label="Civic Priority" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="21"></line><line x1="3" y1="10" x2="21" y2="10"></line><polyline points="12 3 2 10 22 10"></polyline><line x1="6" y1="10" x2="6" y2="21"></line><line x1="10" y1="10" x2="10" y2="21"></line><line x1="14" y1="10" x2="14" y2="21"></line><line x1="18" y1="10" x2="18" y2="21"></line></svg>`;
}

// State Standard Operating Procedure & Process Workflow Presets (Department-Agnostic)
const TN_PROCESS_PRESETS = [
  { title: "Intake & Public Notice", desc: "Initial claim, grant petition, or regulatory filing logged in state tracking system within 24 hours." },
  { title: "Eligibility & Audit Review", desc: "Comprehensive administrative compliance review against statutory requirements and guidelines." },
  { title: "Inter-Agency Evaluation", desc: "Coordinated evaluation panel convenes to score applications and formulate recommendations." },
  { title: "Final Determination & Award", desc: "Official binding determination executed by agency leadership with public notification across all 95 counties." }
];

function parseProcessFlowContent(bodyText) {
  if (!bodyText || !bodyText.trim()) {
    return TN_PROCESS_PRESETS;
  }

  const blocks = bodyText.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);
  let items = [];

  if (blocks.length >= 3) {
    items = blocks.slice(0, 5).map((b, i) => {
      const bLines = b.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const firstLine = bLines[0].replace(/^(?:step\s*)?\d{1,2}[\.\:\)]\s*/i, '').replace(/^[•\-\*]\s*/, '');
      let title = firstLine;
      let desc = bLines.slice(1).join(' ').replace(/^[•\-\*]\s*/, '');
      if (firstLine.includes('|')) {
        const parts = firstLine.split('|').map(s => s.trim());
        title = parts[0];
        desc = (parts.slice(1).join(' | ') + (desc ? ' ' + desc : '')).trim();
      } else if (firstLine.includes(':') && !bLines.slice(1).length) {
        const parts = firstLine.split(':').map(s => s.trim());
        title = parts[0];
        desc = parts.slice(1).join(': ');
      }
      return {
        title: title || `Step 0${i + 1}`,
        desc: desc || ''
      };
    });
  } else {
    const rawLines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    items = rawLines.slice(0, 5).map((line, i) => {
      const cleanLine = line.replace(/^(?:step\s*)?\d{1,2}[\.\:\)]\s*/i, '').replace(/^[•\-\*]\s*/, '');
      let title = `Step 0${i + 1}`;
      let desc = cleanLine;
      if (cleanLine.includes('|')) {
        const parts = cleanLine.split('|').map(s => s.trim());
        title = parts[0];
        desc = parts.slice(1).join(' | ');
      } else if (cleanLine.includes(':')) {
        const parts = cleanLine.split(':').map(s => s.trim());
        title = parts[0];
        desc = parts.slice(1).join(': ');
      }
      return {
        title: title || `Step 0${i + 1}`,
        desc: desc || ''
      };
    });
  }

  while (items.length < 3) {
    const idx = items.length;
    items.push(TN_PROCESS_PRESETS[idx] || {
      title: `Process Stage 0${idx + 1}`,
      desc: 'Operational milestone and execution requirements.'
    });
  }

  return items;
}

// State Milestone Timeline & Roadmap Presets (Department-Agnostic)
const TN_TIMELINE_PRESETS = [
  { date: "Q1 2026", title: "Statutory Mandates & Rulemaking", desc: "Codify core legislative mandates, publish administrative rules, and establish inter-agency working teams." },
  { date: "Q2 2026", title: "Demonstration & Pilot Launch", desc: "Deploy pilot platform across 12 target county test sites with structured stakeholder feedback." },
  { date: "Q3 2026", title: "Regional Training & Guidance", desc: "Conduct statewide training seminars for division staff, regional coordinators, and civic partners." },
  { date: "Q4 2026", title: "Statewide Enactment & Go-Live", desc: "Full statutory go-live across all 95 Tennessee counties with real-time performance analytics." }
];

function parseTimelineContent(bodyText) {
  if (!bodyText || !bodyText.trim()) {
    return TN_TIMELINE_PRESETS;
  }

  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];

  lines.slice(0, 5).forEach((line, i) => {
    let date = `Phase 0${i + 1}`;
    let title = `Milestone 0${i + 1}`;
    let desc = '';

    // Check bracket date: [Q1 2026] Title | Desc
    const bracketMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (bracketMatch) {
      date = bracketMatch[1].trim();
      const remainder = bracketMatch[2].trim();
      if (remainder.includes('|')) {
        const parts = remainder.split('|').map(s => s.trim());
        title = parts[0] || title;
        desc = parts.slice(1).join(' | ');
      } else if (remainder.includes(':')) {
        const parts = remainder.split(':').map(s => s.trim());
        title = parts[0] || title;
        desc = parts.slice(1).join(': ');
      } else {
        title = remainder || title;
      }
    } else if (line.includes('|')) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 3) {
        date = parts[0];
        title = parts[1];
        desc = parts.slice(2).join(' | ');
      } else {
        // 2 parts: check if part 0 looks like a date/quarter (e.g. Q1 2026, July 2026, 2026)
        if (/\b(Q[1-4]|\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Phase|Stage|Step)\b/i.test(parts[0])) {
          date = parts[0];
          title = parts[1];
        } else {
          title = parts[0];
          desc = parts[1];
        }
      }
    } else if (line.includes(':')) {
      const parts = line.split(':').map(s => s.trim());
      if (/\b(Q[1-4]|\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Phase|Stage|Step)\b/i.test(parts[0])) {
        date = parts[0];
        title = parts[1];
      } else {
        title = parts[0];
        desc = parts.slice(1).join(': ');
      }
    } else {
      const splitResult = splitNaturalLineIntoTitleDesc(line, `Milestone ${i + 1}`);
      title = splitResult.title;
      desc = splitResult.desc;
    }

    items.push({
      date: date || `Q${i + 1}`,
      title: title || `Milestone ${i + 1}`,
      desc: desc || ''
    });
  });

  while (items.length < 3) {
    const idx = items.length;
    items.push(TN_TIMELINE_PRESETS[idx] || {
      date: `Q${idx + 1} 2026`,
      title: `Milestone Phase 0${idx + 1}`,
      desc: 'Statutory delivery, program verification, and inter-agency implementation.'
    });
  }

  return items;
}

// State Side-by-Side Policy & Legislative Comparison Presets (Department-Agnostic)
const TN_COMPARISON_PRESETS = {
  left: {
    badge: "Current Operational Baseline",
    title: "Prior Administrative Process (FY25)",
    bullets: [
      "Manual paper-based multi-copy petitions and notarized filings.",
      "45-day sequential intake, validation, and review turnaround.",
      "Fragmented county record repositories without unified indexing.",
      "Limited public transparency and delayed citizen notification."
    ]
  },
  right: {
    badge: "Enacted Statutory Reform",
    title: "Modernized Digital Framework (FY26)",
    bullets: [
      "100% cloud-based citizen self-service and digital document intake.",
      "Accelerated 10-day automated review and real-time validation.",
      "Centralized statewide data aggregation across all 95 counties.",
      "Instant multi-channel SMS and email citizen status updates."
    ]
  }
};

function parseComparisonContent(bodyText) {
  if (!bodyText || !bodyText.trim()) {
    return TN_COMPARISON_PRESETS;
  }

  // Split by ===, or ---, or \nVS\n, or \nvs\n
  let sections = bodyText.split(/\n\s*(?:===+|---+|\bVS\b|\bvs\b)\s*\n/);
  if (sections.length < 2) {
    sections = bodyText.split(/(?:^|\n)\s*(?:===+|---+|\bVS\b|\bvs\b)\s*(?:\n|$)/);
  }

  if (sections.length < 2) {
    const allLines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const mid = Math.ceil(allLines.length / 2);
    sections = [
      allLines.slice(0, mid).join('\n'),
      allLines.slice(mid).join('\n')
    ];
  }

  const parseSection = (secText, defaultBadge, defaultTitle, isReform) => {
    const lines = (secText || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      return isReform ? TN_COMPARISON_PRESETS.right : TN_COMPARISON_PRESETS.left;
    }

    let badge = defaultBadge;
    let title = defaultTitle;
    let bullets = [];

    let startIndex = 0;
    const badgeMatch = lines[0].match(/^\[([^\]]+)\]\s*(.*)$/);
    if (badgeMatch) {
      badge = badgeMatch[1].trim();
      if (badgeMatch[2].trim()) {
        title = badgeMatch[2].trim();
        startIndex = 1;
      } else if (lines.length > 1) {
        title = lines[1].replace(/^[•\-\*]\s*/, '').trim();
        startIndex = 2;
      }
    } else if (!lines[0].startsWith('•') && !lines[0].startsWith('-') && !lines[0].startsWith('*')) {
      title = lines[0];
      startIndex = 1;
    }

    bullets = lines.slice(startIndex).map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(l => l.length > 0);
    if (bullets.length === 0 && lines.length === 1 && startIndex === 1) {
      bullets = [title];
      title = defaultTitle;
    }

    return { badge, title, bullets };
  };

  return {
    left: parseSection(sections[0], "Current Baseline", "Prior Operational Framework", false),
    right: parseSection(sections[1], "Adopted Reform", "Enacted Statutory Modernization", true)
  };
}

// State Executive Agenda Presets (Department-Agnostic)
const TN_AGENDA_PRESETS = [
  {
    num: "01",
    title: "Executive Strategic Framework",
    desc: "Comprehensive review of statewide policy priorities, legislative alignment, and agency mission delivery."
  },
  {
    num: "02",
    title: "Operational & Service Delivery",
    desc: "Key performance metrics, turnaround timelines, and service expansions across all 95 Tennessee counties."
  },
  {
    num: "03",
    title: "Statutory & Fiscal Governance",
    desc: "Regulatory compliance analysis, Triple-A stewardship, and grant allocation benchmarks."
  },
  {
    num: "04",
    title: "Next Steps & Implementation",
    desc: "Regional stakeholder convenings, rule enactment milestones, and operational implementation."
  }
];

function parseAgendaContent(bodyText) {
  if (!bodyText || !bodyText.trim()) {
    return TN_AGENDA_PRESETS;
  }

  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];

  lines.slice(0, 6).forEach((line, i) => {
    let num = String(i + 1).padStart(2, '0');
    let cleanLine = line;

    const numMatch = cleanLine.match(/^(?:(?:topic|item|section|part)\s*)?(\d{1,2})[\.\:\)]\s*(.*)$/i);
    if (numMatch) {
      num = String(numMatch[1]).padStart(2, '0');
      cleanLine = numMatch[2].trim();
    } else {
      cleanLine = cleanLine.replace(/^[•\-\*]\s*/, '');
    }

    let title = `Discussion Topic ${num}`;
    let desc = '';

    if (cleanLine.includes('|')) {
      const parts = cleanLine.split('|').map(s => s.trim());
      title = parts[0] || title;
      desc = parts.slice(1).join(' | ');
    } else if (cleanLine.includes(':')) {
      const parts = cleanLine.split(':').map(s => s.trim());
      title = parts[0] || title;
      desc = parts.slice(1).join(': ');
    } else {
      title = cleanLine || title;
    }

    items.push({ num, title, desc });
  });

  while (items.length < 4) {
    const idx = items.length;
    items.push(TN_AGENDA_PRESETS[idx] || {
      num: String(idx + 1).padStart(2, '0'),
      title: `Executive Focus Item 0${idx + 1}`,
      desc: "Administrative coordination and strategic program briefing."
    });
  }

  return items;
}

// ==========================================================================
// [JS-25] UNIVERSAL STATUTORY CITATION & CUSTOM HEX COLOR PICKER ENGINE
// ==========================================================================
function hexToRgb(hex) {
  if (!hex) return null;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) return null;
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getRelativeLuminance(rgb) {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getHexContrastRatio(hex1, hex2 = '#FFFFFF') {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function applyCustomAccent(hex, skipSync = false) {
  if (!hex) hex = '#002D72';
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;

  appData.customAccent = hex.toUpperCase();
  document.documentElement.style.setProperty('--tn-custom-accent', appData.customAccent);

  // Update contrast UI
  const ratio = getHexContrastRatio(appData.customAccent, '#FFFFFF');
  const badge = document.getElementById('custom-accent-contrast-badge');
  const ratioText = document.getElementById('accent-contrast-ratio-text');

  if (ratioText) {
    ratioText.textContent = `${ratio.toFixed(1)}:1`;
  }

  if (badge) {
    if (ratio >= 4.5) {
      badge.textContent = `WCAG AA ${ratio.toFixed(1)}:1`;
      badge.style.background = '#E8F5E9';
      badge.style.color = '#2E7D32';
    } else {
      badge.textContent = `Low Contrast ${ratio.toFixed(1)}:1`;
      badge.style.background = '#FFEBEE';
      badge.style.color = '#BA0C2F';
    }
  }

  if (!skipSync) {
    const picker = document.getElementById('custom-accent-color-picker');
    const hexInput = document.getElementById('custom-accent-hex-input');
    if (picker) picker.value = appData.customAccent;
    if (hexInput) hexInput.value = appData.customAccent;

    // Update active swatch state
    const swatches = document.querySelectorAll('.tn-color-swatch-btn');
    swatches.forEach(btn => {
      if (btn.dataset.color && btn.dataset.color.toUpperCase() === appData.customAccent) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

// --- 2. DOM REFERENCES ---
var filmstripEl = document.getElementById('slide-filmstrip');
var liveStageEl = document.getElementById('live-slide-stage');
var fullscreenStageEl = document.getElementById('fullscreen-slide-stage');
var fullscreenOverlay = document.getElementById('fullscreen-presentation-overlay');
var slideCounterDisplay = document.getElementById('slide-counter-display');
var hudCounter = document.getElementById('hud-counter');
var progressBar = document.getElementById('slide-progress-bar');
var saveDot = document.getElementById('save-dot');
var saveStatusText = document.getElementById('save-status-text');

// Outline Form Inputs
var inputKicker = document.getElementById('slide-kicker-input');
var inputTitle = document.getElementById('slide-title-input');
var inputBody = document.getElementById('slide-body-input');
var selectLayout = document.getElementById('slide-layout-select');
var inputNotes = document.getElementById('slide-notes-input');
var inputCitation = document.getElementById('slide-citation-input');
var selectTheme = document.getElementById('theme-select');
var selectAgencyLogo = document.getElementById('agency-logo-select');
var selectPhotoStyle = document.getElementById('photo-style-select');
var chkCardWiggle = document.getElementById('chk-card-wiggle');
var selectImagePlacement = document.getElementById('image-placement-select');
var inputImageUrl = document.getElementById('image-url-input');
var inputImageCaption = document.getElementById('image-caption-input');
var inputVideoUrl = document.getElementById('video-url-input');
var inputAudioUrl = document.getElementById('audio-url-input');
// Media Preview
var mediaPreviewBox = document.getElementById('media-preview-box');
var mediaPreviewImg = document.getElementById('media-preview-img');

// Interactive Tennessee Map Form Controls
var boxMapConfig = document.getElementById('slide-map-config-box');
var selectMapMode = document.getElementById('tn-map-mode-select');
var mapModeBadge = document.getElementById('map-mode-badge');
var mapPresetGroup = document.getElementById('map-preset-group');
var selectMapPreset = document.getElementById('tn-map-preset-select');
var inputMapCaption = document.getElementById('tn-map-caption-input');
var inputMapPrefix = document.getElementById('tn-map-prefix-input');
var inputMapUnit = document.getElementById('tn-map-unit-input');
var panelStatewide = document.getElementById('map-panel-statewide');
var inputMapStatewideVal = document.getElementById('tn-map-statewide-val');
var inputMapStatewideSub = document.getElementById('tn-map-statewide-sub');
var panelCustomConfig = document.getElementById('map-panel-custom-config');
var badgeCustomGroupCounter = document.getElementById('custom-group-counter-badge');
var inputMapCustomTitle = document.getElementById('tn-map-custom-title-input');
var inputMapCustomMetric = document.getElementById('tn-map-custom-metric-input');
var panelCountySelect = document.getElementById('map-panel-county-select');
var selectMapCountyPicker = document.getElementById('tn-map-county-picker');
var panelDivisionsEditors = document.getElementById('map-panel-divisions-editors');
var inputMapWestVal = document.getElementById('tn-map-west-val');
var inputMapWestSub = document.getElementById('tn-map-west-sub');
var inputMapMidVal = document.getElementById('tn-map-mid-val');
var inputMapMidSub = document.getElementById('tn-map-mid-sub');
var inputMapEastVal = document.getElementById('tn-map-east-val');
var inputMapEastSub = document.getElementById('tn-map-east-sub');
const btnResetMapSel = document.getElementById('btn-reset-map-selection');

// Fullscreen Video Theater Controls & State
const videoTheaterOverlay = document.getElementById('fullscreen-video-theater');
const videoTheaterHeader = document.getElementById('video-theater-header');
const videoTheaterTitle = document.getElementById('video-theater-title');
const videoTheaterPlayerMount = document.getElementById('video-theater-player-mount');
const videoAccidentalToast = document.getElementById('video-accidental-toast');
const videoToastHeading = document.getElementById('video-toast-heading');
const videoToastSub = document.getElementById('video-toast-sub');
const videoToastProgressFill = document.getElementById('video-toast-progress-fill');
var chkVideoFullscreenAdvance = document.getElementById('chk-video-fullscreen-advance');
const videoStatusBadge = document.getElementById('video-status-badge');
var btnPreviewVideoFullscreen = document.getElementById('btn-preview-video-fullscreen');
var btnClearVideo = document.getElementById('btn-clear-video');
const btnCloseVideoTheater = document.getElementById('btn-close-video-theater');

let isVideoPlayingFullscreen = false;
var lastVideoClickTimestamp = 0;
var lastVideoClickDirection = '';
var videoToastTimeout = null;
var videoTheaterIdleTimeout = null;
var currentPlayingVideoSlideIndex = -1;
var videoSlidePlayState = {}; // { [slideIndex]: 'ready' | 'played' }

// Aspect Ratio, Safe-Zone, & Clipping Audit Controls
var selectCanvasAspectRatio = document.getElementById('select-canvas-aspect-ratio');
var selectStyleAspectRatio = document.getElementById('select-style-aspect-ratio');
var btnToggleSafeZones = document.getElementById('btn-toggle-safe-zones');
var safeZoneOverlay = document.getElementById('safe-zone-overlay');
var canvasClippingBadge = document.getElementById('canvas-clipping-badge');
var btnOpenClippingAudit = document.getElementById('btn-open-clipping-audit');
var btnSidebarCheckClipping = document.getElementById('btn-sidebar-check-clipping');
var modalClippingAudit = document.getElementById('modal-clipping-audit');
var btnCloseClippingAudit = document.getElementById('btn-close-clipping-audit');
var btnCloseClippingAuditFooter = document.getElementById('btn-close-clipping-audit-footer');
var btnApplyCompactFit = document.getElementById('btn-apply-compact-fit');
var clippingAuditTableBody = document.getElementById('clipping-audit-table-body');
var isSafeZonesActive = false;

function extractYouTubeId(url) {
  if (!url) return null;
  const pattern = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = String(url).match(pattern);
  return match ? match[1] : null;
}

function isDirectVideoFile(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function normalizeYouTubeEmbedUrl(url, autoplay = false) {
  if (!url) return '';
  const ytid = extractYouTubeId(url);
  if (ytid) {
    const params = new URLSearchParams({
      enablejsapi: '1',
      rel: '0',
      iv_load_policy: '3',
      modestbranding: '1',
      playsinline: '1'
    });
    if (autoplay) {
      params.set('autoplay', '1');
      params.set('allow', 'autoplay');
    }
    return `https://www.youtube.com/embed/${ytid}?${params.toString()}`;
  }
  return url.trim();
}

function launchFullscreenVideoTheater(slide) {
  if (!slide || !slide.videoUrl) return;
  isVideoPlayingFullscreen = true;
  currentPlayingVideoSlideIndex = currentSlideIndex;
  lastVideoClickTimestamp = 0;
  lastVideoClickDirection = '';

  if (videoTheaterTitle) {
    videoTheaterTitle.textContent = slide.title || 'State of Tennessee Presentation Video';
  }

  const isDirect = isDirectVideoFile(slide.videoUrl);
  const embedUrl = normalizeYouTubeEmbedUrl(slide.videoUrl, true);

  if (videoTheaterPlayerMount) {
    if (isDirect) {
      videoTheaterPlayerMount.innerHTML = `
        <video id="theater-active-video" src="${escapeHtml(slide.videoUrl)}" autoplay controls playsinline style="width:100vw; height:100vh;"></video>
      `;
      const vid = document.getElementById('theater-active-video');
      if (vid) {
        vid.addEventListener('ended', () => {
          exitFullscreenVideoTheater(false);
        });
      }
    } else {
      videoTheaterPlayerMount.innerHTML = `
        <iframe id="theater-active-iframe" src="${escapeHtml(embedUrl)}" allow="autoplay; fullscreen; accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100vw; height:100vh; border:none;"></iframe>
      `;
    }
  }

  if (videoTheaterOverlay) {
    videoTheaterOverlay.classList.add('active');
  }

  resetTheaterHeaderIdleTimer();
}

function exitFullscreenVideoTheater(autoAdvance = false) {
  isVideoPlayingFullscreen = false;
  lastVideoClickTimestamp = 0;
  lastVideoClickDirection = '';
  hideVideoAccidentalToast();

  if (videoTheaterOverlay) {
    videoTheaterOverlay.classList.remove('active');
  }
  if (videoTheaterPlayerMount) {
    videoTheaterPlayerMount.innerHTML = ''; // Tears down iframe to immediately kill audio/video
  }

  if (autoAdvance && currentSlideIndex < appData.slides.length - 1) {
    switchSlide(currentSlideIndex + 1);
  }
}

function resetTheaterHeaderIdleTimer() {
  if (!videoTheaterHeader) return;
  videoTheaterHeader.classList.remove('idle');
  clearTimeout(videoTheaterIdleTimeout);
  videoTheaterIdleTimeout = setTimeout(() => {
    if (isVideoPlayingFullscreen && videoTheaterHeader) {
      videoTheaterHeader.classList.add('idle');
    }
  }, 3200);
}

function handleVideoTheaterAdvance(direction = 'forward') {
  const now = Date.now();
  const timeDiff = now - lastVideoClickTimestamp;
  const isDouble = (lastVideoClickDirection === direction) && (timeDiff < 850);

  if (isDouble) {
    // Double-click/double-press verified! Stop video mid-stream and proceed
    hideVideoAccidentalToast();
    exitFullscreenVideoTheater(false);
    if (direction === 'forward') {
      if (currentSlideIndex < appData.slides.length - 1) {
        switchSlide(currentSlideIndex + 1);
      }
    } else {
      switchSlide(currentSlideIndex);
    }
  } else {
    // First click - filter accidental click and display visual feedback
    lastVideoClickTimestamp = now;
    lastVideoClickDirection = direction;
    showVideoAccidentalToast(direction);
  }
}

function showVideoAccidentalToast(direction) {
  if (!videoAccidentalToast || !videoToastHeading || !videoToastSub || !videoToastProgressFill) return;

  if (direction === 'forward') {
    videoToastHeading.textContent = 'Accidental Advance Filtered (Protection Active)';
    videoToastSub.innerHTML = 'Press <strong>Next (▶ / Space)</strong> or <strong>Double-Click</strong> again to stop video &amp; advance';
  } else {
    videoToastHeading.textContent = 'Accidental Rewind Filtered (Protection Active)';
    videoToastSub.innerHTML = 'Press <strong>Previous (◀)</strong> or <strong>Double-Click</strong> again to stop video &amp; return';
  }

  videoToastProgressFill.classList.remove('counting');
  void videoToastProgressFill.offsetWidth;
  videoToastProgressFill.classList.add('counting');

  videoAccidentalToast.classList.add('visible');
  clearTimeout(videoToastTimeout);
  videoToastTimeout = setTimeout(() => {
    videoAccidentalToast.classList.remove('visible');
  }, 850);
}

function hideVideoAccidentalToast() {
  if (videoAccidentalToast) videoAccidentalToast.classList.remove('visible');
  clearTimeout(videoToastTimeout);
}

// Slide Motion & Animation Controls
var chkSlideAnimate = document.getElementById('chk-slide-animate');
var slideAnimTypeContainer = document.getElementById('slide-anim-type-container');
var selectSlideAnimType = document.getElementById('slide-anim-type-select');

// Copilot Assistant
const copilotBox = document.getElementById('copilot-brevity-box');
var copilotCharCount = document.getElementById('copilot-char-count');
var copilotSuggestionText = document.getElementById('copilot-suggestion-text');
var copilotApplyBtn = document.getElementById('copilot-apply-btn');

// Laser & Canvas
const laserDot = document.getElementById('laser-dot');
const canvasEl = document.getElementById('annotation-canvas');
const ctx = canvasEl.getContext('2d');

// --- 2B. APPROVED STATE LAYOUT CATALOG & MINI PREVIEW WIREFRAMES ---
const TN_LAYOUT_CATALOG = [
  {
    id: 'layout-cover-blue-banner',
    name: 'Dept Blue Banner Cover',
    category: 'State Cover',
    desc: 'Official Tennessee header band cover with centered title and Tri-Star badge.',
    bullets: 'Title & optional subtitle date',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect width="100" height="20" fill="#002D72"/><rect width="100" y="66" height="4" fill="#BA0C2F"/><rect x="22" y="32" width="56" height="7" rx="1.5" fill="#002D72"/><rect x="32" y="43" width="36" height="4" rx="1" fill="#BA0C2F"/><circle cx="50" cy="10" r="4.5" fill="#FFFFFF"/>'
  },
  {
    id: 'layout-cover-state-classic',
    name: 'State Classic Cover',
    category: 'State Cover',
    desc: 'Classic white layout with State Crimson vertical accent stripe and bottom agency lockup.',
    bullets: 'Title, project name & date',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="8" y="0" width="4" height="70" fill="#BA0C2F"/><rect x="20" y="26" width="58" height="7" rx="1.5" fill="#002D72"/><rect x="20" y="37" width="38" height="4" rx="1" fill="#514F50"/><rect x="20" y="44" width="24" height="3" rx="1" fill="#718096"/>'
  },
  {
    id: 'layout-section-break',
    name: 'Section Divider & Breaker',
    category: 'State Cover',
    desc: 'Full-bleed Crimson slide to signal a major transition to the next topic or module.',
    bullets: 'Big topic number & summary',
    svg: '<rect width="100" height="70" fill="#BA0C2F"/><rect x="20" y="28" width="60" height="8" rx="2" fill="#FFFFFF"/><rect x="30" y="40" width="40" height="4" rx="1" fill="rgba(255,255,255,0.7)"/>'
  },
  {
    id: 'layout-agenda',
    name: 'Executive Agenda & Topics',
    category: 'Strategic Framework',
    desc: 'Clean numbered topic cards with chevron indicators for meeting agendas.',
    bullets: '3-6 agenda discussion topics',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="8" width="30" height="4" rx="1" fill="#002D72"/><rect x="8" y="18" width="84" height="13" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="12" y="22" width="8" height="5" rx="1" fill="#002D72"/><rect x="24" y="22" width="52" height="4" rx="1" fill="#64748B"/><rect x="8" y="34" width="84" height="13" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="12" y="38" width="8" height="5" rx="1" fill="#002D72"/><rect x="24" y="38" width="52" height="4" rx="1" fill="#64748B"/><rect x="8" y="50" width="84" height="13" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="12" y="54" width="8" height="5" rx="1" fill="#002D72"/><rect x="24" y="54" width="52" height="4" rx="1" fill="#64748B"/>'
  },
  {
    id: 'layout-pillars-3',
    name: '3 Strategic Pillars',
    category: 'Strategic Framework',
    desc: '3 equal cards with navy header caps for organizational priorities and strategic goals.',
    bullets: '3 bullets (Title | Desc)',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><rect x="8" y="16" width="26" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="8" y="16" width="26" height="5" rx="1" fill="#002D72"/><rect x="37" y="16" width="26" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="37" y="16" width="26" height="5" rx="1" fill="#002D72"/><rect x="66" y="16" width="26" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="66" y="16" width="26" height="5" rx="1" fill="#002D72"/>'
  },
  {
    id: 'layout-pillars-4',
    name: '4 Strategic Pillars',
    category: 'Strategic Framework',
    desc: '4 equal cards across the slide for 4-pillar frameworks and comprehensive policy areas.',
    bullets: '4 bullets (Title | Desc)',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><rect x="6" y="16" width="19" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="6" y="16" width="19" height="4" rx="1" fill="#002D72"/><rect x="29" y="16" width="19" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="29" y="16" width="19" height="4" rx="1" fill="#002D72"/><rect x="52" y="16" width="19" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="52" y="16" width="19" height="4" rx="1" fill="#002D72"/><rect x="75" y="16" width="19" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="75" y="16" width="19" height="4" rx="1" fill="#002D72"/>'
  },
  {
    id: 'layout-process-flow',
    name: 'SOP & Process Flow',
    category: 'Strategic Framework',
    desc: 'Chevrons connected horizontally to illustrate sequence, phases, and procedures.',
    bullets: '3-4 sequential steps',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><path d="M 6 22 L 23 22 L 28 35 L 23 48 L 6 48 Z" fill="#002D72"/><path d="M 29 22 L 46 22 L 51 35 L 46 48 L 29 48 Z" fill="#BA0C2F"/><path d="M 52 22 L 69 22 L 74 35 L 69 48 L 52 48 Z" fill="#514F50"/><path d="M 75 22 L 90 22 L 94 35 L 90 48 L 75 48 Z" fill="#002D72"/>'
  },
  {
    id: 'layout-timeline',
    name: 'Milestone Timeline',
    category: 'Strategic Framework',
    desc: 'Horizontal milestone track with alternating nodes for roadmaps and quarterly schedules.',
    bullets: '3-5 milestone dates',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><line x1="12" y1="36" x2="88" y2="36" stroke="#CBD5E1" stroke-width="3"/><circle cx="22" cy="36" r="4" fill="#002D72"/><rect x="14" y="44" width="16" height="8" rx="1" fill="#FFFFFF" stroke="#CBD5E1"/><circle cx="50" cy="36" r="4" fill="#BA0C2F"/><rect x="42" y="22" width="16" height="8" rx="1" fill="#FFFFFF" stroke="#CBD5E1"/><circle cx="78" cy="36" r="4" fill="#002D72"/><rect x="70" y="44" width="16" height="8" rx="1" fill="#FFFFFF" stroke="#CBD5E1"/>'
  },
  {
    id: 'layout-comparison',
    name: 'Policy & Reform Comparison',
    category: 'Strategic Framework',
    desc: 'Side-by-side cards with central VS badge for comparing baseline vs proposed reform.',
    bullets: 'Separate using === or VS',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><rect x="8" y="16" width="39" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="8" y="16" width="39" height="5" rx="1" fill="#514F50"/><circle cx="50" cy="40" r="5.5" fill="#BA0C2F"/><rect x="53" y="16" width="39" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="53" y="16" width="39" height="5" rx="1" fill="#002D72"/>'
  },
  {
    id: 'layout-split',
    name: '2-Column Split (Text & Media)',
    category: 'Content Layout',
    desc: 'Classic presentation layout: text bullets on left, graphic/chart/photo card on right.',
    bullets: '3-6 action bullets',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="8" y="8" width="30" height="4" rx="1" fill="#002D72"/><rect x="8" y="20" width="38" height="3.5" rx="1" fill="#64748B"/><rect x="8" y="28" width="34" height="3.5" rx="1" fill="#64748B"/><rect x="8" y="36" width="36" height="3.5" rx="1" fill="#64748B"/><rect x="52" y="16" width="40" height="46" rx="2" fill="#F1F5F9" stroke="#CBD5E1"/>'
  },
  {
    id: 'layout-split-50',
    name: 'Split 50/50 Full Height Photo',
    category: 'Content Layout',
    desc: 'Left half contains white typography card; right half is a full-height photo with state overlay.',
    bullets: '2-4 concise bullets',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="8" y="14" width="30" height="5" rx="1" fill="#002D72"/><rect x="8" y="25" width="32" height="3.5" rx="1" fill="#64748B"/><rect x="8" y="33" width="28" height="3.5" rx="1" fill="#64748B"/><rect x="50" y="0" width="50" height="70" fill="#002D72" opacity="0.85"/>'
  },
  {
    id: 'layout-bento-3',
    name: '3-Card Bento Grid',
    category: 'Content Layout',
    desc: 'Modern Bento box: 1 prominent hero card on the left, 2 stacked companion cards on the right.',
    bullets: '3 key takeaways',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="28" height="4" rx="1" fill="#002D72"/><rect x="8" y="15" width="42" height="49" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="54" y="15" width="38" height="23" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="54" y="41" width="38" height="23" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/>'
  },
  {
    id: 'layout-stat-callout',
    name: 'Big Metric Callout',
    category: 'Content Layout',
    desc: 'High-impact oversized numeral with descriptive subtitle card below for major milestones.',
    bullets: 'Single metric & context',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="8" y="8" width="35" height="4" rx="1" fill="#002D72"/><rect x="10" y="18" width="80" height="30" rx="3" fill="#F1F5F9" stroke="#CBD5E1"/><rect x="30" y="24" width="40" height="10" rx="1" fill="#BA0C2F"/><rect x="25" y="38" width="50" height="3.5" rx="1" fill="#514F50"/><rect x="10" y="54" width="60" height="3.5" rx="1" fill="#64748B"/>'
  },
  {
    id: 'layout-quote',
    name: 'Executive Quote & Testimonial',
    category: 'Content Layout',
    desc: 'Centered editorial quote marks with serif quotation styling and author attribution line.',
    bullets: 'Quote & author attribution',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><text x="44" y="22" font-size="20" fill="#BA0C2F" font-family="serif">“</text><rect x="15" y="28" width="70" height="4.5" rx="1" fill="#1E293B"/><rect x="20" y="36" width="60" height="3.5" rx="1" fill="#64748B"/><rect x="35" y="47" width="30" height="3" rx="1" fill="#BA0C2F"/>'
  },
  {
    id: 'layout-title-hero',
    name: 'Keynote Title Hero',
    category: 'Content Layout',
    desc: 'High-energy centered headline with subtitle card for keynote talks and kickoff moments.',
    bullets: 'Headline & brief subtitle',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="20" y="24" width="60" height="8" rx="2" fill="#002D72"/><rect x="28" y="37" width="44" height="4.5" rx="1" fill="#BA0C2F"/><rect x="36" y="47" width="28" height="3" rx="1" fill="#64748B"/>'
  },
  {
    id: 'layout-chart-bar',
    name: 'Bar Chart & WCAG Table',
    category: 'Data & Charts',
    desc: 'Dynamic horizontal bar visualization with paired semantic table for accessibility.',
    bullets: 'CSV / spreadsheet data',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><rect x="8" y="18" width="40" height="5" rx="1" fill="#002D72"/><rect x="8" y="28" width="30" height="5" rx="1" fill="#BA0C2F"/><rect x="8" y="38" width="45" height="5" rx="1" fill="#002D72"/><rect x="56" y="16" width="36" height="48" rx="2" fill="#F8FAFC" stroke="#CBD5E1"/><line x1="56" y1="26" x2="92" y2="26" stroke="#CBD5E1"/>'
  },
  {
    id: 'layout-chart-kpi',
    name: 'KPI Metric Grid',
    category: 'Data & Charts',
    desc: '4-card scorecard displaying big numbers with trend labels for legislative dashboards.',
    bullets: '4 metric data points',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><rect x="8" y="16" width="39" height="23" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="53" y="16" width="39" height="23" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="8" y="42" width="39" height="23" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="53" y="42" width="39" height="23" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/>'
  },
  {
    id: 'layout-data-table',
    name: 'Accessible Executive Table',
    category: 'Data & Charts',
    desc: 'High-contrast data table with navy header, zebra striping, and screen reader headers.',
    bullets: 'Tabular civic data rows',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><rect x="8" y="16" width="84" height="48" rx="2" fill="#FFFFFF" stroke="#CBD5E1"/><rect x="8" y="16" width="84" height="10" fill="#002D72"/><line x1="8" y1="34" x2="92" y2="34" stroke="#E2E8F0"/><line x1="8" y1="44" x2="92" y2="44" stroke="#E2E8F0"/><line x1="8" y1="54" x2="92" y2="54" stroke="#E2E8F0"/>'
  },
  {
    id: 'layout-tn-map',
    name: 'Interactive Tennessee Map',
    category: 'Civic & Maps',
    desc: 'State map highlighting West, Middle, and East Tennessee grand divisions with county details.',
    bullets: 'Grand Division metric values',
    svg: '<rect width="100" height="70" fill="#F8FAFC"/><rect x="8" y="6" width="30" height="4" rx="1" fill="#002D72"/><path d="M 12 34 L 36 34 L 40 48 L 10 48 Z" fill="#002D72"/><path d="M 38 32 L 62 32 L 66 48 L 40 48 Z" fill="#BA0C2F"/><path d="M 64 28 L 88 18 L 92 48 L 66 48 Z" fill="#514F50"/>'
  },
  {
    id: 'layout-thank-you',
    name: 'Closing "THANK YOU"',
    category: 'Closing',
    desc: 'Official State closing slide with Tri-Star seal, agency social tags, and contact lines.',
    bullets: 'Contact info & Q&A prompt',
    svg: '<rect width="100" height="70" fill="#FFFFFF"/><rect x="25" y="20" width="50" height="8" rx="2" fill="#002D72"/><circle cx="50" cy="38" r="5" fill="#BA0C2F"/><rect x="30" y="48" width="40" height="3.5" rx="1" fill="#514F50"/>'
  }
];

function updateLayoutMiniPreview(layoutId) {
  const item = TN_LAYOUT_CATALOG.find(l => l.id === layoutId) || TN_LAYOUT_CATALOG.find(l => l.id === 'layout-split-50');
  if (!item) return;

  const schematicEl = document.getElementById('layout-mini-schematic');
  const nameEl = document.getElementById('layout-mini-name');
  const badgeEl = document.getElementById('layout-mini-badge');
  const descEl = document.getElementById('layout-mini-desc');
  const bulletsEl = document.getElementById('layout-mini-bullets');
  const previewCard = document.getElementById('layout-mini-preview-card');

  if (schematicEl) {
    schematicEl.innerHTML = `<svg viewBox="0 0 100 70" width="100%" height="100%" preserveAspectRatio="none">${item.svg}</svg>`;
  }
  if (nameEl) nameEl.textContent = item.name;
  if (badgeEl) badgeEl.textContent = item.category;
  if (descEl) descEl.textContent = item.desc;
  if (bulletsEl) bulletsEl.textContent = `💡 ${item.bullets}`;
  if (previewCard) previewCard.setAttribute('aria-label', `Selected Layout: ${item.name} (${item.category})`);
}

var activeLayoutFilterCategory = 'all';

function openLayoutGallery() {
  const modal = document.getElementById('modal-layout-gallery');
  if (!modal) return;
  const currentSlideNum = document.getElementById('gallery-current-slide-num');
  if (currentSlideNum) currentSlideNum.textContent = currentSlideIndex + 1;
  renderLayoutGallery(activeLayoutFilterCategory, '');
  modal.classList.add('active');
}

function closeLayoutGallery() {
  const modal = document.getElementById('modal-layout-gallery');
  if (modal) modal.classList.remove('active');
}

function renderLayoutGallery(filterCategory = 'all', searchQuery = '') {
  const gridEl = document.getElementById('layout-gallery-grid');
  if (!gridEl) return;

  const currentLayout = selectLayout ? selectLayout.value : 'layout-split-50';
  const q = (searchQuery || '').trim().toLowerCase();

  const filtered = TN_LAYOUT_CATALOG.filter(l => {
    const matchCat = filterCategory === 'all' || l.category.toLowerCase().includes(filterCategory.toLowerCase());
    const matchQuery = !q || l.name.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q) || l.category.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  if (filtered.length === 0) {
    gridEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--tn-slate-500); padding: 3rem 1rem;">No layouts matching "${escapeHtml(searchQuery)}".</div>`;
    return;
  }

  let html = '';
  filtered.forEach(l => {
    const isActive = l.id === currentLayout;
    html += `
      <div class="layout-card-item ${isActive ? 'active' : ''}" data-layout="${escapeHtml(l.id)}" role="button" tabindex="0" aria-pressed="${isActive}" title="Apply ${escapeHtml(l.name)} to Slide #${currentSlideIndex + 1}">
        <div class="layout-card-schematic" aria-hidden="true">
          <svg viewBox="0 0 100 70" width="100%" height="100%" preserveAspectRatio="none">${l.svg}</svg>
        </div>
        <div class="layout-card-body">
          <div class="layout-card-header">
            <span class="layout-card-title">${escapeHtml(l.name)}</span>
          </div>
          <div class="layout-card-desc">${escapeHtml(l.desc)}</div>
          <div class="layout-card-meta">💡 ${escapeHtml(l.bullets)}</div>
        </div>
      </div>
    `;
  });

  gridEl.innerHTML = html;

  gridEl.querySelectorAll('.layout-card-item').forEach(card => {
    const applyLayout = () => {
      const chosenId = card.dataset.layout;
      if (chosenId && selectLayout) {
        selectLayout.value = chosenId;
        updateSlideFromForm();
        updateLayoutMiniPreview(chosenId);
        closeLayoutGallery();
        
        const toast = document.createElement('div');
        toast.className = 'save-toast';
        const lObj = TN_LAYOUT_CATALOG.find(x => x.id === chosenId);
        toast.textContent = `✓ Layout updated to "${lObj ? lObj.name : chosenId}" on Slide #${currentSlideIndex + 1}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
      }
    };

    card.addEventListener('click', applyLayout);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        applyLayout();
      }
    });
  });
}

