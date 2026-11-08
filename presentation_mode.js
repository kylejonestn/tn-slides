/**
 * State of Tennessee Presentation Studio - Fullscreen Presentation & Presenter Console
 * Handles dual-screen presenter console, laser pointer, pen annotations, safe zones, and clipping.
 */
'use strict';

// --- 9. FULLSCREEN PRESENTATION MODE, ASPECT RATIOS, LASER & DRAWING PEN ---
function getActiveAspectRatioConfig(specifiedRatio = null) {
  const ratio = specifiedRatio || appData.aspectRatio || '16:9';
  if (ratio === '16:10') {
    return {
      name: '16:10',
      label: '16:10 Laptop',
      width: 960,
      height: 600,
      cssRatio: '16 / 10',
      num: 16,
      den: 10
    };
  } else if (ratio === '4:3') {
    return {
      name: '4:3',
      label: '4:3 Projector',
      width: 960,
      height: 720,
      cssRatio: '4 / 3',
      num: 4,
      den: 3
    };
  } else if (ratio === 'auto') {
    let screenW = 960;
    let screenH = 540;
    if (isPresenting) {
      screenW = window.innerWidth || 960;
      screenH = window.innerHeight || 540;
    } else {
      const vp = document.querySelector('.presentation-viewport');
      if (vp && vp.clientWidth > 0 && vp.clientHeight > 0) {
        screenW = vp.clientWidth;
        screenH = vp.clientHeight;
      }
    }
    const r = Math.max(0.5, screenW / screenH);
    const computedHeight = Math.round(960 / r);
    return {
      name: 'auto',
      label: 'Auto-Display',
      width: 960,
      height: computedHeight,
      cssRatio: `${screenW} / ${screenH}`,
      num: Math.round(r * 100),
      den: 100
    };
  }
  return {
    name: '16:9',
    label: '16:9 Widescreen',
    width: 960,
    height: 540,
    cssRatio: '16 / 9',
    num: 16,
    den: 9
  };
}

function applyAspectRatio(ratioName) {
  if (!ratioName) ratioName = '16:9';
  appData.aspectRatio = ratioName;

  const cfg = getActiveAspectRatioConfig(ratioName);
  document.documentElement.style.setProperty('--slide-aspect-ratio', cfg.cssRatio);
  document.documentElement.style.setProperty('--slide-base-width', `${cfg.width}px`);
  document.documentElement.style.setProperty('--slide-base-height', `${cfg.height}px`);
  document.documentElement.style.setProperty('--slide-aspect-num', cfg.num);
  document.documentElement.style.setProperty('--slide-aspect-den', cfg.den);

  const vp = document.querySelector('.presentation-viewport');
  if (vp) vp.style.aspectRatio = cfg.cssRatio;
  const fsBox = document.getElementById('fullscreen-slide-box');
  if (fsBox) fsBox.style.aspectRatio = cfg.cssRatio;

  if (selectCanvasAspectRatio && selectCanvasAspectRatio.value !== ratioName) {
    selectCanvasAspectRatio.value = ratioName;
  }
  if (selectStyleAspectRatio && selectStyleAspectRatio.value !== ratioName) {
    selectStyleAspectRatio.value = ratioName;
  }

  rescalePresentationViewports();
  checkCurrentSlideClipping();
  markDirty();
}

function rescalePresentationViewports() {
  const cfg = getActiveAspectRatioConfig();

  // 1. Studio Editing Viewport
  const vp = document.querySelector('.presentation-viewport');
  const liveStage = document.getElementById('live-slide-stage');
  if (vp && liveStage) {
    const vpWidth = vp.clientWidth;
    if (vpWidth > 0) {
      const liveScale = vpWidth / cfg.width;
      vp.style.setProperty('--live-slide-scale', liveScale);
      liveStage.style.transform = `scale(${liveScale})`;
    }
  }

  // 2. Fullscreen Presentation Viewport
  const fsBox = document.getElementById('fullscreen-slide-box');
  const fsStage = document.getElementById('fullscreen-slide-stage');
  if (fsBox && fsStage) {
    const fsWidth = fsBox.clientWidth;
    if (fsWidth > 0) {
      const fsScale = fsWidth / cfg.width;
      fsBox.style.setProperty('--fullscreen-slide-scale', fsScale);
      fsStage.style.transform = `scale(${fsScale})`;
    }
  }
}

function toggleSafeZones() {
  if (!safeZoneOverlay) return;
  isSafeZonesActive = !isSafeZonesActive;
  if (isSafeZonesActive) {
    safeZoneOverlay.classList.add('active');
    if (btnToggleSafeZones) {
      btnToggleSafeZones.classList.add('active');
      btnToggleSafeZones.style.background = '#FEF08A';
      btnToggleSafeZones.style.borderColor = '#EAB308';
      btnToggleSafeZones.style.color = '#854D0E';
    }
  } else {
    safeZoneOverlay.classList.remove('active');
    if (btnToggleSafeZones) {
      btnToggleSafeZones.classList.remove('active');
      btnToggleSafeZones.style.background = '';
      btnToggleSafeZones.style.borderColor = '';
      btnToggleSafeZones.style.color = '';
    }
  }
}

function getClippingProbeStage() {
  let probe = document.getElementById('clipping-probe-stage');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'clipping-probe-stage';
    probe.className = 'slide-stage';
    probe.style.position = 'fixed';
    probe.style.top = '-9999px';
    probe.style.left = '-9999px';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.zIndex = '-999';
    document.body.appendChild(probe);
  }
  return probe;
}

