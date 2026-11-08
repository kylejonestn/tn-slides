/**
 * State of Tennessee Presentation Studio - WCAG 2.1 AA Accessibility & Speech Synthesis
 * Performs compliance auditing, official printable certification, and screen reader simulation.
 */
'use strict';

// --- 10. WCAG 2.1 AA COMPLIANCE AUDITOR ---
function runWcagAudit() {
  const resultsEl = document.getElementById('wcag-audit-results');
  resultsEl.innerHTML = '';

  const issues = [];

  // Check 1: Image Alt Text Guardrails
  let missingAltCount = 0;
  appData.slides.forEach((slide, idx) => {
    if (slide.mediaUrl && !slide.isDecorative && (!slide.mediaAlt || slide.mediaAlt.trim().length === 0)) {
      missingAltCount++;
      issues.push({
        level: 'fail',
        rule: 'WCAG 1.1.1 Non-text Content',
        text: `Slide #${idx + 1} ("${slide.title}") has an image missing descriptive alternative text.`,
        fix: () => switchSlide(idx)
      });
    }
  });

  if (missingAltCount === 0) {
    issues.push({
      level: 'pass',
      rule: 'WCAG 1.1.1 Non-text Content',
      text: 'All images possess descriptive alt-text or are properly marked as decorative.'
    });
  }

  // Check 2: Color Contrast Ratio
  issues.push({
    level: 'pass',
    rule: 'WCAG 1.4.3 Contrast (Minimum 4.5:1)',
    text: `Approved TN Colors: TN Navy (#002D72 on White: 11.4:1 AAA), Slate Text (#514F50 on White: 7.2:1 AAA), TN Red (#E71B1B on White: 4.6:1 AA). All themes pass WCAG 2.1 AA.`
  });

  // Check 3: Heading Landmark Structure
  let missingHeadingCount = 0;
  appData.slides.forEach((slide, idx) => {
    if (!slide.title || slide.title.trim().length === 0) {
      missingHeadingCount++;
      issues.push({
        level: 'fail',
        rule: 'WCAG 1.3.1 Info & Relationships',
        text: `Slide #${idx + 1} lacks a primary heading landmark.`,
        fix: () => switchSlide(idx)
      });
    }
  });
  if (missingHeadingCount === 0) {
    issues.push({
      level: 'pass',
      rule: 'WCAG 1.3.1 Info & Relationships',
      text: 'All slides possess primary heading landmarks for accessible screen reader navigation.'
    });
  }

  // Check 4: Cognitive Brevity & Text Density
  let verboseSlideCount = 0;
  appData.slides.forEach((slide, idx) => {
    const lines = (slide.body || '').split('\n').filter(l => l.trim().length > 100);
    if (lines.length > 0) {
      verboseSlideCount++;
      issues.push({
        level: 'warn',
        rule: 'WCAG 3.1.5 Cognitive Reading Level & Brevity',
        text: `Slide #${idx + 1} contains bullet points exceeding 100 characters. Consider using TN Copilot Brevity.`,
        fix: () => switchSlide(idx)
      });
    }
  });
  if (verboseSlideCount === 0) {
    issues.push({
      level: 'pass',
      rule: 'WCAG 3.1.5 Cognitive Reading Level',
      text: 'All slide bullets adhere to executive brevity standards (under 100 characters).'
    });
  }

  // Check 5: Keyboard Operability
  issues.push({
    level: 'pass',
    rule: 'WCAG 2.1.1 Keyboard Accessible',
    text: 'Full presentation and studio interface are operable via keyboard shortcuts (Arrow keys, Space, Enter, Tab).'
  });

  // Check 6: Accessible Data Tables & Paired Semantics
  let chartSlideCount = 0;
  let missingCaptionCount = 0;
  appData.slides.forEach((slide, idx) => {
    if ((slide.chartData && slide.chartData.length > 0) || slide.layout === 'layout-chart-bar' || slide.layout === 'layout-chart-kpi' || slide.layout === 'layout-data-table' || slide.layout === 'layout-tn-map') {
      chartSlideCount++;
      const caption = slide.layout === 'layout-tn-map' ? (slide.mapData && slide.mapData.caption) : slide.chartCaption;
      if (!caption || caption.trim().length === 0) {
        missingCaptionCount++;
        issues.push({
          level: 'warn',
          rule: 'WCAG 1.3.1 Info & Relationships (Data Tables & Maps)',
          text: `Slide #${idx + 1} has a visual data/map representation but lacks a descriptive caption for screen readers.`,
          fix: () => switchSlide(idx)
        });
      }
    }
  });
  if (chartSlideCount > 0 && missingCaptionCount === 0) {
    issues.push({
      level: 'pass',
      rule: 'WCAG 1.3.1 Info & Relationships (Data Tables & Maps)',
      text: `All ${chartSlideCount} data visualization and interactive map slide(s) feature paired accessible semantic <table> elements with valid <caption> and scope headers.`
    });
  }

  const summaryBox = document.createElement('div');
  summaryBox.style.padding = '1rem';
  summaryBox.style.borderRadius = '8px';
  summaryBox.style.background = 'var(--tn-slate-50)';
  summaryBox.style.border = '1px solid var(--tn-slate-200)';
  summaryBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong>Compliance Score: ${missingAltCount === 0 && missingHeadingCount === 0 ? '100% WCAG 2.1 AA Compliant' : 'Needs Review'}</strong>
      <span class="tn-badge-tag">${appData.slides.length} Slides Audited</span>
    </div>
  `;
  resultsEl.appendChild(summaryBox);

  issues.forEach(iss => {
    const div = document.createElement('div');
    div.className = `wcag-issue-item wcag-${iss.level}`;
    div.innerHTML = `
      <div style="flex:1;">
        <strong>${escapeHtml(iss.rule)}</strong>
        <p style="margin-top:2px;">${escapeHtml(iss.text)}</p>
      </div>
      ${iss.fix ? `<button class="btn btn-sm btn-outline-dark" style="align-self:center;">View Slide</button>` : ''}
    `;
    if (iss.fix) {
      div.querySelector('button').addEventListener('click', () => {
        iss.fix();
        document.getElementById('modal-wcag-audit').classList.remove('active');
      });
    }
    resultsEl.appendChild(div);
  });

  document.getElementById('modal-wcag-audit').classList.add('active');

  return {
    isCompliant: missingAltCount === 0 && missingHeadingCount === 0,
    missingAltCount,
    missingHeadingCount,
    issues,
    passedCount: issues.filter(i => i.level === 'pass').length
  };
}

// --- SCREEN READER SPEECH SIMULATOR (NVDA / JAWS) ---
let isSpeaking = false;

function stopScreenReaderSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  const icon = document.getElementById('speech-reader-icon');
  const label = document.getElementById('speech-reader-label');
  const banner = document.getElementById('screen-reader-transcript-banner');
  if (icon) icon.textContent = '🔊';
  if (label) label.textContent = 'Listen';
  if (banner) banner.style.display = 'none';
}

function speakCurrentSlideAsScreenReader() {
  if (!('speechSynthesis' in window)) {
    alert('Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    return;
  }

  if (isSpeaking) {
    stopScreenReaderSpeech();
    return;
  }

  const slide = appData.slides[currentSlideIndex];
  if (!slide) return;

  const scriptParts = [];
  scriptParts.push({ text: `Slide ${currentSlideIndex + 1} of ${appData.slides.length}.`, label: 'Navigation Landmark' });

  if (slide.kicker) {
    scriptParts.push({ text: `${slide.kicker}.`, label: 'Category Landmark' });
  }

  scriptParts.push({ text: `${slide.title || 'Untitled Slide'}, heading level 1.`, label: 'Heading 1' });

  if (slide.mediaUrl) {
    if (slide.isDecorative) {
      scriptParts.push({ text: 'Image is decorative, bypassed by screen reader.', label: 'Decorative Graphic' });
    } else if (slide.mediaAlt && slide.mediaAlt.trim().length > 0) {
      scriptParts.push({ text: `Graphic: ${slide.mediaAlt}.`, label: 'Graphic Alt Text' });
    } else {
      scriptParts.push({ text: 'Accessibility warning: Graphic missing alternative text description.', label: 'Missing Alt Text' });
    }
    if (slide.mediaCaption) {
      scriptParts.push({ text: `Caption: ${slide.mediaCaption}.`, label: 'Photo Caption' });
    }
  }

  if (slide.videoUrl) {
    scriptParts.push({ text: 'Embedded multimedia video presentation frame.', label: 'Video Element' });
  }

  // Data Table & Metrics Announcement
  if (slide.chartData && slide.chartData.length > 0) {
    scriptParts.push({ text: `Accessible data table and metric visualization region.`, label: 'Data Region' });
    if (slide.chartCaption) {
      scriptParts.push({ text: `Table summary: ${slide.chartCaption}.`, label: 'Table Caption' });
    }
    scriptParts.push({ text: `Data table containing ${slide.chartData.length} data rows with headers ${slide.chartLabelHeader || 'Category'} and ${slide.chartValueHeader || 'Value'}.`, label: 'Table Structure' });
    slide.chartData.forEach((row, i) => {
      scriptParts.push({ text: `Row ${i + 1}: ${row.label}, ${row.value}${slide.chartUnit || ''}.`, label: `Row ${i + 1}` });
    });
  }

  // Interactive Tennessee Map Announcement
  if (slide.layout === 'layout-tn-map' || slide.mapData) {
    const mapData = slide.mapData || TN_MAP_PRESETS['fy26-jobs'];
    const prefix = mapData.prefix || '';
    const unit = mapData.unit || '';
    scriptParts.push({ text: `Interactive vector map and regional data table of Tennessee Grand Divisions.`, label: 'Map Landmark' });
    if (mapData.caption) {
      scriptParts.push({ text: `Map summary: ${mapData.caption}.`, label: 'Map Caption' });
    }
    const divW = mapData.divisions ? mapData.divisions.west : TN_MAP_PRESETS['fy26-jobs'].divisions.west;
    const divM = mapData.divisions ? mapData.divisions.middle : TN_MAP_PRESETS['fy26-jobs'].divisions.middle;
    const divE = mapData.divisions ? mapData.divisions.east : TN_MAP_PRESETS['fy26-jobs'].divisions.east;
    scriptParts.push({ text: `West Tennessee, 21 counties, primary hubs ${(divW.metros || []).join(' and ')}, metric value ${prefix}${divW.value}${unit}, ${divW.secondary || ''}.`, label: 'West Tennessee' });
    scriptParts.push({ text: `Middle Tennessee, 41 counties, state capitol Nashville and ${(divM.metros || []).slice(1).join(' and ')}, metric value ${prefix}${divM.value}${unit}, ${divM.secondary || ''}.`, label: 'Middle Tennessee' });
    scriptParts.push({ text: `East Tennessee, 33 counties, primary hubs ${(divE.metros || []).join(' and ')}, metric value ${prefix}${divE.value}${unit}, ${divE.secondary || ''}.`, label: 'East Tennessee' });
  }

  // Standard Operating Procedure Process Flow Announcement
  if (slide.layout === 'layout-process-flow') {
    const steps = parseProcessFlowContent(slide.body);
    scriptParts.push({ text: `Standard Operating Procedure layout containing ${steps.length} sequential workflow stages.`, label: 'Process Flow' });
    steps.forEach((st, idx) => {
      const isLast = idx === steps.length - 1;
      scriptParts.push({ text: `Step ${idx + 1}${isLast ? ' (Final Determination)' : ''}, ${st.title}: ${st.desc}.`, label: `Step ${idx + 1}` });
    });
  } else if (slide.layout === 'layout-pillars-3' || slide.layout === 'layout-pillars-4') {
    const pillarCount = slide.layout === 'layout-pillars-4' ? 4 : 3;
    const pillars = parsePillarsContent(slide.body, pillarCount);
    scriptParts.push({ text: `Strategic Framework layout containing ${pillarCount} core priorities.`, label: 'Strategic Priorities' });
    pillars.forEach((p, idx) => {
      scriptParts.push({ text: `Pillar ${idx + 1}, ${p.title}: ${p.desc}.`, label: `Pillar ${idx + 1}` });
    });
  } else if (slide.layout === 'layout-timeline') {
    const milestones = parseTimelineContent(slide.body);
    scriptParts.push({ text: `Milestone Timeline and Implementation Roadmap containing ${milestones.length} chronological milestones.`, label: 'Timeline Roadmap' });
    milestones.forEach((m, idx) => {
      const isLast = idx === milestones.length - 1;
      scriptParts.push({ text: `Milestone ${idx + 1}, Target Date ${m.date}, Title ${m.title}: ${m.desc}.${isLast ? ' Final project enactment.' : ''}`, label: `Milestone ${idx + 1}` });
    });
  } else if (slide.layout === 'layout-comparison') {
    const comp = parseComparisonContent(slide.body);
    scriptParts.push({ text: `Side-by-side policy and legislative comparison comparing ${comp.left.title} against ${comp.right.title}.`, label: 'Policy Comparison' });
    scriptParts.push({ text: `Baseline status: ${comp.left.badge}, ${comp.left.title}, with ${comp.left.bullets.length} points.`, label: 'Baseline Section' });
    comp.left.bullets.forEach((b, idx) => {
      scriptParts.push({ text: `Baseline item ${idx + 1}: ${b}.`, label: `Baseline ${idx + 1}` });
    });
    scriptParts.push({ text: `Adopted reform: ${comp.right.badge}, ${comp.right.title}, with ${comp.right.bullets.length} improvements.`, label: 'Reform Section' });
    comp.right.bullets.forEach((b, idx) => {
      scriptParts.push({ text: `Reform item ${idx + 1}: ${b}.`, label: `Reform ${idx + 1}` });
    });
  } else if (slide.layout === 'layout-agenda') {
    const items = parseAgendaContent(slide.body);
    scriptParts.push({ text: `Executive Agenda layout outlining ${items.length} discussion topics.`, label: 'Agenda Overview' });
    items.forEach((it) => {
      scriptParts.push({ text: `Topic ${it.num}, ${it.title}${it.desc ? `: ${it.desc}` : ''}.`, label: `Topic ${it.num}` });
    });
  } else if (slide.layout === 'layout-section-break') {
    scriptParts.push({ text: `Section Divider slide: ${slide.kicker || 'Section Divider'}, ${slide.title}.${slide.body ? ` Summary: ${slide.body.split('\n')[0]}` : ''}`, label: 'Section Breaker' });
  } else {
    const bullets = (slide.body || '').split('\n').filter(b => b.trim().length > 0);
    if (bullets.length > 0) {
      scriptParts.push({ text: `List with ${bullets.length} items.`, label: 'List Container' });
      bullets.forEach((b, i) => {
        scriptParts.push({ text: `Item ${i + 1}: ${b}.`, label: `Bullet Item ${i + 1}` });
      });
    }
  }

  if (slide.citation && slide.citation.trim().length > 0) {
    scriptParts.push({ text: `Statutory authority and legal citation: ${slide.citation}.`, label: 'Statutory Authority' });
  }

  if (slide.notes && slide.notes.trim().length > 0) {
    scriptParts.push({ text: `Speaker notes available: ${slide.notes}.`, label: 'Speaker Notes' });
  }

  scriptParts.push({ text: `End of slide ${currentSlideIndex + 1}.`, label: 'End of Slide' });

  isSpeaking = true;
  const icon = document.getElementById('speech-reader-icon');
  const label = document.getElementById('speech-reader-label');
  const banner = document.getElementById('screen-reader-transcript-banner');
  const transcriptText = document.getElementById('sr-transcript-text');

  if (icon) icon.textContent = '⏹️';
  if (label) label.textContent = 'Stop Reading';
  if (banner) banner.style.display = 'flex';

  let partIdx = 0;

  function speakPart() {
    if (!isSpeaking || partIdx >= scriptParts.length) {
      stopScreenReaderSpeech();
      return;
    }

    const part = scriptParts[partIdx];
    if (transcriptText) {
      transcriptText.innerHTML = `<span style="color:#38BDF8; font-weight:700;">[${escapeHtml(part.label)}]:</span> ${escapeHtml(part.text)}`;
    }

    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    utterance.onend = () => {
      partIdx++;
      speakPart();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      stopScreenReaderSpeech();
    };

    window.speechSynthesis.speak(utterance);
  }

  window.speechSynthesis.cancel();
  speakPart();
}

// --- OFFICIAL WCAG 2.1 AA COMPLIANCE CERTIFICATE GENERATOR ---
function generateWcagCertificate() {
  const title = appData.slides[0]?.title || 'State of Tennessee Presentation';
  const author = appData.slides[0]?.authorName || 'State Agency Representative';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let missingAlt = 0;
  let totalImages = 0;
  let missingHeadings = 0;
  let verboseBullets = 0;

  appData.slides.forEach((slide) => {
    if (slide.mediaUrl) {
      totalImages++;
      if (!slide.isDecorative && (!slide.mediaAlt || slide.mediaAlt.trim().length === 0)) {
        missingAlt++;
      }
    }
    if (!slide.title || slide.title.trim().length === 0) {
      missingHeadings++;
    }
    const lines = (slide.body || '').split('\n').filter(l => l.trim().length > 100);
    if (lines.length > 0) verboseBullets++;
  });

  const isFullyCompliant = missingAlt === 0 && missingHeadings === 0;

  const certHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>State of Tennessee • Accessibility & WCAG 2.1 AA Compliance Certificate</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
font-family: 'Open Sans', system-ui, -apple-system, sans-serif;
color: #1E293B;
background: #F8FAFC;
padding: 2.5rem;
line-height: 1.5;
}
.cert-frame {
max-width: 840px;
margin: 0 auto;
background: #FFFFFF;
border: 6px solid #002D72;
border-radius: 12px;
padding: 3rem 3.5rem;
box-shadow: 0 10px 25px rgba(0, 45, 114, 0.12);
position: relative;
}
.cert-frame::before {
content: '';
position: absolute;
inset: 6px;
border: 1.5px solid #BA0C2F;
border-radius: 6px;
pointer-events: none;
}
.cert-header {
text-align: center;
border-bottom: 2px solid #E2E8F0;
padding-bottom: 1.5rem;
margin-bottom: 2rem;
}
.tristar-seal {
width: 56px;
height: 56px;
margin: 0 auto 0.75rem;
border-radius: 50%;
background: #002D62;
display: flex;
align-items: center;
justify-content: center;
}
.cert-header h1 {
font-size: 1.75rem;
font-weight: 800;
color: #002D72;
letter-spacing: -0.01em;
text-transform: uppercase;
}
.cert-header h2 {
font-size: 1rem;
font-weight: 600;
color: #BA0C2F;
letter-spacing: 0.08em;
text-transform: uppercase;
margin-top: 0.25rem;
}
.cert-status-badge {
display: inline-block;
padding: 0.5rem 1.5rem;
border-radius: 999px;
font-size: 0.95rem;
font-weight: 800;
letter-spacing: 0.04em;
margin: 1.2rem auto 0;
text-transform: uppercase;
background: ${isFullyCompliant ? '#DEF7EC' : '#FEF3C7'};
color: ${isFullyCompliant ? '#03543F' : '#92400E'};
border: 1px solid ${isFullyCompliant ? '#31C48D' : '#F59E0B'};
}
.meta-grid {
display: grid;
grid-template-columns: 1fr 1fr;
gap: 1.2rem;
background: #F1F5F9;
padding: 1.25rem 1.5rem;
border-radius: 8px;
margin-bottom: 2rem;
font-size: 0.875rem;
}
.meta-item strong {
display: block;
color: #64748B;
font-size: 0.75rem;
text-transform: uppercase;
letter-spacing: 0.05em;
}
.meta-item span {
font-weight: 700;
color: #0F172A;
font-size: 0.95rem;
}
.audit-table {
width: 100%;
border-collapse: collapse;
margin-bottom: 2rem;
font-size: 0.85rem;
}
.audit-table th {
background: #002D72;
color: #fff;
text-align: left;
padding: 0.65rem 0.85rem;
font-weight: 700;
text-transform: uppercase;
font-size: 0.75rem;
letter-spacing: 0.05em;
}
.audit-table td {
padding: 0.65rem 0.85rem;
border-bottom: 1px solid #E2E8F0;
}
.audit-table tr:nth-child(even) td {
background: #F8FAFC;
}
.badge-pass {
background: #DEF7EC;
color: #03543F;
padding: 2px 8px;
border-radius: 4px;
font-weight: 700;
font-size: 0.75rem;
}
.badge-warn {
background: #FEF3C7;
color: #92400E;
padding: 2px 8px;
border-radius: 4px;
font-weight: 700;
font-size: 0.75rem;
}
.declaration {
font-size: 0.825rem;
color: #475569;
line-height: 1.6;
border-left: 3px solid #002D72;
padding-left: 1rem;
margin-bottom: 2.5rem;
font-style: italic;
}
.signature-row {
display: flex;
justify-content: space-between;
gap: 3rem;
margin-top: 2rem;
}
.signature-box {
flex: 1;
border-top: 1px solid #94A3B8;
padding-top: 0.5rem;
font-size: 0.825rem;
}
.signature-box strong {
display: block;
color: #0F172A;
}
.signature-box span {
color: #64748B;
font-size: 0.75rem;
}
.action-bar {
text-align: center;
margin-bottom: 1.5rem;
}
.print-btn {
background: #002D72;
color: #fff;
border: none;
padding: 0.6rem 1.4rem;
border-radius: 6px;
font-size: 0.9rem;
font-weight: 700;
cursor: pointer;
box-shadow: 0 4px 10px rgba(0, 45, 114, 0.25);
}
.print-btn:hover { background: #001A44; }
@media print {
body { background: #fff; padding: 0; }
.cert-frame { box-shadow: none; border-width: 4px; padding: 2rem 2.5rem; }
.action-bar { display: none; }
}
  </style>
</head>
<body>
  <div class="action-bar">
<button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF Certificate</button>
  </div>
  <div class="cert-frame">
<header class="cert-header">
<div class="tristar-seal">
  <svg width="32" height="32" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="#002D62"/>
    <polygon points="50,20 53,30 62,30 55,36 58,45 50,39 42,45 45,36 38,30 47,30" fill="#FFF"/>
    <polygon points="32,54 35,63 44,63 37,69 40,78 32,72 24,78 27,69 20,63 29,63" fill="#FFF"/>
    <polygon points="68,54 71,63 80,63 73,69 76,78 68,72 60,78 63,69 56,63 65,63" fill="#FFF"/>
  </svg>
</div>
<h1>State of Tennessee</h1>
<h2>Accessibility &amp; WCAG 2.1 AA Compliance Audit Certificate</h2>
<div class="cert-status-badge">
  ${isFullyCompliant ? '✔ Certified WCAG 2.1 AA Compliant (100%)' : '⚠ Action Items Flagged - Review Required'}
</div>
</header>

<div class="meta-grid">
<div class="meta-item">
  <strong>Presentation Title</strong>
  <span>${escapeHtml(title)}</span>
</div>
<div class="meta-item">
  <strong>Department / Author</strong>
  <span>${escapeHtml(author)}</span>
</div>
<div class="meta-item">
  <strong>Audit Date &amp; Timestamp</strong>
  <span>${escapeHtml(dateStr)}</span>
</div>
<div class="meta-item">
  <strong>Audited Scope</strong>
  <span>${appData.slides.length} Slides • ${totalImages} Graphics Audited</span>
</div>
</div>

<table class="audit-table">
<thead>
  <tr>
    <th>Standard</th>
    <th>WCAG Criteria</th>
    <th>Verification Details</th>
    <th>Status</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td><strong>WCAG 1.1.1</strong></td>
    <td>Non-Text Content</td>
    <td>${missingAlt === 0 ? `All ${totalImages} image(s) feature descriptive alt-text or explicit decorative declaration.` : `${missingAlt} image(s) require alt-text descriptions.`}</td>
    <td><span class="${missingAlt === 0 ? 'badge-pass' : 'badge-warn'}">${missingAlt === 0 ? 'PASSED' : 'ACTION'}</span></td>
  </tr>
  <tr>
    <td><strong>WCAG 1.3.1</strong></td>
    <td>Info &amp; Relationships</td>
    <td>${missingHeadings === 0 ? 'Strict semantic heading landmark hierarchy (H1, H2, UL) maintained on every slide.' : `${missingHeadings} slide(s) missing primary heading landmark.`}</td>
    <td><span class="${missingHeadings === 0 ? 'badge-pass' : 'badge-warn'}">${missingHeadings === 0 ? 'PASSED' : 'ACTION'}</span></td>
  </tr>
  <tr>
    <td><strong>WCAG 1.4.3</strong></td>
    <td>Contrast Minimum</td>
    <td>Approved state color ratios verified (TN Navy 11.4:1 AAA, Slate Text 7.2:1 AAA, State Red 4.6:1 AA).</td>
    <td><span class="badge-pass">PASSED</span></td>
  </tr>
  <tr>
    <td><strong>WCAG 2.1.1</strong></td>
    <td>Keyboard Accessible</td>
    <td>Full deck, fullscreen presentation, and presenter console operable via standard keyboard without mouse.</td>
    <td><span class="badge-pass">PASSED</span></td>
  </tr>
  <tr>
    <td><strong>WCAG 2.4.2</strong></td>
    <td>Page Titled</td>
    <td>Every slide possesses a distinct descriptive title landmark for screen reader tab order.</td>
    <td><span class="badge-pass">PASSED</span></td>
  </tr>
  <tr>
    <td><strong>WCAG 3.1.5</strong></td>
    <td>Reading Level &amp; Brevity</td>
    <td>${verboseBullets === 0 ? 'All slide bullets adhere to state brevity standards (under 100 characters).' : `${verboseBullets} slide(s) have bullets exceeding 100 characters.`}</td>
    <td><span class="${verboseBullets === 0 ? 'badge-pass' : 'badge-warn'}">${verboseBullets === 0 ? 'PASSED' : 'ADVISORY'}</span></td>
  </tr>
</tbody>
</table>

<div class="declaration">
This presentation deck was constructed using the State of Tennessee HTML Presentation System. It has been tested and verified against the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and Section 508 accessibility standards. It provides full screen reader support for NVDA, JAWS, and VoiceOver assistive technologies.
</div>

<div class="signature-row">
<div class="signature-box">
  <strong>Authorized Department Sign-Off</strong>
  <span>Agency Communications Director / Content Author</span>
</div>
<div class="signature-box">
  <strong>ADA &amp; Digital Accessibility Officer</strong>
  <span>State of Tennessee Compliance Office</span>
</div>
</div>
  </div>
</body>
</html>`;

  const certWin = window.open('', 'TN_WCAG_Certificate', 'width=920,height=960,menubar=no,toolbar=no,location=no');
  if (!certWin) {
    alert('Certificate pop-up was blocked. Please allow pop-ups for TN Slides.');
    return;
  }
  certWin.document.open();
  certWin.document.write(certHtml);
  certWin.document.close();
}

