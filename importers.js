/**
 * State of Tennessee Presentation Studio - Ingestion & Revision Engines
 * Smart outline drafting, Excel/CSV spreadsheet charts, PowerPoint ingestion, and local backups.
 */
'use strict';

// --- 11.5 SMART OUTLINE & AGENDA IMPORTER (WYSIWYG & Text Modes) ---
let outlineEditorMode = 'wysiwyg'; // 'wysiwyg' | 'markdown'

const SAMPLE_TN_AGENDA_HTML = `<h1>State of Tennessee • Executive Briefing</h1>
<p><em>Bureau of Workers' Compensation &amp; Workforce Initiatives<br>Division of Claims, Safety &amp; Return-to-Work Programs</em></p>

<h2>1. Executive Summary &amp; Strategic Milestones</h2>
<ul>
  <li>18% reduction in dispute cycle resolution time across all 95 counties</li>
  <li>Expansion of digital claims portal statewide with real-time tracking</li>
  <li>Enhanced Medical Navigator program connecting injured workers directly with specialists</li>
</ul>
<p><strong>Notes:</strong> Emphasize customer satisfaction reached 96.4% in the latest ombudsman survey.</p>

<h2>2. Key Performance Indicators &amp; Fiscal Strength</h2>
<ul>
  <li>Zero backlog in mandatory administrative mediations</li>
  <li>Maintained lowest state debt per capita and top-tier AAA bond rating</li>
  <li>100% compliance with revised Tennessee digital accessibility mandates</li>
</ul>
<p><strong>Notes:</strong> Highlight inter-agency collaboration between Labor and Treasury.</p>

<h2>3. Leadership Perspective &amp; Citizen Commitment</h2>
<blockquote>"Our singular mission is to ensure every injured Tennessee worker receives prompt, compassionate care and an expedited return to productive employment."</blockquote>
<p><em>— Administrator Troy Haley, Bureau of Workers' Compensation</em></p>

<h2>4. Statewide Rollout &amp; Public Town Halls</h2>
<ol>
  <li>Phase 1: Regional briefing town halls commencing in Nashville, Knoxville, and Memphis</li>
  <li>Phase 2: Final publication of proposed administrative rule revisions in the Tennessee Register</li>
  <li>Phase 3: Public community feedback channels launched on tn.gov/workforce</li>
</ol>
<p><strong>Notes:</strong> Target high attendance from local chamber representatives.</p>

<h2>THANK YOU</h2>
<p>Tennessee Department of Labor &amp; Workforce Development<br>Nashville, TN • tn.gov/workforce<br>Contact: communications@tn.gov • (615) 741-2211</p>
<p><strong>Notes:</strong> Conclude with Q&amp;A session for legislative committee members.</p>`;

const SAMPLE_TN_BLANK_HTML = `<h1>Briefing Title</h1>
<p>State of Tennessee • Project Overview &amp; Context</p>

<hr>

<h2>1. Strategic Priorities &amp; Purpose</h2>
<ul>
  <li>Primary agency objective and public mission</li>
  <li>Immediate target deliverables and community impact</li>
</ul>

<hr>

<h2>2. Key Deliverables &amp; Progress</h2>
<ul>
  <li>Operational performance milestones achieved</li>
  <li>Next legislative steps and community engagement</li>
</ul>

<hr>

<h2>3. Program Conclusion &amp; Next Steps</h2>
<ul>
  <li>Target completion date and accountability checkpoints</li>
  <li>Inter-agency coordination and citizen feedback</li>
</ul>`;

const SAMPLE_TN_AGENDA_MD = `# State of Tennessee • Executive Briefing
Bureau of Workers' Compensation & Workforce Initiatives
Division of Claims, Safety & Return-to-Work Programs

# 1. Executive Summary & Strategic Milestones
- 18% reduction in dispute cycle resolution time across all 95 counties
- Expansion of digital claims portal to all 95 Tennessee counties
- Enhanced Medical Navigator program connecting injured workers directly with specialists
Notes: Emphasize customer satisfaction reached 96.4% in the latest ombudsman survey.

# 2. Key Performance Indicators & Fiscal Strength
- Zero backlog in mandatory administrative mediations
- Maintained lowest state debt per capita and top-tier AAA bond rating
- 100% compliance with revised Tennessee digital accessibility mandates
Notes: Highlight inter-agency collaboration between Labor and Treasury.

# 3. Leadership Perspective & Citizen Commitment
> "Our singular mission is to ensure every injured Tennessee worker receives prompt, compassionate care and an expedited return to productive employment."
— Administrator Troy Haley, Bureau of Workers' Compensation

# 4. Statewide Rollout & Public Town Halls
1. Phase 1: Regional briefing town halls commencing in Nashville, Knoxville, and Memphis
2. Phase 2: Final publication of proposed administrative rule revisions in the Tennessee Register
3. Phase 3: Public community feedback channels launched on tn.gov/workforce
Notes: Target high attendance from local chamber representatives.

# THANK YOU
Tennessee Department of Labor & Workforce Development
Nashville, TN • tn.gov/workforce
Contact: communications@tn.gov • (615) 741-2211
Notes: Conclude with Q&A session for legislative committee members.`;

function execWysiwygCommand(command, value = null) {
  const editor = document.getElementById('outline-wysiwyg-editor');
  editor.focus();
  if (command === 'formatBlock') {
    document.execCommand('formatBlock', false, value);
  } else {
    document.execCommand(command, false, value);
  }
  updateOutlinePreview();
}

function wysiwygToMarkdown(html) {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  let md = '';

  Array.from(temp.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent.trim();
      if (txt) md += `${txt}\n\n`;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toUpperCase();
    const txt = node.textContent.trim();
    if (!txt && tag !== 'HR') return;

    if (tag === 'H1') {
      md += `# ${txt}\n\n`;
    } else if (tag === 'H2') {
      md += `## ${txt}\n\n`;
    } else if (tag === 'H3') {
      md += `### ${txt}\n\n`;
    } else if (tag === 'BLOCKQUOTE') {
      md += `> ${txt}\n\n`;
    } else if (tag === 'UL') {
      node.querySelectorAll('li').forEach(li => {
        md += `- ${li.textContent.trim()}\n`;
      });
      md += '\n';
    } else if (tag === 'OL') {
      node.querySelectorAll('li').forEach((li, i) => {
        md += `${i + 1}. ${li.textContent.trim()}\n`;
      });
      md += '\n';
    } else if (tag === 'HR') {
      md += `---\n\n`;
    } else {
      md += `${txt}\n\n`;
    }
  });

  return md.trim();
}