function auditSlideForRatio(slideIndex, ratioName) {
  const slide = appData.slides[slideIndex];
  if (!slide) return { isClipping: false, overflowPx: 0, reason: 'No slide' };

  const cfg = getActiveAspectRatioConfig(ratioName);
  const probe = getClippingProbeStage();
  probe.style.width = `${cfg.width}px`;
  probe.style.height = `${cfg.height}px`;
  probe.className = `slide-stage ${appData.theme || 'theme-dept-blue-banner'}`;

  probe.innerHTML = buildSlideHtml(slide, slideIndex);

  const unscaledH = cfg.height;
  let isClipping = false;
  let maxOverflow = 0;
  let reason = '';

  if (probe.scrollHeight > unscaledH + 4) {
    const diff = probe.scrollHeight - unscaledH;
    if (diff > maxOverflow) {
      maxOverflow = diff;
      reason = `Exceeds stage height (+${diff}px)`;
    }
    isClipping = true;
  }

  const footer = probe.querySelector('.slide-footer');
  const footerTop = footer ? footer.offsetTop : (unscaledH - 42);

  const contentBlocks = probe.querySelectorAll('.pillar-card, .pillar-column, .split-content, .card, .tn-agenda-card, .tn-stat-card, .comparison-card, .tn-map-viewport, table, ul, ol, p');
  contentBlocks.forEach(el => {
    if (el.closest('.slide-footer')) return;
    const bottom = el.offsetTop + el.offsetHeight;
    if (bottom > footerTop + 4) {
      const diff = Math.round(bottom - footerTop);
      if (diff > maxOverflow) {
        maxOverflow = diff;
        reason = `Overlaps slide footer (+${diff}px)`;
      }
      isClipping = true;
    }
  });

  return {
    isClipping,
    overflowPx: maxOverflow,
    reason: isClipping ? reason : 'Fits within bounds'
  };
}

function checkCurrentSlideClipping() {
  if (!canvasClippingBadge) return;
  const liveStage = document.getElementById('live-slide-stage');
  if (!liveStage) return;

  const currentRatio = appData.aspectRatio || '16:9';
  const cfg = getActiveAspectRatioConfig(currentRatio);
  const unscaledH = cfg.height;

  let isClipping = false;
  let maxOverflow = 0;

  if (liveStage.scrollHeight > unscaledH + 4) {
    const diff = liveStage.scrollHeight - unscaledH;
    if (diff > maxOverflow) maxOverflow = diff;
    isClipping = true;
  }

  const footer = liveStage.querySelector('.slide-footer');
  const footerTop = footer ? footer.offsetTop : (unscaledH - 42);

  const contentBlocks = liveStage.querySelectorAll('.pillar-card, .pillar-column, .split-content, .card, .tn-agenda-card, .tn-stat-card, .comparison-card, .tn-map-viewport, table, ul, ol, p');
  contentBlocks.forEach(el => {
    if (el.closest('.slide-footer')) return;
    const bottom = el.offsetTop + el.offsetHeight;
    if (bottom > footerTop + 4) {
      const diff = Math.round(bottom - footerTop);
      if (diff > maxOverflow) maxOverflow = diff;
      isClipping = true;
    }
  });

  if (isClipping) {
    canvasClippingBadge.className = 'canvas-clipping-badge danger';
    canvasClippingBadge.innerHTML = `⚠️ Clipping (+${maxOverflow}px)`;
    canvasClippingBadge.title = `Content clips by ~${maxOverflow}px on ${cfg.label}. Click to audit deck or apply compact fit.`;
  } else {
    canvasClippingBadge.className = 'canvas-clipping-badge safe';
    canvasClippingBadge.innerHTML = `✓ Safe Fit (${cfg.name})`;
    canvasClippingBadge.title = `Slide layout fits safely within ${cfg.label} boundary. Click to audit entire deck.`;
  }

  return {
    isClipping,
    overflowPx: maxOverflow,
    config: cfg
  };
}

function openClippingAuditModal() {
  if (modalClippingAudit) modalClippingAudit.classList.add('active');
}

function closeClippingAuditModal() {
  if (modalClippingAudit) modalClippingAudit.classList.remove('active');
}

function scanDeckForClipping() {
  if (!modalClippingAudit || !clippingAuditTableBody) return;
  clippingAuditTableBody.innerHTML = '';

  let clipCount169 = 0;
  let clipCount1610 = 0;
  let clipCount43 = 0;
  const total = appData.slides.length;

  appData.slides.forEach((slide, idx) => {
    const res169 = auditSlideForRatio(idx, '16:9');
    const res1610 = auditSlideForRatio(idx, '16:10');
    const res43 = auditSlideForRatio(idx, '4:3');

    if (res169.isClipping) clipCount169++;
    if (res1610.isClipping) clipCount1610++;
    if (res43.isClipping) clipCount43++;

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--tn-slate-200)';
    if (idx === currentSlideIndex) {
      tr.style.background = 'rgba(0, 45, 98, 0.05)';
    }

    const badgeForRes = (res) => {
      if (res.isClipping) {
        return `<span style="background: #FEE2E2; color: #991B1B; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem;" title="${escapeHtml(res.reason)}">⚠️ +${res.overflowPx}px</span>`;
      }
      return `<span style="background: #DCFCE7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">✓ Safe</span>`;
    };

    tr.innerHTML = `
      <td style="padding: 8px 10px; font-weight: 700; color: var(--tn-navy);">${idx + 1}</td>
      <td style="padding: 8px 10px;">
        <div style="font-weight: 600; color: var(--tn-slate-900);">${escapeHtml(slide.title || 'Untitled')}</div>
        <div style="font-size: 0.68rem; color: var(--tn-slate-500);">${escapeHtml(slide.layout || 'standard')}</div>
      </td>
      <td style="padding: 8px 10px; text-align: center;">${badgeForRes(res169)}</td>
      <td style="padding: 8px 10px; text-align: center;">${badgeForRes(res1610)}</td>
      <td style="padding: 8px 10px; text-align: center;">${badgeForRes(res43)}</td>
      <td style="padding: 8px 10px; text-align: right;">
        <button type="button" class="btn btn-sm btn-outline-primary" data-action="audit-jump" data-index="${idx}" style="font-size: 0.68rem; padding: 2px 8px;">
          Inspect
        </button>
      </td>
    `;
    clippingAuditTableBody.appendChild(tr);
  });

  // Update scorecards
  const pct169 = Math.round(((total - clipCount169) / total) * 100);
  const elScore169 = document.getElementById('clipping-score-169');
  const elSub169 = document.getElementById('clipping-sub-169');
  if (elScore169) elScore169.textContent = `${pct169}% Ready`;
  if (elSub169) elSub169.textContent = `${clipCount169} slide${clipCount169 === 1 ? '' : 's'} clipping`;

  const pct1610 = Math.round(((total - clipCount1610) / total) * 100);
  const elScore1610 = document.getElementById('clipping-score-1610');
  const elSub1610 = document.getElementById('clipping-sub-1610');
  if (elScore1610) elScore1610.textContent = `${pct1610}% Ready`;
  if (elSub1610) elSub1610.textContent = `${clipCount1610} slide${clipCount1610 === 1 ? '' : 's'} clipping`;

  const pct43 = Math.round(((total - clipCount43) / total) * 100);
  const elScore43 = document.getElementById('clipping-score-43');
  const elSub43 = document.getElementById('clipping-sub-43');
  if (elScore43) elScore43.textContent = `${pct43}% Ready`;
  if (elSub43) elSub43.textContent = `${clipCount43} slide${clipCount43 === 1 ? '' : 's'} clipping`;

  // Wire inspect buttons
  clippingAuditTableBody.querySelectorAll('[data-action="audit-jump"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sIdx = parseInt(btn.dataset.index, 10);
      if (!isNaN(sIdx)) {
        switchSlide(sIdx);
        closeClippingAuditModal();
      }
    });
  });

  openClippingAuditModal();
}

