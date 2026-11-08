/**
 * State of Tennessee Presentation Studio - Slide Rendering Engine & Form Synchronization
 * Renders slide layouts, filmstrip thumbnails, executive headers, footers, and copilot brevity.
 */
'use strict';

// Helper to retrieve official logos from brand_assets.js
function getActiveAgencyLogoUrl() {
  const choice = appData.agencyLogo || 'dept-labor';
  if (choice === 'none') return '';
  if (choice === 'tristar-starball') return 'https://www.tn.gov/etc/clientlibs/tncore/main/img/footer-starball.png';
  if (typeof TN_BRAND_ASSETS !== 'undefined') {
    if (choice === 'dept-labor') return TN_BRAND_ASSETS.deptLaborLogo;
    if (choice === 'bwc-logo') return TN_BRAND_ASSETS.bwcLogo;
    if (choice === 'tn-square') return TN_BRAND_ASSETS.tnSquareLogo;
  }
  return '';
}

// --- 4. FILMSTRIP & SLIDE RAIL RENDERING ---
function moveSlide(fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= appData.slides.length) return;
  if (toIdx < 0 || toIdx >= appData.slides.length) return;
  const slide = appData.slides.splice(fromIdx, 1)[0];
  appData.slides.splice(toIdx, 0, slide);
  currentSlideIndex = toIdx;
  markDirty();
  renderFilmstrip();
  loadSlideIntoForm(currentSlideIndex);
  renderCurrentSlide();
  syncWithPresenterConsole();
}

function duplicateSlide(idx) {
  const targetIdx = (typeof idx === 'number') ? idx : currentSlideIndex;
  const current = appData.slides[targetIdx];
  if (!current) return;
  const clone = JSON.parse(JSON.stringify(current));
  clone.id = `slide-${Date.now()}`;
  clone.title = (clone.title || 'Slide') + ' (Copy)';
  appData.slides.splice(targetIdx + 1, 0, clone);
  markDirty();
  switchSlide(targetIdx + 1);
}

function deleteSlide(idx) {
  const targetIdx = (typeof idx === 'number') ? idx : currentSlideIndex;
  if (appData.slides.length <= 1) {
    alert('A presentation must have at least one slide.');
    return;
  }
  const title = appData.slides[targetIdx]?.title || `Slide #${targetIdx + 1}`;
  if (confirm(`Are you sure you want to delete "${title}"?`)) {
    if (typeof recordSnapshot === 'function') {
      recordSnapshot('Before Slide Deletion', `Deleted slide #${targetIdx + 1}: ${title}`);
    }
    appData.slides.splice(targetIdx, 1);
    if (currentSlideIndex >= appData.slides.length) {
      currentSlideIndex = appData.slides.length - 1;
    }
    markDirty();
    renderFilmstrip();
    switchSlide(currentSlideIndex);
  }
}

function addNewSlide() {
  const newSlide = {
    id: `slide-${Date.now()}`,
    layout: 'layout-split',
    kicker: 'STATE OF TENNESSEE',
    title: 'New Slide Title',
    body: 'Key strategic takeaway\nHigh impact executive bullet\nAccessible citizen service metric',
    mediaUrl: '',
    mediaAlt: '',
    isDecorative: true,
    imagePlacement: 'split-right',
    notes: ''
  };
  appData.slides.splice(currentSlideIndex + 1, 0, newSlide);
  markDirty();
  switchSlide(currentSlideIndex + 1);
}