function markdownToWysiwyg(md) {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html += '</ul>'; inUl = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      closeLists();
      return;
    }

    if (line.startsWith('# ')) {
      closeLists();
      html += `<h1>${escapeHtml(line.slice(2))}</h1>`;
    } else if (line.startsWith('## ')) {
      closeLists();
      html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      closeLists();
      html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
    } else if (line.startsWith('> ')) {
      closeLists();
      html += `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
    } else if (/^(?:---|===|\*\*\*)$/.test(line)) {
      closeLists();
      html += `<hr>`;
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      if (inOl) closeLists();
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${escapeHtml(line.replace(/^[•\-\*]\s+/, ''))}</li>`;
    } else if (/^\d+[\.\)]\s+/.test(line)) {
      if (inUl) closeLists();
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${escapeHtml(line.replace(/^\d+[\.\)]\s+/, ''))}</li>`;
    } else {
      closeLists();
      html += `<p>${escapeHtml(line)}</p>`;
    }
  });

  closeLists();
  return html;
}

function setOutlineEditorMode(mode) {
  outlineEditorMode = mode;
  const btnWysiwyg = document.getElementById('btn-mode-wysiwyg');
  const btnMarkdown = document.getElementById('btn-mode-markdown');
  const wysiwygContainer = document.getElementById('wysiwyg-container');
  const textInput = document.getElementById('outline-input-text');
  const wysiwygEditor = document.getElementById('outline-wysiwyg-editor');

  if (mode === 'wysiwyg') {
    btnWysiwyg.classList.add('active');
    btnMarkdown.classList.remove('active');
    wysiwygContainer.style.display = 'flex';
    textInput.style.display = 'none';

    if (textInput.value.trim() && !wysiwygEditor.innerHTML.trim()) {
      wysiwygEditor.innerText = textInput.value;
    }
  } else {
    btnMarkdown.classList.add('active');
    btnWysiwyg.classList.remove('active');
    wysiwygContainer.style.display = 'none';
    textInput.style.display = 'block';

    if (wysiwygEditor.innerText.trim() && !textInput.value.trim()) {
      textInput.value = wysiwygEditor.innerText;
    }
  }
  updateOutlinePreview();
}

function parseWysiwygDom(containerEl, autoLayouts = true, splitStrategy = 'smart') {
  if (!containerEl) return [];
  const textContent = containerEl.innerText || containerEl.textContent || '';
  if (!textContent.trim()) return [];

  const headings = containerEl.querySelectorAll('h1, h2');
  
  // Only fall back to plain-text parser if user entered unstyled text without any H1/H2 slide headers
  if (headings.length === 0) {
    return parseOutlineText(textContent, autoLayouts, splitStrategy);
  }

  const children = Array.from(containerEl.children);
  const slideChunks = [];
  let currentElements = [];

  const isSlideHeaderElement = (el, idx) => {
    const tag = el.tagName.toUpperCase();
    if (tag === 'H1' || tag === 'H2') return true;
    if (tag === 'HR') return true;
    const txt = el.textContent.trim();
    if (/^(?:---|\*\*\*)$/.test(txt)) return true;
    if (/^slide\s*\d+[:\-.]?/i.test(txt)) return true;
    return false;
  };

  children.forEach((el, idx) => {
    if (isSlideHeaderElement(el, idx)) {
      if (currentElements.length > 0) {
        slideChunks.push(currentElements);
        currentElements = [];
      }
      if (el.tagName.toUpperCase() !== 'HR') {
        currentElements.push(el);
      }
    } else {
      currentElements.push(el);
    }
  });

  if (currentElements.length > 0) {
    slideChunks.push(currentElements);
  }

  const slides = [];

  slideChunks.forEach((chunk, slideIdx) => {
    let title = '';
    let kicker = '';
    let citation = '';
    let bullets = [];
    let notes = [];
    let authorName = 'State of Tennessee';
    let authorDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let statNumber = '';
    let statLabel = '';
    let quoteText = '';
    let quoteAuthor = '';

    chunk.forEach((el) => {
      const tag = el.tagName.toUpperCase();
      const txt = el.textContent.trim();
      if (!txt && tag !== 'HR') return;

      // H1 or H2: Primary Slide Title
      if (!title && (tag === 'H1' || tag === 'H2')) {
        title = txt.replace(/^#{1,2}\s+/, '').replace(/^\d{1,2}[\.\)]\s+/, '').replace(/^slide\s*\d+[:\-.]?\s*/i, '').trim();
        return;
      }

      // H4 before or right after title: Kicker / Category Eyebrow
      if (tag === 'H4' && !kicker && bullets.length === 0) {
        kicker = txt.replace(/^#{1,4}\s+/, '').trim().toUpperCase();
        return;
      }

      // H3: Card Subheading or Pillar Title
      if (tag === 'H3') {
        const subTxt = txt.replace(/^#{1,3}\s+/, '').trim();
        if (!title) {
          title = subTxt;
        } else {
          bullets.push(`### ${subTxt}`);
        }
        return;
      }

      // H4 inside body: Minor Section Tag
      if (tag === 'H4') {
        const tagTxt = txt.replace(/^#{1,4}\s+/, '').trim();
        bullets.push(`#### ${tagTxt}`);
        return;
      }

      // Blockquote: Leadership Quote
      if (tag === 'BLOCKQUOTE') {
        quoteText = txt.replace(/^[“"']+|[”"']+$/g, '').trim();
        return;
      }

      // Unordered or Ordered Lists
      if (tag === 'UL' || tag === 'OL') {
        const isOl = tag === 'OL';
        const lis = el.querySelectorAll('li');
        lis.forEach((li, liIdx) => {
          const liTxt = li.textContent.trim();
          if (liTxt) {
            bullets.push(isOl ? `${liIdx + 1}. ${liTxt}` : `• ${liTxt}`);
          }
        });
        return;
      }

      // Statutory citation check
      if (/^(?:statutory|legal\s*citation|citation|t\.c\.a\.|tca):\s*/i.test(txt)) {
        citation = txt.replace(/^(?:statutory|legal\s*citation|citation|t\.c\.a\.|tca):\s*/i, '').trim();
        return;
      }

      if (/^t\.c\.a\.\s*§/i.test(txt)) {
        citation = txt;
        return;
      }

      // Speaker notes
      if (/^(?:notes?|speaker notes?):\s*/i.test(txt)) {
        notes.push(txt.replace(/^(?:notes?|speaker notes?):\s*/i, '').trim());
        return;
      }

      // Category / Kicker
      if (/^(?:category|kicker|project\s*id):\s*/i.test(txt)) {
        kicker = txt.replace(/^(?:category|kicker|project\s*id):\s*/i, '').trim().toUpperCase();
        return;
      }

      // Author / Presenter
      if (/^(?:author|presenter|by):\s*/i.test(txt)) {
        authorName = txt.replace(/^(?:author|presenter|by):\s*/i, '').trim();
        return;
      }

      if (/^(?:date):\s*/i.test(txt)) {
        authorDate = txt.replace(/^(?:date):\s*/i, '').trim();
        return;
      }

      if (quoteText && (/^[—–-]\s*/.test(txt) || el.querySelector('em') || el.style.fontStyle === 'italic')) {
        quoteAuthor = txt.replace(/^[—–-]\s*/, '').trim();
        return;
      }

      if (!title) {
        title = txt.replace(/^\d{1,2}[\.\)]\s+/, '').trim();
        return;
      }

      if (txt) {
        bullets.push(txt);
      }
    });

    if (!title && bullets.length > 0) {
      title = bullets.shift();
    }

    const allText = bullets.join(' ');
    const statMatch = allText.match(/\b(\$\d+(?:\.\d+)?[MBK]?|\d+(?:\.\d+)?%|AAA|100%|Zero)\b/i);
    if (statMatch) {
      statNumber = statMatch[1];
      statLabel = 'Key Performance Metric';
    }

    let layout = 'layout-split-50';
    let animationType = 'push';

    if (autoLayouts) {
      const lowerTitle = (title || '').toLowerCase();
      const bodyStr = bullets.join('\n');
      const lowerBody = bodyStr.toLowerCase();

      if (quoteText) {
        layout = 'layout-quote';
        animationType = 'fade';
      } else if (bodyStr.includes('===') || lowerBody.includes(' vs ') || lowerTitle.includes('comparison') || lowerTitle.includes('versus') || lowerTitle.includes('before and after') || lowerTitle.includes('baseline') || lowerTitle.includes('reform')) {
        layout = 'layout-comparison';
        animationType = 'push';
      } else if (/\[(?:q\d|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(bodyStr) || lowerTitle.includes('timeline') || lowerTitle.includes('roadmap') || lowerTitle.includes('schedule') || lowerTitle.includes('milestone') || lowerTitle.includes('phases') || lowerTitle.includes('quarterly')) {
        layout = 'layout-timeline';
        animationType = 'push';
      } else if (/step\s*0?\d/i.test(bodyStr) || lowerTitle.includes('process') || lowerTitle.includes('workflow') || lowerTitle.includes('procedure') || lowerTitle.includes('sop') || lowerTitle.includes('steps') || lowerTitle.includes('stages')) {
        layout = 'layout-process-flow';
        animationType = 'push';
      } else if (/pillar\s*0?\d/i.test(bodyStr) || lowerTitle.includes('pillar') || lowerTitle.includes('priorit') || lowerTitle.includes('framework') || lowerTitle.includes('core goal')) {
        layout = bullets.length === 4 ? 'layout-pillars-4' : 'layout-pillars-3';
        animationType = 'wiggle';
      } else if (slideIdx === 0 && (bullets.length <= 2 || lowerTitle.includes('welcome') || lowerTitle.includes('briefing') || lowerTitle.includes('presentation') || lowerTitle.includes('tennessee') || lowerTitle.includes('bureau'))) {
        layout = 'layout-cover-blue-banner';
        animationType = 'fade';
      } else if (lowerTitle.includes('thank') || lowerTitle.includes('conclusion') || lowerTitle.includes('questions') || lowerTitle.includes('adjourn')) {
        layout = 'layout-thank-you';
        animationType = 'fade';
      } else if (lowerTitle.includes('agenda') || lowerTitle.includes('table of contents') || lowerTitle.includes('meeting topics') || lowerTitle.includes('order of business')) {
        layout = 'layout-agenda';
        animationType = 'push';
      } else if (lowerTitle.includes('section') || lowerTitle.includes('part i') || lowerTitle.includes('part ii') || lowerTitle.includes('module') || lowerTitle.includes('divider')) {
        layout = 'layout-section-break';
        animationType = 'fade';
      } else if (bullets.length >= 3) {
        layout = (slideIdx % 2 === 0) ? 'layout-bento-3' : 'layout-split';
        animationType = 'wiggle';
      } else if (statNumber && bullets.length <= 2) {
        layout = 'layout-stat-callout';
        animationType = 'push';
      } else {
        layout = 'layout-split-50';
        animationType = 'push';
      }
    }

    let bodyContent = bullets.join('\n');
    if (quoteText) {
      bodyContent = quoteText;
      if (quoteAuthor) authorName = quoteAuthor;
    }

    slides.push({
      id: `slide-${Date.now()}-${slideIdx}`,
      layout: layout,
      kicker: kicker || 'STATE OF TENNESSEE',
      title: title || `Slide ${slideIdx + 1}`,
      citation: citation || '',
      body: bodyContent,
      authorName: authorName,
      authorDate: authorDate,
      statNumber: statNumber || 'AAA',
      statLabel: statLabel || 'State Target Metric',
      quote: quoteText || '',
      quoteAuthor: quoteAuthor || authorName || '',
      animate: true,
      animationType: animationType,
      mediaUrl: '',
      mediaAlt: '',
      isDecorative: true,
      imagePlacement: 'split-right',
      videoUrl: '',
      audioUrl: '',
      notes: notes.join(' ')
    });
  });

  return slides;
}