function toggleCompactSafeFit() {
  const liveStage = document.getElementById('live-slide-stage');
  const fsStage = document.getElementById('fullscreen-slide-stage');
  const isCompact = liveStage && liveStage.classList.contains('compact-safe-fit');
  if (liveStage) liveStage.classList.toggle('compact-safe-fit', !isCompact);
  if (fsStage) fsStage.classList.toggle('compact-safe-fit', !isCompact);
  if (btnApplyCompactFit) {
    btnApplyCompactFit.textContent = !isCompact ? '✓ Safe Compact Spacing Active' : '✨ Toggle Safe Compact Spacing';
    btnApplyCompactFit.classList.toggle('btn-primary', !isCompact);
    btnApplyCompactFit.classList.toggle('btn-outline-primary', isCompact);
  }
  checkCurrentSlideClipping();
}

// ============================================================================
// PRESENTER HUD IDLE FADE (10-SECOND INACTIVITY TIMER)
// ============================================================================
var presenterHudTimer = null;
var isPresenterHudHovered = false;
var PRESENTER_HUD_IDLE_DELAY = 10000; // 10 seconds

function showPresenterHud() {
  const hud = document.getElementById('presenter-hud');
  if (!hud) return;
  if (hud.classList.contains('hud-hidden')) {
    hud.classList.remove('hud-hidden');
  }
  resetPresenterHudTimer();
}

function hidePresenterHud() {
  const hud = document.getElementById('presenter-hud');
  if (!hud) return;
  // Never hide if the user's cursor is actively hovering over HUD buttons
  if (isPresenterHudHovered) return;
  hud.classList.add('hud-hidden');
}

function resetPresenterHudTimer() {
  clearTimeout(presenterHudTimer);
  if (!isPresenting) return;
  presenterHudTimer = setTimeout(() => {
    if (isPresenting && !isPresenterHudHovered) {
      hidePresenterHud();
    }
  }, PRESENTER_HUD_IDLE_DELAY);
}

function initPresenterHudBehavior() {
  const hud = document.getElementById('presenter-hud');
  if (!hud) return;

  hud.addEventListener('mouseenter', () => {
    isPresenterHudHovered = true;
    showPresenterHud();
  });

  hud.addEventListener('mouseleave', () => {
    isPresenterHudHovered = false;
    resetPresenterHudTimer();
  });

  // Re-appear whenever mouse moves across the screen during presentation
  window.addEventListener('mousemove', () => {
    if (isPresenting) {
      showPresenterHud();
    }
  });

  // Tap on touch devices also reveals HUD
  window.addEventListener('touchstart', () => {
    if (isPresenting) {
      showPresenterHud();
    }
  }, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPresenterHudBehavior);
} else {
  initPresenterHudBehavior();
}

function enterFullscreenPresentation() {
  isPresenting = true;
  fullscreenOverlay.classList.add('active');
  if (appData.aspectRatio === 'auto') {
    applyAspectRatio('auto');
  } else {
    rescalePresentationViewports();
  }
  renderCurrentSlide();
  resizeAnnotationCanvas();
  redrawAnnotationsForCurrentSlide();

  // Show HUD and arm the 10-second idle countdown
  showPresenterHud();

  try {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  } catch (e) {}
}

function exitFullscreenPresentation() {
  isPresenting = false;
  fullscreenOverlay.classList.remove('active');
  if (isBlackScreen) exitBlackScreen();
  disableLaser();
  disablePen();

  // Cancel idle timer and restore HUD for future presentations
  clearTimeout(presenterHudTimer);
  presenterHudTimer = null;
  isPresenterHudHovered = false;
  const hud = document.getElementById('presenter-hud');
  if (hud) hud.classList.remove('hud-hidden');

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  if (appData.aspectRatio === 'auto') {
    applyAspectRatio('auto');
  } else {
    rescalePresentationViewports();
  }
  renderCurrentSlide();
  syncWithPresenterConsole();
}

function nextSlide() {
  if (isVideoPlayingFullscreen) {
    handleVideoTheaterAdvance('forward');
    return;
  }

  const currentSlide = appData.slides[currentSlideIndex];
  const hasVideo = !!(currentSlide && currentSlide.videoUrl && currentSlide.videoUrl.trim().length > 0);
  const shouldAutoPlay = currentSlide && (currentSlide.playVideoFullscreenOnAdvance !== false);
  const isAlreadyPlayed = videoSlidePlayState[currentSlideIndex] === 'played';

  if (hasVideo && shouldAutoPlay && !isAlreadyPlayed) {
    // Play video in full screen on next "click" as the default behavior!
    videoSlidePlayState[currentSlideIndex] = 'played';
    launchFullscreenVideoTheater(currentSlide);
    return;
  }

  if (currentSlideIndex < appData.slides.length - 1) {
    switchSlide(currentSlideIndex + 1);
  }
}

function prevSlide() {
  if (isVideoPlayingFullscreen) {
    handleVideoTheaterAdvance('backward');
    return;
  }

  if (currentSlideIndex > 0) {
    switchSlide(currentSlideIndex - 1);
  }
}