function renderFilmstrip() {
  const container = document.getElementById('slide-filmstrip');
  if (!container) return;
  container.innerHTML = '';

  const countPill = document.getElementById('filmstrip-count-pill');
  if (countPill) {
    countPill.textContent = `${appData.slides.length} slide${appData.slides.length === 1 ? '' : 's'}`;
  }

  appData.slides.forEach((slide, idx) => {
    const card = document.createElement('div');
    card.className = `rail-slide-card ${idx === currentSlideIndex ? 'active' : ''}`;
    card.setAttribute('role', 'tab');
    card.setAttribute('aria-selected', idx === currentSlideIndex);
    card.setAttribute('tabindex', '0');
    card.dataset.slideIndex = idx;

    let layoutLabel = 'Slide';
    if (slide.layout) {
      if (slide.layout.includes('cover-blue')) layoutLabel = 'Cover';
      else if (slide.layout.includes('cover-state')) layoutLabel = 'Classic';
      else if (slide.layout.includes('pillars')) layoutLabel = 'Pillars';
      else if (slide.layout.includes('timeline')) layoutLabel = 'Timeline';
      else if (slide.layout.includes('process')) layoutLabel = 'Process';
      else if (slide.layout.includes('agenda')) layoutLabel = 'Agenda';
      else if (slide.layout.includes('comparison')) layoutLabel = 'Compare';
      else if (slide.layout.includes('map')) layoutLabel = 'Map';
      else if (slide.layout.includes('section-break')) layoutLabel = 'Section';
      else if (slide.layout.includes('bootstrap5')) layoutLabel = 'Portal';
      else if (slide.layout.includes('video')) layoutLabel = 'Video';
      else if (slide.layout.includes('split')) layoutLabel = 'Split';
    }

    card.innerHTML = `
      <div class="rail-card-header">
        <span class="rail-slide-num">${idx + 1}</span>
        <span class="rail-layout-tag">${layoutLabel}</span>
      </div>
      <div class="rail-thumb-preview">
        <div class="rail-thumb-inner">
          <div class="mini-kicker">${escapeHtml(slide.kicker || '')}</div>
          <div class="mini-title">${escapeHtml(slide.title || 'Untitled Slide')}</div>
          ${slide.videoUrl ? '<span class="mini-video-icon">🎬</span>' : ''}
        </div>
      </div>
      <div class="rail-slide-title" title="${escapeHtml(slide.title || 'Untitled')}">
        ${escapeHtml(slide.title || 'Untitled Slide')}
      </div>
      <div class="rail-card-actions">
        <button type="button" class="rail-action-btn btn-rail-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="rail-action-btn btn-rail-down" title="Move Down" ${idx === appData.slides.length - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" class="rail-action-btn btn-rail-dup" title="Duplicate">⧉</button>
        <button type="button" class="rail-action-btn btn-rail-del" title="Delete" style="color: var(--tn-crimson);">🗑</button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.rail-action-btn')) return;
      switchSlide(idx);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchSlide(idx);
      }
    });

    const btnUp = card.querySelector('.btn-rail-up');
    if (btnUp) {
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSlide(idx, idx - 1);
      });
    }

    const btnDown = card.querySelector('.btn-rail-down');
    if (btnDown) {
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSlide(idx, idx + 1);
      });
    }

    const btnDup = card.querySelector('.btn-rail-dup');
    if (btnDup) {
      btnDup.addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateSlide(idx);
      });
    }

    const btnDel = card.querySelector('.btn-rail-del');
    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSlide(idx);
      });
    }

    container.appendChild(card);
  });

  // Bottom "+ Add Slide" card
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'rail-add-slide-btn';
  addBtn.innerHTML = `<span>+ Add Slide</span>`;
  addBtn.title = 'Add New Slide';
  addBtn.addEventListener('click', addNewSlide);
  container.appendChild(addBtn);

  // Auto-scroll active card into view
  const activeCard = container.querySelector('.rail-slide-card.active');
  if (activeCard && typeof activeCard.scrollIntoView === 'function') {
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function switchSlide(idx) {
  if (idx < 0 || idx >= appData.slides.length) return;
  if (isVideoPlayingFullscreen) {
    exitFullscreenVideoTheater(false);
  }
  currentSlideIndex = idx;
  videoSlidePlayState[idx] = 'ready'; // reset video play state for this slide visit
  if (isBlackScreen) exitBlackScreen();
  stopScreenReaderSpeech();
  renderFilmstrip();
  loadSlideIntoForm(idx);
  renderCurrentSlide(true);
  redrawAnnotationsForCurrentSlide();
  syncWithPresenterConsole();
}

// --- SMART LAYOUT SUGGESTIONS ENGINE (PROGRESSIVE DISCLOSURE) ---
function updateSmartLayoutSuggestions(text, currentLayout) {
  const container = document.getElementById('smart-suggestions-chips');
  const countBadge = document.getElementById('smart-suggestions-count-badge');
  if (!container) return;

  const lines = (text || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lineCount = lines.length;
  const fullText = (text || '').toLowerCase();

  // Pattern detection
  const hasNumbers = /\b\d+(\.\d+)?%|\$\d+|\b\d{2,}\b/.test(fullText);
  const hasDates = /\b(q[1-4]|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|phase|stage|step|202\d)\b/i.test(fullText);
  const hasComparison = /\b(vs|versus|baseline|reform|before|after|current|proposed)\b/i.test(fullText) || fullText.includes('===');
  const hasMapKeywords = /\b(tennessee|county|counties|grand division|west tn|middle tn|east tn|nashville|memphis|knoxville)\b/i.test(fullText);

  const suggestions = [];

  if (hasMapKeywords) {
    suggestions.push({ id: 'layout-tn-map', label: '🗺️ TN Map', desc: 'Geographic map with regional divisions' });
  }

  if (hasComparison) {
    suggestions.push({ id: 'layout-comparison', label: '⚖️ Policy Comparison', desc: 'Baseline vs Reform comparison' });
  }

  if (hasDates) {
    suggestions.push({ id: 'layout-timeline', label: '📅 Milestone Timeline', desc: 'Chronological roadmap' });
    suggestions.push({ id: 'layout-process-flow', label: '🔄 SOP Process Flow', desc: 'Sequential directional flow' });
  }

  if (lineCount === 3) {
    suggestions.push({ id: 'layout-pillars-3', label: '🏛️ 3 Pillars', desc: '3 equal priority cards' });
    suggestions.push({ id: 'layout-bento-3', label: '🍱 3-Card Bento', desc: 'Hero card + 2 companions' });
  } else if (lineCount === 4) {
    suggestions.push({ id: 'layout-pillars-4', label: '🏛️ 4 Pillars', desc: '4 equal priority cards' });
    suggestions.push({ id: 'layout-chart-kpi', label: '📈 4-Card KPI Grid', desc: 'Metric scorecard cards' });
  }

  if (hasNumbers) {
    suggestions.push({ id: 'layout-stat-callout', label: '🎯 Big Metric', desc: 'Oversized focal statistic' });
    suggestions.push({ id: 'layout-chart-bar', label: '📊 Bar Chart', desc: 'Accessible horizontal bar chart' });
  }

  // General fallbacks
  suggestions.push({ id: 'layout-split', label: '📋 Bullet List', desc: 'Standard executive bullet points' });
  suggestions.push({ id: 'layout-agenda', label: '📑 Meeting Agenda', desc: 'Numbered agenda topics' });

  // Deduplicate by ID
  const seen = new Set();
  const uniqueSuggestions = suggestions.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).slice(0, 4);

  if (countBadge) {
    countBadge.textContent = lineCount > 0 ? `${lineCount} thoughts detected` : 'Ready for thoughts';
  }

  container.innerHTML = uniqueSuggestions.map(s => {
    const isActive = s.id === currentLayout;
    return `
      <button type="button" class="smart-chip-btn ${isActive ? 'active' : ''}" data-layout="${s.id}" title="${s.desc}">
        ${s.label}
      </button>
    `;
  }).join('');
}

function getSuggestedIconsForSlide(slide) {
  if (!slide) return [];
  const text = `${slide.title || ''} ${slide.kicker || ''} ${slide.subtitle || ''} ${slide.body || ''} ${slide.citation || ''}`.toLowerCase();

  const suggestions = [];

  // 1. Legal / Statutory / Compliance
  if (/\b(legal|law|statute|t\.c\.a|code|court|judge|judicial|compliance|audit|regulation|penalty|liability|rights|mandate)\b/i.test(text) || slide.citation) {
    suggestions.push({ icon: 'fa-scale-balanced', label: 'Legal Justice' });
    suggestions.push({ icon: 'fa-file-shield', label: 'Statutory Shield' });
    suggestions.push({ icon: 'fa-gavel', label: 'Judicial Gavel' });
  }

  // 2. Finance / Fiscal / Budget
  if (/\b(budget|fiscal|dollar|\$|revenue|fund|cost|expense|appropriation|finance|tax|economic|economy|growth|grant|audit)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-chart-line', label: 'Growth Chart' });
    suggestions.push({ icon: 'fa-sack-dollar', label: 'Fiscal Budget' });
    suggestions.push({ icon: 'fa-vault', label: 'Treasury' });
  }

  // 3. Healthcare / Medical
  if (/\b(health|medical|clinical|hospital|patient|doctor|nurse|clinic|wellness|mental|care|tenncare|medicaid|disease|treatment)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-heart-pulse', label: 'Vital Health' });
    suggestions.push({ icon: 'fa-hospital', label: 'Healthcare' });
    suggestions.push({ icon: 'fa-stethoscope', label: 'Diagnostics' });
  }

  // 4. Education / Workforce
  if (/\b(education|school|student|teacher|college|university|degree|training|workforce|apprentice|learn|literacy|academic|campus)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-graduation-cap', label: 'Higher Ed' });
    suggestions.push({ icon: 'fa-school', label: 'Education' });
    suggestions.push({ icon: 'fa-user-graduate', label: 'Workforce' });
  }

  // 5. Tech / Data / Cloud / Cyber
  if (/\b(tech|software|data|system|cloud|server|network|portal|digital|cyber|security|analytics|database|code|online)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-laptop-code', label: 'Technology' });
    suggestions.push({ icon: 'fa-shield-halved', label: 'Cybersecurity' });
    suggestions.push({ icon: 'fa-database', label: 'Data Bank' });
  }

  // 6. Roads / Infrastructure / Transport
  if (/\b(road|highway|bridge|transport|transit|dot|traffic|freight|logistics|infrastructure|route|fleet|vehicle)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-road', label: 'Highways' });
    suggestions.push({ icon: 'fa-bridge', label: 'Bridges' });
    suggestions.push({ icon: 'fa-truck-fast', label: 'Logistics' });
  }

  // 7. Parks / Environment / Agriculture
  if (/\b(park|forest|nature|mountain|conservation|environment|wildlife|outdoor|agriculture|farm|crop|rural|smoky)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-mountain-sun', label: 'Smoky Mtns' });
    suggestions.push({ icon: 'fa-tree', label: 'State Forest' });
    suggestions.push({ icon: 'fa-wheat-awn', label: 'Agriculture' });
  }

  // 8. Strategy / Milestones / Goals
  if (/\b(strategy|mission|vision|goal|milestone|priority|target|roadmap|initiative|launch|future|outcome|benchmark)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-bullseye', label: 'Strategic Goal' });
    suggestions.push({ icon: 'fa-compass', label: 'Direction' });
    suggestions.push({ icon: 'fa-rocket', label: 'Launch' });
  }

  // 9. Civic / Tennessee State / Government
  if (/\b(tennessee|state|citizen|public|government|capitol|governor|civic|department|agency|assembly|legislation|division|county)\b/i.test(text)) {
    suggestions.push({ icon: 'fa-landmark', label: 'State Capitol' });
    suggestions.push({ icon: 'fa-building-columns', label: 'Civic Trust' });
    suggestions.push({ icon: 'fa-award', label: 'Excellence' });
  }

  // Default fallbacks if no specific keywords
  suggestions.push({ icon: 'fa-landmark', label: 'State Capitol' });
  suggestions.push({ icon: 'fa-chart-line', label: 'Performance' });
  suggestions.push({ icon: 'fa-bullseye', label: 'Key Target' });
  suggestions.push({ icon: 'fa-shield-halved', label: 'State Seal' });

  // Deduplicate by icon
  const seen = new Set();
  return suggestions.filter(item => {
    if (seen.has(item.icon)) return false;
    seen.add(item.icon);
    return true;
  }).slice(0, 5);
}

function updateSmartIconSuggestions(slide) {
  const container = document.getElementById('smart-bg-icon-chips');
  if (!container || !slide) return;
  const suggestions = getSuggestedIconsForSlide(slide);
  const currentIcon = slide.bgIcon || '';

  container.innerHTML = suggestions.map(s => {
    const isActive = s.icon === currentIcon;
    return `
      <button type="button" class="smart-icon-chip-btn ${isActive ? 'active' : ''}" data-icon="${s.icon}" title="Apply ${s.label} (${s.icon}) as background watermark">
        <i class="fa-solid ${s.icon}"></i>
        <span>${s.label}</span>
      </button>
    `;
  }).join('');
}

function updateDrawerBadges(slide) {
  const citationBadge = document.getElementById('citation-summary-badge');
  if (citationBadge) {
    if (slide && slide.citation && slide.citation.trim().length > 0) {
      citationBadge.textContent = 'Active (T.C.A.)';
      citationBadge.style.background = 'var(--tn-navy)';
      citationBadge.style.color = '#fff';
    } else {
      citationBadge.textContent = 'Optional';
      citationBadge.style.background = 'var(--tn-slate-200)';
      citationBadge.style.color = 'var(--tn-slate-500)';
    }
  }

  const motionBadge = document.getElementById('motion-summary-badge');
  if (motionBadge && slide) {
    const isAnim = slide.animate !== false;
    const animType = slide.animationType || 'push';
    motionBadge.textContent = isAnim ? `${animType.toUpperCase()} FX` : 'Off';
  }

  const bgIconBadge = document.getElementById('bg-icon-summary-badge');
  if (bgIconBadge) {
    if (slide && slide.bgIcon && slide.bgIcon.trim().length > 0) {
      const cleanName = slide.bgIcon.replace(/^fa-/, '').replace(/-/g, ' ');
      bgIconBadge.textContent = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      bgIconBadge.style.background = 'var(--tn-navy)';
      bgIconBadge.style.color = '#fff';
    } else {
      bgIconBadge.textContent = 'None';
      bgIconBadge.style.background = 'var(--tn-slate-200)';
      bgIconBadge.style.color = 'var(--tn-slate-500)';
    }
  }
}

// --- 5. FORM BINDING & EDITING ---
function loadSlideIntoForm(idx) {
  const slide = appData.slides[idx];
  if (!slide) return;
  inputKicker.value = slide.kicker || '';
  inputTitle.value = slide.title || '';
  inputBody.value = slide.body || '';
  selectLayout.value = slide.layout || 'layout-split';
  updateLayoutMiniPreview(slide.layout || 'layout-split');
  inputNotes.value = slide.notes || '';
  if (inputCitation) inputCitation.value = slide.citation || '';
  selectImagePlacement.value = slide.imagePlacement || 'split-right';
  inputImageUrl.value = slide.mediaUrl || '';
  inputImageCaption.value = slide.mediaCaption || '';
  inputVideoUrl.value = slide.videoUrl || '';
  if (chkVideoFullscreenAdvance) {
    chkVideoFullscreenAdvance.checked = slide.playVideoFullscreenOnAdvance !== false;
  }
  if (videoStatusBadge) {
    videoStatusBadge.style.display = (slide.videoUrl && slide.videoUrl.trim().length > 0) ? 'inline-block' : 'none';
  }
  inputAudioUrl.value = slide.audioUrl || '';

  if (slide.mediaUrl) {
    mediaPreviewImg.src = slide.mediaUrl;
    mediaPreviewImg.alt = slide.mediaAlt || '';
    mediaPreviewBox.style.display = 'block';
  } else {
    mediaPreviewImg.src = '';
    mediaPreviewImg.alt = '';
    mediaPreviewBox.style.display = 'none';
  }

  // Slide Animation Binding
  const isAnim = slide.animate !== false;
  if (chkSlideAnimate) chkSlideAnimate.checked = isAnim;
  if (selectSlideAnimType) selectSlideAnimType.value = slide.animationType || 'push';
  if (slideAnimTypeContainer) slideAnimTypeContainer.style.display = isAnim ? 'flex' : 'none';

  // Decorative Watermark Icon Binding
  const selectBgIcon = document.getElementById('select-bg-icon');
  const sliderBgIconOpacity = document.getElementById('slider-bg-icon-opacity');
  const labelBgIconOpacity = document.getElementById('label-bg-icon-opacity');
  const selectBgIconPos = document.getElementById('select-bg-icon-pos');

  if (selectBgIcon) selectBgIcon.value = slide.bgIcon || '';
  const currentOpacity = (typeof slide.bgIconOpacity === 'number') ? slide.bgIconOpacity : 0.04;
  if (sliderBgIconOpacity) sliderBgIconOpacity.value = currentOpacity;
  if (labelBgIconOpacity) labelBgIconOpacity.textContent = `${Math.round(currentOpacity * 100)}%`;
  if (selectBgIconPos) selectBgIconPos.value = slide.bgIconPosition || 'bottom-right';

  // Slide Chart Config Panel
  const chartBox = document.getElementById('slide-chart-config-box');
  const chartBadge = document.getElementById('slide-chart-row-count-badge');
  const chartCaptionPreview = document.getElementById('slide-chart-caption-preview');
  const hasChart = !!(slide.chartData && slide.chartData.length > 0) || slide.layout === 'layout-chart-bar' || slide.layout === 'layout-chart-kpi' || slide.layout === 'layout-data-table';
  if (chartBox) {
    chartBox.style.display = hasChart ? 'block' : 'none';
    if (hasChart) {
      chartBadge.textContent = `${(slide.chartData || []).length} rows`;
      chartCaptionPreview.textContent = slide.chartCaption || 'No caption entered yet (WCAG recommended)';
    }
  }

  // Slide Interactive Map Config Panel
  const isMapLayout = slide.layout === 'layout-tn-map';
  if (boxMapConfig) {
    boxMapConfig.style.display = isMapLayout ? 'block' : 'none';
    if (isMapLayout) {
      if (!slide.mapData) {
        slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
      }
      if (!slide.mapData.mapMode) slide.mapData.mapMode = 'divisions';
      if (!Array.isArray(slide.mapData.customCounties)) slide.mapData.customCounties = [];
      if (!slide.mapData.statewideValue) slide.mapData.statewideValue = '18,210';
      if (!slide.mapData.statewideSub) slide.mapData.statewideSub = '95 Counties • 7.1M Citizens';
      if (!slide.mapData.customTitle) slide.mapData.customTitle = 'Upper Cumberland Region';
      if (!slide.mapData.customMetric) slide.mapData.customMetric = '$450M';

      if (selectMapMode) selectMapMode.value = slide.mapData.mapMode;
      if (mapModeBadge) {
        const modeLabels = {
          'divisions': 'Grand Divisions',
          'state': 'Full State Overview',
          'county': 'County by County',
          'custom': 'Custom Group'
        };
        mapModeBadge.textContent = modeLabels[slide.mapData.mapMode] || 'Grand Divisions';
      }

      if (mapPresetGroup) mapPresetGroup.style.display = slide.mapData.mapMode === 'divisions' ? 'block' : 'none';
      if (panelDivisionsEditors) panelDivisionsEditors.style.display = slide.mapData.mapMode === 'divisions' ? 'flex' : 'none';
      if (panelStatewide) panelStatewide.style.display = (slide.mapData.mapMode === 'state' || slide.mapData.mapMode === 'custom') ? 'block' : 'none';
      if (panelCustomConfig) panelCustomConfig.style.display = slide.mapData.mapMode === 'custom' ? 'block' : 'none';
      if (panelCountySelect) panelCountySelect.style.display = slide.mapData.mapMode === 'county' ? 'block' : 'none';

      if (selectMapCountyPicker && window.TN_COUNTIES_DATA && selectMapCountyPicker.options.length <= 1) {
        window.TN_COUNTIES_DATA.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = `${c.name} (${c.division} TN)`;
          selectMapCountyPicker.appendChild(opt);
        });
      }
      if (selectMapCountyPicker) selectMapCountyPicker.value = slide.mapData.selectedCounty || '';

      if (inputMapStatewideVal) inputMapStatewideVal.value = slide.mapData.statewideValue || '';
      if (inputMapStatewideSub) inputMapStatewideSub.value = slide.mapData.statewideSub || '';
      if (inputMapCustomTitle) inputMapCustomTitle.value = slide.mapData.customTitle || '';
      if (inputMapCustomMetric) inputMapCustomMetric.value = slide.mapData.customMetric || '';
      if (badgeCustomGroupCounter) badgeCustomGroupCounter.textContent = `${(slide.mapData.customCounties || []).length} / 95`;

      if (selectMapPreset) selectMapPreset.value = slide.mapPreset || 'fy26-jobs';
      if (inputMapCaption) inputMapCaption.value = slide.mapData.caption || '';
      if (inputMapPrefix) inputMapPrefix.value = slide.mapData.prefix || '';
      if (inputMapUnit) inputMapUnit.value = slide.mapData.unit || '';
      if (inputMapWestVal) inputMapWestVal.value = (slide.mapData.divisions && slide.mapData.divisions.west) ? (slide.mapData.divisions.west.value || '') : '';
      if (inputMapWestSub) inputMapWestSub.value = (slide.mapData.divisions && slide.mapData.divisions.west) ? (slide.mapData.divisions.west.secondary || '') : '';
      if (inputMapMidVal) inputMapMidVal.value = (slide.mapData.divisions && slide.mapData.divisions.middle) ? (slide.mapData.divisions.middle.value || '') : '';
      if (inputMapMidSub) inputMapMidSub.value = (slide.mapData.divisions && slide.mapData.divisions.middle) ? (slide.mapData.divisions.middle.secondary || '') : '';
      if (inputMapEastVal) inputMapEastVal.value = (slide.mapData.divisions && slide.mapData.divisions.east) ? (slide.mapData.divisions.east.value || '') : '';
      if (inputMapEastSub) inputMapEastSub.value = (slide.mapData.divisions && slide.mapData.divisions.east) ? (slide.mapData.divisions.east.secondary || '') : '';
    }
  }

  // Strategic Pillars Helper Bar
  const boxPillarsHelper = document.getElementById('slide-pillars-helper-bar');
  const badgePillarsCount = document.getElementById('pillars-count-badge');
  const isPillarsLayout = slide.layout === 'layout-pillars-3' || slide.layout === 'layout-pillars-4';
  if (boxPillarsHelper) {
    boxPillarsHelper.style.display = isPillarsLayout ? 'block' : 'none';
    if (isPillarsLayout && badgePillarsCount) {
      badgePillarsCount.textContent = slide.layout === 'layout-pillars-4' ? '4 Pillars' : '3 Pillars';
    }
  }

  // Process Workflow Helper Bar
  const boxProcessHelper = document.getElementById('slide-process-helper-bar');
  const isProcessLayout = slide.layout === 'layout-process-flow';
  if (boxProcessHelper) {
    boxProcessHelper.style.display = isProcessLayout ? 'block' : 'none';
  }

  // Milestone Timeline Helper Bar
  const boxTimelineHelper = document.getElementById('slide-timeline-helper-bar');
  const isTimelineLayout = slide.layout === 'layout-timeline';
  if (boxTimelineHelper) {
    boxTimelineHelper.style.display = isTimelineLayout ? 'block' : 'none';
  }

  // Policy Comparison Helper Bar
  const boxComparisonHelper = document.getElementById('slide-comparison-helper-bar');
  const isComparisonLayout = slide.layout === 'layout-comparison';
  if (boxComparisonHelper) {
    boxComparisonHelper.style.display = isComparisonLayout ? 'block' : 'none';
  }

  // Executive Agenda Helper Bar
  const boxAgendaHelper = document.getElementById('slide-agenda-helper-bar');
  const isAgendaLayout = slide.layout === 'layout-agenda';
  if (boxAgendaHelper) {
    boxAgendaHelper.style.display = isAgendaLayout ? 'block' : 'none';
  }

  // Section Break Helper Bar
  const boxSectionBreakHelper = document.getElementById('slide-section-break-helper-bar');
  const isSectionBreakLayout = slide.layout === 'layout-section-break';
  if (boxSectionBreakHelper) {
    boxSectionBreakHelper.style.display = isSectionBreakLayout ? 'block' : 'none';
  }

  checkBrevity(slide.body || '');
  updateSmartLayoutSuggestions(slide.body || '', slide.layout || 'layout-split');
  updateSmartIconSuggestions(slide);
  updateDrawerBadges(slide);
}

function updateSlideFromForm(reanimate = false) {
  const slide = appData.slides[currentSlideIndex];
  if (!slide) return;

  const shouldReanimate = (reanimate === true);

  slide.kicker = inputKicker.value.trim();
  slide.title = inputTitle.value.trim();
  slide.body = inputBody.value;
  slide.layout = selectLayout.value;
  updateLayoutMiniPreview(selectLayout.value);
  slide.notes = inputNotes.value.trim();
  if (inputCitation) slide.citation = inputCitation.value.trim();
  slide.imagePlacement = selectImagePlacement.value;
  slide.mediaUrl = inputImageUrl.value.trim();
  slide.mediaCaption = inputImageCaption.value.trim();
  const rawVideo = inputVideoUrl.value.trim();
  slide.videoUrl = normalizeYouTubeEmbedUrl(rawVideo, false);
  if (chkVideoFullscreenAdvance) {
    slide.playVideoFullscreenOnAdvance = chkVideoFullscreenAdvance.checked;
  }
  if (videoStatusBadge) {
    videoStatusBadge.style.display = (slide.videoUrl && slide.videoUrl.trim().length > 0) ? 'inline-block' : 'none';
  }
  slide.audioUrl = inputAudioUrl.value.trim();

  // Decorative Watermark Icon Sync
  const selectBgIcon = document.getElementById('select-bg-icon');
  const sliderBgIconOpacity = document.getElementById('slider-bg-icon-opacity');
  const labelBgIconOpacity = document.getElementById('label-bg-icon-opacity');
  const selectBgIconPos = document.getElementById('select-bg-icon-pos');

  if (selectBgIcon) slide.bgIcon = selectBgIcon.value.trim();
  if (sliderBgIconOpacity) {
    slide.bgIconOpacity = parseFloat(sliderBgIconOpacity.value) || 0.04;
    if (labelBgIconOpacity) labelBgIconOpacity.textContent = `${Math.round(slide.bgIconOpacity * 100)}%`;
  }
  if (selectBgIconPos) slide.bgIconPosition = selectBgIconPos.value;

  if (chkSlideAnimate) {
    slide.animate = chkSlideAnimate.checked;
    if (slideAnimTypeContainer) {
      slideAnimTypeContainer.style.display = slide.animate ? 'flex' : 'none';
    }
  }
  if (selectSlideAnimType) {
    slide.animationType = selectSlideAnimType.value;
  }

  const chartBox = document.getElementById('slide-chart-config-box');
  const chartBadge = document.getElementById('slide-chart-row-count-badge');
  const chartCaptionPreview = document.getElementById('slide-chart-caption-preview');
  const hasChart = !!(slide.chartData && slide.chartData.length > 0) || slide.layout === 'layout-chart-bar' || slide.layout === 'layout-chart-kpi' || slide.layout === 'layout-data-table';
  if (chartBox) {
    chartBox.style.display = hasChart ? 'block' : 'none';
    if (hasChart) {
      chartBadge.textContent = `${(slide.chartData || []).length} rows`;
      chartCaptionPreview.textContent = slide.chartCaption || 'No caption entered yet (WCAG recommended)';
    }
  }

  // Map Slide Sync
  const isMapLayout = slide.layout === 'layout-tn-map';
  if (boxMapConfig) {
    boxMapConfig.style.display = isMapLayout ? 'block' : 'none';
  }
  if (isMapLayout) {
    if (!slide.mapData) {
      slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
    }
    if (selectMapMode) slide.mapData.mapMode = selectMapMode.value;
    if (inputMapStatewideVal) slide.mapData.statewideValue = inputMapStatewideVal.value.trim();
    if (inputMapStatewideSub) slide.mapData.statewideSub = inputMapStatewideSub.value.trim();
    if (inputMapCustomTitle) slide.mapData.customTitle = inputMapCustomTitle.value.trim();
    if (inputMapCustomMetric) slide.mapData.customMetric = inputMapCustomMetric.value.trim();
    if (selectMapCountyPicker) slide.mapData.selectedCounty = selectMapCountyPicker.value;

    if (inputMapCaption) slide.mapData.caption = inputMapCaption.value.trim();
    if (inputMapPrefix) slide.mapData.prefix = inputMapPrefix.value;
    if (inputMapUnit) slide.mapData.unit = inputMapUnit.value;
    if (!slide.mapData.divisions) slide.mapData.divisions = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs'].divisions));
    if (inputMapWestVal) slide.mapData.divisions.west.value = inputMapWestVal.value.trim();
    if (inputMapWestSub) slide.mapData.divisions.west.secondary = inputMapWestSub.value.trim();
    if (inputMapMidVal) slide.mapData.divisions.middle.value = inputMapMidVal.value.trim();
    if (inputMapMidSub) slide.mapData.divisions.middle.secondary = inputMapMidSub.value.trim();
    if (inputMapEastVal) slide.mapData.divisions.east.value = inputMapEastVal.value.trim();
    if (inputMapEastSub) slide.mapData.divisions.east.secondary = inputMapEastSub.value.trim();
  }

  // Strategic Pillars Helper Bar Sync
  const boxPillarsHelper = document.getElementById('slide-pillars-helper-bar');
  const badgePillarsCount = document.getElementById('pillars-count-badge');
  const isPillarsLayout = slide.layout === 'layout-pillars-3' || slide.layout === 'layout-pillars-4';
  if (boxPillarsHelper) {
    boxPillarsHelper.style.display = isPillarsLayout ? 'block' : 'none';
    if (isPillarsLayout && badgePillarsCount) {
      badgePillarsCount.textContent = slide.layout === 'layout-pillars-4' ? '4 Pillars' : '3 Pillars';
    }
  }

  // Process Workflow Helper Bar Sync
  const boxProcessHelper = document.getElementById('slide-process-helper-bar');
  const isProcessLayout = slide.layout === 'layout-process-flow';
  if (boxProcessHelper) {
    boxProcessHelper.style.display = isProcessLayout ? 'block' : 'none';
  }

  // Milestone Timeline Helper Bar Sync
  const boxTimelineHelper = document.getElementById('slide-timeline-helper-bar');
  const isTimelineLayout = slide.layout === 'layout-timeline';
  if (boxTimelineHelper) {
    boxTimelineHelper.style.display = isTimelineLayout ? 'block' : 'none';
  }

  // Policy Comparison Helper Bar Sync
  const boxComparisonHelper = document.getElementById('slide-comparison-helper-bar');
  const isComparisonLayout = slide.layout === 'layout-comparison';
  if (boxComparisonHelper) {
    boxComparisonHelper.style.display = isComparisonLayout ? 'block' : 'none';
  }

  // Executive Agenda Helper Bar Sync
  const boxAgendaHelper = document.getElementById('slide-agenda-helper-bar');
  const isAgendaLayout = slide.layout === 'layout-agenda';
  if (boxAgendaHelper) {
    boxAgendaHelper.style.display = isAgendaLayout ? 'block' : 'none';
  }

  // Section Break Helper Bar Sync
  const boxSectionBreakHelper = document.getElementById('slide-section-break-helper-bar');
  const isSectionBreakLayout = slide.layout === 'layout-section-break';
  if (boxSectionBreakHelper) {
    boxSectionBreakHelper.style.display = isSectionBreakLayout ? 'block' : 'none';
  }

  markDirty();
  renderCurrentSlide(shouldReanimate);
  checkBrevity(slide.body || '');
  updateSmartLayoutSuggestions(slide.body || '', selectLayout.value);
  updateSmartIconSuggestions(slide);
  updateDrawerBadges(slide);

  // Keep active rail slide thumbnail title & kicker synchronized in real time
  const activeMini = document.querySelector('.rail-slide-card.active .mini-title');
  if (activeMini) activeMini.textContent = slide.title || 'Untitled Slide';
  const activeRail = document.querySelector('.rail-slide-card.active .rail-slide-title');
  if (activeRail) activeRail.textContent = slide.title || 'Untitled Slide';
  const activeMiniKicker = document.querySelector('.rail-slide-card.active .mini-kicker');
  if (activeMiniKicker) activeMiniKicker.textContent = slide.kicker || '';
}

// --- 6. TENNESSEE COPILOT BREVITY ASSISTANT ---
function checkBrevity(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  let hasLongLine = false;
  let longestLine = '';

  for (const line of lines) {
    if (line.length > 100) {
      hasLongLine = true;
      if (line.length > longestLine.length) longestLine = line;
    }
  }

  if (hasLongLine) {
    copilotBox.classList.add('visible');
    copilotCharCount.textContent = `${longestLine.length} chars (Target: ≤ 100)`;
    copilotSuggestionText.textContent = `Tennessee Presentation Copilot: A bullet point contains ${longestLine.length} characters. State presentation standards recommend concise, punchy lines for maximum legibility and audience engagement.`;
  } else {
    copilotBox.classList.remove('visible');
  }
}

function applyCopilotBrevity() {
  const lines = inputBody.value.split('\n');
  const shortened = lines.map(line => {
    if (line.length > 100) {
      let clean = line
        .replace(/in order to/gi, 'to')
        .replace(/with the intention of/gi, 'to')
        .replace(/for the purpose of/gi, 'for')
        .replace(/at this point in time/gi, 'currently')
        .replace(/due to the fact that/gi, 'because')
        .replace(/it is important to note that/gi, '')
        .replace(/please note that/gi, '');
      if (clean.length > 100) {
        const clauses = clean.split(/[,;]/);
        clean = clauses[0].trim() + (clauses[1] ? ` • ${clauses[1].trim()}` : '');
      }
      return clean.trim();
    }
    return line;
  });

  inputBody.value = shortened.join('\n');
  updateSlideFromForm();
  copilotBox.classList.remove('visible');
}

// --- 7. SLIDE RENDERING ENGINE (Approved Templates Support) ---
function renderCurrentSlide(reanimate = false) {
  const slide = appData.slides[currentSlideIndex];
  if (!slide) return;

  const shouldReanimate = (reanimate === true);

  const isBgBleed = slide.imagePlacement === 'bg-bleed' && slide.mediaUrl;
  const stageHtml = buildSlideHtml(slide, currentSlideIndex);

  liveStageEl.innerHTML = stageHtml;
  fullscreenStageEl.innerHTML = stageHtml;

  const theme = appData.theme || 'theme-dept-blue-banner';
  const bgClass = isBgBleed ? 'has-bg-image' : '';
  const animEnabled = slide.animate !== false;
  const animType = slide.animationType || 'push';
  const animClass = animEnabled ? `slide-anim-${animType}` : 'slide-anim-none';
  const mapStageClass = slide.layout === 'layout-tn-map' ? 'layout-stage-tn-map' : '';

  if (shouldReanimate && animEnabled) {
    // Re-trigger animation cleanly by resetting and forcing reflow (only on explicit slide switches or anim changes)
    liveStageEl.className = 'slide-stage';
    fullscreenStageEl.className = 'slide-stage';
    void liveStageEl.offsetWidth;
    void fullscreenStageEl.offsetWidth;
    liveStageEl.className = `slide-stage ${theme} ${bgClass} ${animClass} ${mapStageClass}`;
    fullscreenStageEl.className = `slide-stage ${theme} ${bgClass} ${animClass} ${mapStageClass}`;
  } else {
    // Stable editing render: NO reflow forcing and live studio stage stays completely static (no jumpy re-fade on keystrokes!)
    liveStageEl.className = `slide-stage ${theme} ${bgClass} slide-anim-none ${mapStageClass}`;
    fullscreenStageEl.className = `slide-stage ${theme} ${bgClass} ${animClass} ${mapStageClass}`;
  }

  if (isBgBleed) {
    liveStageEl.style.backgroundImage = `url('${slide.mediaUrl}')`;
    fullscreenStageEl.style.backgroundImage = `url('${slide.mediaUrl}')`;
  } else {
    liveStageEl.style.backgroundImage = '';
    fullscreenStageEl.style.backgroundImage = '';
  }

  const total = appData.slides.length;
  slideCounterDisplay.textContent = `${currentSlideIndex + 1} / ${total}`;
  hudCounter.textContent = `${currentSlideIndex + 1} / ${total}`;
  progressBar.style.width = `${((currentSlideIndex + 1) / total) * 100}%`;

  // Update Outline Tab Pane Navigation Bar
  const outlineCurrent = document.getElementById('outline-nav-current');
  const outlineTotal = document.getElementById('outline-nav-total');
  const outlinePrevBtn = document.getElementById('btn-outline-prev-slide');
  const outlineNextBtn = document.getElementById('btn-outline-next-slide');
  const canvasPrevBtn = document.getElementById('btn-prev-slide');
  const canvasNextBtn = document.getElementById('btn-next-slide');
  if (outlineCurrent) outlineCurrent.textContent = currentSlideIndex + 1;
  if (outlineTotal) outlineTotal.textContent = total;
  if (outlinePrevBtn) outlinePrevBtn.disabled = currentSlideIndex <= 0;
  if (outlineNextBtn) outlineNextBtn.disabled = currentSlideIndex >= total - 1;
  if (canvasPrevBtn) canvasPrevBtn.disabled = currentSlideIndex <= 0;
  if (canvasNextBtn) canvasNextBtn.disabled = currentSlideIndex >= total - 1;

  rescalePresentationViewports();

  // Enable Direct On-Canvas Inline Editing on the Studio Live Stage
  attachOnCanvasInlineEditing(liveStageEl, slide, currentSlideIndex);
}

// --- 7b. DIRECT ON-CANVAS INLINE EDITING ENGINE (PHASE 3) ---
function attachOnCanvasInlineEditing(stageEl, slide, slideIndex) {
  if (!stageEl || !slide) return;

  function makeEditable(el, fieldType, singleLine = false, onSaveCallback = null) {
    if (!el || el.dataset.inlineBound === 'true') return;
    el.dataset.inlineBound = 'true';
    el.classList.add('tn-inline-editable');
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('spellcheck', 'true');
    el.setAttribute('data-inline-field', fieldType);
    el.setAttribute('title', `Click to edit ${fieldType} directly`);
    el.setAttribute('draggable', 'false');

    // Single-line fields (e.g. titles, kickers, dates) exit on Enter key
    if (singleLine) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.blur();
        }
      });
    }

    // Sanitize clipboard paste to pure plain-text
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, text);
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
        }
      }
    });

    // Real-time input synchronization
    el.addEventListener('input', () => {
      if (onSaveCallback) {
        onSaveCallback(el);
      }
      markDirty();
    });

    // On blur: sync thumbnails, brevity checker, and presenter window
    el.addEventListener('blur', () => {
      const activeMiniTitle = document.querySelector('.rail-slide-card.active .mini-title');
      if (activeMiniTitle) activeMiniTitle.textContent = slide.title || 'Untitled Slide';
      const activeRailTitle = document.querySelector('.rail-slide-card.active .rail-slide-title');
      if (activeRailTitle) activeRailTitle.textContent = slide.title || 'Untitled Slide';
      checkBrevity(slide.body || '');
      syncWithPresenterConsole();
    });
  }

  // 1. Primary Slide Title
  const titleEl = stageEl.querySelector('h1.slide-title, h2.slide-title, h1.cover-title, .layout-bootstrap5-stage .tn-title, .section-break-title, .thank-you-title, h1, h2');
  if (titleEl) {
    makeEditable(titleEl, 'title', true, (el) => {
      const text = el.innerText.trim();
      slide.title = text;
      if (inputTitle) inputTitle.value = text;
      const activeMini = document.querySelector('.rail-slide-card.active .mini-title');
      if (activeMini) activeMini.textContent = text || 'Untitled Slide';
      const activeRail = document.querySelector('.rail-slide-card.active .rail-slide-title');
      if (activeRail) activeRail.textContent = text || 'Untitled Slide';
    });
  }

  // 2. Kicker / Category
  const kickerEl = stageEl.querySelector('.slide-kicker, .cover-kicker, .kicker-pill, .mini-kicker');
  if (kickerEl) {
    makeEditable(kickerEl, 'kicker', true, (el) => {
      const text = el.innerText.trim();
      slide.kicker = text;
      if (inputKicker) inputKicker.value = text;
      const activeMiniKicker = document.querySelector('.rail-slide-card.active .mini-kicker');
      if (activeMiniKicker) activeMiniKicker.textContent = text;
    });
  }

  // 3. Subtitle / Presenter / Date Line
  const subEl = stageEl.querySelector('.cover-subtitle, .slide-subtitle, .section-break-subtitle, .thank-you-subtitle, .quote-author');
  if (subEl) {
    makeEditable(subEl, 'subtitle', true, (el) => {
      const text = el.innerText.trim();
      slide.subtitle = text;
      if (inputSubtitle) inputSubtitle.value = text;
    });
  }

  // 4. Strategic Pillars (layout-pillars-3, layout-pillars-4)
  const pillarCards = stageEl.querySelectorAll('.tn-pillar-card');
  if (pillarCards.length > 0) {
    const syncPillars = () => {
      const cards = Array.from(stageEl.querySelectorAll('.tn-pillar-card'));
      const lines = cards.map(c => {
        const t = c.querySelector('.tn-pillar-title')?.innerText?.trim() || '';
        const d = c.querySelector('.tn-pillar-desc')?.innerText?.trim() || '';
        return d ? `${t} | ${d}` : t;
      }).filter(l => l.length > 0);
      slide.body = lines.join('\n');
      if (inputBody) inputBody.value = slide.body;
    };
    pillarCards.forEach(card => {
      const titleNode = card.querySelector('.tn-pillar-title');
      const descNode = card.querySelector('.tn-pillar-desc');
      if (titleNode) makeEditable(titleNode, 'pillar title', true, syncPillars);
      if (descNode) makeEditable(descNode, 'pillar description', false, syncPillars);
    });
    return;
  }

  // 5. Process Flow Steps (layout-process-flow)
  const processCards = stageEl.querySelectorAll('.tn-process-card, .process-step-card, .process-card');
  if (processCards.length > 0) {
    const syncProcess = () => {
      const cards = Array.from(stageEl.querySelectorAll('.tn-process-card, .process-step-card, .process-card'));
      const lines = cards.map((c, i) => {
        const t = c.querySelector('.tn-step-title, .process-step-title')?.innerText?.trim() || '';
        const d = c.querySelector('.tn-step-desc, .process-step-desc')?.innerText?.trim() || '';
        return d ? `${t} | ${d}` : t;
      }).filter(l => l.length > 0);
      slide.body = lines.join('\n');
      if (inputBody) inputBody.value = slide.body;
    };
    processCards.forEach(card => {
      const titleNode = card.querySelector('.tn-step-title, .process-step-title');
      const descNode = card.querySelector('.tn-step-desc, .process-step-desc');
      if (titleNode) makeEditable(titleNode, 'step title', true, syncProcess);
      if (descNode) makeEditable(descNode, 'step description', false, syncProcess);
    });
    return;
  }

  // 6. Milestone Timeline (layout-timeline)
  const timelineCards = stageEl.querySelectorAll('.tn-timeline-item, .timeline-card, .timeline-item, .timeline-content');
  if (timelineCards.length > 0) {
    const syncTimeline = () => {
      const cards = Array.from(stageEl.querySelectorAll('.tn-timeline-item, .timeline-card, .timeline-item, .timeline-content'));
      const lines = cards.map(c => {
        const date = c.querySelector('.tn-timeline-date-badge, .timeline-date-pill')?.innerText?.trim() || '';
        const t = c.querySelector('.tn-timeline-title, .timeline-content-title, .timeline-title')?.innerText?.trim() || '';
        const d = c.querySelector('.tn-timeline-desc, .timeline-content-desc, .timeline-desc')?.innerText?.trim() || '';
        if (date && t) return `[${date}] ${t}${d ? ' | ' + d : ''}`;
        return d ? `${t} | ${d}` : t;
      }).filter(l => l.length > 0);
      slide.body = lines.join('\n');
      if (inputBody) inputBody.value = slide.body;
    };
    timelineCards.forEach(card => {
      const dateNode = card.querySelector('.tn-timeline-date-badge, .timeline-date-pill');
      const titleNode = card.querySelector('.tn-timeline-title, .timeline-content-title, .timeline-title');
      const descNode = card.querySelector('.tn-timeline-desc, .timeline-content-desc, .timeline-desc');
      if (dateNode) makeEditable(dateNode, 'date', true, syncTimeline);
      if (titleNode) makeEditable(titleNode, 'milestone title', true, syncTimeline);
      if (descNode) makeEditable(descNode, 'milestone description', false, syncTimeline);
    });
    return;
  }

  // 7. Executive Agenda Topics (layout-agenda)
  const agendaCards = stageEl.querySelectorAll('.tn-agenda-card, .agenda-item, .agenda-card, .agenda-row');
  if (agendaCards.length > 0) {
    const syncAgenda = () => {
      const cards = Array.from(stageEl.querySelectorAll('.tn-agenda-card, .agenda-item, .agenda-card, .agenda-row'));
      const lines = cards.map(c => {
        const t = c.querySelector('.tn-agenda-title, .agenda-item-title, .agenda-title')?.innerText?.trim() || '';
        const d = c.querySelector('.tn-agenda-desc, .agenda-item-desc, .agenda-desc')?.innerText?.trim() || '';
        return d ? `${t} | ${d}` : t;
      }).filter(l => l.length > 0);
      slide.body = lines.join('\n');
      if (inputBody) inputBody.value = slide.body;
    };
    agendaCards.forEach(card => {
      const titleNode = card.querySelector('.tn-agenda-title, .agenda-item-title, .agenda-title');
      const descNode = card.querySelector('.tn-agenda-desc, .agenda-item-desc, .agenda-desc');
      if (titleNode) makeEditable(titleNode, 'topic title', true, syncAgenda);
      if (descNode) makeEditable(descNode, 'topic description', false, syncAgenda);
    });
    return;
  }

  // 8. Policy Comparison Columns (layout-comparison)
  const comparisonCards = stageEl.querySelectorAll('.tn-comparison-card, .comparison-col, .comparison-card');
  if (comparisonCards.length > 0) {
    const syncComparison = () => {
      const cards = Array.from(stageEl.querySelectorAll('.tn-comparison-card, .comparison-col, .comparison-card'));
      const lines = cards.map(c => {
        const t = c.querySelector('.tn-comparison-title, .comparison-col-header, .comparison-title')?.innerText?.trim() || '';
        const bullets = Array.from(c.querySelectorAll('.tn-comparison-list li span:last-child')).map(b => b.innerText.trim()).filter(b => b.length > 0);
        const d = bullets.length > 0 ? bullets.join(' • ') : (c.querySelector('.tn-comparison-desc, p')?.innerText?.trim() || '');
        return d ? `${t} | ${d}` : t;
      }).filter(l => l.length > 0);
      slide.body = lines.join('\n');
      if (inputBody) inputBody.value = slide.body;
    };
    comparisonCards.forEach(card => {
      const titleNode = card.querySelector('.tn-comparison-title, .comparison-col-header, .comparison-title');
      if (titleNode) makeEditable(titleNode, 'column title', true, syncComparison);
      card.querySelectorAll('.tn-comparison-list li span:last-child').forEach(span => {
        makeEditable(span, 'comparison item', false, syncComparison);
      });
    });
    return;
  }

  // 9. Bento Grid (layout-bento-3)
  const bentoCards = stageEl.querySelectorAll('.slide-content-grid.layout-bento-3 .slide-card');
  if (bentoCards.length > 0) {
    const syncBento = () => {
      const cards = Array.from(stageEl.querySelectorAll('.slide-content-grid.layout-bento-3 .slide-card'));
      const lines = cards.map(c => {
        const t = c.querySelector('h3')?.innerText?.trim() || '';
        const p = c.querySelector('p')?.innerText?.trim() || '';
        return p ? `${t}: ${p}` : t;
      }).filter(l => l.length > 0);
      slide.body = lines.join('\n');
      if (inputBody) inputBody.value = slide.body;
    };
    bentoCards.forEach(card => {
      const h3Node = card.querySelector('h3');
      const pNode = card.querySelector('p');
      if (h3Node) makeEditable(h3Node, 'bento title', true, syncBento);
      if (pNode) makeEditable(pNode, 'bento description', false, syncBento);
    });
    return;
  }

  // 10. Stat Callout (layout-stat-callout)
  const statNumNode = stageEl.querySelector('.big-stat-number, .stat-number, .stat-metric');
  if (statNumNode) {
    const labelNode = stageEl.querySelector('.big-stat-number + div, .stat-label');
    const syncStat = () => {
      const n = statNumNode?.innerText?.trim() || '';
      const l = labelNode?.innerText?.trim() || '';
      slide.body = `${n} | ${l}`;
      if (inputBody) inputBody.value = slide.body;
    };
    makeEditable(statNumNode, 'stat number', true, syncStat);
    if (labelNode) makeEditable(labelNode, 'stat label', true, syncStat);
    return;
  }

  // 11. Executive Quote (layout-quote)
  const quoteBlock = stageEl.querySelector('blockquote.quote-text, .quote-content');
  if (quoteBlock) {
    makeEditable(quoteBlock, 'quote text', false, (el) => {
      slide.body = el.innerText.trim();
      if (inputBody) inputBody.value = slide.body;
    });
    const quoteAuthor = stageEl.querySelector('.quote-author');
    if (quoteAuthor) {
      makeEditable(quoteAuthor, 'author', true, (el) => {
        slide.citation = el.innerText.trim();
        if (inputCitation) inputCitation.value = slide.citation;
      });
    }
    return;
  }

  // 12. Bulleted Lists (Standard, Split 50, and Media Split)
  const listItems = stageEl.querySelectorAll('.split-50-content ul li, ul.slide-bullets li, ol.slide-numbered li, .slide-content-grid.layout-split ul li');
  if (listItems.length > 0) {
    const syncBullets = () => {
      const items = Array.from(stageEl.querySelectorAll('.split-50-content ul li, ul.slide-bullets li, ol.slide-numbered li, .slide-content-grid.layout-split ul li'));
      const lines = items.map(li => {
        const textSpan = li.querySelector('span:last-child');
        return textSpan ? textSpan.innerText.trim() : li.innerText.trim();
      }).filter(t => t.length > 0);
      slide.body = lines.join('\n');
      if (inputBody) inputBody.value = slide.body;
    };
    listItems.forEach(li => {
      const textSpan = li.querySelector('span:last-child');
      const targetEl = textSpan || li;
      makeEditable(targetEl, 'bullet point', false, syncBullets);
    });
    return;
  }

  // 13. Generic Body Text / Living Portal
  const genericBody = stageEl.querySelector('.slide-body, .text-card p, .body-copy, .slide-lead, .layout-bootstrap5-stage .lead');
  if (genericBody && !genericBody.classList.contains('tn-inline-editable')) {
    makeEditable(genericBody, 'body text', false, (el) => {
      slide.body = el.innerText.trim();
      if (inputBody) inputBody.value = slide.body;
    });
  }
}

function renderStructuredContentLines(lines, options = {}) {
  if (!lines || lines.length === 0) return '';
  const bulletIcon = options.bulletIcon || '✦';

  return lines.map(line => {
    const trimmed = (line || '').trim();
    if (!trimmed) return '';

    // 1. Heading 3: Subhead / Card Title
    if (trimmed.startsWith('### ')) {
      const headingText = trimmed.replace(/^###\s+/, '');
      return `
        <div class="slide-body-subhead" style="font-size: 1.05rem; font-weight: 700; color: var(--tn-navy); margin: 0.65rem 0 0.25rem; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 4px; height: 14px; background: var(--tn-state-red); border-radius: 2px;"></span>
          <span>${escapeHtml(headingText)}</span>
        </div>
      `;
    }

    // 2. Heading 4: Eyebrow / Minor Tag
    if (trimmed.startsWith('#### ')) {
      const tagText = trimmed.replace(/^####\s+/, '');
      return `
        <div class="slide-body-tag" style="font-size: 0.72rem; font-weight: 800; color: var(--tn-state-red); text-transform: uppercase; letter-spacing: 0.06em; margin: 0.45rem 0 0.15rem;">
          ${escapeHtml(tagText)}
        </div>
      `;
    }

    // 3. Numbered Item: 1. or 1)
    const numMatch = trimmed.match(/^(\d{1,2})[\.\)]\s+(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const text = numMatch[2];
      return `
        <li class="slide-numbered-item" style="display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.88rem; line-height: 1.45; margin-bottom: 0.35rem;">
          <span class="slide-num-badge" style="background: var(--tn-navy); color: #fff; font-size: 0.7rem; font-weight: 700; border-radius: 50%; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; flex-shrink: 0; margin-top: 2px; box-shadow: 0 1px 3px rgba(0,45,114,0.25);">${escapeHtml(num)}</span>
          <span>${escapeHtml(text)}</span>
        </li>
      `;
    }

    // 4. Bullet Item: • or - or *
    const bulletMatch = trimmed.match(/^[•\-\*✦■★]\s+(.*)$/);
    if (bulletMatch) {
      const text = bulletMatch[1];
      return `
        <li class="slide-bullet-item" style="display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.88rem; line-height: 1.45; margin-bottom: 0.35rem;">
          <span style="color: var(--tn-state-red); font-size: 1rem; line-height: 1; flex-shrink: 0; margin-top: 1px;">${bulletIcon}</span>
          <span>${escapeHtml(text)}</span>
        </li>
      `;
    }

    // 5. Normal paragraph
    return `
      <p class="slide-body-paragraph" style="margin: 0.35rem 0 0.45rem; font-size: 0.88rem; line-height: 1.45; color: var(--tn-slate-800);">
        ${escapeHtml(trimmed)}
      </p>
    `;
  }).join('');
}

function renderDecorativeWatermark(slide) {
  if (!slide || !slide.bgIcon || !slide.bgIcon.trim()) return '';
  const rawIcon = slide.bgIcon.trim();
  const iconClass = rawIcon.includes('fa-') ? (rawIcon.startsWith('fa-solid') ? rawIcon : 'fa-solid ' + rawIcon) : ('fa-solid fa-' + rawIcon);
  const opacity = (typeof slide.bgIconOpacity === 'number') ? slide.bgIconOpacity : 0.04;
  const position = slide.bgIconPosition || 'bottom-right';

  let posStyle = 'bottom: 24px; right: 28px; font-size: 240px; transform: rotate(-6deg);';
  if (position === 'center') {
    posStyle = 'top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-6deg); font-size: 280px;';
  } else if (position === 'top-right') {
    posStyle = 'top: 36px; right: 28px; font-size: 200px; transform: rotate(6deg);';
  }

  const isDarkLayout = slide.layout === 'layout-section-break';
  const color = isDarkLayout ? 'rgba(255, 255, 255, 0.95)' : 'var(--slide-accent, var(--tn-navy))';

  return `
    <div class="slide-decorative-watermark" aria-hidden="true" style="${posStyle} opacity: ${opacity}; color: ${color};">
      <i class="${iconClass}"></i>
    </div>
  `;
}

function buildSlideHtml(slide, index) {
  // Graceful fallback if a slide was previously set to layout-bootstrap5
  if (slide.layout === 'layout-bootstrap5') {
    slide.layout = 'layout-split';
  }

  const isWiggle = appData.enableCardWiggle !== false ? 'animate-wiggle' : '';
  const photoStyle = appData.photoStyle || 'photo-style-blue-overlay';
  const lines = (slide.body || '').split('\n').filter(l => l.trim().length > 0);
  const agencyLogoSrc = getActiveAgencyLogoUrl();

  const citationBadgeHtml = slide.citation ? `
    <div class="tn-citation-badge" title="Statutory Authority: ${escapeHtml(slide.citation)}" aria-label="Statutory Authority: ${escapeHtml(slide.citation)}">
      <i class="fa-solid fa-scale-balanced" style="font-size: 11px;" aria-hidden="true"></i>
      <span>${escapeHtml(slide.citation)}</span>
    </div>
  ` : '';

  const watermarkHtml = renderDecorativeWatermark(slide);

  // 1. APPROVED TEMPLATE 2: BLUE BANNER COVER SLIDE
  if (slide.layout === 'layout-cover-blue-banner') {
    return `
      <div class="layout-cover-blue-banner-stage">
        ${watermarkHtml}
        <div class="cover-top-agency">
          ${agencyLogoSrc ? `<img src="${agencyLogoSrc}" alt="Department Logo">` : `
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--tn-navy); letter-spacing: -0.01em;">
              TENNESSEE
            </div>
          `}
        </div>
        <div class="cover-bottom-banner">
          <h1>${escapeHtml(slide.title)}</h1>
          ${lines.length > 1 ? `
            <div class="banner-sub-bullets" style="display: flex; flex-direction: column; gap: 0.35rem; margin: 0.6rem 0 0.9rem; font-size: 0.95rem; color: rgba(255, 255, 255, 0.95); text-align: left; max-width: 85%;">
              ${lines.map(l => `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: var(--tn-gold); font-size: 0.8rem;">★</span><span>${escapeHtml(l)}</span></div>`).join('')}
            </div>
          ` : `
            <div class="banner-sub">${escapeHtml(lines[0] || 'Strategic Modernization & Leadership Briefing')}</div>
          `}
          <div class="cover-banner-footer">
            <span>${escapeHtml(slide.authorName || 'Jane Doe, Position')}</span>
            <span>|</span>
            <span>${escapeHtml(slide.authorDate || 'October 2026')}</span>
          </div>
        </div>
      </div>
    `;
  }

  // 2. APPROVED TEMPLATE 1: STATE CLASSIC COVER SLIDE (BWC style)
  if (slide.layout === 'layout-cover-state-classic') {
    return `
      <div class="layout-cover-state-classic-stage">
        ${watermarkHtml}
        <div class="slide-corner-logo">
          ${typeof TN_BRAND_ASSETS !== 'undefined' ? `<img src="${TN_BRAND_ASSETS.tnSquareLogo}" alt="TN State Logo">` : ''}
        </div>
        <div class="state-classic-meta-top">${escapeHtml(slide.kicker || 'PROJECT XXXX')}</div>
        <div class="state-classic-title-block">
          <div style="font-size: 0.95rem; font-weight: 700; color: var(--tn-slate-600); text-transform: uppercase; margin-bottom: 4px;">STATE OF TENNESSEE</div>
          <h1>${escapeHtml(slide.title)}</h1>
          ${lines.length > 0 ? `
            <div class="state-classic-subtitles" style="margin-top: 1.1rem; display: flex; flex-direction: column; gap: 0.45rem; font-size: 1.05rem; color: var(--tn-slate-700);">
              ${lines.map(l => `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: var(--tn-state-red); font-size: 0.8rem;">★</span><span>${escapeHtml(l)}</span></div>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="state-classic-logo-center">
          ${typeof TN_BRAND_ASSETS !== 'undefined' ? `<img src="${TN_BRAND_ASSETS.bwcLogo}" alt="Agency Emblem">` : ''}
        </div>
        <footer class="slide-footer">
          <div>${escapeHtml(slide.authorDate || '10/01/2026')}</div>
          ${citationBadgeHtml}
          <div>STATE OF TENNESSEE</div>
        </footer>
      </div>
    `;
  }

  // APPROVED STATE SECTION DIVIDER & TOPIC BREAKER (Full Bleed)
  if (slide.layout === 'layout-section-break') {
    const kickerText = slide.kicker || `SECTION 0${index + 1}`;
    const numMatch = kickerText.match(/\b(?:SECTION|PART|MODULE)?\s*0?(\d{1,2})\b/i);
    const watermarkNum = numMatch ? String(numMatch[1]).padStart(2, '0') : String(index + 1).padStart(2, '0');
    const isCrimson = appData.theme === 'theme-tn-crimson-bold';

    return `
      <div class="layout-section-break-stage ${isCrimson ? 'theme-crimson' : ''}">
        ${watermarkHtml}
        <div class="section-break-watermark" aria-hidden="true">${escapeHtml(watermarkNum)}</div>
        <div class="slide-corner-logo">
          ${typeof TN_BRAND_ASSETS !== 'undefined' ? `<img src="${TN_BRAND_ASSETS.tnSquareLogo}" alt="TN State Logo">` : ''}
        </div>
        <div class="section-break-kicker">${escapeHtml(kickerText)}</div>
        <h1>${escapeHtml(slide.title)}</h1>
        <div class="section-break-divider"></div>
        ${lines.length > 1 ? `
          <div class="section-break-bullets" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 1.05rem; color: rgba(255, 255, 255, 0.95); z-index: 2; position: relative;">
            ${lines.map(l => `<div style="display: flex; align-items: center; gap: 8px;"><span style="color: var(--tn-gold); font-size: 0.8rem;">★</span><span>${escapeHtml(l)}</span></div>`).join('')}
          </div>
        ` : (slide.body ? `<div class="section-break-sub">${escapeHtml(slide.body.split('\n')[0])}</div>` : '')}
        <footer class="slide-footer" style="color: rgba(255, 255, 255, 0.7); border-top-color: rgba(255, 255, 255, 0.15);">
          <div>${escapeHtml(slide.authorDate || 'STATE OF TENNESSEE')}</div>
          ${citationBadgeHtml}
          <div>EXECUTIVE BRIEFING</div>
        </footer>
      </div>
    `;
  }

  // 3. APPROVED TEMPLATE 2: SPLIT 50/50 HERO SLIDE
  if (slide.layout === 'layout-split-50') {
    return `
      <div class="layout-split-50-stage">
        ${watermarkHtml}
        <div class="split-50-content">
          ${slide.kicker ? `<div class="slide-kicker">${escapeHtml(slide.kicker)}</div>` : ''}
          <h2>${escapeHtml(slide.title)}</h2>
          <div class="accent-rule" style="margin-bottom: 1.25rem;"></div>
          <div class="slide-text-structured" style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${renderStructuredContentLines(lines, { bulletIcon: '■' })}
          </div>
          <div style="margin-top: 1.5rem; font-size: 0.8rem; color: var(--tn-slate-500); font-weight: 600;">
            ${escapeHtml(slide.authorName || '')} ${slide.authorDate ? `| ${escapeHtml(slide.authorDate)}` : ''}
          </div>
        </div>
        <div class="split-50-media">
          ${slide.videoUrl ? `
            <div class="video-player-frame" data-action="launch-video-theater" role="region" aria-label="Video presentation for ${escapeHtml(slide.title)}">
              ${isDirectVideoFile(slide.videoUrl) ? `
                <video src="${escapeHtml(slide.videoUrl)}" controls playsinline title="Video presentation for ${escapeHtml(slide.title)}"></video>
              ` : `
                <iframe src="${escapeHtml(normalizeYouTubeEmbedUrl(slide.videoUrl, false))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="Video presentation for ${escapeHtml(slide.title)}"></iframe>
              `}
              <div class="video-player-overlay-bar">
                <button type="button" class="video-play-badge" data-action="launch-video-theater">
                  ▶ Fullscreen Video
                </button>
                <div class="video-fullscreen-hint">
                  <span>Press Space / Next to play full screen</span>
                  <span style="opacity: 0.6;">•</span>
                  <span>🛡️ Protected</span>
                </div>
              </div>
            </div>
          ` : (slide.mediaUrl ? `<img src="${escapeHtml(slide.mediaUrl)}" alt="${escapeHtml(slide.mediaAlt || 'Slide photo')}">` : `
            <div style="width:100%; height:100%; background: var(--tn-navy); display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.2rem; font-weight:700;">
              TENNESSEE
            </div>
          `)}
          ${slide.mediaCaption ? `<div class="photo-caption-tag">${escapeHtml(slide.mediaCaption)}</div>` : ''}
        </div>
      </div>
    `;
  }

  // 4. APPROVED TEMPLATE 1: THANK YOU CLOSING SLIDE
  if (slide.layout === 'layout-thank-you') {
    return `
      <div class="layout-thank-you-stage">
        ${watermarkHtml}
        <div class="slide-corner-logo">
          ${typeof TN_BRAND_ASSETS !== 'undefined' ? `<img src="${TN_BRAND_ASSETS.tnSquareLogo}" alt="TN State Logo">` : ''}
        </div>
        <h1>${escapeHtml(slide.title || 'THANK YOU')}</h1>
        <div class="thank-you-divider"></div>
        <div class="thank-you-meta">
          ${lines.map(l => `<p style="margin-bottom: 0.4rem;">${escapeHtml(l)}</p>`).join('')}
          <p style="margin-top: 1rem; font-weight: 700; color: var(--tn-slate-800);">${escapeHtml(slide.authorName || '')}</p>
          <p style="font-size: 0.9rem; color: var(--tn-slate-500);">${escapeHtml(slide.authorDate || '')}</p>
        </div>
        <footer class="slide-footer">
          <div>State of Tennessee Presentation System</div>
          ${citationBadgeHtml}
          <div>Slide ${index + 1} of ${appData.slides.length}</div>
        </footer>
      </div>
    `;
  }

  // Default Content Header
  let headerHtml = `
    <header class="slide-header">
      ${slide.kicker ? `<div class="slide-kicker">
        <span>${escapeHtml(slide.kicker)}</span>
      </div>` : ''}
      <h2>${escapeHtml(slide.title || 'Untitled Slide')}</h2>
      <div class="accent-rule"></div>
    </header>
    <div class="slide-corner-logo">
      ${agencyLogoSrc ? `<img src="${agencyLogoSrc}" alt="Agency Logo">` : `
        <div class="tn-tristar-badge" style="width: 28px; height: 28px;">
          <img src="https://www.tn.gov/etc/clientlibs/tncore/main/img/footer-starball.png" alt="State of Tennessee Tri-Star" width="28" height="28">
        </div>
      `}
    </div>
  `;

  // Media Section Generator
  let mediaHtml = '';
  if (slide.videoUrl) {
    const embedUrl = normalizeYouTubeEmbedUrl(slide.videoUrl, false);
    const isDirect = isDirectVideoFile(slide.videoUrl);
    mediaHtml = `
      <div class="video-player-frame" data-action="launch-video-theater" role="region" aria-label="Video presentation for ${escapeHtml(slide.title)}">
        ${isDirect ? `
          <video src="${escapeHtml(slide.videoUrl)}" controls playsinline title="Video presentation for ${escapeHtml(slide.title)}"></video>
        ` : `
          <iframe src="${escapeHtml(embedUrl)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="Video presentation for ${escapeHtml(slide.title)}"></iframe>
        `}
        <div class="video-player-overlay-bar">
          <button type="button" class="video-play-badge" data-action="launch-video-theater">
            ▶ Fullscreen Video
          </button>
          <div class="video-fullscreen-hint">
            <span>Press Space / Next to play full screen</span>
            <span style="opacity: 0.6;">•</span>
            <span>🛡️ Protected</span>
          </div>
        </div>
      </div>
    `;
  } else if (slide.mediaUrl && slide.imagePlacement !== 'bg-bleed') {
    const altAttr = slide.isDecorative ? 'alt="" aria-hidden="true"' : `alt="${escapeHtml(slide.mediaAlt || 'Slide illustration')}"`;
    const captionHtml = slide.mediaCaption ? `<div class="photo-caption-tag">${escapeHtml(slide.mediaCaption)}</div>` : '';

    if (photoStyle === 'photo-style-bento') {
      mediaHtml = `
        <div class="photo-style-bento ${isWiggle}">
          <div class="bento-cell span-row">
            <img src="${escapeHtml(slide.mediaUrl)}" ${altAttr}>
          </div>
          <div class="bento-cell">
            <img src="${escapeHtml(slide.mediaUrl)}" ${altAttr} style="filter: brightness(0.9) contrast(1.1);">
          </div>
          <div class="bento-cell">
            <div style="background: var(--tn-navy); width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:0.85rem; letter-spacing:0.05em;">
              TENNESSEE
            </div>
          </div>
          ${captionHtml}
        </div>
      `;
    } else if (photoStyle === 'photo-style-framed') {
      mediaHtml = `
        <div class="photo-style-framed ${isWiggle}">
          <img src="${escapeHtml(slide.mediaUrl)}" ${altAttr}>
          ${captionHtml}
        </div>
      `;
    } else {
      mediaHtml = `
        <div class="photo-style-blue-overlay ${isWiggle}">
          <img src="${escapeHtml(slide.mediaUrl)}" ${altAttr}>
          ${captionHtml}
        </div>
      `;
    }
  }

  // Layout Specific Content
  let bodyHtml = '';
  if (slide.layout === 'layout-title-hero') {
    return `
      <div class="layout-title-hero">
        ${watermarkHtml}
        <div class="slide-corner-logo">
          ${agencyLogoSrc ? `<img src="${agencyLogoSrc}" alt="Logo">` : ''}
        </div>
        ${slide.kicker ? `<div class="slide-kicker" style="font-size: 0.85rem; margin-bottom: 0.4rem;">${escapeHtml(slide.kicker)}</div>` : ''}
        <h1>${escapeHtml(slide.title)}</h1>
        <div class="accent-rule" style="width: 60px; height: 4px; margin-bottom: 1.2rem;"></div>
        <div class="hero-sub">
          ${lines.map(l => `<p style="margin-bottom: 0.35rem;">${escapeHtml(l)}</p>`).join('')}
        </div>
        <footer class="slide-footer">
          <div class="slide-footer-brand">State of Tennessee • Executive Deck</div>
          <div>Slide ${index + 1}</div>
        </footer>
      </div>
    `;
  }

  if (slide.layout === 'layout-pillars-3' || slide.layout === 'layout-pillars-4') {
    const pillarCount = slide.layout === 'layout-pillars-4' ? 4 : 3;
    const pillars = parsePillarsContent(slide.body, pillarCount);
    
    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid ${slide.layout}">
        ${pillars.map((p, i) => {
          const numStr = String(i + 1).padStart(2, '0');
          const defaultIcon = i === 0 ? 'landmark' : i === 1 ? 'chart-line' : i === 2 ? 'shield-check' : 'bullseye';
          const iconSvg = getPillarIconSvg(p.icon || defaultIcon);
          return `
            <div class="tn-pillar-card ${isWiggle}">
              <div class="tn-pillar-header">
                <span class="tn-pillar-badge">PILLAR ${numStr}</span>
                <div class="tn-pillar-icon-box" title="Priority ${numStr}">
                  ${iconSvg}
                </div>
              </div>
              <h3 class="tn-pillar-title">${escapeHtml(p.title)}</h3>
              <div class="tn-pillar-desc">
                ${p.desc.includes('•') ? `
                  <ul class="tn-pillar-bullets">
                    ${p.desc.split('•').filter(s => s.trim().length > 0).map(b => `
                      <li>
                        <span style="color: var(--tn-state-red); font-size: 0.75rem; line-height: 1.4; margin-right: 0.2rem;">★</span>
                        <span>${escapeHtml(b.trim())}</span>
                      </li>
                    `).join('')}
                  </ul>
                ` : `
                  <p style="margin: 0; line-height: 1.45;">${escapeHtml(p.desc)}</p>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (slide.layout === 'layout-process-flow') {
    const steps = parseProcessFlowContent(slide.body);
    
    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid layout-process-flow">
        ${steps.map((st, i) => {
          const isLast = i === steps.length - 1;
          const numStr = String(i + 1).padStart(2, '0');
          const badgeText = isLast ? 'FINAL STEP' : `STEP ${numStr}`;
          const checkmarkSvg = `<svg role="img" aria-label="Completion" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          const cardHtml = `
            <div class="tn-process-card ${isLast ? 'is-final-step' : ''} ${isWiggle}">
              <div class="tn-process-header">
                <span class="tn-step-badge">${badgeText}</span>
                <div class="tn-step-num-circle" title="Step ${i + 1}">
                  ${isLast ? checkmarkSvg : (i + 1)}
                </div>
              </div>
              <h3 class="tn-step-title">${escapeHtml(st.title)}</h3>
              <div class="tn-step-desc">
                ${st.desc.includes('•') ? `
                  <ul class="tn-pillar-bullets">
                    ${st.desc.split('•').filter(s => s.trim().length > 0).map(b => `
                      <li>
                        <span style="color: var(--tn-state-red); font-size: 0.75rem; line-height: 1.4; margin-right: 0.2rem;">★</span>
                        <span>${escapeHtml(b.trim())}</span>
                      </li>
                    `).join('')}
                  </ul>
                ` : `
                  <p>${escapeHtml(st.desc)}</p>
                `}
              </div>
            </div>
          `;

          const connectorHtml = !isLast ? `
            <div class="tn-process-step-connector" aria-hidden="true">
              <svg role="img" aria-label="Next Step" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          ` : '';

          return cardHtml + connectorHtml;
        }).join('')}
      </div>
    `;
  } else if (slide.layout === 'layout-timeline') {
    const milestones = parseTimelineContent(slide.body);
    const calendarSvg = `<svg role="img" aria-label="Milestone Date" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px; vertical-align: -1px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
    const starSvg = `<svg role="img" aria-label="Final Go-Live" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid layout-timeline">
        <div class="tn-timeline-container">
          <div class="tn-timeline-track" aria-hidden="true"></div>
          <div class="tn-timeline-milestones-row">
            ${milestones.map((m, i) => {
              const isLast = i === milestones.length - 1;
              return `
                <div class="tn-timeline-item ${isLast ? 'is-final-milestone' : ''} ${isWiggle}">
                  <div class="tn-timeline-node" title="Milestone ${i + 1}">
                    ${isLast ? starSvg : '<div class="tn-timeline-node-dot"></div>'}
                  </div>
                  <span class="tn-timeline-date-badge">${calendarSvg}${escapeHtml(m.date)}</span>
                  <div class="tn-timeline-card">
                    <h3 class="tn-timeline-title">${escapeHtml(m.title)}</h3>
                    <div class="tn-timeline-desc">
                      ${m.desc.includes('•') ? `
                        <ul class="tn-pillar-bullets">
                          ${m.desc.split('•').filter(s => s.trim().length > 0).map(b => `
                            <li>
                              <span style="color: var(--tn-state-red); font-size: 0.75rem; line-height: 1.4; margin-right: 0.2rem;">★</span>
                              <span>${escapeHtml(b.trim())}</span>
                            </li>
                          `).join('')}
                        </ul>
                      ` : `
                        <p>${escapeHtml(m.desc)}</p>
                      `}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  } else if (slide.layout === 'layout-comparison') {
    const comp = parseComparisonContent(slide.body);
    const checkmarkSvg = `<svg role="img" aria-label="Adopted improvement" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const neutralDotSvg = `<svg role="img" aria-label="Current baseline item" width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"></circle></svg>`;

    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid layout-comparison">
        <div class="tn-comparison-card card-baseline ${isWiggle}">
          <div class="tn-comparison-header">
            <span class="tn-comparison-badge badge-baseline">${escapeHtml(comp.left.badge)}</span>
            <span style="font-size: 0.7rem; font-weight: 700; color: var(--tn-slate-500); text-transform: uppercase;">Baseline</span>
          </div>
          <h3 class="tn-comparison-title">${escapeHtml(comp.left.title)}</h3>
          <ul class="tn-comparison-list">
            ${comp.left.bullets.map(b => `
              <li class="tn-comparison-item">
                <span class="tn-comparison-bullet-icon" aria-hidden="true">${neutralDotSvg}</span>
                <span>${escapeHtml(b)}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <div class="tn-comparison-vs-divider" aria-hidden="true">VS</div>

        <div class="tn-comparison-card card-reform ${isWiggle}">
          <div class="tn-comparison-header">
            <span class="tn-comparison-badge badge-reform">${escapeHtml(comp.right.badge)}</span>
            <span style="font-size: 0.7rem; font-weight: 800; color: var(--tn-state-red); text-transform: uppercase; letter-spacing: 0.04em;">Enacted</span>
          </div>
          <h3 class="tn-comparison-title">${escapeHtml(comp.right.title)}</h3>
          <ul class="tn-comparison-list">
            ${comp.right.bullets.map(b => `
              <li class="tn-comparison-item">
                <span class="tn-comparison-bullet-icon" aria-hidden="true">${checkmarkSvg}</span>
                <span>${escapeHtml(b)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;
  } else if (slide.layout === 'layout-agenda') {
    const items = parseAgendaContent(slide.body);

    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid layout-agenda">
        ${items.map((it) => `
          <div class="tn-agenda-card ${isWiggle}">
            <div class="tn-agenda-num-circle">${escapeHtml(it.num)}</div>
            <div class="tn-agenda-content">
              <h3 class="tn-agenda-title">${escapeHtml(it.title)}</h3>
              ${it.desc ? `<p class="tn-agenda-desc">${escapeHtml(it.desc)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (slide.layout === 'layout-bento-3') {
    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid layout-bento-3">
        ${lines.slice(0, 3).map((line, i) => `
          <div class="slide-card ${isWiggle}">
            <div style="font-size: 1.3rem; font-weight: 800; color: var(--tn-state-red); line-height: 1;">0${i + 1}</div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--tn-navy);">${escapeHtml(line.split(':')[0] || 'Focus Area')}</h3>
            <p style="font-size: 0.825rem; line-height: 1.4; color: inherit; opacity: 0.85;">${escapeHtml(line.includes(':') ? line.split(':').slice(1).join(':') : line)}</p>
          </div>
        `).join('')}
      </div>
    `;
  } else if (slide.layout === 'layout-stat-callout') {
    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid layout-stat-callout">
        <div class="slide-card ${isWiggle}">
          <div class="slide-text-structured" style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${renderStructuredContentLines(lines, { bulletIcon: '★' })}
          </div>
        </div>
        <div class="slide-card ${isWiggle}" style="text-align: center; justify-content: center; align-items: center; background: linear-gradient(135deg, var(--tn-navy-dark) 0%, var(--tn-navy) 100%); color: #fff;">
          <div class="big-stat-number" style="color: var(--tn-gold);">${escapeHtml(slide.statNumber || 'AAA')}</div>
          <div style="font-size: 0.95rem; font-weight: 700; max-width: 180px; line-height: 1.25;">${escapeHtml(slide.statLabel || 'State Fiscal Bond Rating')}</div>
        </div>
      </div>
    `;
  } else if (slide.layout === 'layout-chart-bar' || slide.layout === 'layout-chart-kpi' || slide.layout === 'layout-data-table' || (slide.chartData && slide.chartData.length > 0)) {
    const chartData = slide.chartData || [];
    const activeMode = slide.chartViewMode || (slide.layout === 'layout-data-table' ? 'table' : 'chart');
    const unit = slide.chartUnit || '';
    const caption = slide.chartCaption || 'State of Tennessee Performance Indicators';
    const labelHeader = slide.chartLabelHeader || 'Category';
    const valueHeader = slide.chartValueHeader || 'Metric Value';
    const hasSecondary = !!slide.chartSecondaryHeader;

    // Max value for bar scaling
    const numericVals = chartData.map(d => parseFloat(String(d.value).replace(/[^0-9.-]/g, '')) || 0);
    const maxVal = Math.max(...numericVals, 1);

    // 1. Horizontal Bar Visual
    const barRowsHtml = chartData.map((d, i) => {
      const valNum = parseFloat(String(d.value).replace(/[^0-9.-]/g, '')) || 0;
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
    }).join('');

    // 2. KPI Cards Visual
    const kpiCardsHtml = chartData.slice(0, 4).map((d, i) => `
      <div class="kpi-card ${isWiggle}">
        <div class="kpi-metric-number">${escapeHtml(d.value)}${escapeHtml(unit)}</div>
        <div class="kpi-metric-label">${escapeHtml(d.label)}</div>
        ${d.badge ? `<div class="kpi-metric-badge">${escapeHtml(d.badge)}</div>` : ''}
      </div>
    `).join('');

    // 3. Paired Semantic Accessible HTML Table (WCAG 2.1 AA)
    const pairedTableHtml = `
      <div class="accessible-table-wrapper ${activeMode === 'chart' ? 'sr-only-when-chart' : ''}">
        <table class="accessible-data-table">
          <caption>${escapeHtml(caption)}</caption>
          <thead>
            <tr>
              <th scope="col">${escapeHtml(labelHeader)}</th>
              <th scope="col" style="text-align: right;">${escapeHtml(valueHeader)}</th>
              ${hasSecondary ? `<th scope="col" style="text-align: right;">${escapeHtml(slide.chartSecondaryHeader)}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${chartData.map(d => `
              <tr>
                <th scope="row">${escapeHtml(d.label)}</th>
                <td style="text-align: right; font-variant-numeric: tabular-nums;">${escapeHtml(d.value)}${escapeHtml(unit)}</td>
                ${hasSecondary ? `<td style="text-align: right; font-variant-numeric: tabular-nums;">${escapeHtml(d.secondaryValue || '')}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Visual container based on layout
    let visualHtml = '';
    if (slide.layout === 'layout-chart-kpi') {
      visualHtml = `
        <div class="chart-kpi-grid ${activeMode === 'chart' ? '' : 'sr-only-when-chart'}">
          ${kpiCardsHtml}
        </div>
      `;
    } else if (slide.layout === 'layout-data-table') {
      visualHtml = '';
    } else {
      // Default: layout-chart-bar
      visualHtml = `
        <div class="chart-bar-container ${activeMode === 'chart' ? '' : 'sr-only-when-chart'}">
          ${barRowsHtml}
        </div>
      `;
    }

    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid" style="grid-template-columns: 1fr; align-items: start; max-width: 860px; margin: 0 auto; width: 100%;">
        <div class="slide-card ${isWiggle}" style="padding: 1.1rem 1.4rem;">
          <div class="chart-slide-header-bar">
            <span class="chart-caption-subtext">${escapeHtml(caption)}</span>
            <div class="chart-view-toggle-bar" role="group" aria-label="Toggle visual chart or data table">
              <button type="button" class="chart-toggle-btn ${activeMode === 'chart' ? 'active' : ''}" data-action="toggle-slide-chart-mode" data-mode="chart" title="View visual chart">
                📊 Chart View
              </button>
              <button type="button" class="chart-toggle-btn ${activeMode === 'table' ? 'active' : ''}" data-action="toggle-slide-chart-mode" data-mode="table" title="View accessible semantic data table">
                📋 Data Table (WCAG)
              </button>
            </div>
          </div>

          ${visualHtml}
          ${pairedTableHtml}
        </div>
      </div>
    `;
  } else if (slide.layout === 'layout-tn-map') {
    const mapData = slide.mapData || TN_MAP_PRESETS['fy26-jobs'];
    const activeView = slide.mapViewMode || 'map';
    const mapMode = mapData.mapMode || 'divisions'; // 'divisions' | 'state' | 'county' | 'custom'
    const prefix = mapData.prefix || '';
    const unit = mapData.unit || '';
    const caption = mapData.caption || 'State of Tennessee Geographic Regional Map';
    const selectedDiv = mapData.selectedDivision || 'all';
    const selectedCounty = mapData.selectedCounty || 'Davidson';
    const customCounties = Array.isArray(mapData.customCounties) ? mapData.customCounties : ["Davidson", "Williamson", "Rutherford", "Wilson", "Sumner"];
    const customTitle = mapData.customTitle || "Target Project Counties";
    const customMetric = mapData.customMetric || `${customCounties.length} Counties`;

    const divWest = mapData.divisions ? mapData.divisions.west : TN_MAP_PRESETS['fy26-jobs'].divisions.west;
    const divMid = mapData.divisions ? mapData.divisions.middle : TN_MAP_PRESETS['fy26-jobs'].divisions.middle;
    const divEast = mapData.divisions ? mapData.divisions.east : TN_MAP_PRESETS['fy26-jobs'].divisions.east;

    // Division highlight states
    const isWestActive = selectedDiv === 'west';
    const isMidActive = selectedDiv === 'middle';
    const isEastActive = selectedDiv === 'east';
    const hasSpecificSelection = selectedDiv !== 'all';

    const outlines = (typeof window !== 'undefined' && window.TN_MAP_OUTLINES) || {};
    const counties = (typeof window !== 'undefined' && window.TN_COUNTIES_DATA) || [];
    const metros = (typeof window !== 'undefined' && window.TN_MAP_METROS) || [];

    // Build Mode Switcher Bar on Stage
    const stageModeBarHtml = `
      <div class="tn-map-stage-mode-bar">
        <div class="tn-map-mode-pills" role="tablist" aria-label="Select Map Presentation Mode">
          <button type="button" class="tn-map-mode-btn ${mapMode === 'divisions' ? 'active' : ''}" data-action="set-map-mode" data-mode="divisions" title="Three Grand Divisions (East, Middle, West - TCA § 4-1-201)">
            🏛️ Grand Divisions
          </button>
          <button type="button" class="tn-map-mode-btn ${mapMode === 'state' ? 'active' : ''}" data-action="set-map-mode" data-mode="state" title="Full State Overview with Metro Hubs">
            🗺️ Full State
          </button>
          <button type="button" class="tn-map-mode-btn ${mapMode === 'county' ? 'active' : ''}" data-action="set-map-mode" data-mode="county" title="County by County Interactive Map (95 Counties)">
            📍 County by County
          </button>
          <button type="button" class="tn-map-mode-btn ${mapMode === 'custom' ? 'active' : ''}" data-action="set-map-mode" data-mode="custom" title="Custom County Group Selection">
            ✏️ Custom Group (${customCounties.length})
          </button>
        </div>
        <div class="chart-view-toggle-bar" role="group" aria-label="Toggle map or data table">
          <button type="button" class="chart-toggle-btn ${activeView === 'map' ? 'active' : ''}" data-action="toggle-slide-map-mode" data-mode="map" title="View interactive vector map">
            🗺️ Visual Map
          </button>
          <button type="button" class="chart-toggle-btn ${activeView === 'table' ? 'active' : ''}" data-action="toggle-slide-map-mode" data-mode="table" title="View accessible semantic data table">
            📋 WCAG Table
          </button>
        </div>
      </div>
    `;

    // Generate SVG Content Based on Map Mode
    let svgContentHtml = '';

    // 1. FULL STATE MODE
    if (mapMode === 'state') {
      svgContentHtml = `
        <!-- Full State Authentic Silhouette -->
        <path id="svg-state-perimeter" class="tn-state-path"
              d="${outlines.state || ''}"
              fill="url(#grad-state-full)" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round" />

        <!-- Subtle County Grid Overlay -->
        <g class="tn-state-county-grid" stroke="rgba(255,255,255,0.18)" stroke-width="0.6" fill="none" pointer-events="none">
          ${counties.map(c => `<path d="${c.d}" />`).join('')}
        </g>

        <!-- State of Tennessee Tri-Star Watermark (Centered in Middle TN) -->
        <g transform="translate(395, 128) scale(0.6)" opacity="0.16" pointer-events="none">
          <circle cx="50" cy="50" r="46" fill="#002D62" stroke="#FFFFFF" stroke-width="4"/>
          <polygon points="50,18 53,27 62,27 55,33 58,42 50,36 42,42 45,33 38,27 47,27" fill="#FFFFFF"/>
          <polygon points="32,54 35,63 44,63 37,69 40,78 32,72 24,78 27,69 20,63 29,63" fill="#FFFFFF"/>
          <polygon points="68,54 71,63 80,63 73,69 76,78 68,72 60,78 63,69 56,63 65,63" fill="#FFFFFF"/>
        </g>

        <!-- Statewide Callout Badge Overlay -->
        <g class="tn-statewide-badge" pointer-events="none">
          <rect x="290" y="165" width="260" height="52" rx="8" fill="rgba(0, 45, 114, 0.9)" stroke="#FFCC00" stroke-width="1.8" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.25))" />
          <text x="420" y="185" fill="#FFFFFF" font-family="'Open Sans', sans-serif" font-weight="800" font-size="10" letter-spacing="0.08em" text-anchor="middle">STATEWIDE TOTAL • 95 COUNTIES</text>
          <text x="420" y="206" fill="#FFCC00" font-family="'Permian Slab', serif" font-weight="700" font-size="16" text-anchor="middle">${prefix}${escapeHtml(mapData.statewideValue || '18,210')}${unit}</text>
        </g>
      `;
    }
    // 2. GRAND DIVISIONS MODE (East, Middle, West - TCA § 4-1-201)
    else if (mapMode === 'divisions') {
      svgContentHtml = `
        <!-- WEST TENNESSEE (21 Counties) -->
        <path id="svg-division-west" class="tn-division-path ${isWestActive ? 'active' : (hasSpecificSelection ? 'dimmed' : '')}"
              d="${outlines.west || ''}"
              fill="${isWestActive ? 'url(#grad-div-active)' : 'url(#grad-div-west)'}"
              stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"
              tabindex="0" role="button" aria-label="West Tennessee, 21 counties, Metric: ${prefix}${divWest.value}${unit}"
              data-division="west" data-action="select-map-division" />

        <!-- MIDDLE TENNESSEE (41 Counties) -->
        <path id="svg-division-middle" class="tn-division-path ${isMidActive ? 'active' : (hasSpecificSelection ? 'dimmed' : '')}"
              d="${outlines.middle || ''}"
              fill="${isMidActive ? 'url(#grad-div-active)' : 'url(#grad-div-middle)'}"
              stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"
              tabindex="0" role="button" aria-label="Middle Tennessee, 41 counties, Metric: ${prefix}${divMid.value}${unit}"
              data-division="middle" data-action="select-map-division" />

        <!-- EAST TENNESSEE (33 Counties) -->
        <path id="svg-division-east" class="tn-division-path ${isEastActive ? 'active' : (hasSpecificSelection ? 'dimmed' : '')}"
              d="${outlines.east || ''}"
              fill="${isEastActive ? 'url(#grad-div-active)' : 'url(#grad-div-east)'}"
              stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"
              tabindex="0" role="button" aria-label="East Tennessee, 33 counties, Metric: ${prefix}${divEast.value}${unit}"
              data-division="east" data-action="select-map-division" />

        <!-- Subtle Internal County Boundaries Inside Divisions -->
        <g stroke="rgba(255,255,255,0.12)" stroke-width="0.5" fill="none" pointer-events="none">
          ${counties.map(c => `<path d="${c.d}" />`).join('')}
        </g>

        <!-- Regional Typography Labels & Primary Metrics -->
        <g class="tn-svg-label-group" data-division="west" data-action="select-map-division" style="cursor: pointer;">
          <text x="145" y="98" fill="#FFFFFF" font-family="'Open Sans', sans-serif" font-weight="800" font-size="11.5" letter-spacing="0.08em" text-anchor="middle">WEST TENNESSEE</text>
          <text x="145" y="122" fill="#FFCC00" font-family="'Permian Slab', serif" font-weight="700" font-size="18" text-anchor="middle">${prefix}${escapeHtml(divWest.value)}${unit}</text>
          <text x="145" y="140" fill="rgba(255,255,255,0.85)" font-family="'Open Sans', sans-serif" font-weight="600" font-size="9" text-anchor="middle">21 Counties • ${escapeHtml(divWest.secondary || '')}</text>
        </g>

        <g class="tn-svg-label-group" data-division="middle" data-action="select-map-division" style="cursor: pointer;">
          <text x="405" y="98" fill="#FFFFFF" font-family="'Open Sans', sans-serif" font-weight="800" font-size="11.5" letter-spacing="0.08em" text-anchor="middle">MIDDLE TENNESSEE</text>
          <text x="405" y="122" fill="#FFCC00" font-family="'Permian Slab', serif" font-weight="700" font-size="18" text-anchor="middle">${prefix}${escapeHtml(divMid.value)}${unit}</text>
          <text x="405" y="140" fill="rgba(255,255,255,0.85)" font-family="'Open Sans', sans-serif" font-weight="600" font-size="9" text-anchor="middle">41 Counties • ${escapeHtml(divMid.secondary || '')}</text>
        </g>

        <g class="tn-svg-label-group" data-division="east" data-action="select-map-division" style="cursor: pointer;">
          <text x="735" y="98" fill="#FFFFFF" font-family="'Open Sans', sans-serif" font-weight="800" font-size="11.5" letter-spacing="0.08em" text-anchor="middle">EAST TENNESSEE</text>
          <text x="735" y="122" fill="#FFCC00" font-family="'Permian Slab', serif" font-weight="700" font-size="18" text-anchor="middle">${prefix}${escapeHtml(divEast.value)}${unit}</text>
          <text x="735" y="140" fill="rgba(255,255,255,0.85)" font-family="'Open Sans', sans-serif" font-weight="600" font-size="9" text-anchor="middle">33 Counties • ${escapeHtml(divEast.secondary || '')}</text>
        </g>
      `;
    }
    // 3. COUNTY BY COUNTY MODE (All 95 Individual Counties)
    else if (mapMode === 'county') {
      const countyPathsHtml = counties.map(c => {
        const isSelected = c.name === selectedCounty;
        let fill = '#002D72';
        if (c.division === 'west') fill = '#1B4D72';
        if (c.division === 'east') fill = '#0A3B63';
        if (isSelected) fill = '#BA0C2F';

        return `
          <path class="tn-county-path ${isSelected ? 'active' : ''}"
                d="${c.d}"
                fill="${fill}"
                stroke="#FFFFFF"
                stroke-width="${isSelected ? '2' : '0.7'}"
                stroke-linejoin="round"
                data-county="${escapeHtml(c.name)}"
                data-fips="${escapeHtml(c.fips)}"
                data-division="${escapeHtml(c.division)}"
                data-action="select-county"
                role="button" tabindex="0"
                aria-label="${escapeHtml(c.name)} County, ${escapeHtml(c.division)} Tennessee" />
        `;
      }).join('');

      svgContentHtml = `
        <!-- All 95 Individual Counties -->
        <g class="tn-counties-layer">
          ${countyPathsHtml}
        </g>
      `;
    }
    // 4. CUSTOM GROUP MODE (User-Selected Counties)
    else if (mapMode === 'custom') {
      const customSet = new Set(customCounties);
      const countyPathsHtml = counties.map(c => {
        const isSelected = customSet.has(c.name);
        return `
          <path class="tn-county-path ${isSelected ? 'custom-selected' : 'custom-unselected'}"
                d="${c.d}"
                fill="${isSelected ? '#BA0C2F' : '#E2E8F0'}"
                stroke="${isSelected ? '#FFFFFF' : '#CBD5E1'}"
                stroke-width="${isSelected ? '1.5' : '0.6'}"
                stroke-linejoin="round"
                data-county="${escapeHtml(c.name)}"
                data-action="toggle-custom-county"
                role="button" tabindex="0"
                aria-pressed="${isSelected}"
                aria-label="${escapeHtml(c.name)} County (${isSelected ? 'Included in Group' : 'Not included'})"
                title="Click to toggle ${escapeHtml(c.name)} County" />
        `;
      }).join('');

      svgContentHtml = `
        <!-- Custom County Group Layer -->
        <g class="tn-custom-layer">
          ${countyPathsHtml}
        </g>
      `;
    }

    // Metro Nodes (Overlayed on all modes)
    const metrosHtml = metros.map(m => `
      <g class="tn-metro-group" tabindex="0" role="button" aria-label="${escapeHtml(m.name)}, Tennessee"
         data-metro="${escapeHtml(m.name)}" data-division="${escapeHtml(m.division)}" data-detail="${escapeHtml(m.detail)}">
        ${m.isCapitol ? `
          <circle cx="${m.x}" cy="${m.y}" r="13" fill="none" stroke="#FFCC00" stroke-width="1.5" class="tn-metro-pulse"/>
          <circle cx="${m.x}" cy="${m.y}" r="5.5" fill="#FFCC00" stroke="#002D72" stroke-width="2"/>
          <text x="${m.x}" y="${m.y - 10}" fill="#FFCC00" font-family="'Open Sans', sans-serif" font-weight="800" font-size="9" text-anchor="middle" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.8))">${escapeHtml(m.label)}</text>
        ` : `
          <circle cx="${m.x}" cy="${m.y}" r="4" fill="#FFFFFF" stroke="#002D72" stroke-width="1.8"/>
          <text x="${m.x}" y="${m.y + 13}" fill="#FFFFFF" font-family="'Open Sans', sans-serif" font-weight="700" font-size="8.5" text-anchor="middle" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.8))">${escapeHtml(m.label)}</text>
        `}
      </g>
    `).join('');

    // Interactive SVG Map Card
    const svgMapHtml = `
      <div class="tn-map-canvas-card ${activeView === 'map' ? '' : 'sr-only-when-chart'}">
        ${stageModeBarHtml}

        <svg class="tn-map-svg" viewBox="0 0 960 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interactive Map of Tennessee (${mapMode} mode)">
          <defs>
            <linearGradient id="grad-state-full" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#002D72" />
              <stop offset="50%" stop-color="#0E3D85" />
              <stop offset="100%" stop-color="#1A4E9E" />
            </linearGradient>
            <linearGradient id="grad-div-west" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1B4D72" />
              <stop offset="100%" stop-color="#25669C" />
            </linearGradient>
            <linearGradient id="grad-div-middle" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#002D72" />
              <stop offset="100%" stop-color="#16468E" />
            </linearGradient>
            <linearGradient id="grad-div-east" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0A3B63" />
              <stop offset="100%" stop-color="#185080" />
            </linearGradient>
            <linearGradient id="grad-div-active" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#BA0C2F" />
              <stop offset="100%" stop-color="#E71B1B" />
            </linearGradient>
          </defs>

          ${svgContentHtml}
          ${metrosHtml}
        </svg>

        <!-- Live Hover Tooltip Popover -->
        <div id="tn-map-hover-tooltip" class="tn-map-tooltip-box" style="display: none;"></div>

        <!-- Custom Group Mode HUD on Stage -->
        ${mapMode === 'custom' ? `
          <div class="tn-map-custom-stage-bar">
            <div><strong>✏️ ${escapeHtml(customTitle)}:</strong> <span style="color: var(--tn-crimson); font-weight: 700;">${customCounties.length} of 95 Counties (${Math.round((customCounties.length/95)*100)}%)</span> • Metric: <strong>${prefix}${escapeHtml(customMetric)}${unit}</strong></div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button type="button" class="tn-cluster-pill" data-cluster="upper-cumberland">Upper Cumberland (14)</button>
              <button type="button" class="tn-cluster-pill" data-cluster="greater-nashville">Nashville Metro (10)</button>
              <button type="button" class="tn-cluster-pill" data-cluster="memphis-delta">Memphis Delta (6)</button>
              <button type="button" class="tn-cluster-pill" data-cluster="knoxville-smokies">Knoxville/Smokies (9)</button>
              <button type="button" class="tn-cluster-pill" data-cluster="tier4-distressed">Distressed (15)</button>
              <button type="button" class="tn-cluster-pill" data-cluster="all">All 95</button>
              <button type="button" class="tn-cluster-pill" data-cluster="clear" style="color: var(--tn-crimson);">Clear</button>
            </div>
          </div>
        ` : ''}

        <!-- County Mode Selected Detail HUD -->
        ${mapMode === 'county' ? `
          <div class="tn-county-detail-bar">
            <span>📍 Active County: <strong style="color: var(--tn-navy);">${escapeHtml(selectedCounty || 'Davidson')}</strong> County</span>
            <span>Grand Division: <strong>${escapeHtml(counties.find(c => c.name === selectedCounty)?.division?.toUpperCase() || 'MIDDLE')} TENNESSEE</strong></span>
            <span>FIPS: <strong>${escapeHtml(counties.find(c => c.name === selectedCounty)?.fips || '47037')}</strong></span>
            <span style="font-size: 0.68rem; color: var(--tn-slate-500); font-style: italic;">Click any county on map or choose from sidebar picker</span>
          </div>
        ` : ''}
      </div>
    `;

    // Paired Accessible Data Table (WCAG 2.1 AA)
    const pairedTableHtml = `
      <div class="accessible-table-wrapper ${activeView === 'map' ? 'sr-only-when-chart' : ''}">
        <table class="accessible-data-table">
          <caption>${escapeHtml(caption)}</caption>
          <thead>
            <tr>
              <th scope="col">Geographic Entity</th>
              <th scope="col">Grand Division</th>
              <th scope="col">Counties Included</th>
              <th scope="col" style="text-align: right;">Metric Value</th>
              <th scope="col" style="text-align: right;">Coverage / Share</th>
            </tr>
          </thead>
          <tbody>
            ${mapMode === 'custom' ? `
              <tr class="table-row-selected">
                <th scope="row">${escapeHtml(customTitle)}</th>
                <td>Custom Regional Group</td>
                <td>${customCounties.length} Counties (${escapeHtml(customCounties.slice(0, 8).join(', '))}${customCounties.length > 8 ? '...' : ''})</td>
                <td style="text-align: right; font-weight: 700;">${prefix}${escapeHtml(customMetric)}${unit}</td>
                <td style="text-align: right;">${Math.round((customCounties.length/95)*100)}% of State</td>
              </tr>
            ` : ''}
            <tr class="${isWestActive ? 'table-row-selected' : ''}">
              <th scope="row">West Tennessee</th>
              <td>Western Grand Division (TCA § 4-1-204)</td>
              <td>21 Counties (Memphis, Jackson, Dyersburg)</td>
              <td style="text-align: right; font-weight: 700;">${prefix}${escapeHtml(divWest.value)}${unit}</td>
              <td style="text-align: right;">${escapeHtml(divWest.secondary || '22.1%')}</td>
            </tr>
            <tr class="${isMidActive ? 'table-row-selected' : ''}">
              <th scope="row">Middle Tennessee</th>
              <td>Middle Grand Division (TCA § 4-1-203)</td>
              <td>41 Counties (Nashville, Clarksville, Murfreesboro)</td>
              <td style="text-align: right; font-weight: 700;">${prefix}${escapeHtml(divMid.value)}${unit}</td>
              <td style="text-align: right;">${escapeHtml(divMid.secondary || '43.2%')}</td>
            </tr>
            <tr class="${isEastActive ? 'table-row-selected' : ''}">
              <th scope="row">East Tennessee</th>
              <td>Eastern Grand Division (TCA § 4-1-202)</td>
              <td>33 Counties (Knoxville, Chattanooga, Tri-Cities)</td>
              <td style="text-align: right; font-weight: 700;">${prefix}${escapeHtml(divEast.value)}${unit}</td>
              <td style="text-align: right;">${escapeHtml(divEast.secondary || '34.7%')}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: var(--tn-slate-100); font-weight: 700;">
              <th scope="row">Statewide Aggregate</th>
              <td>State of Tennessee</td>
              <td>95 Counties Total</td>
              <td style="text-align: right;">${prefix}${escapeHtml(mapData.statewideValue || '18,210')}${unit}</td>
              <td style="text-align: right;">100% Total Population</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    // Division KPI Cards (Shown for Grand Divisions mode)
    const kpiGridHtml = mapMode === 'divisions' ? `
      <div class="tn-map-kpi-grid">
        <div class="tn-map-kpi-card ${isWestActive ? 'active' : ''}" data-division="west" data-action="select-map-division" tabindex="0" role="button" aria-pressed="${isWestActive}" aria-label="West Tennessee: ${prefix}${divWest.value}${unit}">
          <div class="tn-map-kpi-title">
            <span>West Tennessee</span>
            <span style="font-size: 0.65rem; color: var(--tn-slate-500); font-weight: normal;">21 Counties</span>
          </div>
          <div class="tn-map-kpi-val">${prefix}${escapeHtml(divWest.value)}${unit}</div>
          <div class="tn-map-kpi-sub">${escapeHtml(divWest.secondary || '')}</div>
        </div>

        <div class="tn-map-kpi-card ${isMidActive ? 'active' : ''}" data-division="middle" data-action="select-map-division" tabindex="0" role="button" aria-pressed="${isMidActive}" aria-label="Middle Tennessee: ${prefix}${divMid.value}${unit}">
          <div class="tn-map-kpi-title">
            <span>Middle Tennessee</span>
            <span style="font-size: 0.65rem; color: var(--tn-slate-500); font-weight: normal;">41 Counties</span>
          </div>
          <div class="tn-map-kpi-val">${prefix}${escapeHtml(divMid.value)}${unit}</div>
          <div class="tn-map-kpi-sub">${escapeHtml(divMid.secondary || '')}</div>
        </div>

        <div class="tn-map-kpi-card ${isEastActive ? 'active' : ''}" data-division="east" data-action="select-map-division" tabindex="0" role="button" aria-pressed="${isEastActive}" aria-label="East Tennessee: ${prefix}${divEast.value}${unit}">
          <div class="tn-map-kpi-title">
            <span>East Tennessee</span>
            <span style="font-size: 0.65rem; color: var(--tn-slate-500); font-weight: normal;">33 Counties</span>
          </div>
          <div class="tn-map-kpi-val">${prefix}${escapeHtml(divEast.value)}${unit}</div>
          <div class="tn-map-kpi-sub">${escapeHtml(divEast.secondary || '')}</div>
        </div>
      </div>
    ` : '';

    // Filter bar
    let filterStatusLabel = 'Showing: All Grand Divisions (Statewide • 95 Counties)';
    if (mapMode === 'state') filterStatusLabel = 'Mode: Full State Overview (Unified Perimeter • Major Metros)';
    else if (mapMode === 'county') filterStatusLabel = `Mode: County by County (Selected: ${selectedCounty} County)`;
    else if (mapMode === 'custom') filterStatusLabel = `Mode: Custom Group (${customCounties.length} Counties Selected)`;
    else if (isWestActive) filterStatusLabel = 'Showing: West Tennessee (21 Counties • Memphis/Jackson Corridor)';
    else if (isMidActive) filterStatusLabel = 'Showing: Middle Tennessee (41 Counties • Nashville Capitol Region)';
    else if (isEastActive) filterStatusLabel = 'Showing: East Tennessee (33 Counties • Knoxville/Chattanooga/Tri-Cities)';

    const filterBannerHtml = `
      <div class="tn-map-filter-banner">
        <span style="font-weight: 600; color: var(--tn-navy);">${filterStatusLabel}</span>
        ${hasSpecificSelection ? `
          <button type="button" class="btn btn-sm btn-outline-dark" data-action="reset-map-division" style="font-size: 0.68rem; padding: 2px 7px;">
            ↺ View Statewide
          </button>
        ` : ''}
      </div>
    `;

    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid" style="grid-template-columns: 1fr; align-items: start; max-width: 920px; margin: 0 auto; width: 100%;">
        <div class="slide-card ${isWiggle}" style="padding: 0.55rem 0.95rem;">
          <div class="tn-map-stage-wrapper">
            ${svgMapHtml}
            ${pairedTableHtml}
            ${filterBannerHtml}
            ${kpiGridHtml}
            ${lines.length > 0 ? `
              <div class="tn-map-takeaways" style="margin-top: 0.6rem; padding: 0.5rem 0.85rem; background: var(--tn-slate-50); border-left: 3px solid var(--tn-navy); border-radius: 4px; font-size: 0.85rem; color: var(--tn-slate-700); display: flex; flex-direction: column; gap: 0.25rem; text-align: left;">
                ${lines.map(l => `<div style="display: flex; align-items: center; gap: 6px;"><span style="color: var(--tn-state-red); font-size: 0.75rem;">★</span><span>${escapeHtml(l)}</span></div>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  } else if (slide.layout === 'layout-quote' || slide.quote) {
    const qText = slide.quote || (lines[0] || '').replace(/^[“"']+|[”"']+$/g, '') || 'Excellence in service to the people of Tennessee.';
    const qAuthor = slide.quoteAuthor || (lines.length > 1 ? lines[lines.length - 1].replace(/^[—–-]\s*/, '') : (slide.authorName || 'State of Tennessee'));
    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid" style="grid-template-columns: 1fr; align-items: center; justify-content: center; max-width: 820px; margin: 0.4rem auto 0; width: 100%;">
        <div class="slide-card ${isWiggle}" style="background: linear-gradient(135deg, rgba(0, 45, 114, 0.05) 0%, rgba(231, 27, 27, 0.04) 100%); border-left: 6px solid var(--tn-state-red); padding: 1.35rem 2rem; text-align: left; position: relative; box-shadow: var(--tn-shadow-md);">
          <div style="font-size: 2.8rem; color: var(--tn-state-red); line-height: 0.5; font-family: Georgia, serif; opacity: 0.5; margin-bottom: 0.6rem;">“</div>
          <div style="font-size: 1.125rem; font-style: italic; font-weight: 500; color: var(--tn-navy-dark); line-height: 1.5; margin-bottom: 0.85rem;">
            ${escapeHtml(qText)}
          </div>
          <div style="font-size: 0.875rem; font-weight: 700; color: var(--tn-slate-700); display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--tn-state-red); font-weight: 900;">—</span>
            <span>${escapeHtml(qAuthor)}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    // Default: 2-Column Split
    const isLeftMedia = slide.imagePlacement === 'split-left';
    const textCardHtml = `
      <div class="slide-card ${isWiggle}">
        <div class="slide-text-structured" style="display: flex; flex-direction: column; gap: 0.35rem;">
          ${renderStructuredContentLines(lines, { bulletIcon: '✦' })}
        </div>
      </div>
    `;
    const mediaContainerHtml = `
      <div style="height: 100%; min-height: 200px; display: flex; align-items: center; justify-content: center;">
        ${mediaHtml || `<div class="slide-card" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color: var(--tn-slate-600); font-style:italic; font-size:0.85rem;">No media selected</div>`}
      </div>
    `;

    bodyHtml = `
      ${headerHtml}
      <div class="slide-content-grid layout-split">
        ${isLeftMedia ? mediaContainerHtml + textCardHtml : textCardHtml + mediaContainerHtml}
      </div>
    `;
  }

  return `
    ${watermarkHtml}
    ${bodyHtml}
    <footer class="slide-footer">
      <div class="slide-footer-brand">
        <span>State of Tennessee Presentation System</span>
      </div>
      ${citationBadgeHtml}
      <div>Slide ${index + 1} of ${appData.slides.length}</div>
    </footer>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