function parseOutlineText(rawText, autoLayouts = true, splitStrategy = 'smart') {
  if (!rawText || !rawText.trim()) return [];

  const cleanRaw = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanRaw.split('\n');

  // Step 1: Detect lines and calculate indent level
  const parsedLines = lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return { idx, raw: line, trimmed: '', indent: 0, isBlank: true };
    }

    // Calculate leading whitespace spaces (tab = 2 spaces)
    const matchIndent = line.match(/^(\s*)/);
    const leadingWhitespace = matchIndent ? matchIndent[1] : '';
    let indent = 0;
    for (let char of leadingWhitespace) {
      if (char === '\t') indent += 2;
      else if (char === ' ') indent += 1;
    }

    const isDivider = /^(?:-{3,}|\*{3,}|_{3,}|(?:\s*-\s*){3,}|(?:\s*\*\s*){3,})$/.test(trimmed);
    const isMarkdownHeading = /^#{1,6}\s+/.test(trimmed);
    const isExplicitSlide = /^slide\s*\d+[:\-.]?/i.test(trimmed);
    const isNumberedItem = /^\d{1,2}[\.\)]\s+/.test(trimmed);
    const isBulletItem = /^[•\-\*\+]\s+/.test(trimmed);
    const isQuote = /^>\s*/.test(trimmed);

    return {
      idx,
      raw: line,
      trimmed,
      indent,
      isBlank: false,
      isDivider,
      isMarkdownHeading,
      isExplicitSlide,
      isNumberedItem,
      isBulletItem,
      isQuote
    };
  });

  const nonBlank = parsedLines.filter(l => !l.isBlank);
  if (nonBlank.length === 0) return [];

  // Determine root indentation and document structure
  const rootIndent = Math.min(...nonBlank.map(l => l.indent));
  const hasMarkdownHeadings = nonBlank.some(l => l.isMarkdownHeading);
  const bulletCount = nonBlank.filter(l => l.isBulletItem || l.isNumberedItem).length;
  const isOutlineFormat = !hasMarkdownHeadings && (bulletCount >= 2 || splitStrategy !== 'headings-only');

  // Track slide chunks
  const slideChunks = [];
  let currentSlide = null;
  let activeSectionCategory = '';

  function startNewSlide(headerLine, category = '') {
    if (currentSlide && currentSlide.lines.length > 0) {
      slideChunks.push(currentSlide);
    }
    currentSlide = {
      headerLine,
      category: category || activeSectionCategory || 'STATE OF TENNESSEE',
      lines: headerLine ? [headerLine] : []
    };
  }

  for (let i = 0; i < nonBlank.length; i++) {
    const item = nonBlank[i];
    const prevItem = i > 0 ? nonBlank[i - 1] : null;

    if (item.isDivider) {
      if (currentSlide && currentSlide.lines.length > 0) {
        slideChunks.push(currentSlide);
        currentSlide = null;
      }
      continue;
    }

    let isBreak = false;
    let nextCategory = null;

    if (i === 0) {
      isBreak = true;
    } else if (item.isMarkdownHeading || item.isExplicitSlide) {
      isBreak = true;
    } else if (hasMarkdownHeadings || splitStrategy === 'headings-only') {
      // In markdown heading mode, only dividers or explicit headings break slides
      if (prevItem && prevItem.isDivider) {
        isBreak = true;
      }
    } else if (isOutlineFormat) {
      // In outline format mode:
      if (item.isNumberedItem && (splitStrategy === 'smart' || splitStrategy === 'numbered')) {
        isBreak = true;
      } else if (item.isBulletItem && item.indent <= rootIndent + 1) {
        isBreak = true;
        const boldMatch = item.trimmed.match(/^[•\-\*\+]\s+\*\*([^*]+)\*\*/);
        if (boldMatch) {
          nextCategory = boldMatch[1].trim();
        }
      } else if (!item.isBulletItem && !item.isQuote && item.indent <= rootIndent + 1 && item.trimmed.length < 50) {
        isBreak = true;
      } else if (prevItem && prevItem.isDivider) {
        isBreak = true;
      }
    }

    if (nextCategory) {
      activeSectionCategory = nextCategory;
    }

    if (isBreak || !currentSlide) {
      startNewSlide(item, activeSectionCategory);
    } else {
      currentSlide.lines.push(item);
    }
  }

  if (currentSlide && currentSlide.lines.length > 0) {
    slideChunks.push(currentSlide);
  }

  // Fallback if chunks are <= 1 and text has double blank lines
  if (slideChunks.length <= 1 && slideChunks[0] && slideChunks[0].lines.length > 6) {
    const doubleBlankChunks = cleanRaw.split(/\n\s*\n\s*\n/).filter(c => c.trim().length > 0);
    if (doubleBlankChunks.length > 1) {
      slideChunks.length = 0;
      doubleBlankChunks.forEach(chunk => {
        const cLines = chunk.split('\n').map(l => ({ trimmed: l.trim(), indent: 0, raw: l })).filter(l => l.trimmed);
        if (cLines.length) {
          slideChunks.push({ headerLine: cLines[0], category: 'STATE OF TENNESSEE', lines: cLines });
        }
      });
    }
  }

  // Convert slide chunks to Presentation Slide objects
  const slides = slideChunks.map((chunk, slideIdx) => {
    const chunkLines = chunk.lines;
    const headerItem = chunkLines[0];
    let rawTitle = headerItem ? headerItem.trimmed : `Slide ${slideIdx + 1}`;

    // Clean title string: remove bullets, numbers, markdown formatting
    let cleanTitle = rawTitle
      .replace(/^#{1,6}\s+/, '')
      .replace(/^slide\s*\d+[:\-.]?\s*/i, '')
      .replace(/^[•\-\*\+]\s+/, '')
      .trim();

    // Check if title has numbered prefix (e.g. "1. Set your Settings for Success")
    const numMatch = cleanTitle.match(/^(\d{1,2})[\.\)]\s+(.*)/);
    let slideTipNumber = '';
    if (numMatch) {
      slideTipNumber = numMatch[1];
      cleanTitle = numMatch[2].trim();
    }

    // Strip bold/italic/highlight markdown marks from title
    cleanTitle = cleanTitle.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/==([^=]+)==/g, '$1').trim();

    // Setup kicker
    let kicker = chunk.category || 'STATE OF TENNESSEE';
    if (slideTipNumber && kicker) {
      kicker = `${kicker.toUpperCase()} • TIP ${slideTipNumber}`;
    } else if (kicker) {
      kicker = kicker.toUpperCase();
    }

    let bullets = [];
    let notes = [];
    let quoteText = '';
    let quoteAuthor = '';
    let citation = '';

    for (let i = 1; i < chunkLines.length; i++) {
      const lineObj = chunkLines[i];
      let lineText = lineObj.trimmed;
      if (!lineText) continue;

      // Check for quote
      if (lineObj.isQuote || /^>\s*/.test(lineText)) {
        quoteText = lineText.replace(/^>\s*/, '').replace(/^[“"']+|[”"']+$/g, '').trim();
        continue;
      }

      // Check for speaker notes / cues
      if (/^(?:notes?|speaker notes?):\s*/i.test(lineText)) {
        notes.push(lineText.replace(/^(?:notes?|speaker notes?):\s*/i, '').trim());
        continue;
      }
      if (/^@\w+\s+can\s+(?:explain|demo|talk)/i.test(lineText) || /#needsattention/i.test(lineText)) {
        notes.push(`Speaker Cue: ${lineText}`);
        continue;
      }

      // Check for statutory citations
      if (/^(?:statutory|legal\s*citation|citation|t\.c\.a\.|tca):\s*/i.test(lineText)) {
        citation = lineText.replace(/^(?:statutory|legal\s*citation|citation|t\.c\.a\.|tca):\s*/i, '').trim();
        continue;
      }
      if (/^t\.c\.a\.\s*§/i.test(lineText)) {
        citation = lineText.trim();
        continue;
      }

      // Clean bullet line
      let cleanBullet = lineText.replace(/^[•\-\*\+]\s+/, '').trim();
      cleanBullet = cleanBullet.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/==([^=]+)==/g, '$1');

      if (cleanBullet && cleanBullet !== '-') {
        bullets.push(cleanBullet);
      }
    }

    // Layout detection
    let layout = 'layout-split-50';
    let animationType = 'push';
    const lowerTitle = cleanTitle.toLowerCase();
    const bodyStr = bullets.join('\n');
    const lowerBody = bodyStr.toLowerCase();

    if (autoLayouts) {
      if (slideIdx === 0 && (lowerTitle.includes('talk') || lowerTitle.includes('outline') || lowerTitle.includes('welcome') || lowerTitle.includes('briefing') || bullets.length <= 1)) {
        layout = 'layout-cover-blue-banner';
        animationType = 'fade';
      } else if (lowerTitle.includes('welcome')) {
        layout = 'layout-title-hero';
        animationType = 'fade';
      } else if (bullets.length === 3 && (lowerBody.includes('why') && lowerBody.includes('how') && lowerBody.includes('what'))) {
        layout = 'layout-pillars-3';
        animationType = 'wiggle';
      } else if (bullets.length >= 3 && bullets.length <= 4 && (slideIdx % 2 === 0)) {
        layout = 'layout-bento-3';
        animationType = 'wiggle';
      } else if (bullets.length > 4) {
        layout = 'layout-split';
        animationType = 'push';
      } else if (quoteText) {
        layout = 'layout-quote';
        animationType = 'fade';
      } else if (lowerTitle.includes('thank') || lowerTitle.includes('conclusion') || lowerTitle.includes('questions')) {
        layout = 'layout-thank-you';
        animationType = 'fade';
      }
    }

    let bodyContent = bullets.join('\n');
    if (quoteText) {
      bodyContent = quoteText;
    }

    return {
      id: `slide-${Date.now()}-${slideIdx}`,
      layout: layout,
      kicker: kicker,
      title: cleanTitle || `Slide ${slideIdx + 1}`,
      citation: citation || '',
      body: bodyContent,
      authorName: 'State of Tennessee',
      authorDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      statNumber: 'AAA',
      statLabel: 'State Target Metric',
      quote: quoteText || '',
      quoteAuthor: quoteAuthor || '',
      animate: true,
      animationType: animationType,
      mediaUrl: '',
      mediaAlt: '',
      isDecorative: true,
      imagePlacement: 'split-right',
      videoUrl: '',
      audioUrl: '',
      notes: notes.join(' • ')
    };
  });

  return slides;
}

function getParsedSlides(autoLayouts) {
  const strategy = document.getElementById('select-outline-split-strategy')?.value || 'smart';
  const textInput = document.getElementById('outline-input-text');
  const editor = document.getElementById('outline-wysiwyg-editor');

  if (outlineEditorMode === 'wysiwyg') {
    return parseWysiwygDom(editor, autoLayouts, strategy);
  } else {
    const text = textInput ? textInput.value : '';
    return parseOutlineText(text, autoLayouts, strategy);
  }
}

