#!/usr/bin/env node
/**
 * TN Slides Skill Builder
 * Builds a self-contained Portable Smart-Deck (.html) and/or WCAG-compliant PowerPoint (.pptx)
 * from a clean deck.json specification.
 *
 * Usage:
 *   node scripts/build_deck.mjs deck.json [--out-dir ./output] [--format both|html|pptx]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const THEMES = {
  'theme-dept-blue-banner': {
    bg: '#FFFFFF',
    surface: '#F8FAFC',
    primary: '#002D72',
    accent: '#C8102E',
    gold: '#C59B27',
    text: '#1E293B',
    muted: '#64748B',
    border: '#E2E8F0',
    coverBg: '#002D72',
    coverText: '#FFFFFF',
  },
  'theme-state-classic': {
    bg: '#FFFFFF',
    surface: '#F8FAFC',
    primary: '#002D72',
    accent: '#EE0000',
    gold: '#C59B27',
    text: '#0F172A',
    muted: '#475569',
    border: '#CBD5E1',
    coverBg: '#FFFFFF',
    coverText: '#002D72',
  },
  'theme-tn-crimson-bold': {
    bg: '#FFFDF9',
    surface: '#FFFFFF',
    primary: '#B91C1C',
    accent: '#002D72',
    gold: '#D97706',
    text: '#1E293B',
    muted: '#64748B',
    border: '#FDE68A',
    coverBg: '#991B1B',
    coverText: '#FFFFFF',
  },
  'theme-executive-dark': {
    bg: '#0F172A',
    surface: '#1E293B',
    primary: '#38BDF8',
    accent: '#C59B27',
    gold: '#F59E0B',
    text: '#F8FAFC',
    muted: '#94A3B8',
    border: '#334155',
    coverBg: '#020617',
    coverText: '#F8FAFC',
  },
};

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(str) {
  return (
    String(str || 'tn-presentation')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'tn-presentation'
  );
}

function splitLines(body) {
  return String(body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseCardItems(lines) {
  return lines.map((line) => {
    const idx = line.indexOf(':');
    if (idx > 0 && idx < 42) {
      return {
        heading: line.slice(0, idx).replace(/\*\*/g, '').trim(),
        detail: line.slice(idx + 1).trim(),
      };
    }
    return { heading: line.replace(/\*\*/g, '').trim(), detail: '' };
  });
}

function auditDeckAccessibility(deck) {
  const warnings = [];
  (deck.slides || []).forEach((s, i) => {
    if (s.mediaUrl && s.isDecorative !== true && (!s.mediaAlt || !s.mediaAlt.trim())) {
      warnings.push(`Slide ${i + 1} ("${s.title || 'Untitled'}"): non-decorative image is missing WCAG 2.1 mediaAlt.`);
    }
  });
  return warnings;
}