// --- BLACK SCREEN CONCEALMENT (B Key) ---
function toggleBlackScreen() {
  if (isBlackScreen) exitBlackScreen();
  else enterBlackScreen();
}

function enterBlackScreen() {
  isBlackScreen = true;
  fullscreenOverlay.classList.add('black-screen');
  const btn = document.getElementById('hud-black-btn');
  if (btn) btn.classList.add('active');
  syncWithPresenterConsole();
}

function exitBlackScreen() {
  isBlackScreen = false;
  fullscreenOverlay.classList.remove('black-screen');
  const btn = document.getElementById('hud-black-btn');
  if (btn) btn.classList.remove('active');
  syncWithPresenterConsole();
}

// --- DUAL-SCREEN PRESENTER CONSOLE & SESSION END COUNTDOWN ---
function openPresenterConsole() {
  if (presenterWindow && !presenterWindow.closed) {
    presenterWindow.focus();
    syncWithPresenterConsole();
    return;
  }

  try {
    presenterWindow = window.open('', 'TN_Presenter_Console', 'width=1180,height=780,menubar=no,toolbar=no,location=no,status=no');
    if (!presenterWindow) {
      alert('Presenter Console pop-up was blocked. Please allow pop-ups for this presentation.');
      return;
    }
    renderPresenterConsoleDocument(presenterWindow);
  } catch (err) {
    console.error('Error opening presenter console:', err);
    alert('Could not open Presenter Console: ' + err.message);
  }
}

function syncWithPresenterConsole() {
  if (presenterWindow && !presenterWindow.closed && presenterWindow.updateConsoleView) {
    try {
      presenterWindow.updateConsoleView();
    } catch (e) {
      console.warn('Presenter console sync error:', e);
    }
  }
}

