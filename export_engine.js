/**
 * State of Tennessee Presentation Studio - Export Engines & Disk Persistence
 * Generates PowerPoint (.pptx), tagged PDFs, printable handouts, offline .zip, and self-editing disk saves.
 */
'use strict';

// --- 8. SELF-EDITING & FILE SYSTEM ACCESS API ---
function markDirty() {
  isDirty = true;
  if (saveDot) saveDot.classList.add('dirty');
  if (saveStatusText) saveStatusText.textContent = 'Save *';
  const btnSave = document.getElementById('btn-header-save');
  if (btnSave) btnSave.classList.add('has-unsaved');
}

function markClean() {
  isDirty = false;
  if (saveDot) saveDot.classList.remove('dirty');
  if (saveStatusText) saveStatusText.textContent = 'Saved';
  const btnSave = document.getElementById('btn-header-save');
  if (btnSave) btnSave.classList.remove('has-unsaved');
}

function getDeckSlugFilename() {
  const rawTitle = (appData && (appData.deckTitle || (appData.slides && appData.slides[0] && appData.slides[0].title))) || 'tn-presentation';
  const slug = String(rawTitle)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return (slug || 'tn-presentation') + '.html';
}

function escapeHtmlSafe(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generatePortableDeckHtml() {
  const deckTitle = (appData && (appData.deckTitle || (appData.slides && appData.slides[0] && appData.slides[0].title))) || 'TN Slides Presentation';
  const theme = (appData && appData.theme) || 'theme-dept-blue-banner';
  const aspectRatio = (appData && appData.aspectRatio) || '16:9';
  const baseWidth = 960;
  const baseHeight = aspectRatio === '4:3' ? 720 : 540;
  const customBrandColor = (appData && appData.customBrandColor) || '';

  // Collect all inline <style> blocks from the studio so every slide layout renders identically
  const studioStyles = Array.from(document.querySelectorAll('style'))
    .filter(s => s.id !== 'tn-portable-player-styles')
    .map(s => s.textContent)
    .join('\n\n');

  // Pre-render each slide using the exact studio renderer
  const slidesDataHtml = (appData && Array.isArray(appData.slides) ? appData.slides : []).map((slide, idx) => {
    const rendered = typeof buildSlideHtml === 'function' ? buildSlideHtml(slide, idx) : `<h1>${escapeHtmlSafe(slide.title)}</h1>`;
    const isBgBleed = slide.imagePlacement === 'bg-bleed' && slide.mediaUrl;
    const bgUrl = isBgBleed ? escapeHtmlSafe(slide.mediaUrl) : '';
    const mapClass = slide.layout === 'layout-tn-map' ? 'layout-stage-tn-map' : '';
    return `<div class="tn-deck-slide-data" data-slide-index="${idx}" data-layout="${escapeHtmlSafe(slide.layout || '')}" data-bg="${bgUrl}" data-map-class="${mapClass}" hidden>${rendered}</div>`;
  }).join('\n');

  const safeJson = JSON.stringify(appData, null, 2).replace(/<\/script>/gi, '<\\/script>');

  const playerCss = `
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #0b1324;
      color: #f8fafc;
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
    }
    #tn-deck-player {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, #13203b 0%, #070d19 100%);
    }
    #tn-player-viewport {
      position: relative;
      width: ${baseWidth}px;
      height: ${baseHeight}px;
      background: #ffffff;
      border-radius: 6px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
      overflow: hidden;
      transform-origin: center center;
    }
    #tn-player-stage {
      width: ${baseWidth}px;
      height: ${baseHeight}px;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
    }
    #tn-player-hud {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      padding: 6px 12px;
      border-radius: 999px;
      z-index: 900;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      transition: opacity 0.25s ease;
    }
    .tn-hud-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #e2e8f0;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .tn-hud-btn:hover { background: rgba(255, 255, 255, 0.12); color: #ffffff; }
    .tn-hud-btn.active { background: #c59b27; color: #0f172a; }
    .tn-hud-btn.save-btn { background: #16a34a; color: #ffffff; display: none; }
    .tn-hud-btn.save-btn:hover { background: #15803d; }
    body.quick-edit-active .tn-hud-btn.save-btn { display: inline-flex; }
    .tn-hud-counter {
      font-size: 0.8rem;
      font-weight: 700;
      color: #cbd5e1;
      padding: 0 8px;
      min-width: 54px;
      text-align: center;
    }
    .tn-hud-divider {
      width: 1px;
      height: 18px;
      background: rgba(255, 255, 255, 0.16);
      margin: 0 2px;
    }
    #tn-quick-edit-banner {
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: #002d72;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 7px 14px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      display: none;
      align-items: center;
      gap: 10px;
      z-index: 950;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }
    body.quick-edit-active #tn-quick-edit-banner { display: flex; }
    body.quick-edit-active #tn-player-stage [contenteditable="true"] {
      outline: 1.5px dashed rgba(197, 155, 39, 0.75);
      outline-offset: 2px;
      border-radius: 3px;
      cursor: text;
    }
    body.quick-edit-active #tn-player-stage [contenteditable="true"]:focus {
      outline: 2px solid #c59b27;
      background: rgba(255, 251, 235, 0.12);
    }
    #tn-notes-drawer {
      position: fixed;
      right: 18px;
      bottom: 72px;
      width: min(380px, calc(100vw - 36px));
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 10px;
      padding: 12px 14px;
      color: #f1f5f9;
      z-index: 900;
      display: none;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    }
    #tn-notes-drawer.open { display: block; }
    #tn-notes-drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #c59b27;
      margin-bottom: 8px;
    }
    #tn-notes-text {
      width: 100%;
      min-height: 84px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      color: #f8fafc;
      font-family: inherit;
      font-size: 0.82rem;
      line-height: 1.45;
      padding: 8px;
      resize: vertical;
      box-sizing: border-box;
    }
    #tn-notes-text[readonly] {
      border-color: transparent;
      background: transparent;
      padding: 0;
    }
    #tn-mobile-edit-sheet {
      display: none;
      position: fixed;
      left: 10px;
      right: 10px;
      bottom: 68px;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(197, 155, 39, 0.45);
      border-radius: 12px;
      padding: 12px;
      z-index: 920;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
      max-height: 46vh;
      overflow-y: auto;
    }
    #tn-mobile-edit-sheet label {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #c59b27;
      margin: 6px 0 3px;
    }
    #tn-mobile-edit-sheet label:first-child { margin-top: 0; }
    #tn-mobile-edit-sheet input,
    #tn-mobile-edit-sheet textarea {
      width: 100%;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      color: #f8fafc;
      font-family: inherit;
      font-size: 0.85rem;
      padding: 7px 9px;
    }
    #tn-mobile-edit-sheet textarea {
      min-height: 62px;
      resize: vertical;
      line-height: 1.4;
    }
    @media (max-width: 767px) {
      body.quick-edit-active #tn-deck-player {
        justify-content: flex-start;
        padding-top: 52px;
      }
      body.quick-edit-active #tn-mobile-edit-sheet {
        display: block;
      }
      body.quick-edit-active #tn-notes-drawer {
        display: none !important;
      }
    }
    @media (max-width: 640px) {
      #tn-player-hud {
        bottom: 10px;
        max-width: calc(100vw - 16px);
        padding: 5px 8px;
        gap: 3px;
        flex-wrap: nowrap;
        overflow-x: auto;
      }
      .tn-hud-btn {
        padding: 6px 8px;
        font-size: 0.74rem;
        white-space: nowrap;
      }
      .tn-hud-btn .tn-hud-label-hide-sm {
        display: none;
      }
      .tn-hud-counter {
        padding: 0 4px;
        min-width: 42px;
        font-size: 0.74rem;
      }
      #tn-quick-edit-banner {
        top: 8px;
        max-width: calc(100vw - 20px);
        padding: 5px 10px;
        font-size: 0.7rem;
      }
    }
  `;

  const playerJs = `
    (function() {
      const dataEl = document.getElementById('tn-presentation-data');
      const deckData = dataEl ? JSON.parse(dataEl.textContent) : { slides: [] };
      const slideContainers = Array.from(document.querySelectorAll('.tn-deck-slide-data'));
      const stage = document.getElementById('tn-player-stage');
      const viewport = document.getElementById('tn-player-viewport');
      const counterEl = document.getElementById('tn-hud-counter');
      const notesDrawer = document.getElementById('tn-notes-drawer');
      const notesTextarea = document.getElementById('tn-notes-text');
      const btnQuickEdit = document.getElementById('tn-btn-quick-edit');
      const btnNotes = document.getElementById('tn-btn-notes');
      const btnSaveCopy = document.getElementById('tn-btn-save-copy');
      const btnDoneEdit = document.getElementById('tn-btn-done-edit');

      let currentIdx = 0;
      let isQuickEdit = false;
      const baseW = ${baseWidth};
      const baseH = ${baseHeight};
      const deckTheme = '${escapeHtmlSafe(theme)}';

      function scaleViewport() {
        const padW = window.innerWidth - 32;
        const padH = window.innerHeight - 96;
        const scale = Math.min(padW / baseW, padH / baseH, 1.8);
        viewport.style.transform = 'scale(' + Math.max(0.25, scale) + ')';
      }

      function getEditableSelectors() {
        return 'h1, h2, h3, h4, p, li, .slide-kicker, .slide-title, .slide-subtitle, .pillar-title, .pillar-desc, .timeline-title, .timeline-desc, .stat-number, .stat-label, .quote-text, .quote-author';
      }

      function flushCurrentSlideEdits() {
        if (!isQuickEdit) return;
        const container = slideContainers[currentIdx];
        if (!container) return;

        // Strip contenteditable before storing back into slide template
        const clone = stage.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        container.innerHTML = clone.innerHTML;

        // Sync text fields back to JSON payload for 100% round-trip fidelity in TN Slides Studio
        const slideObj = deckData.slides && deckData.slides[currentIdx];
        if (slideObj) {
          const titleEl = stage.querySelector('.slide-title, h1, h2');
          const kickerEl = stage.querySelector('.slide-kicker, .kicker');
          const bulletEls = Array.from(stage.querySelectorAll('.slide-bullets li, ul li, ol li'));
          if (titleEl) slideObj.title = titleEl.innerText.trim();
          if (kickerEl) slideObj.kicker = kickerEl.innerText.trim();
          if (bulletEls.length > 0) {
            slideObj.body = bulletEls.map(li => li.innerText.trim()).filter(Boolean).join('\\n');
          }
          if (notesTextarea) slideObj.notes = notesTextarea.value;
          if (dataEl) {
            dataEl.textContent = '\\n' + JSON.stringify(deckData, null, 2) + '\\n  ';
          }
        }
      }

      function applyQuickEditToStage() {
        stage.querySelectorAll(getEditableSelectors()).forEach(el => {
          if (isQuickEdit) {
            el.setAttribute('contenteditable', 'true');
          } else {
            el.removeAttribute('contenteditable');
          }
        });
        if (notesTextarea) {
          notesTextarea.readOnly = !isQuickEdit;
        }
      }

      function renderSlide(idx) {
        if (slideContainers.length === 0) return;
        if (isQuickEdit) flushCurrentSlideEdits();
        currentIdx = Math.max(0, Math.min(idx, slideContainers.length - 1));
        const src = slideContainers[currentIdx];
        const bgUrl = src.getAttribute('data-bg') || '';
        const mapCls = src.getAttribute('data-map-class') || '';
        stage.innerHTML = src.innerHTML;
        stage.className = 'slide-stage ' + deckTheme + (bgUrl ? ' has-bg-image' : '') + ' ' + mapCls;
        stage.style.backgroundImage = bgUrl ? "url('" + bgUrl + "')" : '';
        counterEl.textContent = (currentIdx + 1) + ' / ' + slideContainers.length;

        const slideObj = (deckData.slides && deckData.slides[currentIdx]) || {};
        if (notesTextarea) {
          notesTextarea.value = slideObj.notes || '';
        }
        applyQuickEditToStage();
      }

      function toggleQuickEdit(force) {
        if (isQuickEdit && force !== true) {
          flushCurrentSlideEdits();
        }
        isQuickEdit = typeof force === 'boolean' ? force : !isQuickEdit;
        document.body.classList.toggle('quick-edit-active', isQuickEdit);
        btnQuickEdit.classList.toggle('active', isQuickEdit);
        if (isQuickEdit && notesDrawer) {
          notesDrawer.classList.add('open');
          btnNotes.classList.add('active');
        }
        applyQuickEditToStage();
      }

      async function saveUpdatedCopy() {
        flushCurrentSlideEdits();
        const wasEditing = isQuickEdit;
        if (wasEditing) toggleQuickEdit(false);

        const docClone = document.documentElement.cloneNode(true);
        const clonedBody = docClone.querySelector('body');
        if (clonedBody) clonedBody.classList.remove('quick-edit-active');
        const clonedNotes = docClone.querySelector('#tn-notes-drawer');
        if (clonedNotes) clonedNotes.classList.remove('open');
        const clonedStage = docClone.querySelector('#tn-player-stage');
        if (clonedStage) clonedStage.innerHTML = '';

        const htmlOut = '<!DOCTYPE html>\\n' + docClone.outerHTML;
        const filename = '${escapeHtmlSafe(getDeckSlugFilename())}';

        if ('showSaveFilePicker' in window) {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [{ description: 'TN Slides Smart-Deck HTML', accept: { 'text/html': ['.html'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(htmlOut);
            await writable.close();
            if (wasEditing) toggleQuickEdit(true);
            return;
          } catch (e) {
            if (e.name === 'AbortError') {
              if (wasEditing) toggleQuickEdit(true);
              return;
            }
          }
        }
        const blob = new Blob([htmlOut], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (wasEditing) toggleQuickEdit(true);
      }

      document.getElementById('tn-btn-prev').addEventListener('click', () => renderSlide(currentIdx - 1));
      document.getElementById('tn-btn-next').addEventListener('click', () => renderSlide(currentIdx + 1));
      btnNotes.addEventListener('click', () => {
        notesDrawer.classList.toggle('open');
        btnNotes.classList.toggle('active', notesDrawer.classList.contains('open'));
      });
      document.getElementById('tn-btn-close-notes').addEventListener('click', () => {
        notesDrawer.classList.remove('open');
        btnNotes.classList.remove('active');
      });
      btnQuickEdit.addEventListener('click', () => toggleQuickEdit());
      btnDoneEdit.addEventListener('click', () => toggleQuickEdit(false));
      btnSaveCopy.addEventListener('click', saveUpdatedCopy);
      document.getElementById('tn-btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });

      const btnShare = document.getElementById('tn-btn-share');
      const mobTitleInput = document.getElementById('tn-mob-title');
      const mobBodyInput = document.getElementById('tn-mob-body');
      const mobNotesInput = document.getElementById('tn-mob-notes');

      function buildCleanHtmlSnapshot() {
        flushCurrentSlideEdits();
        const wasEditing = isQuickEdit;
        if (wasEditing) toggleQuickEdit(false);

        const docClone = document.documentElement.cloneNode(true);
        const clonedBody = docClone.querySelector('body');
        if (clonedBody) clonedBody.classList.remove('quick-edit-active');
        const clonedNotes = docClone.querySelector('#tn-notes-drawer');
        if (clonedNotes) clonedNotes.classList.remove('open');
        const clonedStage = docClone.querySelector('#tn-player-stage');
        if (clonedStage) clonedStage.innerHTML = '';

        const htmlOut = '<!DOCTYPE html>\\n' + docClone.outerHTML;
        if (wasEditing) toggleQuickEdit(true);
        return htmlOut;
      }

      async function shareOrEmailDeck() {
        const htmlOut = buildCleanHtmlSnapshot();
        const filename = '${escapeHtmlSafe(getDeckSlugFilename())}';
        const title = '${escapeHtmlSafe(deckTitle)}';
        try {
          const file = new File([htmlOut], filename, { type: 'text/html' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: title,
              text: 'TN Slides Presentation (' + filename + ')'
            });
            return;
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
        // Fallback on desktop: download file so user can attach to email
        const blob = new Blob([htmlOut], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (btnShare) {
          const orig = btnShare.innerHTML;
          btnShare.innerHTML = '<span>Saved for Email</span>';
          setTimeout(() => { btnShare.innerHTML = orig; }, 2200);
        }
      }

      function syncMobileInputsFromSlide() {
        const slideObj = (deckData.slides && deckData.slides[currentIdx]) || {};
        if (mobTitleInput) mobTitleInput.value = slideObj.title || '';
        if (mobBodyInput) mobBodyInput.value = slideObj.body || '';
        if (mobNotesInput) mobNotesInput.value = slideObj.notes || '';
      }

      function applyMobileInputsToStage() {
        const slideObj = deckData.slides && deckData.slides[currentIdx];
        if (!slideObj) return;
        if (mobTitleInput) {
          slideObj.title = mobTitleInput.value;
          const titleEl = stage.querySelector('.slide-title, h1, h2');
          if (titleEl) titleEl.innerText = mobTitleInput.value;
        }
        if (mobBodyInput) {
          slideObj.body = mobBodyInput.value;
          const lines = mobBodyInput.value.split('\\n').map(s => s.trim()).filter(Boolean);
          const listEl = stage.querySelector('.slide-bullets, ul, ol');
          if (listEl) {
            listEl.innerHTML = lines.map(l => '<li>' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</li>').join('');
          }
        }
        if (mobNotesInput) {
          slideObj.notes = mobNotesInput.value;
          if (notesTextarea) notesTextarea.value = mobNotesInput.value;
        }
        if (dataEl) {
          dataEl.textContent = '\\n' + JSON.stringify(deckData, null, 2) + '\\n  ';
        }
        const container = slideContainers[currentIdx];
        if (container) {
          const clone = stage.cloneNode(true);
          clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
          container.innerHTML = clone.innerHTML;
        }
      }

      if (mobTitleInput) mobTitleInput.addEventListener('input', applyMobileInputsToStage);
      if (mobBodyInput) mobBodyInput.addEventListener('input', applyMobileInputsToStage);
      if (mobNotesInput) mobNotesInput.addEventListener('input', applyMobileInputsToStage);
      if (btnShare) btnShare.addEventListener('click', shareOrEmailDeck);

      // Touch swipe navigation on mobile
      let touchStartX = 0;
      let touchStartY = 0;
      const playerMain = document.getElementById('tn-deck-player');
      if (playerMain) {
        playerMain.addEventListener('touchstart', (e) => {
          if (e.touches && e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
          }
        }, { passive: true });
        playerMain.addEventListener('touchend', (e) => {
          if (isQuickEdit || !e.changedTouches || e.changedTouches.length !== 1) return;
          const dx = e.changedTouches[0].clientX - touchStartX;
          const dy = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            if (dx < 0) renderSlide(currentIdx + 1);
            else renderSlide(currentIdx - 1);
          }
        }, { passive: true });
      }

      const _origRenderSlide = renderSlide;
      renderSlide = function(idx) {
        _origRenderSlide(idx);
        syncMobileInputsFromSlide();
      };

      document.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) || '';
        const isTyping = (e.target && e.target.isContentEditable) || tag === 'TEXTAREA' || tag === 'INPUT';
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          saveUpdatedCopy();
          return;
        }
        if (e.key === 'Escape') {
          if (isQuickEdit) toggleQuickEdit(false);
          else if (notesDrawer.classList.contains('open')) {
            notesDrawer.classList.remove('open');
            btnNotes.classList.remove('active');
          }
          return;
        }
        if (isTyping) return;
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault();
          renderSlide(currentIdx + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          renderSlide(currentIdx - 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          renderSlide(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          renderSlide(slideContainers.length - 1);
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          toggleQuickEdit();
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          notesDrawer.classList.toggle('open');
          btnNotes.classList.toggle('active', notesDrawer.classList.contains('open'));
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
          else document.exitFullscreen().catch(() => {});
        }
      });

      window.addEventListener('resize', scaleViewport);
      scaleViewport();
      renderSlide(0);
    })();
  `;

  const customColorStyle = customBrandColor ? ` style="--tn-navy: ${escapeHtmlSafe(customBrandColor)};"` : '';

  return `<!DOCTYPE html>
<html lang="en"${customColorStyle}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlSafe(deckTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Roboto+Slab:wght@400;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
  <style>
${studioStyles}
  </style>
  <style id="tn-portable-player-styles">
${playerCss}
  </style>
</head>
<body>
  <div id="tn-quick-edit-banner">
    <span><i class="fa-solid fa-pen-to-square"></i> Quick Edit Mode</span>
    <button type="button" class="tn-hud-btn" id="tn-btn-done-edit" style="background: rgba(255,255,255,0.16); padding: 4px 10px;">Done</button>
  </div>

  <main id="tn-deck-player" aria-label="Presentation Player">
    <div id="tn-player-viewport">
      <div id="tn-player-stage" class="slide-stage ${escapeHtmlSafe(theme)}"></div>
    </div>
  </main>

  <section id="tn-mobile-edit-sheet" aria-label="Mobile Quick Editor">
    <label for="tn-mob-title">Slide Title</label>
    <input type="text" id="tn-mob-title" placeholder="Slide title...">
    <label for="tn-mob-body">Bullets / Body (one per line)</label>
    <textarea id="tn-mob-body" placeholder="Bullet points..."></textarea>
    <label for="tn-mob-notes">Speaker Notes</label>
    <textarea id="tn-mob-notes" placeholder="Speaker notes..."></textarea>
  </section>

  <aside id="tn-notes-drawer" aria-label="Speaker Notes">
    <div id="tn-notes-drawer-header">
      <span><i class="fa-solid fa-note-sticky"></i> Speaker Notes</span>
      <button type="button" id="tn-btn-close-notes" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;">&times;</button>
    </div>
    <textarea id="tn-notes-text" readonly placeholder="No speaker notes for this slide."></textarea>
  </aside>

  <nav id="tn-player-hud" aria-label="Presentation Controls">
    <button type="button" class="tn-hud-btn" id="tn-btn-prev" title="Previous Slide (Left Arrow)" aria-label="Previous Slide">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="tn-hud-counter" id="tn-hud-counter">1 / 1</span>
    <button type="button" class="tn-hud-btn" id="tn-btn-next" title="Next Slide (Right Arrow / Space)" aria-label="Next Slide">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <span class="tn-hud-divider"></span>
    <button type="button" class="tn-hud-btn" id="tn-btn-notes" title="Speaker Notes (N)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="tn-hud-label-hide-sm">Notes</span>
    </button>
    <button type="button" class="tn-hud-btn" id="tn-btn-quick-edit" title="Quick Edit Last-Minute Typos (E)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>Edit</span>
    </button>
    <button type="button" class="tn-hud-btn" id="tn-btn-share" title="Share / Email Deck">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      <span class="tn-hud-label-hide-sm">Share</span>
    </button>
    <button type="button" class="tn-hud-btn save-btn" id="tn-btn-save-copy" title="Save Updated HTML Copy (Ctrl+S)">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      <span>Save</span>
    </button>
    <button type="button" class="tn-hud-btn" id="tn-btn-fullscreen" title="Fullscreen (F)" aria-label="Toggle Fullscreen">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
    </button>
  </nav>

  <!-- Pre-rendered Slide Snapshots -->
  <div id="tn-deck-slides-store" hidden>
${slidesDataHtml}
  </div>

  <!-- Lossless Round-Trip State for TN Slides Studio -->
  <script type="application/json" id="tn-presentation-data">
${safeJson}
  </script>

  <script>
${playerJs}
  </script>
</body>
</html>`;
}

function generateUpdatedHtmlFile() {
  return generatePortableDeckHtml();
}

async function saveToFileSystem() {
  const htmlContent = generatePortableDeckHtml();
  const defaultName = getDeckSlugFilename();

  if ('showSaveFilePicker' in window) {
    try {
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'TN Slides Smart-Deck HTML',
            accept: { 'text/html': ['.html', '.htm'] }
          }]
        });
      }

      const writable = await fileHandle.createWritable();
      await writable.write(htmlContent);
      await writable.close();

      markClean();
      recordSnapshot('Saved Deck', `Saved Smart-Deck HTML (${defaultName})`);
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('File System Access API prompt cancelled or unavailable:', err);
      } else {
        return;
      }
    }
  }

  downloadFileFallback(htmlContent, defaultName);
  markClean();
  recordSnapshot('Saved Deck', `Downloaded Smart-Deck HTML (${defaultName})`);
}