function updateOutlinePreview() {
  const autoLayouts = document.getElementById('chk-auto-layouts').checked;
  const parsed = getParsedSlides(autoLayouts);

  const countBadge = document.getElementById('detected-slide-count');
  const listEl = document.getElementById('detected-slides-list');
  const syncIndicator = document.getElementById('importer-sync-indicator');

  countBadge.textContent = parsed.length;
  if (syncIndicator) {
    syncIndicator.textContent = `● Live Synced (${parsed.length} slides)`;
    syncIndicator.style.color = '#059669';
  }

  if (parsed.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; color: var(--tn-slate-400); padding: 3rem 1rem; font-size: 0.85rem;">
        Type in the visual editor or click "Load Sample TN Agenda" to preview parsed slides here.
      </div>
    `;
    return;
  }

  let html = '';
  parsed.forEach((slide, idx) => {
    let badgeClass = 'detected-badge-split';
    let badgeLabel = '50/50 Split';
    if (slide.layout === 'layout-cover-blue-banner' || slide.layout === 'layout-cover-state-classic') {
      badgeClass = 'detected-badge-cover';
      badgeLabel = 'Cover Banner';
    } else if (slide.layout === 'layout-bento-3') {
      badgeClass = 'detected-badge-bento';
      badgeLabel = 'Bento Grid';
    } else if (slide.layout === 'layout-pillars-3' || slide.layout === 'layout-pillars-4') {
      badgeClass = 'detected-badge-bento';
      badgeLabel = slide.layout === 'layout-pillars-4' ? '4 Pillars' : '3 Pillars';
    } else if (slide.layout === 'layout-process-flow') {
      badgeClass = 'detected-badge-bento';
      badgeLabel = 'SOP Flow';
    } else if (slide.layout === 'layout-timeline') {
      badgeClass = 'detected-badge-cover';
      badgeLabel = 'Timeline';
    } else if (slide.layout === 'layout-comparison') {
      badgeClass = 'detected-badge-bento';
      badgeLabel = 'Comparison';
    } else if (slide.layout === 'layout-agenda') {
      badgeClass = 'detected-badge-bento';
      badgeLabel = 'Agenda';
    } else if (slide.layout === 'layout-section-break') {
      badgeClass = 'detected-badge-cover';
      badgeLabel = 'Section Break';
    } else if (slide.layout === 'layout-stat-callout') {
      badgeClass = 'detected-badge-stat';
      badgeLabel = 'Stat Callout';
    } else if (slide.layout === 'layout-quote' || slide.quote) {
      badgeClass = 'detected-badge-quote';
      badgeLabel = 'Quote Callout';
    } else if (slide.layout === 'layout-thank-you') {
      badgeClass = 'detected-badge-thank';
      badgeLabel = 'Thank You';
    }

    const bullets = (slide.body || '').split('\n').filter(b => b.trim().length > 0);
    const bulletSnippet = bullets.slice(0, 2).map(b => `• ${escapeHtml(b)}`).join('<br>');
    const notesSnippet = slide.notes ? `<span style="color: #6366F1; font-weight: 700; font-size: 0.68rem;">📝 Notes</span>` : '';

    html += `
      <div class="detected-slide-card">
        <div class="detected-slide-meta">
          <span style="font-weight: 700; color: var(--tn-navy);">Slide #${idx + 1}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${notesSnippet}
            <span class="detected-badge ${badgeClass}">${badgeLabel}</span>
          </div>
        </div>
        <div class="detected-slide-title">${escapeHtml(slide.title)}</div>
        ${bulletSnippet ? `<div class="detected-bullets-preview">${bulletSnippet}${bullets.length > 2 ? `<div style="color: var(--tn-slate-400); font-size: 0.68rem;">+ ${bullets.length - 2} more item(s)...</div>` : ''}</div>` : ''}
      </div>
    `;
  });

  listEl.innerHTML = html;
}

function executeOutlineImport() {
  const autoLayouts = document.getElementById('chk-auto-layouts').checked;
  const mode = document.querySelector('input[name="importer-mode"]:checked')?.value || 'replace';
  const parsed = getParsedSlides(autoLayouts);

  if (parsed.length === 0) {
    alert('Please enter or paste an outline to import, or click "Load Sample TN Agenda".');
    return;
  }

  recordSnapshot('Before Outline Import', `Importing ${parsed.length} slide(s) (${mode} mode)`);

  if (mode === 'replace') {
    if (appData.slides.length > 0 && !confirm(`This will replace your current ${appData.slides.length} slide(s) with ${parsed.length} newly generated slide(s). Proceed?`)) {
      return;
    }
    appData.slides = parsed;
    currentSlideIndex = 0;
  } else {
    const startIdx = appData.slides.length;
    appData.slides.push(...parsed);
    currentSlideIndex = startIdx;
  }

  markDirty();
  renderFilmstrip();
  switchSlide(currentSlideIndex);
  closeOutlineImporter();

  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.textContent = `✓ Generated ${parsed.length} slide(s) from document!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function openOutlineImporter(startFullscreen = false) {
  const modal = document.getElementById('modal-outline-importer');
  if (startFullscreen) {
    modal.classList.add('importer-fullscreen');
    const toggleText = document.getElementById('fs-toggle-text');
    const toggleIcon = document.getElementById('fs-toggle-icon');
    if (toggleText) toggleText.textContent = 'Windowed';
    if (toggleIcon) toggleIcon.textContent = '❐';
  }
  modal.classList.add('active');
  const wysiwygEditor = document.getElementById('outline-wysiwyg-editor');
  if (!wysiwygEditor.innerHTML.trim()) {
    wysiwygEditor.innerHTML = SAMPLE_TN_AGENDA_HTML;
  }
  updateOutlinePreview();
  wysiwygEditor.focus();
}

function toggleImporterFullscreen() {
  const modal = document.getElementById('modal-outline-importer');
  const isFs = modal.classList.toggle('importer-fullscreen');
  const toggleText = document.getElementById('fs-toggle-text');
  const toggleIcon = document.getElementById('fs-toggle-icon');
  if (toggleText) toggleText.textContent = isFs ? 'Windowed' : 'Full Screen';
  if (toggleIcon) toggleIcon.textContent = isFs ? '❐' : '⛶';
}

function closeOutlineImporter() {
  document.getElementById('modal-outline-importer').classList.remove('active');
}

// ==========================================================================
// [JS-16] ACCESSIBLE SPREADSHEET & CSV CHART INGESTION ENGINE (WCAG 2.1 AA)
// ==========================================================================
let chartPreviewMode = 'chart'; // 'chart' | 'table'

const SAMPLE_TN_DATASETS = {
  bwc: {
    title: "Workers' Comp Dispute Resolution Rates",
    kicker: "BUREAU OF WORKERS' COMPENSATION • STATE OF TENNESSEE",
    caption: "Dispute resolution rates exceeded 91% across all major Tennessee metropolitan counties in FY 2025-2026, led by Williamson (97.2%) and Knox (96.5%).",
    unit: "%",
    labelCol: "County",
    valueCol: "Dispute Resolution Rate",
    layout: "layout-chart-bar",
    csv: `County,Dispute Resolution Rate,Cases Resolved
Williamson,97.2%,380
Knox,96.5%,870
Rutherford,95.0%,420
Davidson,94.2%,1240
Hamilton,93.1%,650
Shelby,91.8%,1890`
  },
  budget: {
    title: "FY26 Strategic Job Creation by Grand Division",
    kicker: "ECONOMIC & COMMUNITY DEVELOPMENT • STATE OF TENNESSEE",
    caption: "Over $1.34 Billion in targeted capital investments projected to create 48,800 high-wage jobs across Tennessee's Three Grand Divisions.",
    unit: " jobs",
    labelCol: "Grand Division",
    valueCol: "Projected New Jobs",
    layout: "layout-chart-kpi",
    csv: `Grand Division,Projected New Jobs,Strategic Investment ($M)
Middle Tennessee,18500,520
West Tennessee,16100,440
East Tennessee,14200,385`
  },
  apprenticeship: {
    title: "Tennessee Apprenticeship Credentials (2021-2025)",
    kicker: "DEPARTMENT OF LABOR & WORKFORCE DEVELOPMENT",
    caption: "Certified registered apprenticeship completions expanded over 200% between 2021 and 2025, reaching 12,850 skilled workers in high-demand trades.",
    unit: "",
    labelCol: "Year",
    valueCol: "Certified Completions",
    layout: "layout-chart-bar",
    csv: `Year,Certified Completions,Annual Growth
2021,4200,8.2%
2022,5800,12.5%
2023,7900,18.1%
2024,10400,24.3%
2025,12850,29.7%`
  }
};

// Built-in Lightweight CSV / TSV Parser (Zero-dependency client-side fallback)
function parseCsvText(rawText) {
  if (!rawText || !rawText.trim()) return { headers: [], rows: [] };
  const clean = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const lines = clean.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Determine delimiter (comma, tab, or semicolon)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  function splitLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;
    const rowObj = {};
    headers.forEach((h, hIdx) => {
      rowObj[h] = values[hIdx] !== undefined ? values[hIdx] : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

function ingestSpreadsheetFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (typeof XLSX === 'undefined') {
      alert('Excel parser library is loading. Please try again in a moment or save your spreadsheet as a .CSV file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        openChartImporter();
        document.getElementById('chart-csv-raw').value = csv;
        document.getElementById('chart-slide-title').value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        updateChartModalPreview();
      } catch (err) {
        console.error('Spreadsheet parse error:', err);
        alert('Could not read Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    // CSV / TSV / Text
    const reader = new FileReader();
    reader.onload = (e) => {
      openChartImporter();
      document.getElementById('chart-csv-raw').value = e.target.result;
      document.getElementById('chart-slide-title').value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      updateChartModalPreview();
    };
    reader.readAsText(file);
  }
}

function openChartImporter(prefillData = null) {
  const modal = document.getElementById('modal-chart-importer');
  modal.classList.add('active');

  const activeSlide = appData.slides[currentSlideIndex];
  const rawTextarea = document.getElementById('chart-csv-raw');
  const titleInput = document.getElementById('chart-slide-title');
  const captionInput = document.getElementById('chart-accessible-caption');
  const unitInput = document.getElementById('chart-unit-suffix');
  const layoutSelect = document.getElementById('chart-style-select');

  if (prefillData) {
    rawTextarea.value = prefillData.csv || '';
    titleInput.value = prefillData.title || '';
    captionInput.value = prefillData.caption || '';
    unitInput.value = prefillData.unit || '%';
    layoutSelect.value = prefillData.layout || 'layout-chart-bar';
  } else if (activeSlide && activeSlide.chartData && activeSlide.chartData.length > 0) {
    // Reconstruct CSV from active slide
    const h1 = activeSlide.chartLabelHeader || 'Category';
    const h2 = activeSlide.chartValueHeader || 'Value';
    let csv = `${h1},${h2}\n`;
    activeSlide.chartData.forEach(d => {
      csv += `"${d.label}","${d.value}"\n`;
    });
    rawTextarea.value = csv;
    titleInput.value = activeSlide.title || '';
    captionInput.value = activeSlide.chartCaption || '';
    unitInput.value = activeSlide.chartUnit || '';
    layoutSelect.value = activeSlide.layout || 'layout-chart-bar';
  } else if (!rawTextarea.value.trim()) {
    loadSampleDataset('bwc');
  }

  updateChartModalPreview();
}

function closeChartImporter() {
  document.getElementById('modal-chart-importer').classList.remove('active');
}

function loadSampleDataset(key) {
  const ds = SAMPLE_TN_DATASETS[key];
  if (!ds) return;
  document.getElementById('chart-csv-raw').value = ds.csv;
  document.getElementById('chart-slide-title').value = ds.title;
  document.getElementById('chart-accessible-caption').value = ds.caption;
  document.getElementById('chart-unit-suffix').value = ds.unit;
  document.getElementById('chart-style-select').value = ds.layout;
  updateChartModalPreview();
}

function updateChartModalPreview() {
  const rawText = document.getElementById('chart-csv-raw').value;
  const parsed = parseCsvText(rawText);
  const labelSelect = document.getElementById('chart-col-label');
  const valueSelect = document.getElementById('chart-col-value');
  const badge = document.getElementById('chart-detected-rows-badge');
  const previewStage = document.getElementById('chart-modal-preview-stage');

  badge.textContent = `${parsed.rows.length} row(s) detected`;

  const prevLabel = labelSelect.value;
  const prevValue = valueSelect.value;

  labelSelect.innerHTML = '';
  valueSelect.innerHTML = '';

  parsed.headers.forEach((h) => {
    const opt1 = document.createElement('option');
    opt1.value = h;
    opt1.textContent = h;
    labelSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = h;
    opt2.textContent = h;
    valueSelect.appendChild(opt2);
  });

  if (parsed.headers.length >= 2) {
    if (parsed.headers.includes(prevLabel)) {
      labelSelect.value = prevLabel;
    } else {
      labelSelect.selectedIndex = 0;
    }

    if (parsed.headers.includes(prevValue)) {
      valueSelect.value = prevValue;
    } else {
      valueSelect.selectedIndex = 1;
    }
  }

  const labelCol = labelSelect.value;
  const valueCol = valueSelect.value;
  const unit = document.getElementById('chart-unit-suffix').value;
  const layout = document.getElementById('chart-style-select').value;
  const caption = document.getElementById('chart-accessible-caption').value || 'State of Tennessee Tabular Data';

  if (parsed.rows.length === 0 || !labelCol || !valueCol) {
    previewStage.innerHTML = `
      <div style="text-align: center; color: var(--tn-slate-400); padding: 3rem 1rem; font-size: 0.85rem;">
        Drop a CSV/Excel file or paste data above to see the live chart and paired table.
      </div>
    `;
    return;
  }

  const chartItems = parsed.rows.map(r => ({
    label: String(r[labelCol] || 'Item'),
    value: String(r[valueCol] || '0').trim()
  }));

  const numericVals = chartItems.map(d => parseFloat(d.value.replace(/[^0-9.-]/g, '')) || 0);
  const maxVal = Math.max(...numericVals, 1);

  if (chartPreviewMode === 'chart') {
    if (layout === 'layout-chart-kpi') {
      previewStage.innerHTML = `
        <div class="chart-kpi-grid" style="margin-top: 0.5rem;">
          ${chartItems.slice(0, 4).map(d => `
            <div class="kpi-card" style="padding: 1rem 0.6rem;">
              <div class="kpi-metric-number">${escapeHtml(d.value)}${escapeHtml(unit)}</div>
              <div class="kpi-metric-label">${escapeHtml(d.label)}</div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      previewStage.innerHTML = `
        <div class="chart-bar-container" style="margin-top: 0.5rem;">
          ${chartItems.map(d => {
            const valNum = parseFloat(d.value.replace(/[^0-9.-]/g, '')) || 0;
            const pct = Math.min(Math.max((valNum / maxVal) * 100, 2), 100);
            const isTop = valNum === maxVal && valNum > 0;
            return `
              <div class="chart-bar-row">
                <div class="chart-bar-label" title="${escapeHtml(d.label)}">${escapeHtml(d.label)}</div>
                <div class="chart-bar-track">
                  <div class="chart-bar-fill ${isTop ? 'accent-highlight' : ''}" style="width: ${pct}%;"></div>
                </div>
                <div class="chart-bar-val">${escapeHtml(d.value)}${escapeHtml(unit)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  } else {
    previewStage.innerHTML = `
      <div class="accessible-table-wrapper" style="margin-top: 0.5rem;">
        <table class="accessible-data-table">
          <caption>${escapeHtml(caption)}</caption>
          <thead>
            <tr>
              <th scope="col">${escapeHtml(labelCol)}</th>
              <th scope="col" style="text-align: right;">${escapeHtml(valueCol)}</th>
            </tr>
          </thead>
          <tbody>
            ${chartItems.map(d => `
              <tr>
                <th scope="row">${escapeHtml(d.label)}</th>
                <td style="text-align: right; font-variant-numeric: tabular-nums;">${escapeHtml(d.value)}${escapeHtml(unit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function executeChartImport() {
  const rawText = document.getElementById('chart-csv-raw').value;
  const parsed = parseCsvText(rawText);
  const labelCol = document.getElementById('chart-col-label').value;
  const valueCol = document.getElementById('chart-col-value').value;
  const layout = document.getElementById('chart-style-select').value;
  const unit = document.getElementById('chart-unit-suffix').value.trim();
  const title = document.getElementById('chart-slide-title').value.trim() || 'Performance Metrics & Insights';
  const caption = document.getElementById('chart-accessible-caption').value.trim() || `${title} data summary.`;
  const targetMode = document.querySelector('input[name="chart-target-mode"]:checked')?.value || 'current';

  if (parsed.rows.length === 0 || !labelCol || !valueCol) {
    alert('Please enter or upload spreadsheet data with at least one row and select label/value columns.');
    return;
  }

  const chartData = parsed.rows.map(r => ({
    label: String(r[labelCol] || '').trim(),
    value: String(r[valueCol] || '').trim()
  }));

  const slidePayload = {
    layout: layout,
    kicker: "STATE OF TENNESSEE • DATA & METRICS",
    title: title,
    body: chartData.map(d => `${d.label}: ${d.value}${unit}`).join('\n'),
    chartData: chartData,
    chartLabelHeader: labelCol,
    chartValueHeader: valueCol,
    chartCaption: caption,
    chartUnit: unit,
    chartViewMode: 'chart',
    animate: true,
    animationType: 'push',
    notes: `Data visualization slide: ${title}. ${caption}`
  };

  recordSnapshot('Before Chart Ingestion', `Ingesting ${chartData.length} data row(s)`);

  if (targetMode === 'new') {
    slidePayload.id = `slide-${Date.now()}`;
    appData.slides.splice(currentSlideIndex + 1, 0, slidePayload);
    currentSlideIndex++;
  } else {
    const cur = appData.slides[currentSlideIndex];
    slidePayload.id = cur ? cur.id : `slide-${Date.now()}`;
    appData.slides[currentSlideIndex] = Object.assign({}, cur, slidePayload);
  }

  markDirty();
  renderFilmstrip();
  loadSlideIntoForm(currentSlideIndex);
  renderCurrentSlide();
  closeChartImporter();

  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.textContent = `✓ Ingested ${chartData.length} data rows with paired WCAG table!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// --- 16B. EXISTING DECK INGESTION & TEMPLATE MODERNIZATION ENGINE ---
let deckImporterState = {
  currentStep: 1,
  slides: [],
  graphics: []
};

function openDeckImporter() {
  const modal = document.getElementById('modal-deck-importer');
  if (!modal) return;
  deckImporterState = { currentStep: 1, slides: [], graphics: [] };
  const statusEl = document.getElementById('deck-parse-status');
  if (statusEl) statusEl.style.display = 'none';
  const fileInput = document.getElementById('deck-file-input');
  if (fileInput) fileInput.value = '';
  setDeckImporterStep(1);
  modal.classList.add('active');
}

function closeDeckImporter() {
  const modal = document.getElementById('modal-deck-importer');
  if (modal) modal.classList.remove('active');
}

function setDeckImporterStep(step) {
  // Validate Alt Text if navigating away from Step 2
  if (deckImporterState.currentStep === 2 && step === 3) {
    const invalid = deckImporterState.graphics.find(g => g.keep && (!g.altText || !g.altText.trim()));
    if (invalid) {
      const card = document.querySelector(`.deck-graphic-card[data-graphic-id="${invalid.id}"]`);
      if (card) {
        card.classList.add('has-error');
        const input = card.querySelector('.deck-graphic-alt-input');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      const toast = document.createElement('div');
      toast.className = 'save-toast';
      toast.style.background = 'var(--tn-crimson)';
      toast.textContent = '⚠️ Alt text is required for every retained graphic before proceeding (or uncheck to exclude).';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
      return;
    }
  }

  deckImporterState.currentStep = step;

  // Update tabs
  for (let i = 1; i <= 3; i++) {
    const tab = document.getElementById(`deck-step-tab-${i}`);
    const panel = document.getElementById(`deck-panel-${i}`);
    if (tab) {
      tab.classList.toggle('active', i === step);
      tab.classList.toggle('completed', i < step);
      tab.setAttribute('aria-selected', i === step);
    }
    if (panel) {
      panel.classList.toggle('active', i === step);
    }
  }

  // Update buttons
  const btnBack = document.getElementById('btn-deck-back');
  const btnNext = document.getElementById('btn-deck-next');
  const btnFinalize = document.getElementById('btn-deck-finalize');

  if (btnBack) {
    btnBack.style.display = step > 1 ? 'inline-flex' : 'none';
    if (step === 2) btnBack.textContent = '← Back to Upload';
    if (step === 3) btnBack.textContent = '← Back to Graphics';
  }

  if (btnNext) {
    btnNext.style.display = step < 3 ? 'inline-flex' : 'none';
    btnNext.disabled = (step === 1 && deckImporterState.slides.length === 0);
    if (step === 1) btnNext.textContent = 'Next: Review Graphics Triage ➔';
    if (step === 2) btnNext.textContent = 'Next: Review Slide Layouts ➔';
  }

  if (btnFinalize) {
    btnFinalize.style.display = step === 3 ? 'inline-flex' : 'none';
  }

  if (step === 2) {
    renderGraphicsTriage();
  } else if (step === 3) {
    renderSlideMapping();
  }
}

async function parsePptxDeckFile(file) {
  const statusEl = document.getElementById('deck-parse-status');
  const statusText = document.getElementById('deck-parse-status-text');
  if (statusEl) statusEl.style.display = 'flex';
  if (statusText) statusText.textContent = `Reading and unzipping "${file.name}"...`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    if (typeof window.JSZip === 'undefined') {
      throw new Error('JSZip library is not loaded.');
    }

    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const slideEntries = [];
    const slideRegex = /^ppt\/slides\/slide([0-9]+)\.xml$/i;

    zip.forEach((relativePath, zipEntry) => {
      const match = relativePath.match(slideRegex);
      if (match) {
        slideEntries.push({
          num: parseInt(match[1], 10),
          path: relativePath,
          entry: zipEntry
        });
      }
    });

    if (slideEntries.length === 0) {
      throw new Error('No slide files found in PowerPoint archive. Please confirm this is a valid .pptx file.');
    }

    slideEntries.sort((a, b) => a.num - b.num);
    if (statusText) statusText.textContent = `Found ${slideEntries.length} slide(s). Extracting text, structure, and media...`;

    const parsedSlides = [];
    const extractedGraphics = [];

    for (let i = 0; i < slideEntries.length; i++) {
      const item = slideEntries[i];
      const xmlText = await zip.file(item.path).async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

      // Parse relations for media
      const relsPath = `ppt/slides/_rels/slide${item.num}.xml.rels`;
      const relsFile = zip.file(relsPath);
      const relations = {};
      if (relsFile) {
        const relsText = await relsFile.async('string');
        const relsDoc = parser.parseFromString(relsText, 'application/xml');
        relsDoc.querySelectorAll('Relationship').forEach(r => {
          relations[r.getAttribute('Id')] = {
            target: r.getAttribute('Target'),
            type: r.getAttribute('Type')
          };
        });
      }

      // Extract titles and text paragraphs
      let slideTitle = '';
      const bodyLines = [];

      const shapes = xmlDoc.querySelectorAll('sp');
      shapes.forEach(sp => {
        const ph = sp.querySelector('ph');
        const phType = ph ? ph.getAttribute('type') : null;
        const isTitlePh = phType === 'title' || phType === 'ctrTitle';

        const paragraphs = sp.querySelectorAll('p');
        const spTextLines = [];

        paragraphs.forEach(p => {
          const textRuns = p.querySelectorAll('t');
          let pText = '';
          textRuns.forEach(t => { pText += t.textContent; });
          pText = pText.trim();
          if (pText) {
            const lvlAttr = p.querySelector('pPr')?.getAttribute('lvl');
            const indent = lvlAttr ? parseInt(lvlAttr, 10) : 0;
            spTextLines.push({ text: pText, indent });
          }
        });

        if (spTextLines.length > 0) {
          if (isTitlePh && !slideTitle) {
            slideTitle = spTextLines.map(l => l.text).join(' ');
          } else {
            spTextLines.forEach(l => {
              const prefix = l.indent > 0 ? '  '.repeat(l.indent) + '- ' : '• ';
              bodyLines.push(prefix + l.text);
            });
          }
        }
      });

      if (!slideTitle && bodyLines.length > 0) {
        slideTitle = bodyLines.shift().replace(/^[•\-\s]+/, '');
      }
      if (!slideTitle) {
        slideTitle = `Slide ${i + 1}`;
      }

      // Extract media graphics for this slide
      const slideGraphics = [];
      const pics = xmlDoc.querySelectorAll('pic');
      for (const pic of Array.from(pics)) {
        const blip = pic.querySelector('blip');
        const rId = blip ? (blip.getAttribute('r:embed') || blip.getAttribute('r:link')) : null;
        if (rId && relations[rId]) {
          let mediaTarget = relations[rId].target;
          let fullMediaPath = mediaTarget.replace(/^\.\.\//, 'ppt/');
          if (!fullMediaPath.startsWith('ppt/')) fullMediaPath = 'ppt/' + fullMediaPath;

          const mediaZipFile = zip.file(fullMediaPath);
          if (mediaZipFile) {
            const ext = fullMediaPath.split('.').pop().toLowerCase();
            const mimeTypes = {
              'png': 'image/png',
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'gif': 'image/gif',
              'svg': 'image/svg+xml',
              'webp': 'image/webp'
            };
            const mime = mimeTypes[ext] || 'image/png';
            const b64 = await mediaZipFile.async('base64');
            const dataUri = `data:${mime};base64,${b64}`;
            const graphicId = `graphic_s${item.num}_${slideGraphics.length + 1}_${Date.now()}`;

            const graphicObj = {
              id: graphicId,
              slideIndex: i,
              slideNum: item.num,
              slideTitle: slideTitle,
              filename: fullMediaPath.split('/').pop(),
              format: ext.toUpperCase(),
              dataUri: dataUri,
              keep: false, // EXCLUDED BY DEFAULT AS REQUESTED!
              altText: '',
              placement: 'split-right'
            };
            slideGraphics.push(graphicObj);
            extractedGraphics.push(graphicObj);
          }
        }
      }

      // Recommended Layout Selection
      let recommendedLayout = 'layout-banner';
      const allText = (slideTitle + ' ' + bodyLines.join(' ')).toLowerCase();
      if (i === 0) {
        recommendedLayout = 'layout-cover-blue-banner';
      } else if (/agenda|outline|overview|table of contents/i.test(slideTitle)) {
        recommendedLayout = 'layout-agenda';
      } else if (/thank\s*you|questions|closing|contact/i.test(slideTitle)) {
        recommendedLayout = 'layout-thank-you';
      } else if (bodyLines.length === 3) {
        recommendedLayout = 'layout-pillars-3';
      } else if (bodyLines.length === 4) {
        recommendedLayout = 'layout-process-flow';
      } else if (/comparison|versus|baseline|reform|pros\s*&\s*cons/i.test(slideTitle)) {
        recommendedLayout = 'layout-comparison';
      } else if (/\$|[0-9]{2,}%|rate|kpi/i.test(allText)) {
        recommendedLayout = 'layout-stat-callout';
      }

      parsedSlides.push({
        originalIndex: i,
        slideNum: item.num,
        title: slideTitle,
        kicker: 'STATE OF TENNESSEE • PRESENTATION MODERNIZATION',
        body: bodyLines.join('\n'),
        notes: `Converted from PowerPoint slide #${item.num}.`,
        recommendedLayout: recommendedLayout,
        selectedLayout: recommendedLayout,
        graphics: slideGraphics
      });
    }

    deckImporterState.slides = parsedSlides;
    deckImporterState.graphics = extractedGraphics;

    if (statusEl) statusEl.style.display = 'none';
    setDeckImporterStep(2);

  } catch (err) {
    console.error('Error parsing PowerPoint deck:', err);
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--tn-crimson); font-weight: 700;">❌ Error reading deck: ${escapeHtml(err.message)}</span>`;
    }
  }
}

function loadSampleLegacyDeck() {
  const logoData = (typeof window.TN_BRAND_ASSETS !== 'undefined' && window.TN_BRAND_ASSETS.tnSquareLogo)
    ? window.TN_BRAND_ASSETS.tnSquareLogo
    : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const sampleSlides = [
    {
      originalIndex: 0,
      slideNum: 1,
      title: "Workforce Modernization & Service Delivery Review",
      kicker: "STATE OF TENNESSEE • CABINET BRIEFING",
      body: "Executive Briefing & Strategic Priorities\nBureau of Workers' Compensation & Division of Citizen Engagement",
      notes: "Opening presentation remarks for legislative committee.",
      recommendedLayout: "layout-cover-blue-banner",
      selectedLayout: "layout-cover-blue-banner",
      graphics: []
    },
    {
      originalIndex: 1,
      slideNum: 2,
      title: "Expedited Dispute Mediation Across Grand Divisions",
      kicker: "OPERATIONAL PERFORMANCE METRICS",
      body: "• Average dispute resolution turnaround reduced to 38 calendar days statewide.\n• Over 92% of disputes successfully mediated without contentious litigation.\n• Virtual hearing rooms active across Memphis, Nashville, Knoxville and Chattanooga.\n• Dedicated bilingual citizen advocate hotlines operational in all 95 counties.",
      notes: "Discuss regional mediation results and time savings.",
      recommendedLayout: "layout-split",
      selectedLayout: "layout-split",
      graphics: []
    },
    {
      originalIndex: 2,
      slideNum: 3,
      title: "Three Grand Division Implementation Priorities",
      kicker: "STRATEGIC CIVIC PRIORITIES",
      body: "West Tennessee: Logistics Corridor | BlueOval City regional support center & expedited ombudsman staffing.\nMiddle Tennessee: Adjudication Hub | Centralized claims processing and real-time electronic docket filing.\nEast Tennessee: High-Tech Safety Labs | Advanced occupational safety demonstrations and employer certifications.",
      notes: "Pillar overview for regional division coordinators.",
      recommendedLayout: "layout-pillars-3",
      selectedLayout: "layout-pillars-3",
      graphics: []
    },
    {
      originalIndex: 3,
      slideNum: 4,
      title: "Standard Operating Procedure: Digital Claim Filing",
      kicker: "SOP & PROCESS WORKFLOW",
      body: "Step 1: Secure Portal Registration | Employer or citizen signs in with statewide verified identity.\nStep 2: Automated Electronic Intake | Instant OCR scanning and document validation across 24 fields.\nStep 3: Ombudsman Review & Triage | Assigned specialist assesses claim within 48 business hours.\nStep 4: Formal Resolution & Notice | Digital sign-off with permanent cloud repository archiving.",
      notes: "Walk through the four sequential steps for staff adoption.",
      recommendedLayout: "layout-process-flow",
      selectedLayout: "layout-process-flow",
      graphics: []
    }
  ];

  // Sample Graphics associated with slides (DEFAULT TO EXCLUDE!)
  const sampleGraphics = [
    {
      id: `graphic_sample_1_${Date.now()}`,
      slideIndex: 1,
      slideNum: 2,
      slideTitle: "Expedited Dispute Mediation Across Grand Divisions",
      filename: "regional_office_operations.png",
      format: "PNG",
      dataUri: logoData,
      keep: false, // EXCLUDED BY DEFAULT!
      altText: "",
      placement: "split-right"
    },
    {
      id: `graphic_sample_2_${Date.now()}`,
      slideIndex: 3,
      slideNum: 4,
      slideTitle: "Standard Operating Procedure: Digital Claim Filing",
      filename: "workflow_diagram_v1.png",
      format: "PNG",
      dataUri: logoData,
      keep: false, // EXCLUDED BY DEFAULT!
      altText: "",
      placement: "split-right"
    }
  ];

  sampleSlides[1].graphics = [sampleGraphics[0]];
  sampleSlides[3].graphics = [sampleGraphics[1]];

  deckImporterState.slides = sampleSlides;
  deckImporterState.graphics = sampleGraphics;

  setDeckImporterStep(2);
}

function renderGraphicsTriage() {
  const gridEl = document.getElementById('deck-graphics-grid');
  const emptyNotice = document.getElementById('deck-graphics-empty-notice');
  const counterText = document.getElementById('deck-triage-counter-text');
  if (!gridEl) return;

  const graphics = deckImporterState.graphics;
  if (graphics.length === 0) {
    if (emptyNotice) emptyNotice.style.display = 'block';
    gridEl.innerHTML = '';
    if (counterText) counterText.textContent = '0 graphics found in deck';
    return;
  }

  if (emptyNotice) emptyNotice.style.display = 'none';

  const updateCounter = () => {
    const keptCount = graphics.filter(g => g.keep).length;
    const excludedCount = graphics.length - keptCount;
    if (counterText) {
      counterText.innerHTML = `<strong>${keptCount}</strong> of <strong>${graphics.length}</strong> graphics selected (<strong>${excludedCount}</strong> excluded)`;
    }
  };

  updateCounter();

  let html = '';
  graphics.forEach(g => {
    const isKept = !!g.keep;
    html += `
      <div class="deck-graphic-card ${isKept ? 'included' : 'excluded'}" data-graphic-id="${escapeHtml(g.id)}">
        <div class="deck-graphic-preview-row">
          <div class="deck-graphic-thumb-wrap">
            <img src="${escapeHtml(g.dataUri)}" alt="Legacy graphic preview from slide ${g.slideNum}">
          </div>
          <div class="deck-graphic-origin-box">
            <span class="deck-graphic-slide-badge">Found on Slide #${g.slideNum}</span>
            <div class="deck-graphic-slide-title" title="${escapeHtml(g.slideTitle)}">${escapeHtml(g.slideTitle)}</div>
            <div class="deck-graphic-filename">${escapeHtml(g.filename)} • ${escapeHtml(g.format)}</div>
          </div>
        </div>
        <div class="deck-graphic-card-body">
          <div class="deck-graphic-toggle-row">
            <label class="deck-graphic-checkbox-label">
              <input type="checkbox" class="deck-graphic-include-checkbox" data-graphic-id="${escapeHtml(g.id)}" ${isKept ? 'checked' : ''}>
              <span>Keep Graphic</span>
            </label>
            <span class="deck-graphic-status-tag ${isKept ? 'tag-included' : 'tag-excluded'}">
              ${isKept ? '✓ Retained as Base64' : '✕ Excluded (Deleted)'}
            </span>
          </div>

          <div class="deck-graphic-alt-box">
            <label for="alt-input-${escapeHtml(g.id)}">
              <span>Descriptive Alt Text</span>
              <span class="required-star">*</span>
              <span style="font-weight: normal; font-size: 0.68rem; color: var(--tn-slate-500);">(Required to retain)</span>
            </label>
            <input type="text" id="alt-input-${escapeHtml(g.id)}" class="form-input deck-graphic-alt-input" data-graphic-id="${escapeHtml(g.id)}" 
                   placeholder="${isKept ? 'Describe photo/diagram for screen readers...' : 'Graphic excluded (will not be inserted)'}" 
                   value="${escapeHtml(g.altText || '')}" ${isKept ? '' : 'disabled'}>
          </div>

          <div class="deck-graphic-placement-row">
            <span style="font-weight: 700; color: var(--tn-slate-700);">Template Location:</span>
            <select class="form-select deck-graphic-placement-select" data-graphic-id="${escapeHtml(g.id)}" style="flex: 1; padding: 3px 6px; font-size: 0.72rem;" ${isKept ? '' : 'disabled'}>
              <option value="split-right" ${g.placement === 'split-right' ? 'selected' : ''}>Split Right (Template Default)</option>
              <option value="split-left" ${g.placement === 'split-left' ? 'selected' : ''}>Split Left</option>
              <option value="card" ${g.placement === 'card' ? 'selected' : ''}>Card Photo Frame</option>
              <option value="bg-bleed" ${g.placement === 'bg-bleed' ? 'selected' : ''}>Full Background Bleed</option>
            </select>
          </div>
        </div>
      </div>
    `;
  });

  gridEl.innerHTML = html;

  // Wire inputs
  gridEl.querySelectorAll('.deck-graphic-include-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.graphicId;
      const g = graphics.find(x => x.id === id);
      if (!g) return;
      g.keep = e.target.checked;

      const card = gridEl.querySelector(`.deck-graphic-card[data-graphic-id="${id}"]`);
      if (card) {
        card.classList.toggle('included', g.keep);
        card.classList.toggle('excluded', !g.keep);
        card.classList.remove('has-error');

        const statusTag = card.querySelector('.deck-graphic-status-tag');
        if (statusTag) {
          statusTag.className = `deck-graphic-status-tag ${g.keep ? 'tag-included' : 'tag-excluded'}`;
          statusTag.textContent = g.keep ? '✓ Retained as Base64' : '✕ Excluded (Deleted)';
        }

        const altInput = card.querySelector('.deck-graphic-alt-input');
        const placementSelect = card.querySelector('.deck-graphic-placement-select');

        if (altInput) {
          altInput.disabled = !g.keep;
          altInput.placeholder = g.keep ? 'Describe photo/diagram for screen readers...' : 'Graphic excluded (will not be inserted)';
          if (g.keep && !altInput.value) {
            altInput.focus();
          }
        }
        if (placementSelect) {
          placementSelect.disabled = !g.keep;
        }
      }

      updateCounter();
    });
  });

  gridEl.querySelectorAll('.deck-graphic-alt-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.graphicId;
      const g = graphics.find(x => x.id === id);
      if (g) {
        g.altText = e.target.value.trim();
        if (g.altText) {
          const card = gridEl.querySelector(`.deck-graphic-card[data-graphic-id="${id}"]`);
          if (card) card.classList.remove('has-error');
        }
      }
    });
  });

  gridEl.querySelectorAll('.deck-graphic-placement-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const id = e.target.dataset.graphicId;
      const g = graphics.find(x => x.id === id);
      if (g) g.placement = e.target.value;
    });
  });
}