function renderSlideHtml(slide, themeTokens) {
  const layout = slide.layout || 'layout-split';
  const kicker = slide.kicker ? `<div class="slide-kicker">${esc(slide.kicker)}</div>` : '';
  const title = `<h2 class="slide-title">${esc(slide.title || '')}</h2>`;
  const lines = splitLines(slide.body);
  const watermark = slide.watermarkIcon
    ? `<i class="${esc(slide.watermarkIcon)} slide-watermark" aria-hidden="true"></i>`
    : '';
  const citation = slide.citation ? `<footer class="slide-citation">${esc(slide.citation)}</footer>` : '';

  const imgHtml = slide.mediaUrl
    ? `<div class="slide-media"><img src="${esc(slide.mediaUrl)}" alt="${slide.isDecorative ? '' : esc(slide.mediaAlt || '')}" ${slide.isDecorative ? 'aria-hidden="true"' : ''}></div>`
    : '';

  // Cover & Hero
  if (layout === 'layout-cover-blue-banner' || layout === 'layout-cover-state-classic' || layout === 'layout-title-hero') {
    const isClassic = layout === 'layout-cover-state-classic';
    const meta = [slide.authorName, slide.authorDate].filter(Boolean).map(esc).join('  •  ');
    return `
      <div class="slide-inner ${esc(layout)} ${isClassic ? 'cover-classic' : 'cover-banner'}">
        ${watermark}
        ${kicker}
        <h1 class="slide-title cover-title">${esc(slide.title || '')}</h1>
        ${lines.length ? `<div class="cover-subtitle">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
        ${meta ? `<div class="cover-meta">${meta}</div>` : ''}
        ${citation}
      </div>`;
  }

  if (layout === 'layout-section-break') {
    return `
      <div class="slide-inner layout-section-break cover-banner">
        ${watermark}
        ${kicker}
        <h1 class="slide-title cover-title">${esc(slide.title || '')}</h1>
        ${lines.length ? `<p class="cover-subtitle">${esc(lines.join(' '))}</p>` : ''}
      </div>`;
  }

  if (layout === 'layout-thank-you') {
    const meta = [slide.authorName, slide.authorDate].filter(Boolean).map(esc).join('  •  ');
    return `
      <div class="slide-inner layout-thank-you">
        ${watermark}
        ${kicker}
        <h1 class="slide-title">${esc(slide.title || 'THANK YOU')}</h1>
        ${lines.length ? `<div class="thank-you-body">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
        ${meta ? `<div class="thank-you-meta">${meta}</div>` : ''}
      </div>`;
  }

  if (layout === 'layout-stat-callout') {
    return `
      <div class="slide-inner layout-stat-callout">
        ${watermark}
        ${kicker}
        <div class="stat-hero-number">${esc(slide.statNumber || slide.title || '—')}</div>
        <h2 class="slide-title stat-hero-label">${esc(slide.statLabel || slide.title || '')}</h2>
        ${lines.length ? `<ul class="slide-bullets">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        ${citation}
      </div>`;
  }

  if (layout === 'layout-quote') {
    return `
      <div class="slide-inner layout-quote">
        ${watermark}
        ${kicker}
        <blockquote class="quote-block">
          <p class="quote-text">“${esc(slide.quote || lines.join(' ') || slide.title)}”</p>
          ${slide.quoteAuthor ? `<footer class="quote-author">— ${esc(slide.quoteAuthor)}</footer>` : ''}
        </blockquote>
        ${citation}
      </div>`;
  }

  if (layout === 'layout-pillars-3' || layout === 'layout-pillars-4' || layout === 'layout-bento-3') {
    const cards = parseCardItems(lines);
    const cols = layout === 'layout-pillars-4' ? 4 : 3;
    return `
      <div class="slide-inner ${esc(layout)}">
        ${watermark}
        <header class="slide-header">${kicker}${title}</header>
        <div class="cards-grid cols-${cols}">
          ${cards
            .map(
              (c, idx) => `
            <div class="pillar-card">
              <div class="pillar-num">0${idx + 1}</div>
              <h3 class="pillar-title">${esc(c.heading)}</h3>
              ${c.detail ? `<p class="pillar-desc">${esc(c.detail)}</p>` : ''}
            </div>`
            )
            .join('')}
        </div>
        ${citation}
      </div>`;
  }

  if (layout === 'layout-process-flow' || layout === 'layout-timeline') {
    const steps = parseCardItems(lines);
    const isTimeline = layout === 'layout-timeline';
    return `
      <div class="slide-inner ${esc(layout)}">
        ${watermark}
        <header class="slide-header">${kicker}${title}</header>
        <ol class="flow-list ${isTimeline ? 'is-timeline' : 'is-process'}">
          ${steps
            .map(
              (st, idx) => `
            <li class="flow-item">
              <span class="flow-badge">${isTimeline ? esc(st.heading) : `Step ${idx + 1}`}</span>
              <h3 class="pillar-title">${isTimeline ? esc(st.detail || st.heading) : esc(st.heading)}</h3>
              ${!isTimeline && st.detail ? `<p class="pillar-desc">${esc(st.detail)}</p>` : ''}
            </li>`
            )
            .join('')}
        </ol>
        ${citation}
      </div>`;
  }

  if (layout === 'layout-comparison') {
    const items = parseCardItems(lines);
    const half = Math.ceil(items.length / 2);
    const left = items.slice(0, half);
    const right = items.slice(half);
    return `
      <div class="slide-inner layout-comparison">
        ${watermark}
        <header class="slide-header">${kicker}${title}</header>
        <div class="comparison-grid">
          <div class="compare-col">
            ${left.map((i) => `<div class="compare-item"><strong>${esc(i.heading)}</strong>${i.detail ? `<span>${esc(i.detail)}</span>` : ''}</div>`).join('')}
          </div>
          <div class="compare-col accent">
            ${right.map((i) => `<div class="compare-item"><strong>${esc(i.heading)}</strong>${i.detail ? `<span>${esc(i.detail)}</span>` : ''}</div>`).join('')}
          </div>
        </div>
        ${citation}
      </div>`;
  }

  if (layout === 'layout-agenda') {
    return `
      <div class="slide-inner layout-agenda">
        ${watermark}
        <header class="slide-header">${kicker}${title}</header>
        <ol class="agenda-list">
          ${lines.map((l, i) => `<li><span class="agenda-num">0${i + 1}</span><span>${esc(l)}</span></li>`).join('')}
        </ol>
        ${citation}
      </div>`;
  }

  if (layout === 'layout-chart-bar' || layout === 'layout-chart-kpi') {
    const data = Array.isArray(slide.chartData) ? slide.chartData : [];
    const maxVal = Math.max(1, ...data.map((d) => Number(d.value) || 0));
    if (layout === 'layout-chart-kpi') {
      return `
        <div class="slide-inner layout-chart-kpi">
          ${watermark}
          <header class="slide-header">${kicker}${title}</header>
          <div class="cards-grid cols-${Math.min(4, Math.max(2, data.length))}">
            ${data
              .map(
                (d) => `
              <div class="pillar-card kpi-card">
                <div class="kpi-val">${esc(d.value)}</div>
                <div class="kpi-lbl">${esc(d.label)}</div>
              </div>`
              )
              .join('')}
          </div>
          ${citation}
        </div>`;
    }
    return `
      <div class="slide-inner layout-chart-bar">
        ${watermark}
        <header class="slide-header">${kicker}${title}</header>
        <div class="bar-chart">
          ${data
            .map((d) => {
              const pct = Math.round(((Number(d.value) || 0) / maxVal) * 100);
              return `
              <div class="bar-row">
                <span class="bar-label">${esc(d.label)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
                <span class="bar-val">${esc(d.value)}</span>
              </div>`;
            })
            .join('')}
        </div>
        ${citation}
      </div>`;
  }

  if (layout === 'layout-data-table') {
    const headers = Array.isArray(slide.tableHeaders) ? slide.tableHeaders : [];
    const rows = Array.isArray(slide.tableRows) ? slide.tableRows : [];
    return `
      <div class="slide-inner layout-data-table">
        ${watermark}
        <header class="slide-header">${kicker}${title}</header>
        <table class="data-table">
          ${headers.length ? `<thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>` : ''}
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        ${citation}
      </div>`;
  }

  // Default: split / split-50 / bullets
  return `
    <div class="slide-inner ${esc(layout)} ${imgHtml ? 'has-media' : ''}">
      ${watermark}
      <header class="slide-header">${kicker}${title}</header>
      <div class="split-body">
        <ul class="slide-bullets">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        ${imgHtml}
      </div>
      ${citation}
    </div>`;
}

function buildHtmlDeck(deck) {
  const themeId = deck.theme && THEMES[deck.theme] ? deck.theme : 'theme-dept-blue-banner';
  const t = THEMES[themeId];
  const baseW = 960;
  const baseH = deck.aspectRatio === '4:3' ? 720 : 540;
  const filename = slugify(deck.deckTitle) + '.html';
  const safeJson = JSON.stringify(deck, null, 2).replace(/<\/script>/gi, '<\\/script>');

  const slidesStore = (deck.slides || [])
    .map((s, idx) => `<div class="tn-deck-slide-data" data-slide-index="${idx}" hidden>${renderSlideHtml(s, t)}</div>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(deck.deckTitle || 'TN Slides Presentation')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Roboto+Slab:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
    :root {
      --tn-bg: ${t.bg};
      --tn-surface: ${t.surface};
      --tn-primary: ${t.primary};
      --tn-accent: ${t.accent};
      --tn-gold: ${t.gold};
      --tn-text: ${t.text};
      --tn-muted: ${t.muted};
      --tn-border: ${t.border};
      --tn-cover-bg: ${t.coverBg};
      --tn-cover-text: ${t.coverText};
    }
    html, body { margin:0; padding:0; width:100%; height:100%; background:#0b1324; font-family:'Open Sans',system-ui,sans-serif; overflow:hidden; }
    #tn-deck-player { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at center,#13203b 0%,#070d19 100%); }
    #tn-player-viewport { width:${baseW}px; height:${baseH}px; background:var(--tn-bg); color:var(--tn-text); border-radius:6px; box-shadow:0 24px 64px rgba(0,0,0,.55); overflow:hidden; transform-origin:center center; }
    #tn-player-stage { width:${baseW}px; height:${baseH}px; position:relative; box-sizing:border-box; }
    .slide-inner { width:100%; height:100%; padding:42px 54px; box-sizing:border-box; display:flex; flex-direction:column; position:relative; overflow:hidden; background:var(--tn-bg); color:var(--tn-text); border-top:6px solid var(--tn-primary); }
    .slide-inner.cover-banner { background:var(--tn-cover-bg); color:var(--tn-cover-text); justify-content:center; border-top:8px solid var(--tn-gold); }
    .slide-inner.cover-classic { justify-content:center; border-top:8px solid var(--tn-primary); }
    .slide-watermark { position:absolute; right:36px; bottom:32px; font-size:150px; opacity:.06; color:var(--tn-primary); pointer-events:none; }
    .cover-banner .slide-watermark { color:#fff; opacity:.08; }
    .slide-kicker { font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--tn-accent); margin-bottom:8px; }
    .cover-banner .slide-kicker { color:var(--tn-gold); }
    .slide-title { font-family:'Roboto Slab',Georgia,serif; font-size:32px; font-weight:800; line-height:1.18; margin:0 0 18px; color:var(--tn-primary); }
    .cover-banner .slide-title { color:var(--tn-cover-text); font-size:44px; }
    .cover-subtitle p { margin:4px 0; font-size:19px; opacity:.92; }
    .cover-meta, .thank-you-meta { margin-top:24px; font-size:14px; font-weight:600; opacity:.85; }
    .slide-header { margin-bottom:18px; border-bottom:2px solid var(--tn-border); padding-bottom:10px; }
    .slide-header .slide-title { margin-bottom:0; }
    .slide-bullets { margin:0; padding-left:22px; font-size:19px; line-height:1.55; flex:1; }
    .slide-bullets li { margin-bottom:10px; }
    .split-body { display:flex; gap:28px; align-items:center; flex:1; min-height:0; }
    .has-media .slide-media { flex:0 0 42%; max-height:100%; display:flex; justify-content:center; }
    .has-media .slide-media img { max-width:100%; max-height:320px; border-radius:8px; object-fit:cover; box-shadow:0 6px 20px rgba(0,0,0,.15); }
    .cards-grid { display:grid; gap:18px; flex:1; align-content:center; }
    .cols-2 { grid-template-columns:repeat(2,1fr); }
    .cols-3 { grid-template-columns:repeat(3,1fr); }
    .cols-4 { grid-template-columns:repeat(4,1fr); }
    .pillar-card { background:var(--tn-surface); border:1px solid var(--tn-border); border-top:4px solid var(--tn-primary); border-radius:8px; padding:18px; display:flex; flex-direction:column; gap:6px; }
    .pillar-num { font-size:12px; font-weight:800; color:var(--tn-accent); }
    .pillar-title { margin:0; font-size:17px; font-weight:700; color:var(--tn-primary); }
    .pillar-desc { margin:0; font-size:14px; line-height:1.45; color:var(--tn-text); }
    .flow-list { list-style:none; padding:0; margin:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; flex:1; align-content:center; }
    .flow-item { background:var(--tn-surface); border:1px solid var(--tn-border); border-radius:8px; padding:16px; position:relative; }
    .flow-badge { display:inline-block; background:var(--tn-primary); color:#fff; font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; margin-bottom:8px; }
    .comparison-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; flex:1; align-content:center; }
    .compare-col { background:var(--tn-surface); border:1px solid var(--tn-border); border-radius:8px; padding:18px; display:flex; flex-direction:column; gap:12px; }
    .compare-col.accent { border-top:4px solid var(--tn-primary); }
    .compare-item strong { display:block; color:var(--tn-primary); font-size:15px; }
    .compare-item span { font-size:14px; }
    .layout-stat-callout { justify-content:center; align-items:flex-start; }
    .stat-hero-number { font-family:'Roboto Slab',serif; font-size:84px; font-weight:800; color:var(--tn-accent); line-height:1; margin-bottom:8px; }
    .layout-quote { justify-content:center; }
    .quote-block { margin:0; padding-left:24px; border-left:6px solid var(--tn-gold); }
    .quote-text { font-family:'Roboto Slab',serif; font-size:28px; line-height:1.35; margin:0 0 12px; }
    .quote-author { font-size:16px; font-weight:700; color:var(--tn-muted); }
    .agenda-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; flex:1; justify-content:center; font-size:20px; }
    .agenda-list li { display:flex; align-items:center; gap:14px; background:var(--tn-surface); padding:10px 16px; border-radius:6px; border:1px solid var(--tn-border); }
    .agenda-num { font-weight:800; color:var(--tn-accent); }
    .bar-chart { display:flex; flex-direction:column; gap:14px; flex:1; justify-content:center; }
    .bar-row { display:grid; grid-template-columns:180px 1fr 60px; align-items:center; gap:12px; font-size:15px; font-weight:600; }
    .bar-track { height:22px; background:var(--tn-border); border-radius:999px; overflow:hidden; }
    .bar-fill { height:100%; background:var(--tn-primary); border-radius:999px; }
    .kpi-card { align-items:center; text-align:center; }
    .kpi-val { font-family:'Roboto Slab',serif; font-size:36px; font-weight:800; color:var(--tn-accent); }
    .kpi-lbl { font-size:14px; font-weight:600; }
    .data-table { width:100%; border-collapse:collapse; font-size:14px; }
    .data-table th { background:var(--tn-primary); color:#fff; text-align:left; padding:10px 12px; }
    .data-table td { padding:9px 12px; border-bottom:1px solid var(--tn-border); }
    .slide-citation { margin-top:auto; padding-top:10px; font-size:11px; color:var(--tn-muted); }
    .layout-thank-you { justify-content:center; align-items:center; text-align:center; }
    /* HUD & Quick Edit */
    #tn-player-hud { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:6px; background:rgba(15,23,42,.9); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,.15); padding:6px 12px; border-radius:999px; z-index:900; box-shadow:0 8px 24px rgba(0,0,0,.4); }
    .tn-hud-btn { background:transparent; border:none; color:#e2e8f0; padding:6px 10px; border-radius:999px; font-size:.8rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
    .tn-hud-btn:hover { background:rgba(255,255,255,.12); color:#fff; }
    .tn-hud-btn.active { background:#c59b27; color:#0f172a; }
    .tn-hud-btn.save-btn { background:#16a34a; color:#fff; display:none; }
    body.quick-edit-active .tn-hud-btn.save-btn { display:inline-flex; }
    .tn-hud-counter { font-size:.8rem; font-weight:700; color:#cbd5e1; padding:0 6px; min-width:48px; text-align:center; }
    .tn-hud-divider { width:1px; height:18px; background:rgba(255,255,255,.16); }
    #tn-notes-drawer { position:fixed; right:18px; bottom:72px; width:min(380px,calc(100vw - 36px)); background:rgba(15,23,42,.95); border:1px solid rgba(255,255,255,.16); border-radius:10px; padding:12px; color:#f1f5f9; z-index:900; display:none; }
    #tn-notes-drawer.open { display:block; }
    #tn-notes-text { width:100%; min-height:80px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); border-radius:6px; color:#f8fafc; font-family:inherit; font-size:.82rem; padding:8px; box-sizing:border-box; }
    body.quick-edit-active [contenteditable="true"] { outline:1.5px dashed rgba(197,155,39,.8); outline-offset:2px; border-radius:3px; }
    #tn-mobile-edit-sheet { display:none; position:fixed; left:10px; right:10px; bottom:68px; background:rgba(15,23,42,.96); border:1px solid rgba(197,155,39,.45); border-radius:12px; padding:12px; z-index:920; max-height:46vh; overflow-y:auto; }
    #tn-mobile-edit-sheet label { display:block; font-size:.7rem; font-weight:700; text-transform:uppercase; color:#c59b27; margin:6px 0 3px; }
    #tn-mobile-edit-sheet input, #tn-mobile-edit-sheet textarea { width:100%; box-sizing:border-box; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.16); border-radius:6px; color:#f8fafc; font-family:inherit; font-size:.85rem; padding:7px 9px; }
    @media (max-width:767px) {
      body.quick-edit-active #tn-deck-player { justify-content:flex-start; padding-top:24px; }
      body.quick-edit-active #tn-mobile-edit-sheet { display:block; }
      body.quick-edit-active #tn-notes-drawer { display:none !important; }
    }
    @media (max-width:640px) {
      #tn-player-hud { bottom:10px; max-width:calc(100vw - 16px); padding:5px 8px; gap:3px; }
      .tn-hud-label-hide-sm { display:none; }
    }
  </style>
</head>
<body>
  <main id="tn-deck-player" aria-label="Presentation Player">
    <div id="tn-player-viewport"><div id="tn-player-stage"></div></div>
  </main>
  <section id="tn-mobile-edit-sheet" aria-label="Mobile Quick Editor">
    <label for="tn-mob-title">Slide Title</label><input type="text" id="tn-mob-title">
    <label for="tn-mob-body">Bullets / Body</label><textarea id="tn-mob-body"></textarea>
    <label for="tn-mob-notes">Speaker Notes</label><textarea id="tn-mob-notes"></textarea>
  </section>
  <aside id="tn-notes-drawer" aria-label="Speaker Notes">
    <div style="display:flex;justify-content:space-between;font-size:.75rem;font-weight:700;color:#c59b27;margin-bottom:6px;">
      <span>SPEAKER NOTES</span>
      <button type="button" id="tn-btn-close-notes" style="background:none;border:none;color:#94a3b8;cursor:pointer;">&times;</button>
    </div>
    <textarea id="tn-notes-text" readonly></textarea>
  </aside>
  <nav id="tn-player-hud" aria-label="Presentation Controls">
    <button type="button" class="tn-hud-btn" id="tn-btn-prev" aria-label="Previous Slide">&#9664;</button>
    <span class="tn-hud-counter" id="tn-hud-counter">1 / 1</span>
    <button type="button" class="tn-hud-btn" id="tn-btn-next" aria-label="Next Slide">&#9654;</button>
    <span class="tn-hud-divider"></span>
    <button type="button" class="tn-hud-btn" id="tn-btn-notes">Notes</button>
    <button type="button" class="tn-hud-btn" id="tn-btn-quick-edit">Edit</button>
    <button type="button" class="tn-hud-btn" id="tn-btn-share">Share</button>
    <button type="button" class="tn-hud-btn save-btn" id="tn-btn-save-copy">Save</button>
  </nav>
  <div id="tn-deck-slides-store" hidden>${slidesStore}</div>
  <script type="application/json" id="tn-presentation-data">${safeJson}</script>
  <script>
    (function(){
      const dataEl = document.getElementById('tn-presentation-data');
      const deckData = JSON.parse(dataEl.textContent);
      const stores = Array.from(document.querySelectorAll('.tn-deck-slide-data'));
      const stage = document.getElementById('tn-player-stage');
      const viewport = document.getElementById('tn-player-viewport');
      const counter = document.getElementById('tn-hud-counter');
      const notesDrawer = document.getElementById('tn-notes-drawer');
      const notesTa = document.getElementById('tn-notes-text');
      const mobT = document.getElementById('tn-mob-title'), mobB = document.getElementById('tn-mob-body'), mobN = document.getElementById('tn-mob-notes');
      let idx = 0, editing = false;

      function scale() {
        const s = Math.min((window.innerWidth - 24) / ${baseW}, (window.innerHeight - 88) / ${baseH}, 1.8);
        viewport.style.transform = 'scale(' + Math.max(0.25, s) + ')';
      }
      function render(i) {
        if (!stores.length) return;
        idx = Math.max(0, Math.min(i, stores.length - 1));
        stage.innerHTML = stores[idx].innerHTML;
        counter.textContent = (idx + 1) + ' / ' + stores.length;
        const sl = deckData.slides[idx] || {};
        notesTa.value = sl.notes || '';
        mobT.value = sl.title || ''; mobB.value = sl.body || ''; mobN.value = sl.notes || '';
        stage.querySelectorAll('h1,h2,h3,p,li,.stat-hero-number').forEach(el => editing ? el.setAttribute('contenteditable','true') : el.removeAttribute('contenteditable'));
        notesTa.readOnly = !editing;
      }
      function flush() {
        if (!editing) return;
        const c = stage.cloneNode(true);
        c.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        stores[idx].innerHTML = c.innerHTML;
        const sl = deckData.slides[idx];
        if (sl) {
          const h = stage.querySelector('.slide-title,h1,h2');
          if (h) sl.title = h.innerText.trim();
          sl.notes = notesTa.value;
          dataEl.textContent = JSON.stringify(deckData, null, 2);
        }
      }
      function toggleEdit(f) {
        if (editing && f !== true) flush();
        editing = typeof f === 'boolean' ? f : !editing;
        document.body.classList.toggle('quick-edit-active', editing);
        document.getElementById('tn-btn-quick-edit').classList.toggle('active', editing);
        render(idx);
      }
      function snapshot() {
        flush();
        const was = editing; if (was) toggleEdit(false);
        const clone = document.documentElement.cloneNode(true);
        clone.querySelector('#tn-player-stage').innerHTML = '';
        const out = '<!DOCTYPE html>\\n' + clone.outerHTML;
        if (was) toggleEdit(true);
        return out;
      }
      async function shareDeck() {
        const html = snapshot();
        const fn = '${esc(filename)}';
        try {
          const file = new File([html], fn, { type: 'text/html' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: deckData.deckTitle || 'TN Slides' });
            return;
          }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        a.download = fn; a.click();
      }
      mobT.addEventListener('input', () => { deckData.slides[idx].title = mobT.value; const h = stage.querySelector('.slide-title,h1,h2'); if (h) h.innerText = mobT.value; flush(); });
      mobB.addEventListener('input', () => { deckData.slides[idx].body = mobB.value; flush(); });
      mobN.addEventListener('input', () => { deckData.slides[idx].notes = mobN.value; notesTa.value = mobN.value; flush(); });
      document.getElementById('tn-btn-prev').onclick = () => { flush(); render(idx - 1); };
      document.getElementById('tn-btn-next').onclick = () => { flush(); render(idx + 1); };
      document.getElementById('tn-btn-notes').onclick = () => notesDrawer.classList.toggle('open');
      document.getElementById('tn-btn-close-notes').onclick = () => notesDrawer.classList.remove('open');
      document.getElementById('tn-btn-quick-edit').onclick = () => toggleEdit();
      document.getElementById('tn-btn-save-copy').onclick = shareDeck;
      document.getElementById('tn-btn-share').onclick = shareDeck;
      let tx = 0;
      document.getElementById('tn-deck-player').addEventListener('touchstart', e => { if (e.touches.length === 1) tx = e.touches[0].clientX; }, { passive: true });
      document.getElementById('tn-deck-player').addEventListener('touchend', e => {
        if (editing || !e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 45) render(idx + (dx < 0 ? 1 : -1));
      }, { passive: true });
      document.addEventListener('keydown', e => {
        if (e.target && (e.target.isContentEditable || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
        if (e.key === 'ArrowRight' || e.key === ' ') render(idx + 1);
        else if (e.key === 'ArrowLeft') render(idx - 1);
        else if (e.key.toLowerCase() === 'e') toggleEdit();
        else if (e.key.toLowerCase() === 'n') notesDrawer.classList.toggle('open');
      });
      window.addEventListener('resize', scale);
      scale(); render(0);
    })();
  </script>
</body>
</html>`;
}

async function buildPptxDeck(deck, outPath) {
  let PptxGenJS;
  try {
    PptxGenJS = require('pptxgenjs');
  } catch {
    throw new Error('pptxgenjs is not installed. Run "npm install" inside tn-slides-skill/ to enable .pptx export.');
  }

  const themeId = deck.theme && THEMES[deck.theme] ? deck.theme : 'theme-dept-blue-banner';
  const t = THEMES[themeId];
  const pptx = new PptxGenJS();
  pptx.layout = deck.aspectRatio === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9';
  pptx.title = deck.deckTitle || 'TN Slides Presentation';

  for (const s of deck.slides || []) {
    const slide = pptx.addSlide();
    const isCover = s.layout === 'layout-cover-blue-banner' || s.layout === 'layout-section-break' || s.layout === 'layout-title-hero';
    slide.background = { color: (isCover ? t.coverBg : t.bg).replace('#', '') };

    const lines = splitLines(s.body);
    const textColor = (isCover ? t.coverText : t.text).replace('#', '');
    const primaryHex = t.primary.replace('#', '');
    const accentHex = t.accent.replace('#', '');

    // Strict Reading Order: 1. Kicker -> 2. Title -> 3. Body/Cards/Table -> 4. Image (with altText) -> 5. Citation
    if (s.kicker) {
      slide.addText(s.kicker.toUpperCase(), {
        x: 0.6, y: 0.4, w: 8.8, h: 0.35,
        fontSize: 11, bold: true, color: isCover ? t.gold.replace('#', '') : accentHex,
        fontFace: 'Open Sans',
      });
    }

    slide.addText(s.title || '', {
      x: 0.6, y: isCover ? 1.5 : 0.78, w: 8.8, h: 0.85,
      fontSize: isCover ? 34 : 24, bold: true,
      color: isCover ? t.coverText.replace('#', '') : primaryHex,
      fontFace: 'Roboto Slab',
    });

    const hasMedia = Boolean(s.mediaUrl);
    const contentW = hasMedia ? 4.8 : 8.8;

    if (s.layout === 'layout-stat-callout') {
      slide.addText(String(s.statNumber || s.title || ''), {
        x: 0.6, y: 1.8, w: 8.8, h: 1.4, fontSize: 60, bold: true, color: accentHex, fontFace: 'Roboto Slab',
      });
      if (s.statLabel) {
        slide.addText(s.statLabel, { x: 0.6, y: 3.2, w: 8.8, h: 0.5, fontSize: 18, bold: true, color: textColor });
      }
    } else if (s.layout === 'layout-quote') {
      slide.addText(`“${s.quote || lines.join(' ')}”`, {
        x: 0.9, y: 1.8, w: 8.2, h: 1.8, fontSize: 22, italic: true, color: textColor, fontFace: 'Roboto Slab',
      });
      if (s.quoteAuthor) {
        slide.addText(`— ${s.quoteAuthor}`, { x: 0.9, y: 3.7, w: 8.2, h: 0.4, fontSize: 14, bold: true, color: t.muted.replace('#', '') });
      }
    } else if (s.layout === 'layout-data-table' && Array.isArray(s.tableRows)) {
      const tblRows = [];
      if (Array.isArray(s.tableHeaders) && s.tableHeaders.length) {
        tblRows.push(s.tableHeaders.map((h) => ({ text: String(h), options: { bold: true, fill: primaryHex, color: 'FFFFFF' } })));
      }
      for (const r of s.tableRows) {
        tblRows.push(r.map((c) => ({ text: String(c), options: { color: textColor } })));
      }
      if (tblRows.length) {
        slide.addTable(tblRows, { x: 0.6, y: 1.75, w: 8.8, fontSize: 12, border: { pt: 1, color: 'CBD5E1' } });
      }
    } else if (lines.length) {
      slide.addText(
        lines.map((l) => ({ text: l, options: { bullet: !isCover, breakLine: true } })),
        {
          x: 0.6, y: isCover ? 2.55 : 1.75, w: contentW, h: 3.1,
          fontSize: isCover ? 16 : 15, color: textColor, fontFace: 'Open Sans', valign: 'top',
        }
      );
    }

    if (hasMedia) {
      const imgOpts = {
        x: 5.7, y: 1.75, w: 3.7, h: 2.9,
        altText: s.isDecorative ? '' : (s.mediaAlt || ''),
      };
      if (s.mediaUrl.startsWith('data:')) imgOpts.data = s.mediaUrl;
      else imgOpts.path = s.mediaUrl;
      try {
        slide.addImage(imgOpts);
      } catch (e) {
        console.warn(`Warning: could not embed image on slide "${s.title}": ${e.message}`);
      }
    }

    if (s.citation) {
      slide.addText(s.citation, {
        x: 0.6, y: 5.1, w: 8.8, h: 0.3, fontSize: 10, color: t.muted.replace('#', ''),
      });
    }

    if (s.notes) {
      slide.addNotes(s.notes);
    }
  }

  await pptx.writeFile({ fileName: outPath });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node build_deck.mjs <deck.json> [--out-dir ./output] [--format both|html|pptx]');
    process.exit(1);
  }
  const deckPath = path.resolve(args[0]);
  const outDirIdx = args.indexOf('--out-dir');
  const outDir = outDirIdx !== -1 && args[outDirIdx + 1] ? path.resolve(args[outDirIdx + 1]) : path.dirname(deckPath);
  const fmtIdx = args.indexOf('--format');
  const format = fmtIdx !== -1 && args[fmtIdx + 1] ? args[fmtIdx + 1].toLowerCase() : 'both';

  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
  const warnings = auditDeckAccessibility(deck);
  if (warnings.length) {
    console.warn('WCAG 2.1 Accessibility Warnings:\n' + warnings.map((w) => '  - ' + w).join('\n'));
  }

  fs.mkdirSync(outDir, { recursive: true });
  const baseName = slugify(deck.deckTitle);

  if (format === 'html' || format === 'both') {
    const htmlOut = path.join(outDir, `${baseName}.html`);
    fs.writeFileSync(htmlOut, buildHtmlDeck(deck), 'utf8');
    console.log(`Built HTML Smart-Deck: ${htmlOut}`);
  }

  if (format === 'pptx' || format === 'both') {
    const pptxOut = path.join(outDir, `${baseName}.pptx`);
    await buildPptxDeck(deck, pptxOut);
    console.log(`Built PowerPoint (.pptx): ${pptxOut}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