async function openExistingPresentationFile() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'TN Slides Smart-Deck HTML',
          accept: { 'text/html': ['.html', '.htm'] }
        }]
      });
      fileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();
      loadPresentationFromHtmlString(text);
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('File open error:', err);
      } else {
        return;
      }
    }
  }

  document.getElementById('local-html-file-picker').click();
}

function loadPresentationFromHtmlString(htmlString) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const scriptEl = doc.querySelector('#tn-presentation-data');
    if (scriptEl && scriptEl.textContent) {
      appData = JSON.parse(scriptEl.textContent);
      currentSlideIndex = 0;
      init();
      markClean();
      const filePopover = document.getElementById('popover-file-menu');
      if (filePopover && filePopover.hidePopover) {
        try { filePopover.hidePopover(); } catch (_) {}
      }
    } else {
      alert('Could not locate #tn-presentation-data in the selected HTML file.');
    }
  } catch (e) {
    alert('Error parsing presentation file: ' + e.message);
  }
}

function downloadFileFallback(content, filename) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- PRESENTATION PROJECT FOLDER & ASSET BUNDLER (File System Access & JSZip) ---
const PROJECT_FONT_FILES = [
  'PermianSlabSerifTypeface-Bold.otf',
  'PermianSlabSerifTypeface.otf',
  'PermianSlabSerifTypeface-Italic.otf',
  'OpenSans-Regular.ttf',
  'OpenSans-Bold.ttf',
  'OpenSans-Semibold.ttf',
  'OpenSans-Italic.ttf'
];