function renderSlideMapping() {
  const listEl = document.getElementById('deck-slides-mapping-list');
  const summaryEl = document.getElementById('deck-mapping-summary');
  if (!listEl) return;

  const slides = deckImporterState.slides;
  const graphics = deckImporterState.graphics;

  const keptGraphicsCount = graphics.filter(g => g.keep).length;
  const excludedGraphicsCount = graphics.length - keptGraphicsCount;

  if (summaryEl) {
    summaryEl.textContent = `${slides.length} slide(s) ready • ${keptGraphicsCount} graphic(s) kept, ${excludedGraphicsCount} excluded`;
  }

  let html = '';
  slides.forEach((s, idx) => {
    // Check if this slide has a retained graphic
    const keptGraphic = graphics.find(g => g.slideIndex === s.originalIndex && g.keep);

    // If graphic retained, default layout to split photo if currently standard
    if (keptGraphic && s.selectedLayout === 'layout-banner') {
      s.selectedLayout = 'layout-split';
    }

    const bodyExcerpt = (s.body || '').split('\n').filter(Boolean).slice(0, 2).join(' • ');

    html += `
      <div class="deck-slide-mapping-card">
        <div class="deck-slide-num-pill">${idx + 1}</div>
        <div class="deck-slide-info-col">
          <div class="deck-slide-info-title">${escapeHtml(s.title || 'Untitled Slide')}</div>
          <div class="deck-slide-info-body">${escapeHtml(bodyExcerpt || 'No body text')}</div>
          ${keptGraphic ? `
            <div class="deck-slide-graphic-pill pill-retained">
              <span>📷 Retained: "${escapeHtml(keptGraphic.altText || 'Photo')}" (${escapeHtml(keptGraphic.placement)})</span>
            </div>
          ` : `
            <div class="deck-slide-graphic-pill pill-excluded">
              <span>🚫 Clean Text Template (Graphics Excluded)</span>
            </div>
          `}
        </div>
        <div style="min-width: 200px;">
          <label style="font-size: 0.7rem; font-weight: 700; color: var(--tn-slate-600); display: block; margin-bottom: 2px;">Assigned Layout:</label>
          <select class="form-select deck-slide-layout-select" data-slide-idx="${idx}" style="font-size: 0.78rem; padding: 4px 8px; width: 100%;">
            ${TN_LAYOUT_CATALOG.map(l => `
              <option value="${escapeHtml(l.id)}" ${l.id === s.selectedLayout ? 'selected' : ''}>
                ${escapeHtml(l.name)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;

  listEl.querySelectorAll('.deck-slide-layout-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.slideIdx, 10);
      if (slides[idx]) {
        slides[idx].selectedLayout = e.target.value;
      }
    });
  });
}