function renderPresenterConsoleDocument(win) {
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
  const slideOptions = appData.slides.map((s, i) => '<option value="' + i + '">#' + (i + 1) + ': ' + escapeHtml(s.title || 'Untitled') + '</option>').join('');

  const html = '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'  <meta charset="UTF-8">' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'  <title>State of Tennessee • Presenter Console</title>' +
   styles +
'  <style>' +
'    * { box-sizing: border-box; margin: 0; padding: 0; }' +
'    body {' +
'      background: #090E17;' +
'      color: #F8FAFC;' +
'      font-family: \"Open Sans\", system-ui, -apple-system, sans-serif;' +
'      height: 100vh;' +
'      display: flex;' +
'      flex-direction: column;' +
'      overflow: hidden;' +
'      user-select: none;' +
'    }' +
'    .console-header {' +
'      background: #0F172A;' +
'      border-bottom: 2px solid #1E293B;' +
'      padding: 0.5rem 1rem;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'      gap: 0.8rem;' +
'      flex-shrink: 0;' +
'    }' +
'    .console-brand {' +
'      display: flex;' +
'      align-items: center;' +
'      gap: 0.6rem;' +
'    }' +
'    .console-badge {' +
'      background: #002D72;' +
'      color: #fff;' +
'      font-size: 0.7rem;' +
'      font-weight: 800;' +
'      letter-spacing: 0.05em;' +
'      padding: 3px 8px;' +
'      border-radius: 4px;' +
'      border: 1px solid #1E40AF;' +
'    }' +
'    .console-title {' +
'      font-size: 0.78rem;' +
'      font-weight: 700;' +
'      color: #94A3B8;' +
'      text-transform: uppercase;' +
'      letter-spacing: 0.05em;' +
'    }' +
'    .timekeeper-station {' +
'      display: flex;' +
'      align-items: center;' +
'      gap: 0.9rem;' +
'      background: #1E293B;' +
'      border: 1px solid #334155;' +
'      padding: 0.3rem 0.9rem;' +
'      border-radius: 999px;' +
'    }' +
'    .clock-block {' +
'      display: flex;' +
'      align-items: baseline;' +
'      gap: 0.3rem;' +
'      font-family: ui-monospace, monospace;' +
'    }' +
'    .clock-label {' +
'      font-size: 0.65rem;' +
'      font-weight: 700;' +
'      color: #64748B;' +
'      text-transform: uppercase;' +
'    }' +
'    .clock-val {' +
'      font-size: 1rem;' +
'      font-weight: 800;' +
'      color: #F8FAFC;' +
'    }' +
'    .time-sep {' +
'      width: 1px;' +
'      height: 18px;' +
'      background: #475569;' +
'    }' +
'    .countdown-block {' +
'      display: flex;' +
'      align-items: center;' +
'      gap: 0.5rem;' +
'    }' +
'    .countdown-badge {' +
'      font-family: ui-monospace, monospace;' +
'      font-size: 1.15rem;' +
'      font-weight: 800;' +
'      padding: 2px 10px;' +
'      border-radius: 6px;' +
'      background: #0284C7;' +
'      color: #fff;' +
'      letter-spacing: 0.02em;' +
'      transition: all 0.2s ease;' +
'      min-width: 140px;' +
'      text-align: center;' +
'    }' +
'    .countdown-badge.warn {' +
'      background: #D97706 !important;' +
'      color: #fff !important;' +
'    }' +
'    .countdown-badge.overtime {' +
'      background: #DC2626 !important;' +
'      color: #fff !important;' +
'    }' +
'    .target-time-control {' +
'      display: flex;' +
'      align-items: center;' +
'      gap: 0.3rem;' +
'      font-size: 0.72rem;' +
'      color: #94A3B8;' +
'    }' +
'    .time-input-box {' +
'      background: #0F172A;' +
'      border: 1px solid #475569;' +
'      color: #fff;' +
'      font-size: 0.75rem;' +
'      border-radius: 4px;' +
'      padding: 2px 5px;' +
'      font-family: inherit;' +
'    }' +
'    .quick-btn {' +
'      background: #334155;' +
'      border: none;' +
'      color: #CBD5E1;' +
'      font-size: 0.68rem;' +
'      border-radius: 4px;' +
'      padding: 2px 5px;' +
'      cursor: pointer;' +
'    }' +
'    .quick-btn:hover { background: #475569; color: #fff; }' +
'    .console-main {' +
'      display: grid;' +
'      grid-template-columns: 1.15fr 0.85fr;' +
'      gap: 0.8rem;' +
'      padding: 0.8rem;' +
'      flex: 1;' +
'      min-height: 0;' +
'    }' +
'    .slides-col {' +
'      display: flex;' +
'      flex-direction: column;' +
'      gap: 0.7rem;' +
'      min-height: 0;' +
'    }' +
'    .console-card {' +
'      background: #141E33;' +
'      border: 1px solid #2A3B5C;' +
'      border-radius: 8px;' +
'      overflow: hidden;' +
'      display: flex;' +
'      flex-direction: column;' +
'    }' +
'    .console-card-header {' +
'      background: #0F172A;' +
'      padding: 0.35rem 0.75rem;' +
'      font-size: 0.7rem;' +
'      font-weight: 700;' +
'      color: #94A3B8;' +
'      text-transform: uppercase;' +
'      letter-spacing: 0.05em;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'      border-bottom: 1px solid #1E293B;' +
'    }' +
'    .live-dot {' +
'      display: inline-block;' +
'      width: 8px;' +
'      height: 8px;' +
'      background: #EF4444;' +
'      border-radius: 50%;' +
'      margin-right: 5px;' +
'    }' +
'    .slide-viewport-box {' +
'      width: 100%;' +
'      aspect-ratio: 16 / 9;' +
'      position: relative;' +
'      background: #000;' +
'      overflow: hidden;' +
'    }' +
'    .slide-viewport-box .slide-stage {' +
'      width: 960px !important;' +
'      height: 540px !important;' +
'      transform-origin: top left;' +
'      position: absolute;' +
'      top: 0;' +
'      left: 0;' +
'      pointer-events: none;' +
'    }' +
'    .black-screen-veil {' +
'      position: absolute;' +
'      inset: 0;' +
'      background: rgba(0, 0, 0, 0.95);' +
'      color: #fff;' +
'      display: none;' +
'      flex-direction: column;' +
'      align-items: center;' +
'      justify-content: center;' +
'      gap: 0.4rem;' +
'      z-index: 50;' +
'    }' +
'    .black-screen-veil.active {' +
'      display: flex;' +
'    }' +
'    .notes-col {' +
'      background: #141E33;' +
'      border: 1px solid #2A3B5C;' +
'      border-radius: 8px;' +
'      display: flex;' +
'      flex-direction: column;' +
'      overflow: hidden;' +
'    }' +
'    .notes-header {' +
'      background: #0F172A;' +
'      padding: 0.45rem 0.8rem;' +
'      border-bottom: 1px solid #1E293B;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'    }' +
'    .notes-title {' +
'      font-size: 0.72rem;' +
'      font-weight: 700;' +
'      color: #94A3B8;' +
'      text-transform: uppercase;' +
'      letter-spacing: 0.05em;' +
'    }' +
'    .font-btns {' +
'      display: flex;' +
'      gap: 4px;' +
'    }' +
'    .btn-font {' +
'      background: #1E293B;' +
'      border: 1px solid #334155;' +
'      color: #fff;' +
'      font-size: 0.72rem;' +
'      font-weight: 700;' +
'      padding: 2px 7px;' +
'      border-radius: 4px;' +
'      cursor: pointer;' +
'    }' +
'    .btn-font:hover { background: #334155; }' +
'    .notes-content {' +
'      padding: 1.25rem;' +
'      flex: 1;' +
'      overflow-y: auto;' +
'      font-size: 1.15rem;' +
'      line-height: 1.6;' +
'      color: #F8FAFC;' +
'      white-space: pre-wrap;' +
'      user-select: text;' +
'    }' +
'    .notes-empty-msg {' +
'      color: #64748B;' +
'      font-style: italic;' +
'      font-size: 0.9rem;' +
'      margin-top: 1.5rem;' +
'      text-align: center;' +
'    }' +
'    .console-dock {' +
'      background: #0F172A;' +
'      border-top: 2px solid #1E293B;' +
'      padding: 0.5rem 1rem;' +
'      display: flex;' +
'      align-items: center;' +
'      justify-content: space-between;' +
'      gap: 0.8rem;' +
'      flex-shrink: 0;' +
'    }' +
'    .dock-group {' +
'      display: flex;' +
'      align-items: center;' +
'      gap: 0.5rem;' +
'    }' +
'    .btn-action {' +
'      background: #1E293B;' +
'      border: 1px solid #334155;' +
'      color: #fff;' +
'      padding: 0.45rem 0.9rem;' +
'      border-radius: 6px;' +
'      font-size: 0.85rem;' +
'      font-weight: 700;' +
'      cursor: pointer;' +
'      display: inline-flex;' +
'      align-items: center;' +
'      gap: 0.4rem;' +
'      transition: all 0.15s ease;' +
'    }' +
'    .btn-action:hover { background: #334155; }' +
'    .btn-action-primary {' +
'      background: #002D72;' +
'      border-color: #0284C7;' +
'    }' +
'    .btn-action-primary:hover { background: #0284C7; }' +
'    .btn-action.active-black {' +
'      background: #DC2626 !important;' +
'      border-color: #EF4444 !important;' +
'      color: #fff !important;' +
'    }' +
'    .slide-select-dock {' +
'      background: #0F172A;' +
'      border: 1px solid #334155;' +
'      color: #fff;' +
'      padding: 0.4rem 0.7rem;' +
'      border-radius: 6px;' +
'      font-size: 0.8rem;' +
'      max-width: 260px;' +
'    }' +
'  </style>' +
'</head>' +
'<body>' +
'  <header class=\"console-header\">' +
'    <div class=\"console-brand\">' +
'      <span class=\"console-badge\">TENNESSEE</span>' +
'      <span class=\"console-title\">Presenter Cockpit</span>' +
'    </div>' +
'    <div class=\"timekeeper-station\">' +
'      <div class=\"clock-block\">' +
'        <span class=\"clock-label\">Local:</span>' +
'        <span class=\"clock-val\" id=\"live-clock\">--:--:--</span>' +
'      </div>' +
'      <div class=\"time-sep\"></div>' +
'      <div class=\"countdown-block\">' +
'        <span class=\"countdown-badge\" id=\"countdown-badge\">--:--</span>' +
'        <div class=\"target-time-control\">' +
'          <span>End:</span>' +
'          <input type=\"time\" id=\"target-end-input\" class=\"time-input-box\">' +
'          <button type=\"button\" class=\"quick-btn\" id=\"btn-plus-5\">+5m</button>' +
'          <button type=\"button\" class=\"quick-btn\" id=\"btn-plus-15\">+15m</button>' +
'        </div>' +
'      </div>' +
'    </div>' +
'    <div style=\"display:flex; align-items:center; gap:0.5rem;\">' +
'      <span id=\"console-slide-counter\" style=\"font-size: 0.8rem; font-weight:700; color:#94A3B8;\">Slide 1 of 7</span>' +
'      <button class=\"btn-action\" id=\"btn-focus-slides\" title=\"Focus Audience Slides\">Focus Slides ⛶</button>' +
'    </div>' +
'  </header>' +
'  <main class=\"console-main\">' +
'    <div class=\"slides-col\">' +
'      <div class=\"console-card\">' +
'        <div class=\"console-card-header\">' +
'          <span><span class=\"live-dot\"></span>CURRENT SLIDE (LIVE TO AUDIENCE)</span>' +
'          <span id=\"current-slide-title-tag\" style=\"color:#CBD5E1; font-weight:600;\">Title</span>' +
'        </div>' +
'        <div class=\"slide-viewport-box\" id=\"current-viewport\">' +
'          <div id=\"current-stage-wrap\"></div>' +
'          <div class=\"black-screen-veil\" id=\"black-veil\">' +
'            <div style=\"font-size:1.8rem;\">⬛</div>' +
'            <div style=\"font-size:1.05rem; font-weight:700;\">AUDIENCE SCREEN IS CONCEALED (BLACK)</div>' +
'            <div style=\"font-size:0.8rem; color:#94A3B8;\">Press \'B\' or click Black Screen button to resume</div>' +
'          </div>' +
'        </div>' +
'      </div>' +
'      <div class=\"console-card\">' +
'        <div class=\"console-card-header\">' +
'          <span style=\"color:#38BDF8;\">UP NEXT (ANTICIPATION)</span>' +
'          <span id=\"next-slide-title-tag\" style=\"color:#94A3B8; font-weight:600;\">Next Title</span>' +
'        </div>' +
'        <div class=\"slide-viewport-box\" id=\"next-viewport\" style=\"max-height: 200px;\">' +
'          <div id=\"next-stage-wrap\"></div>' +
'        </div>' +
'      </div>' +
'    </div>' +
'    <div class=\"notes-col\">' +
'      <div class=\"notes-header\">' +
'        <span class=\"notes-title\">Speaker Notes &amp; Talking Points</span>' +
'        <div class=\"font-btns\">' +
'          <button type=\"button\" class=\"btn-font\" id=\"btn-font-dec\" title=\"Decrease font size\">A-</button>' +
'          <button type=\"button\" class=\"btn-font\" id=\"btn-font-inc\" title=\"Increase font size\">A+</button>' +
'          <button type=\"button\" class=\"btn-font\" id=\"btn-font-reset\" title=\"Reset font size\">Reset</button>' +
'        </div>' +
'      </div>' +
'      <div class=\"notes-content\" id=\"console-notes-text\"></div>' +
'    </div>' +
'  </main>' +
'  <footer class=\"console-dock\">' +
'    <div class=\"dock-group\">' +
'      <button class=\"btn-action btn-action-primary\" id=\"btn-prev\" title=\"Previous Slide (← / PageUp)\">◀ Previous</button>' +
'      <select id=\"slide-jump-select\" class=\"slide-select-dock\" aria-label=\"Jump to slide\">' +
  slideOptions +