const PROJECT_JS_FILES = [
  'brand_assets.js',
  'tn_map_data.js',
  'app_state.js',
  'slide_renderer.js',
  'presentation_mode.js',
  'accessibility_audit.js',
  'export_engine.js',
  'importers.js',
  'app.js'
];

function getMimeExtension(mime) {
  if (!mime) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'png';
}

function base64ToBlob(base64Data, contentType) {
  contentType = contentType || '';
  const sliceSize = 1024;
  const byteCharacters = atob(base64Data);
  const bytesLength = byteCharacters.length;
  const slicesCount = Math.ceil(bytesLength / sliceSize);
  const byteArrays = new Array(slicesCount);

  for (let sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
    const begin = sliceIndex * sliceSize;
    const end = Math.min(begin + sliceSize, bytesLength);
    const bytes = new Array(end - begin);
    for (let offset = begin, i = 0; offset < end; ++i, ++offset) {
      bytes[i] = byteCharacters.charCodeAt(offset);
    }
    byteArrays[sliceIndex] = new Uint8Array(bytes);
  }
  return new Blob(byteArrays, { type: contentType });
}

function extractPresentationMediaAssets() {
  const clonedAppData = JSON.parse(JSON.stringify(appData));
  const assetFiles = [];
  let totalBase64Bytes = 0;

  clonedAppData.slides.forEach((slide, idx) => {
    if (slide.mediaUrl && slide.mediaUrl.startsWith('data:image/')) {
      const match = slide.mediaUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const b64 = match[2];
        const ext = getMimeExtension(mime);
        const safeTitle = (slide.title || 'media').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 20);
        const filename = `slide-${idx + 1}-${safeTitle || 'image'}.${ext}`;
        const blob = base64ToBlob(b64, mime);
        totalBase64Bytes += b64.length;

        assetFiles.push({
          filename: filename,
          relativePath: `assets/${filename}`,
          blob: blob,
          mime: mime,
          slideIndex: idx
        });

        slide.mediaUrl = `assets/${filename}`;
      }
    }
  });

  return {
    bundledAppData: clonedAppData,
    assetFiles: assetFiles,
    totalBase64Bytes: totalBase64Bytes
  };
}

async function fetchProjectFonts() {
  const fontMap = {};
  for (const fontName of PROJECT_FONT_FILES) {
    try {
      let res = await fetch(fontName);
      if (!res.ok) {
        res = await fetch(`fonts/${fontName}`);
      }
      if (res.ok) {
        fontMap[fontName] = await res.blob();
      }
    } catch (e) {
      console.warn(`Could not preload font ${fontName}:`, e);
    }
  }
  return fontMap;
}

function generateProjectReadme(deckTitle, slideCount) {
  return `================================================================================
STATE OF TENNESSEE - TN SLIDES PROJECT PACKAGE
================================================================================
Generated: ${new Date().toLocaleString()}
Presentation Title: ${deckTitle || 'Executive Briefing Presentation'}
Slide Count: ${slideCount} Slide(s)
Brand Standard: State of Tennessee Official Brand Guidelines & WCAG 2.1 AA

PACKAGE CONTENTS:
--------------------------------------------------------------------------------
1. index.html:
   The complete self-contained presentation and editing studio.
   Double-click to open in Google Chrome, Microsoft Edge, Safari, or Brave.
   Includes:
   - 16:9 full-screen presentation mode (press 'F')
   - Dual-screen pop-out Presenter Console with target end-time countdown ('O')
   - NVDA / JAWS speech synthesis reader ('Listen as Screen Reader')
   - WCAG 2.1 AA compliance auditor & printable certification
   - Accessible spreadsheet and CSV chart ingestion engine
   - Self-editing disk saving engine

2. assets/
   All slide photographs, charts, and media extracted as standalone files.
   This avoids large base64 data blobs and ensures rapid load times.

3. Typography / Fonts (Permian Slab & Open Sans):
   Official State of Tennessee typography from Font Squirrel:
   - Permian Slab (Executive Headings)
   - Open Sans (Clean Body & Tabular Data)
   Provides 100% offline typography without external internet dependencies.

4. JavaScript Application Modules:
   - brand_assets.js: Official State of Tennessee seals, wordmarks, and lockups
   - tn_map_data.js: 95-County vector map boundaries and regional clusters
   - app_state.js: Core state management, aspect ratios, and template catalog
   - slide_renderer.js: Slide rendering engine and form synchronization
   - presentation_mode.js: Fullscreen presentation HUD and Presenter Console
   - accessibility_audit.js: WCAG 2.1 AA auditor and speech simulator
   - export_engine.js: PowerPoint, PDF, offline zip, and disk saver
   - importers.js: Outline, spreadsheet chart, and PowerPoint ingestion
   - app.js: Keyboard shortcuts, interaction controller, and initialization

HOW TO EDIT AND SAVE:
--------------------------------------------------------------------------------
1. Open index.html in Google Chrome or Microsoft Edge.
2. Edit your slides, copy, or themes.
3. Click "Save to File" or "Save Folder" to save updates directly back to disk!
================================================================================
`;
}

function generateBundledHtmlFile(bundledAppData) {
  const docClone = document.documentElement.cloneNode(true);

  const payloadScript = docClone.querySelector('#tn-presentation-data');
  if (payloadScript) {
    payloadScript.textContent = '\n' + JSON.stringify(bundledAppData, null, 2) + '\n  ';
  }

  const fullMode = docClone.querySelector('#fullscreen-presentation-overlay');
  if (fullMode) fullMode.classList.remove('active');

  const videoTheaterEl = docClone.querySelector('#fullscreen-video-theater');
  if (videoTheaterEl) videoTheaterEl.classList.remove('active');
  const videoMountEl = docClone.querySelector('#video-theater-player-mount');
  if (videoMountEl) videoMountEl.innerHTML = '';

  const modals = docClone.querySelectorAll('.modal-overlay');
  modals.forEach(m => m.classList.remove('active'));

  // Ensure exported header save button reflects clean persisted state
  const saveBtn = docClone.querySelector('#btn-header-save');
  if (saveBtn) {
    saveBtn.classList.remove('dirty');
    saveBtn.innerHTML = `<svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg><span>Saved</span>`;
  }

  return '<!DOCTYPE html>\n' + docClone.outerHTML;
}

async function saveToProjectFolder() {
  if (!('showDirectoryPicker' in window)) {
    if (confirm('The modern Directory Picker API is not supported in this browser. Would you like to download the complete presentation package as an offline .ZIP archive instead?')) {
      await exportToZipBundle();
    }
    return;
  }

  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    if (!dirHandle) return;

    // 1. Extract media assets
    const { bundledAppData, assetFiles, totalBase64Bytes } = extractPresentationMediaAssets();

    // 2. Create assets/ directory and write media files
    const assetsHandle = await dirHandle.getDirectoryHandle('assets', { create: true });
    for (const asset of assetFiles) {
      const fileH = await assetsHandle.getFileHandle(asset.filename, { create: true });
      const writable = await fileH.createWritable();
      await writable.write(asset.blob);
      await writable.close();
    }

    // 3. Write font files to project root
    const fontsMap = await fetchProjectFonts();
    for (const [fontName, fontBlob] of Object.entries(fontsMap)) {
      const fontH = await dirHandle.getFileHandle(fontName, { create: true });
      const writable = await fontH.createWritable();
      await writable.write(fontBlob);
      await writable.close();
    }

    // 4. Write all project JS application files
    for (const jsFile of PROJECT_JS_FILES) {
      try {
        const fileH = await dirHandle.getFileHandle(jsFile, { create: true });
        const writable = await fileH.createWritable();
        const res = await fetch(jsFile);
        if (res.ok) {
          const text = await res.text();
          await writable.write(text);
        }
        await writable.close();
      } catch (e) {
        console.warn(`Could not bundle ${jsFile}:`, e);
      }
    }

    // 5. Write README.txt
    const readmeH = await dirHandle.getFileHandle('README.txt', { create: true });
    const readmeWritable = await readmeH.createWritable();
    await readmeWritable.write(generateProjectReadme(bundledAppData.slides[0]?.title, bundledAppData.slides.length));
    await readmeWritable.close();

    // 6. Generate and write index.html
    const htmlContent = generateBundledHtmlFile(bundledAppData);
    const indexH = await dirHandle.getFileHandle('index.html', { create: true });
    const indexWritable = await indexH.createWritable();
    await indexWritable.write(htmlContent);
    await indexWritable.close();

    // 7. Update in-memory appData with clean relative paths
    appData = bundledAppData;
    markClean();
    recordSnapshot('Saved to File', `Saved to project folder: ${dirHandle.name}`);
    saveStatusText.textContent = `Folder: ${dirHandle.name}`;
    renderFilmstrip();
    loadSlideIntoForm(currentSlideIndex);
    renderCurrentSlide();
    updateMediaAssetStats();

    const toast = document.createElement('div');
    toast.className = 'save-toast';
    const savedMb = (totalBase64Bytes / (1024 * 1024)).toFixed(1);
    toast.textContent = `✓ Project folder "${dirHandle.name}" saved! ${assetFiles.length} asset(s) extracted (${savedMb} MB base64 removed).`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);

    document.getElementById('modal-export-menu').classList.remove('active');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Project folder save error:', err);
      alert('Could not save project folder: ' + err.message);
    }
  }
}