function finalizeDeckConversion() {
  const slides = deckImporterState.slides;
  const graphics = deckImporterState.graphics;

  if (!slides || slides.length === 0) {
    alert('No slides available to convert.');
    return;
  }

  // Strict WCAG Alt Text check
  const invalid = graphics.find(g => g.keep && (!g.altText || !g.altText.trim()));
  if (invalid) {
    setDeckImporterStep(2);
    const card = document.querySelector(`.deck-graphic-card[data-graphic-id="${invalid.id}"]`);
    if (card) {
      card.classList.add('has-error');
      const input = card.querySelector('.deck-graphic-alt-input');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    const toast = document.createElement('div');
    toast.className = 'save-toast';
    toast.style.background = 'var(--tn-crimson)';
    toast.textContent = '⚠️ Alt text is mandatory for all retained graphics before conversion.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
    return;
  }

  // Snapshot rollback point
  recordSnapshot('Before Deck Conversion', `Ingested deck of ${slides.length} slides with layout modernization`);

  const keptCount = graphics.filter(g => g.keep).length;
  const excludedCount = graphics.length - keptCount;

  const convertedSlides = slides.map((s, idx) => {
    const keptGraphic = graphics.find(g => g.slideIndex === s.originalIndex && g.keep);

    return {
      id: `slide-converted-${Date.now()}-${idx}`,
      layout: s.selectedLayout || s.recommendedLayout || 'layout-banner',
      kicker: s.kicker || 'STATE OF TENNESSEE • PRESENTATION MODERNIZATION',
      title: s.title || 'Untitled Slide',
      body: s.body || '',
      animate: true,
      animationType: 'push',
      mediaUrl: keptGraphic ? keptGraphic.dataUri : '',
      mediaAlt: keptGraphic ? keptGraphic.altText : '',
      isDecorative: !keptGraphic,
      imagePlacement: keptGraphic ? (keptGraphic.placement || 'split-right') : 'split-right',
      notes: s.notes || `Converted from presentation slide #${s.slideNum}.`
    };
  });

  const importMode = document.querySelector('input[name="deck-import-mode"]:checked')?.value || 'replace';

  if (importMode === 'replace') {
    appData.slides = convertedSlides;
    currentSlideIndex = 0;
  } else {
    const startIdx = appData.slides.length;
    appData.slides = appData.slides.concat(convertedSlides);
    currentSlideIndex = startIdx;
  }

  markDirty();
  renderFilmstrip();
  loadSlideIntoForm(currentSlideIndex);
  renderCurrentSlide();
  updateLayoutMiniPreview(appData.slides[currentSlideIndex].layout);
  closeDeckImporter();

  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.textContent = `✓ Successfully converted ${convertedSlides.length} slides to State layouts! (${keptCount} graphics retained with Alt Text, ${excludedCount} excluded).`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// --- 17. AUTOMATIC LOCAL VERSION SNAPSHOTS & REVISION ROLLBACK ENGINE ---
const SNAPSHOT_STORAGE_KEY = 'tn_presentation_snapshots_v1';
const MAX_SNAPSHOTS = 25;
let lastSnapshotTime = 0;

function getSnapshotsList() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('Could not read snapshot history from localStorage:', e);
    return [];
  }
}