'      </select>' +
'      <button class=\"btn-action btn-action-primary\" id=\"btn-next\" title=\"Next Slide (→ / Space / PageDown)\">Next ▶</button>' +
'    </div>' +
'    <div class=\"dock-group\">' +
'      <button class=\"btn-action\" id=\"btn-black-screen\" title=\"Toggle Black Screen (B)\">⬛ Black Screen</button>' +
'      <span style=\"font-size:0.75rem; color:#64748B;\">Shortcuts: [Space/→] Next • [←] Prev • [B] Black • [Esc] Exit</span>' +
'    </div>' +
'  </footer>' +
'  <script>' +
'    (function() {' +
'      const parentWin = window.opener;' +
'      if (!parentWin || !parentWin.tnPresentation) {' +
'        document.body.innerHTML = \'<div style=\"padding:2rem;color:#fff;\">Unable to link with presentation window. Please reopen console from the presentation.</div>\';' +
'        return;' +
'      }' +
'      let targetTimeMs = Date.now() + 45 * 60 * 1000;' +
'      const clockEl = document.getElementById(\"live-clock\");' +
'      const countdownEl = document.getElementById(\"countdown-badge\");' +
'      const endInput = document.getElementById(\"target-end-input\");' +
'      const initDate = new Date(targetTimeMs);' +
'      endInput.value = String(initDate.getHours()).padStart(2, \"0\") + \":\" + String(initDate.getMinutes()).padStart(2, \"0\");' +
'      endInput.addEventListener(\"change\", () => {' +
'        const parts = endInput.value.split(\":\");' +
'        if (parts.length === 2) {' +
'          const d = new Date();' +
'          d.setHours(parseInt(parts[0], 10));' +
'          d.setMinutes(parseInt(parts[1], 10));' +
'          d.setSeconds(0);' +
'          targetTimeMs = d.getTime();' +
'          updateTimekeeper();' +
'        }' +
'      });' +
'      document.getElementById(\"btn-plus-5\").addEventListener(\"click\", () => {' +
'        targetTimeMs += 5 * 60 * 1000;' +
'        const d = new Date(targetTimeMs);' +
'        endInput.value = String(d.getHours()).padStart(2, \"0\") + \":\" + String(d.getMinutes()).padStart(2, \"0\");' +
'        updateTimekeeper();' +
'      });' +
'      document.getElementById(\"btn-plus-15\").addEventListener(\"click\", () => {' +
'        targetTimeMs += 15 * 60 * 1000;' +
'        const d = new Date(targetTimeMs);' +
'        endInput.value = String(d.getHours()).padStart(2, \"0\") + \":\" + String(d.getMinutes()).padStart(2, \"0\");' +
'        updateTimekeeper();' +
'      });' +
'      function updateClock() {' +
'        const now = new Date();' +
'        clockEl.textContent = now.toLocaleTimeString([], { hour: \"2-digit\", minute: \"2-digit\", second: \"2-digit\" });' +
'        updateTimekeeper();' +
'      }' +
'      function updateTimekeeper() {' +
'        const now = Date.now();' +
'        const diffSec = Math.round((targetTimeMs - now) / 1000);' +
'        countdownEl.classList.remove(\"warn\", \"overtime\");' +
'        if (diffSec >= 0) {' +
'          const m = Math.floor(diffSec / 60);' +
'          const s = diffSec % 60;' +
'          countdownEl.textContent = String(m).padStart(2, \"0\") + \":\" + String(s).padStart(2, \"0\") + \" REMAINING\";' +
'          if (diffSec <= 300) {' +
'            countdownEl.classList.add(\"warn\");' +
'            countdownEl.textContent = String(m).padStart(2, \"0\") + \":\" + String(s).padStart(2, \"0\") + \" (WRAP UP)\";' +
'          }' +
'        } else {' +
'          const abs = Math.abs(diffSec);' +
'          const m = Math.floor(abs / 60);' +
'          const s = abs % 60;' +
'          countdownEl.classList.add(\"overtime\");' +
'          countdownEl.textContent = \"-\" + String(m).padStart(2, \"0\") + \":\" + String(s).padStart(2, \"0\") + \" OVERTIME\";' +
'        }' +
'      }' +
'      setInterval(updateClock, 1000);' +
'      updateClock();' +
'      function rescaleViewports() {' +
'        const curBox = document.getElementById(\"current-viewport\");' +
'        const nextBox = document.getElementById(\"next-viewport\");' +
'        const curStage = curBox.querySelector(\".slide-stage\");' +
'        const nextStage = nextBox.querySelector(\".slide-stage\");' +
'        if (curStage) {' +
'          const scale = curBox.clientWidth / 960;' +
'          curStage.style.transform = \"scale(\" + scale + \")\";' +
'        }' +
'        if (nextStage) {' +
'          const scale = nextBox.clientWidth / 960;' +
'          nextStage.style.transform = \"scale(\" + scale + \")\";' +
'        }' +
'      }' +
'      window.addEventListener(\"resize\", rescaleViewports);' +
'      function updateConsoleView() {' +
'        const appData = parentWin.tnPresentation.getAppData();' +
'        const curIdx = parentWin.tnPresentation.getCurrentIndex();' +
'        const isBlack = parentWin.tnPresentation.isBlackScreen();' +
'        const curSlide = appData.slides[curIdx];' +
'        const nextSlide = appData.slides[curIdx + 1];' +
'        document.getElementById(\"console-slide-counter\").textContent = \"Slide \" + (curIdx + 1) + \" of \" + appData.slides.length;' +
'        document.getElementById(\"current-slide-title-tag\").textContent = curSlide?.title || \"Untitled\";' +
'        document.getElementById(\"slide-jump-select\").value = curIdx;' +
'        const curWrap = document.getElementById(\"current-stage-wrap\");' +
'        const theme = appData.theme || \"theme-dept-blue-banner\";' +
'        const isBgBleed = curSlide.imagePlacement === \"bg-bleed\" && curSlide.mediaUrl;' +
'        const bgClass = isBgBleed ? \"has-bg-image\" : \"\";' +
'        const bgStyle = isBgBleed ? \"background-image: url(\'\" + curSlide.mediaUrl + \"\');\" : \"\";' +
'        curWrap.innerHTML = \'<div class=\"slide-stage \' + theme + \' \' + bgClass + \'\" style=\"\' + bgStyle + \'\">\' + parentWin.tnPresentation.buildSlideHtml(curSlide, curIdx) + \'</div>\';' +
'        const nextWrap = document.getElementById(\"next-stage-wrap\");' +
'        const nextTitleTag = document.getElementById(\"next-slide-title-tag\");' +
'        if (nextSlide) {' +
'          nextTitleTag.textContent = nextSlide.title || \"Untitled\";' +
'          const nBgBleed = nextSlide.imagePlacement === \"bg-bleed\" && nextSlide.mediaUrl;' +
'          const nBgClass = nBgBleed ? \"has-bg-image\" : \"\";' +
'          const nBgStyle = nBgBleed ? \"background-image: url(\'\" + nextSlide.mediaUrl + \"\');\" : \"\";' +
'          nextWrap.innerHTML = \'<div class=\"slide-stage \' + theme + \' \' + nBgClass + \'\" style=\"\' + nBgStyle + \'\">\' + parentWin.tnPresentation.buildSlideHtml(nextSlide, curIdx + 1) + \'</div>\';' +
'        } else {' +
'          nextTitleTag.textContent = \"End of Deck\";' +
'          nextWrap.innerHTML = \'<div style=\"height:100%; display:flex; align-items:center; justify-content:center; background:#1E293B; color:#94A3B8; font-weight:700;\">END OF PRESENTATION (No Next Slide)</div>\';' +
'        }' +
'        const veil = document.getElementById(\"black-veil\");' +
'        const blackBtn = document.getElementById(\"btn-black-screen\");' +
'        if (isBlack) {' +
'          veil.classList.add(\"active\");' +
'          blackBtn.classList.add(\"active-black\");' +
'          blackBtn.textContent = \"⬛ Black Screen (ON)\";' +
'        } else {' +
'          veil.classList.remove(\"active\");' +
'          blackBtn.classList.remove(\"active-black\");' +
'          blackBtn.textContent = \"⬛ Black Screen\";' +
'        }' +
'        const notesBox = document.getElementById(\"console-notes-text\");' +
'        if (curSlide.notes && curSlide.notes.trim().length > 0) {' +
'          notesBox.textContent = curSlide.notes;' +
'        } else {' +
'          notesBox.innerHTML = \'<div class=\"notes-empty-msg\">No speaker notes recorded for Slide #\' + (curIdx + 1) + \'.<br>Add notes in the Outline Editor.</div>\';' +
'        }' +
'        rescaleViewports();' +
'      }' +
'      window.updateConsoleView = updateConsoleView;' +
'      updateConsoleView();' +
'      document.getElementById(\"btn-prev\").addEventListener(\"click\", () => parentWin.tnPresentation.prevSlide());' +
'      document.getElementById(\"btn-next\").addEventListener(\"click\", () => parentWin.tnPresentation.nextSlide());' +
'      document.getElementById(\"slide-jump-select\").addEventListener(\"change\", (e) => {' +
'        parentWin.tnPresentation.switchSlide(parseInt(e.target.value, 10));' +
'      });' +
'      document.getElementById(\"btn-black-screen\").addEventListener(\"click\", () => {' +
'        parentWin.tnPresentation.toggleBlackScreen();' +
'      });' +
'      document.getElementById(\"btn-focus-slides\").addEventListener(\"click\", () => {' +
'        parentWin.focus();' +
'        parentWin.tnPresentation.enterFullscreen();' +
'      });' +
'      let notesFontSize = 18;' +
'      const notesEl = document.getElementById(\"console-notes-text\");' +
'      document.getElementById(\"btn-font-inc\").addEventListener(\"click\", () => {' +
'        if (notesFontSize < 34) {' +
'          notesFontSize += 2;' +
'          notesEl.style.fontSize = notesFontSize + \"px\";' +
'        }' +
'      });' +
'      document.getElementById(\"btn-font-dec\").addEventListener(\"click\", () => {' +
'        if (notesFontSize > 13) {' +
'          notesFontSize -= 2;' +
'          notesEl.style.fontSize = notesFontSize + \"px\";' +
'        }' +
'      });' +
'      document.getElementById(\"btn-font-reset\").addEventListener(\"click\", () => {' +
'        notesFontSize = 18;' +
'        notesEl.style.fontSize = \"18px\";' +
'      });' +
'      window.addEventListener(\"keydown\", (e) => {' +
'        if (e.target.matches(\"input, select\")) return;' +
'        switch (e.key) {' +
'          case \"ArrowRight\":' +
'          case \" \":' +
'          case \"PageDown\":' +
'            e.preventDefault();' +
'            parentWin.tnPresentation.nextSlide();' +
'            break;' +
'          case \"ArrowLeft\":' +
'          case \"PageUp\":' +
'            e.preventDefault();' +
'            parentWin.tnPresentation.prevSlide();' +
'            break;' +
'          case \"b\":' +
'          case \"B\":' +
'            e.preventDefault();' +
'            parentWin.tnPresentation.toggleBlackScreen();' +
'            break;' +
'          case \"Escape\":' +
'            window.close();' +
'            break;' +
'        }' +
'      });' +
'    })();' +
'  <\/script>' +
'</body>' +
'</html>';

  win.document.open();
  win.document.write(html);
  win.document.close();
}