async function exportToZipBundle() {
  if (typeof JSZip === 'undefined') {
    alert('JSZip library is initializing. Please verify network connectivity.');
    return;
  }

  try {
    const zip = new JSZip();

    // 1. Extract media assets
    const { bundledAppData, assetFiles, totalBase64Bytes } = extractPresentationMediaAssets();

    // 2. assets/ folder
    const assetsFolder = zip.folder('assets');
    for (const asset of assetFiles) {
      assetsFolder.file(asset.filename, asset.blob);
    }

    // 3. Typography font files (root)
    const fontsMap = await fetchProjectFonts();
    for (const [fontName, fontBlob] of Object.entries(fontsMap)) {
      zip.file(fontName, fontBlob);
    }

    // 4. Write all project JS application files
    for (const jsFile of PROJECT_JS_FILES) {
      try {
        const res = await fetch(jsFile);
        if (res.ok) {
          const text = await res.text();
          zip.file(jsFile, text);
        }
      } catch (e) {
        console.warn(`Could not zip ${jsFile}:`, e);
      }
    }

    // 5. README.txt
    zip.file('README.txt', generateProjectReadme(bundledAppData.slides[0]?.title, bundledAppData.slides.length));

    // 6. index.html
    const htmlContent = generateBundledHtmlFile(bundledAppData);
    zip.file('index.html', htmlContent);

    // 7. Generate zip blob
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    // Download zip
    const zipFilename = `tennessee-presentation-deck-${Date.now()}.zip`;
    downloadBlobFallback(zipBlob, zipFilename);

    const toast = document.createElement('div');
    toast.className = 'save-toast';
    toast.textContent = `✓ Generated offline package: ${zipFilename} with ${assetFiles.length} asset(s)!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);

    document.getElementById('modal-export-menu').classList.remove('active');
  } catch (err) {
    console.error('ZIP bundle error:', err);
    alert('Could not generate ZIP bundle: ' + err.message);
  }
}

function downloadBlobFallback(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function updateMediaAssetStats() {
  const badge = document.getElementById('asset-stats-badge');
  const desc = document.getElementById('asset-stats-desc');
  if (!badge || !desc) return;

  let totalImages = 0;
  let base64Images = 0;
  let relativeImages = 0;
  let totalB64Chars = 0;

  appData.slides.forEach(s => {
    if (s.mediaUrl) {
      totalImages++;
      if (s.mediaUrl.startsWith('data:image/')) {
        base64Images++;
        totalB64Chars += s.mediaUrl.length;
      } else {
        relativeImages++;
      }
    }
  });

  badge.textContent = `${totalImages} Asset${totalImages === 1 ? '' : 's'}`;
  if (base64Images > 0) {
    const mb = (totalB64Chars / (1024 * 1024)).toFixed(1);
    desc.innerHTML = `<strong>${base64Images} inline image(s)</strong> detected (~${mb} MB base64). Bundle into a project folder to reduce file size and enable offline sharing.`;
    badge.style.background = 'var(--tn-state-red)';
    badge.style.color = '#fff';
  } else if (relativeImages > 0) {
    desc.innerHTML = `<strong>${relativeImages} clean asset(s)</strong> linked via <code>assets/</code>. Zero base64 bloat!`;
    badge.style.background = 'var(--tn-navy)';
    badge.style.color = '#fff';
  } else {
    desc.textContent = 'Extract uploaded images into an assets/ subfolder to avoid large base64 file sizes.';
    badge.style.background = 'var(--tn-slate-200)';
    badge.style.color = 'var(--tn-slate-700)';
  }
}



// --- 11. EXPORT ENGINES: PPTX, PDF, OUTLINE ---
async function exportToPptx() {
  if (typeof PptxGenJS === 'undefined') {
    alert('PowerPoint generator library is initializing. Please check your network connection.');
    return;
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'State of Tennessee';
  pptx.company = 'State of Tennessee';
  pptx.title = appData.slides[0]?.title || 'Tennessee Presentation';

  const TN_BANNER_BLUE = '002D72';
  const TN_STATE_RED = 'E71B1B';
  const TN_WHITE = 'FFFFFF';
  const TN_DARK = '1F1F1F';
  const TN_SLATE = '514F50';

  appData.slides.forEach((slide) => {
    const pptSlide = pptx.addSlide();
    pptSlide.bkgd = TN_WHITE;

    function finalizeSlide(s) {
      if (s.citation && s.citation.trim()) {
        pptSlide.addText(`⚖ Statutory Authority: ${s.citation.trim()}`, {
          x: 0.8, y: 5.2, w: 7.0, h: 0.3,
          fontSize: 8.0, color: TN_SLATE, italic: true
        });
      }
      if (s.notes) {
        pptSlide.addNotes(s.notes);
      }
    }

    // Fallback if layout was bootstrap5
    if (slide.layout === 'layout-bootstrap5') {
      slide.layout = 'layout-split';
    }

    // Check if Blue Banner Cover layout
    if (slide.layout === 'layout-cover-blue-banner') {
      // Lower Blue Banner shape
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: 0, y: 2.8, w: 10, h: 2.8,
        fill: { color: TN_BANNER_BLUE },
        line: { color: TN_BANNER_BLUE }
      });

      // Top Department Logo
      if (typeof TN_BRAND_ASSETS !== 'undefined' && TN_BRAND_ASSETS.deptLaborLogo) {
        pptSlide.addImage({
          data: TN_BRAND_ASSETS.deptLaborLogo,
          x: 0.8, y: 0.8, w: 3.5, h: 1.2
        });
      }

      // Title & Subtitle in White inside banner
      pptSlide.addText(slide.title || 'Presentation Title', {
        x: 0.8, y: 3.0, w: 8.4, h: 1.0,
        fontSize: 26, bold: true, color: TN_WHITE
      });
      const lines = (slide.body || '').split('\n').filter(b => b.trim().length > 0);
      if (lines[0]) {
        pptSlide.addText(lines[0], {
          x: 0.8, y: 4.1, w: 8.4, h: 0.5,
          fontSize: 14, color: TN_WHITE
        });
      }
      pptSlide.addText(`${slide.authorName || 'Name, Position'} | ${slide.authorDate || 'Date'}`, {
        x: 0.8, y: 4.8, w: 8.4, h: 0.4,
        fontSize: 10, color: 'CCCCCC'
      });
      return;
    }

    // Check if Thank You layout
    if (slide.layout === 'layout-thank-you') {
      pptSlide.addText(slide.title || 'THANK YOU', {
        x: 1.0, y: 1.8, w: 8.0, h: 1.2,
        fontSize: 40, bold: true, color: TN_DARK, align: 'center'
      });
      // Red accent rule
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: 4.5, y: 3.1, w: 1.0, h: 0.05,
        fill: { color: TN_STATE_RED }
      });
      const lines = (slide.body || '').split('\n').filter(b => b.trim().length > 0);
      pptSlide.addText(lines.join('\n'), {
        x: 1.0, y: 3.3, w: 8.0, h: 1.2,
        fontSize: 14, color: TN_SLATE, align: 'center'
      });
      if (typeof TN_BRAND_ASSETS !== 'undefined' && TN_BRAND_ASSETS.tnSquareLogo) {
        pptSlide.addImage({
          data: TN_BRAND_ASSETS.tnSquareLogo,
          x: 8.8, y: 0.4, w: 0.7, h: 0.7
        });
      }
      return;
    }

    // Check if Section Break layout (Full Bleed Dark Navy)
    if (slide.layout === 'layout-section-break') {
      pptSlide.bkgd = TN_NAVY;
      const kickerText = slide.kicker || 'SECTION DIVIDER';
      const numMatch = kickerText.match(/\b(?:SECTION|PART|MODULE)?\s*0?(\d{1,2})\b/i);
      const watermarkNum = numMatch ? String(numMatch[1]).padStart(2, '0') : '01';

      // Huge subtle watermark numeral
      pptSlide.addText(watermarkNum, {
        x: 6.5, y: 1.5, w: 3.5, h: 4.0,
        fontSize: 160, bold: true, color: '0A3680', fontFace: 'Georgia', align: 'right'
      });

      // Kicker
      pptSlide.addText(kickerText.toUpperCase(), {
        x: 0.8, y: 1.8, w: 8.0, h: 0.4,
        fontSize: 11, bold: true, color: 'FFCC00', fontFace: 'Arial'
      });

      // Title
      pptSlide.addText(slide.title, {
        x: 0.8, y: 2.2, w: 7.5, h: 1.5,
        fontSize: 30, bold: true, color: TN_WHITE, fontFace: 'Georgia'
      });

      // Red accent rule
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.8, y: 3.8, w: 1.2, h: 0.06,
        fill: { color: TN_STATE_RED },
        line: { color: TN_STATE_RED }
      });

      // Subtitle
      const lines = (slide.body || '').split('\n').filter(b => b.trim().length > 0);
      if (lines[0]) {
        pptSlide.addText(lines[0], {
          x: 0.8, y: 4.05, w: 7.0, h: 0.8,
          fontSize: 13, color: 'E2E8F0', fontFace: 'Arial'
        });
      }

      finalizeSlide(slide);
      return;
    }

    // Standard Content Slides with Corner TN Logo
    if (typeof TN_BRAND_ASSETS !== 'undefined' && TN_BRAND_ASSETS.tnSquareLogo) {
      pptSlide.addImage({
        data: TN_BRAND_ASSETS.tnSquareLogo,
        x: 8.8, y: 0.4, w: 0.65, h: 0.65
      });
    }

    // Slide Title
    if (slide.kicker) {
      pptSlide.addText(slide.kicker.toUpperCase(), {
        x: 0.8, y: 0.5, w: 7.5, h: 0.3,
        fontSize: 10, bold: true, color: TN_STATE_RED
      });
    }

    pptSlide.addText(slide.title || 'Untitled Slide', {
      x: 0.8, y: 0.8, w: 7.5, h: 0.8,
      fontSize: 22, bold: true, color: TN_DARK
    });

    // Red accent rule below title
    pptSlide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.8, y: 1.55, w: 0.7, h: 0.04,
      fill: { color: TN_STATE_RED }
    });

    // Check if Tennessee Interactive Map Layout
    if (slide.layout === 'layout-tn-map' || slide.mapData) {
      const mapData = slide.mapData || TN_MAP_PRESETS['fy26-jobs'];
      const prefix = mapData.prefix || '';
      const unit = mapData.unit || '';
      const divWest = mapData.divisions ? mapData.divisions.west : TN_MAP_PRESETS['fy26-jobs'].divisions.west;
      const divMid = mapData.divisions ? mapData.divisions.middle : TN_MAP_PRESETS['fy26-jobs'].divisions.middle;
      const divEast = mapData.divisions ? mapData.divisions.east : TN_MAP_PRESETS['fy26-jobs'].divisions.east;

      // Render 3 Grand Division Cards in PowerPoint
      const divisionsList = [
        { name: 'WEST TENNESSEE', count: '21 Counties', val: divWest.value, sub: divWest.secondary, color: TN_BANNER_BLUE, x: 0.8 },
        { name: 'MIDDLE TENNESSEE', count: '41 Counties', val: divMid.value, sub: divMid.secondary, color: TN_DARK, x: 3.7 },
        { name: 'EAST TENNESSEE', count: '33 Counties', val: divEast.value, sub: divEast.secondary, color: TN_STATE_RED, x: 6.6 }
      ];

      divisionsList.forEach(d => {
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: d.x, y: 1.8, w: 2.7, h: 2.0,
          fill: { color: 'F8FAFC' },
          line: { color: d.color, width: 2 }
        });
        pptSlide.addText(d.name, {
          x: d.x + 0.1, y: 1.9, w: 2.5, h: 0.3,
          fontSize: 10, bold: true, color: d.color, align: 'center'
        });
        pptSlide.addText(`${prefix}${d.val}${unit}`, {
          x: d.x + 0.1, y: 2.2, w: 2.5, h: 0.8,
          fontSize: 26, bold: true, color: d.color, align: 'center'
        });
        pptSlide.addText(`${d.count} • ${d.sub || ''}`, {
          x: d.x + 0.1, y: 3.1, w: 2.5, h: 0.5,
          fontSize: 9, bold: true, color: TN_SLATE, align: 'center'
        });
      });

      // Native Paired PowerPoint Data Table
      const headers = [
        { text: 'Grand Division', options: { bold: true, fill: TN_BANNER_BLUE, color: TN_WHITE, fontSize: 10 } },
        { text: 'Counties', options: { bold: true, fill: TN_BANNER_BLUE, color: TN_WHITE, fontSize: 10 } },
        { text: 'Key Metro Hubs', options: { bold: true, fill: TN_BANNER_BLUE, color: TN_WHITE, fontSize: 10 } },
        { text: 'Metric Value', options: { bold: true, fill: TN_BANNER_BLUE, color: TN_WHITE, fontSize: 10, align: 'right' } }
      ];
      const tableRows = [
        headers,
        [
          { text: 'West Tennessee', options: { fontSize: 9.5, bold: true, color: TN_DARK, fill: TN_WHITE } },
          { text: `${divWest.countiesCount || 21} Counties`, options: { fontSize: 9.5, color: TN_SLATE, fill: TN_WHITE } },
          { text: (divWest.metros || []).join(', '), options: { fontSize: 9.5, color: TN_SLATE, fill: TN_WHITE } },
          { text: `${prefix}${divWest.value}${unit}`, options: { fontSize: 9.5, bold: true, align: 'right', color: TN_DARK, fill: TN_WHITE } }
        ],
        [
          { text: 'Middle Tennessee', options: { fontSize: 9.5, bold: true, color: TN_DARK, fill: 'F1F5F9' } },
          { text: `${divMid.countiesCount || 41} Counties`, options: { fontSize: 9.5, color: TN_SLATE, fill: 'F1F5F9' } },
          { text: (divMid.metros || []).join(', '), options: { fontSize: 9.5, color: TN_SLATE, fill: 'F1F5F9' } },
          { text: `${prefix}${divMid.value}${unit}`, options: { fontSize: 9.5, bold: true, align: 'right', color: TN_DARK, fill: 'F1F5F9' } }
        ],
        [
          { text: 'East Tennessee', options: { fontSize: 9.5, bold: true, color: TN_DARK, fill: TN_WHITE } },
          { text: `${divEast.countiesCount || 33} Counties`, options: { fontSize: 9.5, color: TN_SLATE, fill: TN_WHITE } },
          { text: (divEast.metros || []).join(', '), options: { fontSize: 9.5, color: TN_SLATE, fill: TN_WHITE } },
          { text: `${prefix}${divEast.value}${unit}`, options: { fontSize: 9.5, bold: true, align: 'right', color: TN_DARK, fill: TN_WHITE } }
        ]
      ];

      pptSlide.addTable(tableRows, {
        x: 0.8, y: 4.1, w: 8.5,
        colW: [2.2, 1.4, 3.2, 1.7],
        border: { pt: 0.5, color: 'CBD5E1' }
      });

      pptSlide.addText(mapData.caption || slide.title || 'State of Tennessee Grand Division Distribution', {
        x: 0.8, y: 5.85, w: 8.5, h: 0.35,
        fontSize: 8.5, italic: true, color: TN_SLATE
      });

      finalizeSlide(slide);
      return;
    }

    // Check if Strategic Pillars Layout (3 or 4 Columns)
    if (slide.layout === 'layout-pillars-3' || slide.layout === 'layout-pillars-4') {
      const pillarCount = slide.layout === 'layout-pillars-4' ? 4 : 3;
      const pillars = parsePillarsContent(slide.body, pillarCount);
      const totalW = 8.5;
      const gap = pillarCount === 4 ? 0.2 : 0.25;
      const cardW = (totalW - (gap * (pillarCount - 1))) / pillarCount;
      const topColors = [TN_BANNER_BLUE, TN_STATE_RED, TN_BANNER_BLUE, 'CC9900'];

      pillars.forEach((p, idx) => {
        const xPos = 0.8 + idx * (cardW + gap);
        const accentColor = topColors[idx % topColors.length];
        const numStr = String(idx + 1).padStart(2, '0');

        // Card Background Shape
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: 1.8, w: cardW, h: 4.2,
          fill: { color: 'FFFFFF' },
          line: { color: 'CBD5E1', width: 1 }
        });

        // Top Accent Strip
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: 1.8, w: cardW, h: 0.08,
          fill: { color: accentColor }
        });

        // Pillar Badge
        pptSlide.addText(`PILLAR ${numStr}`, {
          x: xPos + 0.15, y: 2.0, w: cardW - 0.3, h: 0.28,
          fontSize: 9, bold: true, color: TN_SLATE
        });

        // Pillar Title
        pptSlide.addText(p.title, {
          x: xPos + 0.15, y: 2.32, w: cardW - 0.3, h: 0.75,
          fontSize: pillarCount === 4 ? 12 : 14, bold: true, color: TN_DARK, fontFace: 'Georgia'
        });

        // Pillar Description
        const descClean = p.desc.replace(/•/g, '\n• ');
        pptSlide.addText(descClean, {
          x: xPos + 0.15, y: 3.12, w: cardW - 0.3, h: 2.75,
          fontSize: pillarCount === 4 ? 9.5 : 10.5, color: TN_SLATE, lineSpacing: 14
        });
      });

      finalizeSlide(slide);
      return;
    }

    // Check if Step-by-Step SOP & Process Workflow Layout
    if (slide.layout === 'layout-process-flow') {
      const steps = parseProcessFlowContent(slide.body);
      const totalW = 8.5;
      const count = steps.length;
      const arrowW = 0.25;
      const totalArrowsW = (count - 1) * arrowW;
      const cardW = (totalW - totalArrowsW) / count;
      const topColors = [TN_BANNER_BLUE, '1B4D72', '0284C7', 'D4A017', TN_STATE_RED];

      steps.forEach((st, idx) => {
        const isLast = idx === count - 1;
        const xPos = 0.8 + idx * (cardW + arrowW);
        const accentColor = isLast ? TN_STATE_RED : topColors[idx % topColors.length];
        const numStr = String(idx + 1).padStart(2, '0');

        // Card Background Shape
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: 1.8, w: cardW, h: 4.2,
          fill: { color: isLast ? 'FFFDFD' : 'FFFFFF' },
          line: { color: isLast ? TN_STATE_RED : 'CBD5E1', width: isLast ? 1.5 : 1 }
        });

        // Top Accent Strip
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: 1.8, w: cardW, h: 0.08,
          fill: { color: accentColor }
        });

        // Step Badge
        pptSlide.addText(isLast ? 'FINAL STEP' : `STEP ${numStr}`, {
          x: xPos + 0.12, y: 2.0, w: cardW - 0.24, h: 0.28,
          fontSize: 8.5, bold: true, color: isLast ? TN_STATE_RED : TN_SLATE
        });

        // Step Title
        pptSlide.addText(st.title, {
          x: xPos + 0.12, y: 2.32, w: cardW - 0.24, h: 0.75,
          fontSize: count >= 4 ? 11.5 : 13, bold: true, color: TN_DARK, fontFace: 'Georgia'
        });

        // Step Description
        const descClean = st.desc.replace(/•/g, '\n• ');
        pptSlide.addText(descClean, {
          x: xPos + 0.12, y: 3.12, w: cardW - 0.24, h: 2.75,
          fontSize: count >= 4 ? 9.0 : 10.0, color: TN_SLATE, lineSpacing: 13
        });

        // Directional Chevron Arrow between cards
        if (!isLast) {
          const arrowX = xPos + cardW + 0.04;
          pptSlide.addShape(pptx.shapes.RIGHT_ARROW, {
            x: arrowX, y: 3.5, w: 0.17, h: 0.24,
            fill: { color: '94A3B8' },
            line: { color: '94A3B8' }
          });
        }
      });

      finalizeSlide(slide);
      return;
    }

    // Check if Horizontal Milestone Timeline Layout
    if (slide.layout === 'layout-timeline') {
      const milestones = parseTimelineContent(slide.body);
      const count = milestones.length;
      const totalW = 8.5;
      const cardGap = 0.22;
      const cardW = (totalW - (count - 1) * cardGap) / count;
      const topColors = [TN_BANNER_BLUE, '1B4D72', '0284C7', 'D4A017', TN_STATE_RED];

      // Horizontal Connecting Track Line Shape across all milestones
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.8 + cardW * 0.5, y: 1.88, w: totalW - cardW, h: 0.05,
        fill: { color: TN_BANNER_BLUE },
        line: { color: TN_BANNER_BLUE }
      });

      milestones.forEach((m, idx) => {
        const isLast = idx === count - 1;
        const xPos = 0.8 + idx * (cardW + cardGap);
        const accentColor = isLast ? TN_STATE_RED : topColors[idx % topColors.length];

        // Circular Node Marker on track
        pptSlide.addShape(pptx.shapes.OVAL, {
          x: xPos + (cardW - 0.3) / 2, y: 1.75, w: 0.3, h: 0.3,
          fill: { color: 'FFFFFF' },
          line: { color: accentColor, width: 2.5 }
        });

        // Inner Dot
        pptSlide.addShape(pptx.shapes.OVAL, {
          x: xPos + (cardW - 0.12) / 2, y: 1.84, w: 0.12, h: 0.12,
          fill: { color: accentColor },
          line: { color: accentColor }
        });

        // Date Pill Shape & Text
        pptSlide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: xPos + 0.1, y: 2.15, w: cardW - 0.2, h: 0.32,
          fill: { color: isLast ? 'FFF1F2' : 'F1F5F9' },
          line: { color: isLast ? TN_STATE_RED : 'CBD5E1', width: 0.75 },
          rectRadius: 0.15
        });
        pptSlide.addText(m.date.toUpperCase(), {
          x: xPos + 0.1, y: 2.17, w: cardW - 0.2, h: 0.28,
          fontSize: 8.5, bold: true, color: accentColor, align: 'center'
        });

        // Card Background Shape
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: 2.55, w: cardW, h: 3.5,
          fill: { color: isLast ? 'FFFDFD' : 'FFFFFF' },
          line: { color: isLast ? TN_STATE_RED : 'CBD5E1', width: isLast ? 1.5 : 1 }
        });

        // Top Accent Strip on Card
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: 2.55, w: cardW, h: 0.08,
          fill: { color: accentColor }
        });

        // Milestone Title
        pptSlide.addText(m.title, {
          x: xPos + 0.12, y: 2.7, w: cardW - 0.24, h: 0.7,
          fontSize: count >= 4 ? 11.5 : 13, bold: true, color: TN_DARK, fontFace: 'Georgia'
        });

        // Milestone Description
        const descClean = m.desc.replace(/•/g, '\n• ');
        pptSlide.addText(descClean, {
          x: xPos + 0.12, y: 3.45, w: cardW - 0.24, h: 2.45,
          fontSize: count >= 4 ? 9.0 : 10.0, color: TN_SLATE, lineSpacing: 13
        });
      });

      finalizeSlide(slide);
      return;
    }

    // Check if Side-by-Side Policy Comparison Layout
    if (slide.layout === 'layout-comparison') {
      const comp = parseComparisonContent(slide.body);
      const cardW = 4.0;
      const cardH = 4.2;
      const leftX = 0.8;
      const rightX = 5.2;

      // --- Left Card: Baseline / Current Status ---
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: leftX, y: 1.8, w: cardW, h: cardH,
        fill: { color: 'F8FAFC' },
        line: { color: 'CBD5E1', width: 1.2 }
      });
      // Left Top Accent Strip (Slate)
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: leftX, y: 1.8, w: cardW, h: 0.1,
        fill: { color: '64748B' }
      });
      // Left Badge
      pptSlide.addText(comp.left.badge.toUpperCase(), {
        x: leftX + 0.2, y: 2.05, w: cardW - 0.4, h: 0.28,
        fontSize: 8.5, bold: true, color: '64748B'
      });
      // Left Title
      pptSlide.addText(comp.left.title, {
        x: leftX + 0.2, y: 2.38, w: cardW - 0.4, h: 0.7,
        fontSize: 13, bold: true, color: TN_DARK, fontFace: 'Georgia'
      });
      // Left Bullets
      const leftBulletsText = comp.left.bullets.map(b => `• ${b}`).join('\n\n');
      pptSlide.addText(leftBulletsText, {
        x: leftX + 0.2, y: 3.15, w: cardW - 0.4, h: 2.7,
        fontSize: 9.5, color: TN_SLATE, lineSpacing: 13
      });

      // --- Central "VS" Circle Shape ---
      pptSlide.addShape(pptx.shapes.OVAL, {
        x: 4.75, y: 3.65, w: 0.5, h: 0.5,
        fill: { color: 'FFFFFF' },
        line: { color: '94A3B8', width: 1.5 }
      });
      pptSlide.addText('VS', {
        x: 4.75, y: 3.75, w: 0.5, h: 0.3,
        fontSize: 9, bold: true, color: '64748B', align: 'center'
      });

      // --- Right Card: Adopted Reform / Enacted Policy ---
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: rightX, y: 1.8, w: cardW, h: cardH,
        fill: { color: 'FFFDFD' },
        line: { color: TN_STATE_RED, width: 1.5 }
      });
      // Right Top Accent Strip (State Red)
      pptSlide.addShape(pptx.shapes.RECTANGLE, {
        x: rightX, y: 1.8, w: cardW, h: 0.1,
        fill: { color: TN_STATE_RED }
      });
      // Right Badge
      pptSlide.addText(comp.right.badge.toUpperCase(), {
        x: rightX + 0.2, y: 2.05, w: cardW - 0.4, h: 0.28,
        fontSize: 8.5, bold: true, color: TN_STATE_RED
      });
      // Right Title
      pptSlide.addText(comp.right.title, {
        x: rightX + 0.2, y: 2.38, w: cardW - 0.4, h: 0.7,
        fontSize: 13, bold: true, color: TN_DARK, fontFace: 'Georgia'
      });
      // Right Bullets (with checkmark / bullet)
      const rightBulletsText = comp.right.bullets.map(b => `✔ ${b}`).join('\n\n');
      pptSlide.addText(rightBulletsText, {
        x: rightX + 0.2, y: 3.15, w: cardW - 0.4, h: 2.7,
        fontSize: 9.5, color: TN_DARK, lineSpacing: 13, bold: false
      });

      finalizeSlide(slide);
      return;
    }

    // Check if Executive Agenda Layout
    if (slide.layout === 'layout-agenda') {
      const items = parseAgendaContent(slide.body);
      const count = Math.min(items.length, 6);
      const cols = 2;
      const rows = Math.ceil(count / cols);
      const colW = 4.1;
      const rowH = rows === 2 ? 1.7 : 1.25;

      items.slice(0, 6).forEach((it, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const xPos = 0.8 + c * (colW + 0.3);
        const yPos = 1.9 + r * (rowH + 0.2);

        // Agenda Card Background Shape
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: yPos, w: colW, h: rowH,
          fill: { color: 'FFFFFF' },
          line: { color: 'CBD5E1', width: 1 }
        });

        // Left Accent Strip
        pptSlide.addShape(pptx.shapes.RECTANGLE, {
          x: xPos, y: yPos, w: 0.08, h: rowH,
          fill: { color: TN_BANNER_BLUE }
        });

        // Number Circle
        pptSlide.addShape(pptx.shapes.OVAL, {
          x: xPos + 0.18, y: yPos + 0.18, w: 0.45, h: 0.45,
          fill: { color: 'F1F5F9' },
          line: { color: TN_BANNER_BLUE, width: 1.5 }
        });
        pptSlide.addText(it.num, {
          x: xPos + 0.18, y: yPos + 0.22, w: 0.45, h: 0.35,
          fontSize: 10, bold: true, color: TN_BANNER_BLUE, align: 'center'
        });

        // Title
        pptSlide.addText(it.title, {
          x: xPos + 0.72, y: yPos + 0.16, w: colW - 0.85, h: 0.45,
          fontSize: 11.5, bold: true, color: TN_DARK, fontFace: 'Georgia'
        });

        // Description
        if (it.desc) {
          pptSlide.addText(it.desc, {
            x: xPos + 0.72, y: yPos + 0.58, w: colW - 0.85, h: rowH - 0.65,
            fontSize: 9.0, color: TN_SLATE, lineSpacing: 12
          });
        }
      });

      finalizeSlide(slide);
      return;
    }

    // Check if Data / Chart Layout
    if ((slide.chartData && slide.chartData.length > 0) || slide.layout === 'layout-chart-bar' || slide.layout === 'layout-chart-kpi' || slide.layout === 'layout-data-table') {
      const chartData = slide.chartData || [];
      const unit = slide.chartUnit || '';
      const caption = slide.chartCaption || slide.title || 'State of Tennessee Performance Indicators';

      if (slide.layout === 'layout-chart-kpi') {
        const count = Math.min(chartData.length, 4);
        const cardW = 8.4 / Math.max(count, 1);
        chartData.slice(0, 4).forEach((item, idx) => {
          const xPos = 0.8 + idx * cardW;
          pptSlide.addShape(pptx.shapes.RECTANGLE, {
            x: xPos, y: 2.2, w: cardW - 0.25, h: 2.8,
            fill: { color: 'F8FAFC' },
            line: { color: idx === 0 ? TN_STATE_RED : TN_BANNER_BLUE, width: 2 }
          });
          pptSlide.addText(`${item.value}${unit}`, {
            x: xPos + 0.1, y: 2.5, w: cardW - 0.45, h: 1.1,
            fontSize: 28, bold: true, color: idx === 0 ? TN_STATE_RED : TN_BANNER_BLUE, align: 'center'
          });
          pptSlide.addText(item.label, {
            x: xPos + 0.1, y: 3.7, w: cardW - 0.45, h: 0.9,
            fontSize: 11, bold: true, color: TN_SLATE, align: 'center'
          });
        });
      } else {
        const headers = [
          { text: slide.chartLabelHeader || 'Category', options: { bold: true, fill: TN_BANNER_BLUE, color: TN_WHITE, fontSize: 11 } },
          { text: slide.chartValueHeader || 'Metric Value', options: { bold: true, fill: TN_BANNER_BLUE, color: TN_WHITE, fontSize: 11, align: 'right' } }
        ];
        const tableRows = [headers];
        chartData.forEach((row, i) => {
          const rowFill = (i % 2 === 0) ? TN_WHITE : 'F1F5F9';
          tableRows.push([
            { text: String(row.label), options: { fill: rowFill, color: TN_DARK, fontSize: 10, bold: true } },
            { text: `${row.value}${unit}`, options: { fill: rowFill, color: TN_DARK, fontSize: 10, align: 'right' } }
          ]);
        });

        pptSlide.addTable(tableRows, {
          x: 0.8, y: 1.8, w: 8.4,
          colW: [5.2, 3.2],
          border: { pt: 0.5, color: 'CBD5E1' }
        });

        pptSlide.addText(caption, {
          x: 0.8, y: 1.8 + Math.min(tableRows.length * 0.38, 3.2) + 0.15, w: 8.4, h: 0.5,
          fontSize: 9, italic: true, color: TN_SLATE
        });
      }

      finalizeSlide(slide);
      return;
    }

    const bullets = (slide.body || '').split('\n').filter(b => b.trim().length > 0);
    if (bullets.length > 0) {
      const bulletItems = bullets.map(b => ({
        text: b,
        options: { bullet: true, color: TN_SLATE, fontSize: 13, spacing: 10 }
      }));

      pptSlide.addText(bulletItems, {
        x: 0.8, y: 1.8, w: slide.mediaUrl ? 4.5 : 8.5, h: 4.0,
        valign: 'top'
      });
    }

    if (slide.mediaUrl) {
      try {
        pptSlide.addImage({
          path: slide.mediaUrl,
          x: 5.6, y: 1.8, w: 3.8, h: 3.2,
          altText: slide.mediaAlt || 'Slide illustration',
          animation: appData.enableCardWiggle !== false ? { type: 'appear', delay: 0.2 } : undefined
        });
      } catch (err) {
        console.warn('PPTX Image fetch warning:', err);
      }
    }

    finalizeSlide(slide);
  });

  // Generate PPTX with native slide transitions matching web animations
  const rawBlob = await pptx.write('blob');
  if (typeof JSZip !== 'undefined') {
    try {
      const zip = await JSZip.loadAsync(rawBlob);
      for (let idx = 0; idx < appData.slides.length; idx++) {
        const slide = appData.slides[idx];
        const slideFile = `ppt/slides/slide${idx + 1}.xml`;
        const fileObj = zip.file(slideFile);
        if (fileObj) {
          let transitionXml = '';
          if (slide.animate !== false) {
            const anim = slide.animationType || 'push';
            if (anim === 'push') {
              transitionXml = '<p:transition spd="med"><p:push dir="b"/></p:transition>';
            } else if (anim === 'fade') {
              transitionXml = '<p:transition spd="med"><p:fade/></p:transition>';
            } else if (anim === 'wiggle') {
              transitionXml = '<p:transition spd="med"><p:push dir="b"/></p:transition>';
            } else if (anim === 'wipe') {
              transitionXml = '<p:transition spd="med"><p:wipe dir="r"/></p:transition>';
            }
          }

          if (transitionXml) {
            const content = await fileObj.async('string');
            if (!content.includes('<p:transition')) {
              const updated = content.replace('</p:sld>', `${transitionXml}</p:sld>`);
              zip.file(slideFile, updated);
            }
          }
        }
      }

      const enhancedBlob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

      const downloadUrl = URL.createObjectURL(enhancedBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'Tennessee-State-Presentation.pptx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      return;
    } catch (zipErr) {
      console.warn('PPTX transition injection fallback:', zipErr);
    }
  }

  // Direct fallback
  await pptx.writeFile({ fileName: 'Tennessee-State-Presentation.pptx' });
}

function exportAccessibleOutline() {
  let textDoc = `=====================================================\n`;
  textDoc += `STATE OF TENNESSEE ACCESSIBLE PRESENTATION OUTLINE\n`;
  textDoc += `Generated: ${new Date().toLocaleDateString()}\n`;
  textDoc += `=====================================================\n\n`;

  appData.slides.forEach((slide, idx) => {
    textDoc += `SLIDE ${idx + 1}: ${slide.title || 'Untitled'}\n`;
    if (slide.kicker) textDoc += `Category: ${slide.kicker}\n`;
    textDoc += `-----------------------------------------------------\n`;
    const lines = (slide.body || '').split('\n').filter(l => l.trim().length > 0);
    lines.forEach(l => textDoc += `• ${l}\n`);
    if (slide.chartData && slide.chartData.length > 0) {
      textDoc += `Data Table: ${slide.chartCaption || slide.title}\n`;
      textDoc += `  Headers: ${slide.chartLabelHeader || 'Category'} | ${slide.chartValueHeader || 'Value'}\n`;
      slide.chartData.forEach(row => {
        textDoc += `  • ${row.label}: ${row.value}${slide.chartUnit || ''}\n`;
      });
    }
    if (slide.mediaUrl) {
      textDoc += `[Image]: ${slide.isDecorative ? 'Decorative Graphic' : slide.mediaAlt}\n`;
      if (slide.mediaCaption) textDoc += `Source: ${slide.mediaCaption}\n`;
    }
    if (slide.notes) {
      textDoc += `\nSpeaker Notes: ${slide.notes}\n`;
    }
    textDoc += `\n\n`;
  });

  const blob = new Blob([textDoc], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Tennessee-Presentation-Outline.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function updateExportStatsBanner() {
  const statsEl = document.getElementById('export-deck-stats');
  if (!statsEl) return;
  let images = 0;
  let tables = 0;
  appData.slides.forEach(s => {
    if (s.mediaUrl) images++;
    if (s.chartData && s.chartData.length > 0) tables++;
  });
  statsEl.textContent = `${appData.slides.length} Slides • ${images} Visual Graphics • ${tables} Accessible Tables`;
}

// --- 1. ACCESSIBLE OUTLINE PDF (PREFERRED) ---
function exportOutlinePdf() {
  const title = appData.slides[0]?.title || 'TN Slides Presentation';
  const author = appData.slides[0]?.authorName || 'State Agency Representative';
  const kicker = appData.slides[0]?.kicker || 'STATE OF TENNESSEE';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let totalImages = 0;
  let totalTables = 0;
  let totalBullets = 0;

  const slidesHtml = appData.slides.map((slide, idx) => {
    const lines = (slide.body || '').split('\n').filter(l => l.trim().length > 0);
    totalBullets += lines.length;
    if (slide.mediaUrl) totalImages++;
    if (slide.chartData && slide.chartData.length > 0) totalTables++;

    let mediaHtml = '';
    if (slide.mediaUrl) {
      mediaHtml = `
        <div class="outline-media-card">
          <img src="${escapeHtml(slide.mediaUrl)}" alt="${escapeHtml(slide.isDecorative ? '' : (slide.mediaAlt || 'Slide photo'))}" ${slide.isDecorative ? 'aria-hidden="true"' : ''} class="outline-thumb">
          <div class="outline-media-info">
            <span class="media-tag">WCAG 1.1.1 Non-Text Content Verification:</span>
            <p class="media-alt-desc">
              ${slide.isDecorative ? '<em>Marked as decorative image (aria-hidden="true", conveys no informative content)</em>' : `<strong>Alt Text:</strong> ${escapeHtml(slide.mediaAlt || 'Descriptive photo representation')}`}
            </p>
            ${slide.mediaCaption ? `<div class="media-source">Source Credit: ${escapeHtml(slide.mediaCaption)}</div>` : ''}
          </div>
        </div>
      `;
    }

    let tableHtml = '';
    if (slide.chartData && slide.chartData.length > 0) {
      tableHtml = `
        <div class="outline-table-container">
          <table class="outline-semantic-table">
            <caption>${escapeHtml(slide.chartCaption || slide.title || 'Slide Data Table')}</caption>
            <thead>
              <tr>
                <th scope="col">${escapeHtml(slide.chartLabelHeader || 'Category / Dimension')}</th>
                <th scope="col">${escapeHtml(slide.chartValueHeader || 'Value / Metric')}</th>
              </tr>
            </thead>
            <tbody>
              ${slide.chartData.map(row => `
                <tr>
                  <th scope="row">${escapeHtml(row.label)}</th>
                  <td>${escapeHtml(row.value)}${escapeHtml(slide.chartUnit || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let notesHtml = '';
    if (slide.notes && slide.notes.trim()) {
      notesHtml = `
        <aside class="outline-speaker-notes" aria-label="Speaker notes for slide ${idx + 1}">
          <span class="notes-badge">Speaker Notes &amp; Talking Points:</span>
          <p>${escapeHtml(slide.notes)}</p>
        </aside>
      `;
    }

    return `
      <section class="outline-slide-section" aria-labelledby="slide-heading-${idx + 1}">
        <div class="slide-meta-bar">
          <span class="slide-number-pill">Slide ${idx + 1} of ${appData.slides.length}</span>
          ${slide.kicker ? `<span class="slide-kicker-pill">${escapeHtml(slide.kicker)}</span>` : ''}
          ${slide.citation ? `<span class="slide-citation-pill">⚖ Statutory Authority: T.C.A. § ${escapeHtml(slide.citation)}</span>` : ''}
        </div>

        <h2 id="slide-heading-${idx + 1}" class="slide-outline-title">
          ${escapeHtml(slide.title || 'Untitled Slide')}
        </h2>

        ${lines.length > 0 ? `
          <ul class="slide-outline-bullets">
            ${lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}
          </ul>
        ` : ''}

        ${mediaHtml}
        ${tableHtml}
        ${notesHtml}
      </section>
    `;
  }).join('');

  const docHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} • Accessible Presentation Outline (WCAG 2.1 AA Preferred)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body {
font-family: 'Open Sans', system-ui, -apple-system, sans-serif;
color: #1E293B;
background: #F8FAFC;
line-height: 1.6;
font-size: 10pt;
}
.print-bar {
position: sticky;
top: 0;
background: #002D72;
color: #FFFFFF;
padding: 0.75rem 1.5rem;
display: flex;
align-items: center;
justify-content: space-between;
gap: 1rem;
box-shadow: 0 4px 12px rgba(0, 45, 114, 0.25);
z-index: 100;
}
.print-btn {
background: #DDA719;
color: #0F172A;
border: none;
padding: 0.55rem 1.4rem;
border-radius: 6px;
font-weight: 800;
font-size: 0.85rem;
cursor: pointer;
display: inline-flex;
align-items: center;
gap: 6px;
}
.print-btn:hover { background: #B8860B; color: #FFFFFF; }
.page-container {
max-width: 850px;
margin: 1.5rem auto 3rem auto;
background: #FFFFFF;
padding: 2.5rem 3rem;
border: 1px solid #E2E8F0;
border-radius: 8px;
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.doc-header {
border-bottom: 3px solid #002D72;
padding-bottom: 1.25rem;
margin-bottom: 1.75rem;
}
.tristar-seal {
width: 44px;
height: 44px;
border-radius: 50%;
background: #002D62;
display: flex;
align-items: center;
justify-content: center;
margin-bottom: 0.75rem;
}
.doc-kicker {
font-size: 0.75rem;
font-weight: 700;
color: #BA0C2F;
text-transform: uppercase;
letter-spacing: 0.06em;
}
h1 {
font-size: 1.8rem;
font-weight: 800;
color: #002D72;
line-height: 1.2;
margin: 0.25rem 0 0.5rem 0;
}
.doc-meta-row {
display: flex;
flex-wrap: wrap;
gap: 1.5rem;
font-size: 0.8rem;
color: #64748B;
margin-top: 0.5rem;
}
.wcag-certified-pill {
display: inline-flex;
align-items: center;
gap: 5px;
background: #DEF7EC;
color: #03543F;
padding: 2px 8px;
border-radius: 999px;
font-weight: 700;
font-size: 0.725rem;
}
.outline-slide-section {
padding: 1.25rem 0;
border-bottom: 1px solid #E2E8F0;
page-break-inside: avoid;
break-inside: avoid;
}
.slide-meta-bar {
display: flex;
align-items: center;
gap: 8px;
margin-bottom: 0.4rem;
font-size: 0.72rem;
}
.slide-number-pill {
background: #002D72;
color: #FFFFFF;
font-weight: 700;
padding: 2px 8px;
border-radius: 4px;
}
.slide-kicker-pill {
color: #64748B;
font-weight: 600;
text-transform: uppercase;
}
.slide-citation-pill {
background: #FEF3C7;
color: #92400E;
padding: 2px 6px;
border-radius: 4px;
font-weight: 700;
}
h2.slide-outline-title {
font-size: 1.25rem;
font-weight: 700;
color: #002D72;
margin-bottom: 0.6rem;
line-height: 1.3;
}
.slide-outline-bullets {
margin-left: 1.4rem;
margin-bottom: 0.75rem;
}
.slide-outline-bullets li {
margin-bottom: 0.35rem;
color: #334155;
}
.outline-media-card {
display: flex;
gap: 12px;
background: #F8FAFC;
border: 1px solid #E2E8F0;
border-radius: 6px;
padding: 0.75rem;
margin: 0.75rem 0;
align-items: center;
}
.outline-thumb {
width: 120px;
height: 75px;
object-fit: cover;
border-radius: 4px;
border: 1px solid #CBD5E1;
flex-shrink: 0;
}
.outline-media-info {
font-size: 0.75rem;
flex: 1;
}
.media-tag {
font-weight: 700;
color: #002D72;
text-transform: uppercase;
font-size: 0.68rem;
display: block;
}
.media-alt-desc {
color: #1E293B;
margin: 2px 0;
}
.media-source {
font-size: 0.68rem;
color: #64748B;
font-style: italic;
}
.outline-table-container {
margin: 0.75rem 0;
}
.outline-semantic-table {
width: 100%;
border-collapse: collapse;
font-size: 0.8rem;
}
.outline-semantic-table caption {
font-weight: 700;
color: #002D72;
text-align: left;
margin-bottom: 0.35rem;
font-size: 0.825rem;
}
.outline-semantic-table th, .outline-semantic-table td {
border: 1px solid #CBD5E1;
padding: 6px 10px;
text-align: left;
}
.outline-semantic-table thead th {
background: #002D72;
color: #FFFFFF;
font-weight: 700;
}
.outline-semantic-table tbody tr:nth-child(even) {
background: #F8FAFC;
}
.outline-speaker-notes {
background: #EFF6FF;
border-left: 3px solid #3B82F6;
padding: 0.6rem 0.85rem;
margin-top: 0.6rem;
border-radius: 0 4px 4px 0;
font-size: 0.75rem;
}
.notes-badge {
font-weight: 700;
color: #1D4ED8;
text-transform: uppercase;
font-size: 0.68rem;
display: block;
margin-bottom: 2px;
}
.doc-footer {
margin-top: 2.5rem;
padding-top: 1.25rem;
border-top: 2px solid #E2E8F0;
display: flex;
justify-content: space-between;
font-size: 0.72rem;
color: #64748B;
}
@page {
margin: 0.75in;
size: letter portrait;
}
@media print {
body { background: #FFFFFF !important; font-size: 9.5pt !important; }
.print-bar { display: none !important; }
.page-container {
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  box-shadow: none !important;
  max-width: 100% !important;
}
.outline-slide-section { page-break-inside: avoid; break-inside: avoid; }
}
  </style>
</head>
<body>
  <div class="print-bar">
<div>
<strong>Accessible Presentation Outline (WCAG 2.1 AA Preferred)</strong>
<span style="font-size: 0.75rem; opacity: 0.85; margin-left: 8px;">Select "Save as PDF", portrait orientation, enable "Background graphics"</span>
</div>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>

  <main class="page-container">
<header class="doc-header">
<div class="tristar-seal">
  <svg width="24" height="24" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <circle cx="50" cy="50" r="46" fill="#002D62"/>
    <polygon points="50,20 53,30 62,30 55,36 58,45 50,39 42,45 45,36 38,30 47,30" fill="#FFF"/>
    <polygon points="32,54 35,63 44,63 37,69 40,78 32,72 24,78 27,69 20,63 29,63" fill="#FFF"/>
    <polygon points="68,54 71,63 80,63 73,69 76,78 68,72 60,78 63,69 56,63 65,63" fill="#FFF"/>
  </svg>
</div>
<div class="doc-kicker">${escapeHtml(kicker)}</div>
<h1>${escapeHtml(title)}</h1>
<div class="doc-meta-row">
  <span><strong>Department / Author:</strong> ${escapeHtml(author)}</span>
  <span><strong>Date:</strong> ${escapeHtml(dateStr)}</span>
  <span><strong>Scope:</strong> ${appData.slides.length} Slides • ${totalBullets} Key Points</span>
  <span class="wcag-certified-pill">✔ WCAG 2.1 AA Semantic Tagged</span>
</div>
</header>

<div class="outline-content">
${slidesHtml}
</div>

<footer class="doc-footer">
<span>State of Tennessee • TN Slides System • Official Executive Briefing Document</span>
<span>Compliant with WCAG 2.1 Level AA &amp; Section 508 Standards</span>
</footer>
  </main>
</body>
</html>`;

  const win = window.open('', 'TN_Slides_Outline_PDF', 'width=960,height=980,menubar=no,toolbar=no');
  if (!win) {
    alert('Pop-up window was blocked. Please allow pop-ups for TN Slides to generate PDF.');
    return;
  }
  win.document.open();
  win.document.write(docHtml);
  win.document.close();
}

// --- 2. VISUAL 16:9 PRESENTATION PDF (TAGGED SLIDES) ---
function exportVisualSlidesPdf() {
  const title = appData.slides[0]?.title || 'TN Slides Presentation';
  const theme = appData.theme || 'theme-dept-blue-banner';
  const stylesText = document.querySelector('style') ? document.querySelector('style').textContent : '';

  const slidesMarkup = appData.slides.map((slide, idx) => {
    const slideInner = buildSlideHtml(slide, idx);
    return `
      <section class="visual-pdf-page" aria-label="Slide ${idx + 1} of ${appData.slides.length}: ${escapeHtml(slide.title || 'Slide')}">
        <div class="visual-pdf-scaler">
          <div class="slide-stage ${theme}">
            ${slideInner}
          </div>
        </div>
        <footer class="visual-pdf-footer" aria-hidden="true">
          <span>State of Tennessee • Official Presentation</span>
          <span>Slide ${idx + 1} of ${appData.slides.length}</span>
          <span>WCAG 2.1 AA Tagged</span>
        </footer>
      </section>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} • Visual 16:9 Slides (WCAG 2.1 AA Tagged)</title>
  <style>
${stylesText}

* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body {
margin: 0;
padding: 0;
background: #0F172A;
color: #1E293B;
font-family: 'Open Sans', system-ui, -apple-system, sans-serif;
}
.print-bar {
position: sticky;
top: 0;
background: #002D72;
color: #FFFFFF;
padding: 0.75rem 1.5rem;
display: flex;
align-items: center;
justify-content: space-between;
gap: 1rem;
box-shadow: 0 4px 12px rgba(0, 45, 114, 0.25);
z-index: 9999;
}
.print-btn {
background: #DDA719;
color: #0F172A;
border: none;
padding: 0.55rem 1.4rem;
border-radius: 6px;
font-weight: 800;
font-size: 0.85rem;
cursor: pointer;
}
.print-btn:hover { background: #B8860B; color: #FFFFFF; }
.deck-scroll-container {
display: flex;
flex-direction: column;
gap: 2rem;
align-items: center;
padding: 2rem 0;
}
.visual-pdf-page {
width: 960px;
height: 540px;
position: relative;
background: #FFFFFF;
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
page-break-after: always;
break-after: page;
display: flex;
flex-direction: column;
overflow: hidden;
border-radius: 4px;
}
.visual-pdf-scaler {
width: 960px;
height: 540px;
position: relative;
flex: 1;
overflow: hidden;
}
.visual-pdf-scaler .slide-stage {
width: 960px !important;
height: 540px !important;
transform: none !important;
position: absolute;
top: 0;
left: 0;
}
.visual-pdf-footer {
display: none;
}
@page {
size: 16in 9in landscape;
margin: 0;
}
@media print {
body { background: #FFFFFF !important; }
.print-bar { display: none !important; }
.deck-scroll-container { gap: 0 !important; padding: 0 !important; }
.visual-pdf-page {
  width: 16in !important;
  height: 9in !important;
  box-shadow: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  page-break-after: always !important;
  break-after: page !important;
}
.visual-pdf-scaler {
  width: 16in !important;
  height: 9in !important;
  transform-origin: top left;
  transform: scale(1.6666667) !important;
}
.visual-pdf-scaler .slide-stage {
  width: 960px !important;
  height: 540px !important;
}
}
  </style>
</head>
<body>
  <div class="print-bar">
<div>
<strong>Visual 16:9 Presentation PDF (WCAG 2.1 AA Tagged)</strong>
<span style="font-size: 0.75rem; opacity: 0.85; margin-left: 8px;">Select "Save as PDF", landscape orientation, enable "Background graphics"</span>
</div>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save 16:9 PDF</button>
  </div>
  <main class="deck-scroll-container">
${slidesMarkup}
  </main>
</body>
</html>`;

  const win = window.open('', 'TN_Slides_Visual_PDF', 'width=1020,height=720,menubar=no,toolbar=no');
  if (!win) {
    alert('Pop-up window was blocked. Please allow pop-ups for TN Slides to generate PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// --- 3. EXECUTIVE SLIDE + SPEAKER NOTES HANDOUT (MEETING BRIEF) ---
function exportSpeakerHandoutPdf() {
  const title = appData.slides[0]?.title || 'TN Slides Presentation';
  const author = appData.slides[0]?.authorName || 'State Agency Representative';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const stylesText = document.querySelector('style') ? document.querySelector('style').textContent : '';

  const handoutsMarkup = appData.slides.map((slide, idx) => {
    const lines = (slide.body || '').split('\n').filter(l => l.trim().length > 0);
    const slideInner = buildSlideHtml(slide, idx);
    const theme = appData.theme || 'theme-dept-blue-banner';

    return `
      <section class="handout-page" aria-label="Handout for slide ${idx + 1}: ${escapeHtml(slide.title || '')}">
        <header class="handout-page-header">
          <span class="handout-brand">State of Tennessee • Executive Briefing Handout</span>
          <span class="handout-counter">Slide ${idx + 1} of ${appData.slides.length}</span>
        </header>

        <div class="handout-slide-box">
          <div class="handout-slide-scaler">
            <div class="slide-stage ${theme}">
              ${slideInner}
            </div>
          </div>
        </div>

        <div class="handout-notes-section">
          <div class="handout-heading-row">
            ${slide.kicker ? `<span class="handout-kicker">${escapeHtml(slide.kicker)}</span>` : ''}
            <h2 class="handout-slide-title">${escapeHtml(slide.title || 'Untitled Slide')}</h2>
          </div>

          ${lines.length > 0 ? `
            <div class="handout-bullets-box">
              <strong>Key Discussion Points:</strong>
              <ul>
                ${lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${slide.citation ? `
            <div class="handout-citation-box">
              ⚖ <strong>Statutory Authority:</strong> Tennessee Code Annotated § ${escapeHtml(slide.citation)}
            </div>
          ` : ''}

          ${slide.notes ? `
            <div class="handout-speaker-notes-box">
              <strong>Presenter Talking Points &amp; Briefing Notes:</strong>
              <p>${escapeHtml(slide.notes)}</p>
            </div>
          ` : ''}

          <div class="handout-lines-area" aria-hidden="true">
            <span class="lines-label">Meeting Notes &amp; Action Items:</span>
            <div class="write-line"></div>
            <div class="write-line"></div>
            <div class="write-line"></div>
          </div>
        </div>
      </section>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)} • Executive Speaker Handout (WCAG 2.1 AA)</title>
  <style>
${stylesText}

* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body {
margin: 0;
padding: 0;
background: #F1F5F9;
color: #1E293B;
font-family: 'Open Sans', system-ui, -apple-system, sans-serif;
}
.print-bar {
position: sticky;
top: 0;
background: #002D72;
color: #FFFFFF;
padding: 0.75rem 1.5rem;
display: flex;
align-items: center;
justify-content: space-between;
gap: 1rem;
box-shadow: 0 4px 12px rgba(0, 45, 114, 0.2);
z-index: 9999;
}
.print-btn {
background: #DDA719;
color: #0F172A;
border: none;
padding: 0.55rem 1.4rem;
border-radius: 6px;
font-weight: 800;
font-size: 0.85rem;
cursor: pointer;
}
.print-btn:hover { background: #B8860B; color: #FFFFFF; }
.handout-scroll-container {
display: flex;
flex-direction: column;
gap: 2rem;
align-items: center;
padding: 2rem 0;
}
.handout-page {
width: 8.5in;
height: 11in;
background: #FFFFFF;
padding: 0.6in 0.65in;
box-sizing: border-box;
box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
display: flex;
flex-direction: column;
justify-content: space-between;
page-break-after: always;
break-after: page;
}
.handout-page-header {
display: flex;
justify-content: space-between;
font-size: 0.72rem;
color: #64748B;
border-bottom: 2px solid #002D72;
padding-bottom: 0.35rem;
margin-bottom: 0.65rem;
font-weight: 700;
}
.handout-slide-box {
width: 100%;
height: 4.1in;
border: 1px solid #CBD5E1;
border-radius: 6px;
overflow: hidden;
position: relative;
background: #F8FAFC;
}
.handout-slide-scaler {
width: 960px;
height: 540px;
transform-origin: top left;
transform: scale(0.72) !important;
position: absolute;
top: 0;
left: 0;
}
.handout-notes-section {
flex: 1;
display: flex;
flex-direction: column;
gap: 0.45rem;
margin-top: 0.65rem;
}
.handout-kicker {
font-size: 0.68rem;
font-weight: 700;
color: #BA0C2F;
text-transform: uppercase;
}
.handout-slide-title {
font-size: 1.1rem;
font-weight: 800;
color: #002D72;
margin: 2px 0 0.25rem 0;
}
.handout-bullets-box {
font-size: 0.8rem;
color: #334155;
}
.handout-bullets-box ul {
margin: 0.2rem 0 0 1.25rem;
padding: 0;
}
.handout-bullets-box li {
margin-bottom: 2px;
}
.handout-citation-box {
font-size: 0.75rem;
background: #FEF3C7;
color: #92400E;
padding: 4px 8px;
border-radius: 4px;
border-left: 3px solid #D97706;
}
.handout-speaker-notes-box {
background: #EFF6FF;
border-left: 3px solid #3B82F6;
padding: 6px 10px;
border-radius: 0 4px 4px 0;
font-size: 0.78rem;
color: #1E3A8A;
}
.handout-speaker-notes-box p {
margin: 2px 0 0 0;
}
.handout-lines-area {
margin-top: auto;
padding-top: 0.4rem;
}
.lines-label {
font-size: 0.68rem;
font-weight: 700;
color: #64748B;
text-transform: uppercase;
letter-spacing: 0.05em;
}
.write-line {
border-bottom: 1px dashed #CBD5E1;
height: 18px;
}
@page {
size: letter portrait;
margin: 0;
}
@media print {
body { background: #FFFFFF !important; }
.print-bar { display: none !important; }
.handout-scroll-container { gap: 0 !important; padding: 0 !important; }
.handout-page {
  box-shadow: none !important;
  margin: 0 !important;
  page-break-after: always !important;
  break-after: page !important;
}
}
  </style>
</head>
<body>
  <div class="print-bar">
<div>
<strong>Executive Slide + Speaker Notes Handout (WCAG 2.1 AA)</strong>
<span style="font-size: 0.75rem; opacity: 0.85; margin-left: 8px;">Select "Save as PDF", portrait orientation, enable "Background graphics"</span>
</div>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save Handout PDF</button>
  </div>
  <main class="handout-scroll-container">
${handoutsMarkup}
  </main>
</body>
</html>`;

  const win = window.open('', 'TN_Slides_Handout_PDF', 'width=980,height=980,menubar=no,toolbar=no');
  if (!win) {
    alert('Pop-up window was blocked. Please allow pop-ups for TN Slides to generate PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function triggerPrintPdf() {
  exportVisualSlidesPdf();
}