function saveSnapshotsList(list) {
  let attempts = 0;
  let currentList = list.slice(0, MAX_SNAPSHOTS);
  while (attempts < 5) {
    try {
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(currentList));
      updateHistoryBadgeCount(currentList.length);
      return true;
    } catch (e) {
      attempts++;
      if (currentList.length > 2) {
        currentList.pop();
      } else {
        console.warn('Storage quota exceeded for snapshots:', e);
        return false;
      }
    }
  }
  return false;
}

function updateHistoryBadgeCount(count) {
  const badge = document.getElementById('history-count-badge');
  if (badge) {
    const actualCount = count !== undefined ? count : getSnapshotsList().length;
    badge.textContent = String(actualCount);
  }
}

function recordSnapshot(triggerType, optionalNote) {
  try {
    const list = getSnapshotsList();
    const now = Date.now();

    if (triggerType === 'Autosave Checkpoint' && now - lastSnapshotTime < 45000) {
      return;
    }

    const clonedData = JSON.parse(JSON.stringify(appData));
    const dateObj = new Date();
    const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateFormatted = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    const newSnap = {
      id: `snap-${now}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      timeFormatted: timeFormatted,
      dateFormatted: dateFormatted,
      trigger: triggerType || 'Autosave Checkpoint',
      note: optionalNote || '',
      slideCount: clonedData.slides.length,
      deckTitle: clonedData.slides[0]?.title || 'Untitled Presentation',
      slideTitles: clonedData.slides.map((s, i) => `#${i + 1} ${s.title || 'Untitled'}`).slice(0, 5),
      appData: clonedData
    };

    list.unshift(newSnap);
    saveSnapshotsList(list);
    lastSnapshotTime = now;
  } catch (err) {
    console.warn('Snapshot recording failed:', err);
  }
}