// Expose Presentation API on window for Presenter Console sync
window.tnPresentation = {
  getAppData: () => appData,
  getCurrentIndex: () => currentSlideIndex,
  switchSlide: (idx) => switchSlide(idx),
  nextSlide: () => nextSlide(),
  prevSlide: () => prevSlide(),
  toggleBlackScreen: () => toggleBlackScreen(),
  isBlackScreen: () => isBlackScreen,
  enterFullscreen: () => enterFullscreenPresentation(),
  buildSlideHtml: (slide, idx) => buildSlideHtml(slide, idx),
  getActiveAgencyLogoUrl: () => getActiveAgencyLogoUrl(),
  launchFullscreenVideo: (slide) => launchFullscreenVideoTheater(slide || appData.slides[currentSlideIndex]),
  stopFullscreenVideo: () => exitFullscreenVideoTheater(false),
  isVideoPlaying: () => isVideoPlayingFullscreen,
  applyAspectRatio: (r) => applyAspectRatio(r),
  getActiveAspectRatioConfig: (r) => getActiveAspectRatioConfig(r),
  toggleSafeZones: () => toggleSafeZones(),
  checkCurrentSlideClipping: () => checkCurrentSlideClipping(),
  scanDeckForClipping: () => scanDeckForClipping(),
  toggleCompactSafeFit: () => toggleCompactSafeFit()
};