function restoreSnapshot(snapshotId) {
  const list = getSnapshotsList();
  const target = list.find(s => s.id === snapshotId);
  if (!target) {
    alert('Snapshot not found.');
    return;
  }

  const confirmMsg = `Revert presentation to snapshot from ${target.dateFormatted} at ${target.timeFormatted} (${target.slideCount} slides)?\n\nTrigger: ${target.trigger}\n\nNote: A safety snapshot of your current state will be saved first so you can undo this rollback at any time.`;
  if (!confirm(confirmMsg)) return;

  recordSnapshot('Before Rollback Safety Checkpoint', `Reverting to ${target.trigger} (${target.timeFormatted})`);

  appData = JSON.parse(JSON.stringify(target.appData));
  currentSlideIndex = 0;
  markDirty();

  selectTheme.value = appData.theme || 'theme-dept-blue-banner';
  selectAgencyLogo.value = appData.agencyLogo || 'dept-labor';
  selectPhotoStyle.value = appData.photoStyle || 'photo-style-blue-overlay';
  chkCardWiggle.checked = appData.enableCardWiggle !== false;

  renderFilmstrip();
  loadSlideIntoForm(0);
  renderCurrentSlide();
  updateMediaAssetStats();

  closeHistoryModal();

  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.textContent = `✓ Rolled back to checkpoint: ${target.trigger} (${target.timeFormatted})!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function deleteSnapshot(snapshotId) {
  const list = getSnapshotsList().filter(s => s.id !== snapshotId);
  saveSnapshotsList(list);
  renderSnapshotTimeline();
}

function clearAllSnapshots() {
  if (!confirm('Are you sure you want to clear all revision history snapshots? This cannot be undone.')) {
    return;
  }
  localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  updateHistoryBadgeCount(0);
  renderSnapshotTimeline();
}

function exportSnapshotJson(snapshotId) {
  const list = getSnapshotsList();
  const target = list.find(s => s.id === snapshotId);
  if (!target) return;
  const jsonStr = JSON.stringify(target.appData, null, 2);
  const filename = `tn-presentation-snapshot-${target.timestamp}.json`;
  downloadFileFallback(jsonStr, filename);
}

function renderSnapshotTimeline() {
  const container = document.getElementById('snapshot-timeline-list');
  if (!container) return;

  const list = getSnapshotsList();
  updateHistoryBadgeCount(list.length);

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--tn-slate-500); padding: 3rem 1rem; font-size: 0.875rem;">
        No revision snapshots recorded yet. Snapshots are created automatically when you save, import content, or click "Save Snapshot" above.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((snap, idx) => {
    let badgeColor = 'var(--tn-navy)';
    if (snap.trigger.includes('Outline') || snap.trigger.includes('Chart')) badgeColor = 'var(--tn-state-red)';
    if (snap.trigger.includes('Saved to File')) badgeColor = 'var(--tn-slate-700)';
    if (snap.trigger.includes('Manual')) badgeColor = '#9E7C0C';
    if (snap.trigger.includes('Safety')) badgeColor = 'var(--tn-crimson)';

    const previewTitles = (snap.slideTitles || []).join(' • ') + (snap.slideCount > 5 ? ' ...' : '');

    return `
      <div style="background: #ffffff; border: 1px solid var(--tn-slate-200); border-radius: 8px; padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.5rem; transition: border-color 0.15s ease;" class="snapshot-card">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="tn-badge-tag" style="background: ${badgeColor}; color: #ffffff; font-size: 0.7rem; font-weight: 700;">${escapeHtml(snap.trigger)}</span>
            <strong style="color: var(--tn-navy); font-size: 0.875rem;">${escapeHtml(snap.dateFormatted)} at ${escapeHtml(snap.timeFormatted)}</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.75rem; font-weight: 600; color: var(--tn-slate-600);">${snap.slideCount} Slide${snap.slideCount === 1 ? '' : 's'}</span>
            ${idx === 0 ? '<span class="tn-badge-tag" style="background: var(--tn-slate-200); color: var(--tn-slate-700); font-size: 0.65rem;">Latest</span>' : ''}
          </div>
        </div>

        ${snap.note ? `<div style="font-size: 0.775rem; color: var(--tn-slate-800); font-style: italic;">“${escapeHtml(snap.note)}”</div>` : ''}

        <div style="font-size: 0.72rem; color: var(--tn-slate-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(previewTitles)}
        </div>

        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 0.35rem; padding-top: 0.5rem; border-top: 1px dashed var(--tn-slate-200);">
          <button type="button" class="btn btn-sm btn-outline-dark" data-action="export-snapshot" data-id="${snap.id}" style="font-size: 0.72rem; padding: 3px 8px;" title="Export snapshot as JSON">
            💾 Export JSON
          </button>
          <button type="button" class="btn btn-sm btn-outline-dark" data-action="delete-snapshot" data-id="${snap.id}" style="font-size: 0.72rem; padding: 3px 8px; color: var(--tn-crimson);" title="Delete this snapshot">
            🗑️
          </button>
          <button type="button" class="btn btn-sm btn-primary" data-action="revert-snapshot" data-id="${snap.id}" style="font-size: 0.75rem; padding: 3px 12px; font-weight: 700;">
            ↺ Revert to this Version
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openHistoryModal() {
  renderSnapshotTimeline();
  document.getElementById('modal-version-history').classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('modal-version-history').classList.remove('active');
}

function startAutosaveSnapshotTimer() {
  setInterval(() => {
    if (isDirty) {
      recordSnapshot('Autosave Checkpoint', 'Automatic periodic background save');
    }
  }, 180000);
}