function toggleLaser() {
  if (isLaserActive) disableLaser();
  else enableLaser();
}

function enableLaser() {
  isLaserActive = true;
  disablePen();
  laserDot.classList.add('active');
  document.getElementById('hud-laser-btn').style.background = '#FF0033';
  document.getElementById('hud-laser-btn').style.color = '#FFFFFF';
}

function disableLaser() {
  isLaserActive = false;
  laserDot.classList.remove('active');
  const btn = document.getElementById('hud-laser-btn');
  if (btn) {
    btn.style.background = '';
    btn.style.color = '';
  }
}

function togglePen() {
  if (isPenActive) disablePen();
  else enablePen();
}

function enablePen() {
  isPenActive = true;
  disableLaser();
  canvasEl.classList.add('pen-active');
  document.getElementById('hud-pen-btn').style.background = 'var(--tn-gold)';
  document.getElementById('hud-pen-btn').style.color = '#000';
}

function disablePen() {
  isPenActive = false;
  canvasEl.classList.remove('pen-active');
  const btn = document.getElementById('hud-pen-btn');
  if (btn) {
    btn.style.background = '';
    btn.style.color = '';
  }
}

function resizeAnnotationCanvas() {
  const box = document.getElementById('fullscreen-slide-box');
  if (box) {
    canvasEl.width = box.clientWidth;
    canvasEl.height = box.clientHeight;
  }
}

function redrawAnnotationsForCurrentSlide() {
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  const strokes = annotationsBySlide[currentSlideIndex] || [];
  strokes.forEach(stroke => {
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    stroke.points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
  });
}

function clearCurrentSlideAnnotations() {
  annotationsBySlide[currentSlideIndex] = [];
  redrawAnnotationsForCurrentSlide();
}

