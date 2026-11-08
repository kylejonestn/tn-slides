/**
 * State of Tennessee Presentation Studio - Application Entry & Interaction Controller
 * Sets up DOM event listeners, keyboard shortcuts, modal controls, and initializes the studio.
 */
'use strict';

// --- 3. INITIALIZATION ---
function init() {
  selectTheme.value = appData.theme || 'theme-dept-blue-banner';
  selectAgencyLogo.value = appData.agencyLogo || 'dept-labor';
  selectPhotoStyle.value = appData.photoStyle || 'photo-style-blue-overlay';
  chkCardWiggle.checked = appData.enableCardWiggle !== false;
  applyCustomAccent(appData.customAccent || '#002D72');
  applyAspectRatio(appData.aspectRatio || '16:9');

  renderFilmstrip();
  loadSlideIntoForm(currentSlideIndex);
  renderCurrentSlide();
  setupEventListeners();
  rescalePresentationViewports();
  checkCurrentSlideClipping();
  resizeAnnotationCanvas();
  updateMediaAssetStats();
  updateHistoryBadgeCount();
  startAutosaveSnapshotTimer();
  if (getSnapshotsList().length === 0) {
    recordSnapshot('Initial Deck Loaded', 'Baseline presentation state');
  }
}



// --- 18. EVENT LISTENERS & INTERACTION ---
function setupEventListeners() {
  inputKicker.addEventListener('input', updateSlideFromForm);
  inputTitle.addEventListener('input', updateSlideFromForm);
  inputBody.addEventListener('input', updateSlideFromForm);
  selectLayout.addEventListener('change', updateSlideFromForm);
  inputNotes.addEventListener('input', updateSlideFromForm);
  if (inputCitation) inputCitation.addEventListener('input', updateSlideFromForm);
  selectImagePlacement.addEventListener('change', updateSlideFromForm);
  inputImageUrl.addEventListener('input', updateSlideFromForm);
  inputImageCaption.addEventListener('input', updateSlideFromForm);
  inputVideoUrl.addEventListener('input', updateSlideFromForm);
  if (chkVideoFullscreenAdvance) {
    chkVideoFullscreenAdvance.addEventListener('change', updateSlideFromForm);
  }
  if (btnPreviewVideoFullscreen) {
    btnPreviewVideoFullscreen.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.videoUrl) {
        launchFullscreenVideoTheater(slide);
      } else {
        alert('Please enter a valid YouTube or video URL first.');
      }
    });
  }
  if (btnClearVideo) {
    btnClearVideo.addEventListener('click', () => {
      inputVideoUrl.value = '';
      updateSlideFromForm();
    });
  }
  if (btnCloseVideoTheater) {
    btnCloseVideoTheater.addEventListener('click', () => {
      exitFullscreenVideoTheater(false);
    });
  }
  if (videoTheaterOverlay) {
    videoTheaterOverlay.addEventListener('click', (e) => {
      if (e.target.closest('#btn-close-video-theater')) {
        exitFullscreenVideoTheater(false);
        return;
      }
      handleVideoTheaterAdvance('forward');
    });
    videoTheaterOverlay.addEventListener('mousemove', resetTheaterHeaderIdleTimer);
  }

  // Listen for YouTube API message events (e.g. video completion)
  window.addEventListener('message', (e) => {
    if (!isVideoPlayingFullscreen) return;
    try {
      let data = e.data;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      // YouTube sends { event: "onStateChange", info: 0 } when video finishes
      if (data && data.event === 'onStateChange' && data.info === 0) {
        exitFullscreenVideoTheater(false);
      }
    } catch (err) {}
  });

  inputAudioUrl.addEventListener('input', updateSlideFromForm);

  // Visual Layout Gallery & Mini Preview Triggers
  const btnBrowseLayouts = document.getElementById('btn-browse-layouts');
  const layoutMiniCard = document.getElementById('layout-mini-preview-card');
  const btnCloseGallery = document.getElementById('btn-close-layout-gallery');
  const btnCloseGalleryFooter = document.getElementById('btn-close-gallery-footer');
  const layoutSearchInput = document.getElementById('layout-search-input');
  const filterBtns = document.querySelectorAll('.layout-filter-btn');

  if (btnBrowseLayouts) btnBrowseLayouts.addEventListener('click', openLayoutGallery);
  if (layoutMiniCard) layoutMiniCard.addEventListener('click', openLayoutGallery);
  if (btnCloseGallery) btnCloseGallery.addEventListener('click', closeLayoutGallery);
  if (btnCloseGalleryFooter) btnCloseGalleryFooter.addEventListener('click', closeLayoutGallery);

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLayoutFilterCategory = btn.dataset.category || 'all';
      renderLayoutGallery(activeLayoutFilterCategory, layoutSearchInput ? layoutSearchInput.value : '');
    });
  });

  if (layoutSearchInput) {
    layoutSearchInput.addEventListener('input', (e) => {
      renderLayoutGallery(activeLayoutFilterCategory, e.target.value);
    });
  }

  if (chkSlideAnimate) {
    chkSlideAnimate.addEventListener('change', () => {
      if (slideAnimTypeContainer) {
        slideAnimTypeContainer.style.display = chkSlideAnimate.checked ? 'flex' : 'none';
      }
      updateSlideFromForm(true);
    });
  }
  if (selectSlideAnimType) {
    selectSlideAnimType.addEventListener('change', () => {
      updateSlideFromForm(true);
    });
  }

  // Sidebar Tabs
  const tabBtns = document.querySelectorAll('.sidebar-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.getElementById('outline-tab-pane').style.display = target === 'outline' ? 'block' : 'none';
      document.getElementById('style-tab-pane').style.display = target === 'style' ? 'block' : 'none';
      document.getElementById('media-tab-pane').style.display = target === 'media' ? 'block' : 'none';
      if (target === 'media') {
        updateMediaAssetStats();
      }
    });
  });

  // Theme and Style pickers
  selectTheme.addEventListener('change', () => {
    appData.theme = selectTheme.value;
    markDirty();
    renderCurrentSlide();
  });

  selectAgencyLogo.addEventListener('change', () => {
    appData.agencyLogo = selectAgencyLogo.value;
    markDirty();
    renderCurrentSlide();
  });

  selectPhotoStyle.addEventListener('change', () => {
    appData.photoStyle = selectPhotoStyle.value;
    markDirty();
    renderCurrentSlide();
  });

  chkCardWiggle.addEventListener('change', () => {
    appData.enableCardWiggle = chkCardWiggle.checked;
    markDirty();
    renderCurrentSlide();
  });

  // Civic Color Palette Swatches
  const swatchButtons = document.querySelectorAll('.tn-color-swatch-btn');
  swatchButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      applyCustomAccent(color);
      markDirty();
      renderCurrentSlide();
    });
  });

  // Custom Color Picker & Hex Input
  const customPicker = document.getElementById('custom-accent-color-picker');
  const customHexInp = document.getElementById('custom-accent-hex-input');
  const btnResetAccent = document.getElementById('btn-reset-accent-color');

  if (customPicker) {
    customPicker.addEventListener('input', (e) => {
      applyCustomAccent(e.target.value);
      markDirty();
      renderCurrentSlide();
    });
  }

  if (customHexInp) {
    customHexInp.addEventListener('input', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        applyCustomAccent(val, true);
        markDirty();
        renderCurrentSlide();
      }
    });
  }

  if (btnResetAccent) {
    btnResetAccent.addEventListener('click', () => {
      applyCustomAccent('#002D72');
      markDirty();
      renderCurrentSlide();
    });
  }

  // Add Slide Button
  const btnAddSlide = document.getElementById('btn-add-slide');
  if (btnAddSlide) {
    btnAddSlide.addEventListener('click', addNewSlide);
  }

  // Duplicate Slide
  const btnDupSlide = document.getElementById('btn-duplicate-slide');
  if (btnDupSlide) {
    btnDupSlide.addEventListener('click', () => duplicateSlide(currentSlideIndex));
  }

  // Delete Slide
  const btnDelSlide = document.getElementById('btn-delete-slide');
  if (btnDelSlide) {
    btnDelSlide.addEventListener('click', () => deleteSlide(currentSlideIndex));
  }

  // Deck Filmstrip Collapse/Expand Toggle (if present)
  const btnToggleFilmstrip = document.getElementById('btn-toggle-filmstrip');
  const filmstripWrapper = document.getElementById('filmstrip-wrapper');
  if (btnToggleFilmstrip && filmstripWrapper) {
    btnToggleFilmstrip.addEventListener('click', () => {
      const isCollapsed = filmstripWrapper.classList.toggle('collapsed');
      btnToggleFilmstrip.setAttribute('aria-expanded', !isCollapsed);
    });
  }

  // Outline Tab Pane Navigation
  const btnOutlinePrev = document.getElementById('btn-outline-prev-slide');
  const btnOutlineNext = document.getElementById('btn-outline-next-slide');
  if (btnOutlinePrev) {
    btnOutlinePrev.addEventListener('click', () => {
      prevSlide();
      document.querySelector('.sidebar-content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (btnOutlineNext) {
    btnOutlineNext.addEventListener('click', () => {
      nextSlide();
      document.querySelector('.sidebar-content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Navigation
  document.getElementById('btn-prev-slide').addEventListener('click', prevSlide);
  document.getElementById('btn-next-slide').addEventListener('click', nextSlide);
  document.getElementById('hud-prev-btn').addEventListener('click', prevSlide);
  document.getElementById('hud-next-btn').addEventListener('click', nextSlide);

  // Presenter & Fullscreen
  document.getElementById('btn-present-mode').addEventListener('click', enterFullscreenPresentation);
  const btnQuickPresent = document.getElementById('btn-quick-present');
  if (btnQuickPresent) btnQuickPresent.addEventListener('click', enterFullscreenPresentation);
  document.getElementById('hud-exit-btn').addEventListener('click', exitFullscreenPresentation);
  document.getElementById('btn-presenter-console').addEventListener('click', openPresenterConsole);
  document.getElementById('hud-console-btn').addEventListener('click', openPresenterConsole);
  document.getElementById('hud-black-btn').addEventListener('click', toggleBlackScreen);

  // Copilot
  copilotApplyBtn.addEventListener('click', applyCopilotBrevity);

  // Unified Header Save & Export
  const btnHeaderSave = document.getElementById('btn-header-save');
  if (btnHeaderSave) btnHeaderSave.addEventListener('click', saveToFileSystem);

  const btnHeaderExport = document.getElementById('btn-header-export');
  if (btnHeaderExport) {
    btnHeaderExport.addEventListener('click', () => {
      updateExportStatsBanner();
      document.getElementById('modal-export-menu').classList.add('active');
    });
  }

  // Step 1 Onboarding Card Dismiss & Reopen
  const step1Card = document.getElementById('step1-onboarding-card');
  const btnDismissStep1 = document.getElementById('btn-dismiss-step1');
  const btnReopenStep1 = document.getElementById('btn-reopen-step1');

  if (step1Card && btnDismissStep1) {
    if (localStorage.getItem('tn_slides_step1_dismissed') === 'true') {
      step1Card.style.display = 'none';
      if (btnReopenStep1) btnReopenStep1.style.display = 'inline-flex';
    }

    btnDismissStep1.addEventListener('click', (e) => {
      e.stopPropagation();
      step1Card.style.display = 'none';
      if (btnReopenStep1) btnReopenStep1.style.display = 'inline-flex';
      localStorage.setItem('tn_slides_step1_dismissed', 'true');
    });
  }

  if (btnReopenStep1 && step1Card) {
    btnReopenStep1.addEventListener('click', () => {
      step1Card.style.display = 'block';
      btnReopenStep1.style.display = 'none';
      localStorage.removeItem('tn_slides_step1_dismissed');
    });
  }

  // Self-Editing Save & Open
  document.getElementById('btn-self-save').addEventListener('click', saveToFileSystem);
  document.getElementById('btn-open-file').addEventListener('click', openExistingPresentationFile);
  document.getElementById('local-html-file-picker').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (evt) => loadPresentationFromHtmlString(evt.target.result);
      reader.readAsText(e.target.files[0]);
    }
  });

  // Modals & Accessibility Tools
  document.getElementById('btn-speech-reader').addEventListener('click', speakCurrentSlideAsScreenReader);
  document.getElementById('btn-stop-sr').addEventListener('click', stopScreenReaderSpeech);
  document.getElementById('btn-print-wcag-cert').addEventListener('click', generateWcagCertificate);
  document.getElementById('btn-audit-wcag').addEventListener('click', runWcagAudit);
  document.getElementById('btn-close-wcag').addEventListener('click', () => document.getElementById('modal-wcag-audit').classList.remove('active'));
  document.getElementById('btn-wcag-close-footer').addEventListener('click', () => document.getElementById('modal-wcag-audit').classList.remove('active'));

  document.getElementById('btn-export-menu').addEventListener('click', () => {
    updateExportStatsBanner();
    document.getElementById('modal-export-menu').classList.add('active');
  });
  document.getElementById('btn-close-export').addEventListener('click', () => document.getElementById('modal-export-menu').classList.remove('active'));

  document.getElementById('btn-ai-guide').addEventListener('click', () => document.getElementById('modal-ai-guide').classList.add('active'));
  document.getElementById('btn-close-ai').addEventListener('click', () => document.getElementById('modal-ai-guide').classList.remove('active'));

  // Aspect Ratio Selectors (Canvas Toolbar & Style Tab)
  if (selectCanvasAspectRatio) {
    selectCanvasAspectRatio.addEventListener('change', (e) => {
      applyAspectRatio(e.target.value);
    });
  }
  if (selectStyleAspectRatio) {
    selectStyleAspectRatio.addEventListener('change', (e) => {
      applyAspectRatio(e.target.value);
    });
  }

  // Safe-Zone Visual Guides
  if (btnToggleSafeZones) {
    btnToggleSafeZones.addEventListener('click', toggleSafeZones);
  }

  // Live Slide Clipping Badge & Deck Auditor
  if (canvasClippingBadge) {
    canvasClippingBadge.addEventListener('click', scanDeckForClipping);
  }
  if (btnOpenClippingAudit) {
    btnOpenClippingAudit.addEventListener('click', scanDeckForClipping);
  }
  if (btnSidebarCheckClipping) {
    btnSidebarCheckClipping.addEventListener('click', scanDeckForClipping);
  }
  if (btnCloseClippingAudit) {
    btnCloseClippingAudit.addEventListener('click', closeClippingAuditModal);
  }
  if (btnCloseClippingAuditFooter) {
    btnCloseClippingAuditFooter.addEventListener('click', closeClippingAuditModal);
  }
  if (btnApplyCompactFit) {
    btnApplyCompactFit.addEventListener('click', toggleCompactSafeFit);
  }
  if (modalClippingAudit) {
    modalClippingAudit.addEventListener('click', (e) => {
      if (e.target === modalClippingAudit) closeClippingAuditModal();
    });
  }

  // Sub-Menu & Progressive Disclosure Actions
  const menuImportOutline = document.getElementById('menu-btn-import-outline');
  if (menuImportOutline) menuImportOutline.addEventListener('click', openOutlineImporter);

  const menuImportChart = document.getElementById('menu-btn-import-chart');
  if (menuImportChart) menuImportChart.addEventListener('click', () => openChartImporter());

  const menuImportDeck = document.getElementById('menu-btn-import-deck');
  if (menuImportDeck) menuImportDeck.addEventListener('click', openDeckImporter);

  const btnOpenDeck = document.getElementById('btn-open-deck-importer');
  if (btnOpenDeck) btnOpenDeck.addEventListener('click', openDeckImporter);

  const menuWcagCert = document.getElementById('menu-btn-wcag-cert');
  if (menuWcagCert) menuWcagCert.addEventListener('click', generateWcagCertificate);

  const menuSpeechReader = document.getElementById('menu-btn-speech-reader');
  if (menuSpeechReader) menuSpeechReader.addEventListener('click', speakCurrentSlideAsScreenReader);

  const menuFsPresent = document.getElementById('menu-btn-fullscreen-present');
  if (menuFsPresent) menuFsPresent.addEventListener('click', enterFullscreenPresentation);

  // Auto-dismiss popover when any action item inside it is selected
  document.querySelectorAll('.dropdown-popover-menu .dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const pop = item.closest('[popover]');
      if (pop && pop.hidePopover) {
        try { pop.hidePopover(); } catch (err) {}
      }
    });
  });

  // Outline & Agenda Importer (WYSIWYG & Markdown) - Step 1 Thought Drafting
  const btnNewPres = document.getElementById('btn-new-presentation');
  if (btnNewPres) btnNewPres.addEventListener('click', () => openOutlineImporter(true));

  const btnHeroStep1 = document.getElementById('btn-open-importer-hero');
  if (btnHeroStep1) btnHeroStep1.addEventListener('click', () => openOutlineImporter(true));

  const btnToggleFs = document.getElementById('btn-toggle-importer-fullscreen');
  if (btnToggleFs) btnToggleFs.addEventListener('click', toggleImporterFullscreen);

  document.getElementById('btn-open-importer').addEventListener('click', () => openOutlineImporter(false));
  const filmstripImportBtn = document.getElementById('btn-open-importer-filmstrip');
  if (filmstripImportBtn) {
    filmstripImportBtn.addEventListener('click', () => openOutlineImporter(false));
  }
  document.getElementById('btn-close-importer').addEventListener('click', closeOutlineImporter);
  document.getElementById('btn-cancel-importer').addEventListener('click', closeOutlineImporter);
  document.getElementById('outline-input-text').addEventListener('input', updateOutlinePreview);
  document.getElementById('chk-auto-layouts').addEventListener('change', updateOutlinePreview);
  const splitStrategySelect = document.getElementById('select-outline-split-strategy');
  if (splitStrategySelect) {
    splitStrategySelect.addEventListener('change', updateOutlinePreview);
  }

  // Progressive Disclosure: Smart Layout Suggestion Chips & Contextual Actions
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.smart-chip-btn');
    if (chip && chip.dataset.layout) {
      const layout = chip.dataset.layout;
      if (selectLayout) {
        selectLayout.value = layout;
        updateSlideFromForm(true);
        renderCurrentSlide(true);
      }
    }

    const iconChip = e.target.closest('.smart-icon-chip-btn');
    if (iconChip && iconChip.dataset.icon) {
      const icon = iconChip.dataset.icon;
      const selectBgIcon = document.getElementById('select-bg-icon');
      if (selectBgIcon) {
        selectBgIcon.value = icon;
      }
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.bgIcon = icon;
      }
      updateSlideFromForm(false);
    }

    if (e.target.closest('#btn-add-visual-contextual')) {
      const mediaTab = document.querySelector('.sidebar-tab-btn[data-tab="media"]');
      if (mediaTab) mediaTab.click();
    }
    if (e.target.closest('#btn-open-chart-contextual')) {
      if (typeof openChartImporter === 'function') openChartImporter();
    }
  });

  if (inputCitation) {
    inputCitation.addEventListener('input', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.citation = inputCitation.value.trim();
        updateDrawerBadges(slide);
      }
    });
  }
  if (chkSlideAnimate) {
    chkSlideAnimate.addEventListener('change', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.animate = chkSlideAnimate.checked;
        updateDrawerBadges(slide);
      }
    });
  }
  if (selectSlideAnimType) {
    selectSlideAnimType.addEventListener('change', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.animationType = selectSlideAnimType.value;
        updateDrawerBadges(slide);
      }
    });
  }

  // Decorative Watermark Icon Drawer Controls
  const selectBgIcon = document.getElementById('select-bg-icon');
  if (selectBgIcon) {
    selectBgIcon.addEventListener('change', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.bgIcon = selectBgIcon.value.trim();
      }
      updateSlideFromForm(false);
    });
  }

  const sliderBgIconOpacity = document.getElementById('slider-bg-icon-opacity');
  const labelBgIconOpacity = document.getElementById('label-bg-icon-opacity');
  if (sliderBgIconOpacity) {
    sliderBgIconOpacity.addEventListener('input', () => {
      const slide = appData.slides[currentSlideIndex];
      const val = parseFloat(sliderBgIconOpacity.value) || 0.04;
      if (slide) {
        slide.bgIconOpacity = val;
      }
      if (labelBgIconOpacity) {
        labelBgIconOpacity.textContent = `${Math.round(val * 100)}%`;
      }
      updateSlideFromForm(false);
    });
  }

  const selectBgIconPos = document.getElementById('select-bg-icon-pos');
  if (selectBgIconPos) {
    selectBgIconPos.addEventListener('change', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.bgIconPosition = selectBgIconPos.value;
      }
      updateSlideFromForm(false);
    });
  }

  const btnClearBgIcon = document.getElementById('btn-clear-bg-icon');
  if (btnClearBgIcon) {
    btnClearBgIcon.addEventListener('click', () => {
      if (selectBgIcon) selectBgIcon.value = '';
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.bgIcon = '';
      }
      updateSlideFromForm(false);
    });
  }

  document.getElementById('btn-mode-wysiwyg').addEventListener('click', () => setOutlineEditorMode('wysiwyg'));
  document.getElementById('btn-mode-markdown').addEventListener('click', () => setOutlineEditorMode('markdown'));

  const wysiwygBtns = document.querySelectorAll('.wysiwyg-toolbar button[data-command]');
  wysiwygBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      execWysiwygCommand(btn.dataset.command);
    });
  });

  const fmtSelect = document.getElementById('wysiwyg-format-select');
  if (fmtSelect) {
    fmtSelect.addEventListener('change', () => {
      execWysiwygCommand('formatBlock', '<' + fmtSelect.value.toUpperCase() + '>');
    });
  }

  const quoteBtn = document.getElementById('btn-wysiwyg-quote-tool');
  if (quoteBtn) {
    quoteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      execWysiwygCommand('formatBlock', '<BLOCKQUOTE>');
    });
  }

  // Quick Heading Buttons (H1, H2, H3, H4)
  const headingBtns = document.querySelectorAll('.wysiwyg-heading-btn');
  headingBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const headingTag = btn.dataset.heading;
      execWysiwygCommand('formatBlock', '<' + headingTag.toUpperCase() + '>');
      const fmtSelect = document.getElementById('wysiwyg-format-select');
      if (fmtSelect) fmtSelect.value = headingTag;
    });
  });

  const wysiwygEditor = document.getElementById('outline-wysiwyg-editor');
  let outlineDebounceTimer = null;
  function triggerLiveOutlineSync() {
    const syncIndicator = document.getElementById('importer-sync-indicator');
    if (syncIndicator) {
      syncIndicator.textContent = '⏳ Parsing...';
      syncIndicator.style.color = '#f59e0b';
    }
    clearTimeout(outlineDebounceTimer);
    outlineDebounceTimer = setTimeout(updateOutlinePreview, 120);
  }

  if (wysiwygEditor) {
    wysiwygEditor.addEventListener('paste', (e) => {
      const pastedText = (e.clipboardData || window.clipboardData)?.getData('text/plain');
      if (pastedText) {
        const textInput = document.getElementById('outline-input-text');
        if (textInput) textInput.value = pastedText;
      }
    });
    ['input', 'keyup', 'paste', 'change'].forEach(evtType => {
      wysiwygEditor.addEventListener(evtType, triggerLiveOutlineSync);
    });
  }

  // Explicit Update Slides Button
  const btnReparseOutline = document.getElementById('btn-reparse-outline');
  if (btnReparseOutline) {
    btnReparseOutline.addEventListener('click', () => {
      updateOutlinePreview();
      const count = document.getElementById('detected-slide-count')?.textContent || '0';
      const toast = document.createElement('div');
      toast.className = 'save-toast';
      toast.textContent = `✓ Refreshed outline: detected ${count} slide(s)`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    });
  }

  // Periodic Auto-Sync Timer (every 20s when outline editor is open)
  setInterval(() => {
    const modal = document.getElementById('modal-outline-importer');
    if (modal && modal.classList.contains('active')) {
      updateOutlinePreview();
    }
  }, 20000);

  document.getElementById('btn-insert-sample-agenda').addEventListener('click', () => {
    if (outlineEditorMode === 'wysiwyg') {
      document.getElementById('outline-wysiwyg-editor').innerHTML = SAMPLE_TN_AGENDA_HTML;
    } else {
      document.getElementById('outline-input-text').value = SAMPLE_TN_AGENDA_MD;
    }
    updateOutlinePreview();
  });

  const btnBlankAgenda = document.getElementById('btn-insert-blank-agenda');
  if (btnBlankAgenda) {
    btnBlankAgenda.addEventListener('click', () => {
      if (outlineEditorMode === 'wysiwyg') {
        document.getElementById('outline-wysiwyg-editor').innerHTML = SAMPLE_TN_BLANK_HTML;
      } else {
        document.getElementById('outline-input-text').value = `# Briefing Title\nState of Tennessee • Project Overview & Context\n\n---\n\n# 1. Strategic Priorities & Purpose\n- Primary agency objective and public mission\n- Immediate target deliverables and community impact\n\n---\n\n# 2. Key Deliverables & Progress\n- Operational performance milestones achieved\n- Next legislative steps and community engagement`;
      }
      updateOutlinePreview();
    });
  }
  document.getElementById('btn-execute-importer').addEventListener('click', executeOutlineImport);

  // Accessible Spreadsheet & CSV Chart Ingestion Listeners
  const chartLaunchers = ['btn-open-chart-importer', 'btn-open-chart-importer-filmstrip', 'btn-edit-slide-chart'];
  chartLaunchers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => openChartImporter());
  });

  const btnRemoveChart = document.getElementById('btn-remove-slide-chart');
  if (btnRemoveChart) {
    btnRemoveChart.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        delete slide.chartData;
        delete slide.chartCaption;
        slide.layout = 'layout-split';
        markDirty();
        renderFilmstrip();
        loadSlideIntoForm(currentSlideIndex);
        renderCurrentSlide();
      }
    });
  }

  document.getElementById('btn-close-chart-importer').addEventListener('click', closeChartImporter);
  document.getElementById('btn-cancel-chart-importer').addEventListener('click', closeChartImporter);
  document.getElementById('btn-apply-chart-importer').addEventListener('click', executeChartImport);

  // Sample Datasets
  document.getElementById('btn-sample-bwc').addEventListener('click', () => loadSampleDataset('bwc'));
  document.getElementById('btn-sample-budget').addEventListener('click', () => loadSampleDataset('budget'));
  document.getElementById('btn-sample-apprenticeship').addEventListener('click', () => loadSampleDataset('apprenticeship'));

  // Chart Dropzone and File Picker
  const chartDropzone = document.getElementById('chart-file-dropzone');
  const chartFileInput = document.getElementById('chart-file-input');
  if (chartDropzone && chartFileInput) {
    chartDropzone.addEventListener('click', () => chartFileInput.click());
    chartDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        chartFileInput.click();
      }
    });
    chartDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      chartDropzone.classList.add('dragover');
    });
    chartDropzone.addEventListener('dragleave', () => chartDropzone.classList.remove('dragover'));
    chartDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      chartDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        ingestSpreadsheetFile(e.dataTransfer.files[0]);
      }
    });
    chartFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        ingestSpreadsheetFile(e.target.files[0]);
      }
    });
  }

  // Live Stage Drag & Drop Support for CSV/Excel & Images (including Google Images)
  [liveStageEl, fullscreenStageEl].forEach(stage => {
    if (!stage) return;
    stage.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        const name = file.name.toLowerCase();
        if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.tsv') || file.type.includes('csv') || file.type.includes('spreadsheet')) {
          ingestSpreadsheetFile(file);
          return;
        } else if (name.endsWith('.pptx')) {
          openDeckImporter();
          parsePptxDeckFile(file);
          return;
        }
      }
      handleDroppedMedia(e.dataTransfer, null);
    });
  });

  // Modal inputs dynamic live preview
  ['input', 'change'].forEach(evt => {
    document.getElementById('chart-csv-raw').addEventListener(evt, updateChartModalPreview);
    document.getElementById('chart-col-label').addEventListener(evt, updateChartModalPreview);
    document.getElementById('chart-col-value').addEventListener(evt, updateChartModalPreview);
    document.getElementById('chart-style-select').addEventListener(evt, updateChartModalPreview);
    document.getElementById('chart-unit-suffix').addEventListener(evt, updateChartModalPreview);
    document.getElementById('chart-accessible-caption').addEventListener(evt, updateChartModalPreview);
  });

  // Modal View Toggle Buttons
  const btnPrevChart = document.getElementById('btn-preview-chart-view');
  const btnPrevTable = document.getElementById('btn-preview-table-view');
  if (btnPrevChart && btnPrevTable) {
    btnPrevChart.addEventListener('click', () => {
      chartPreviewMode = 'chart';
      btnPrevChart.classList.add('active');
      btnPrevTable.classList.remove('active');
      updateChartModalPreview();
    });
    btnPrevTable.addEventListener('click', () => {
      chartPreviewMode = 'table';
      btnPrevTable.classList.add('active');
      btnPrevChart.classList.remove('active');
      updateChartModalPreview();
    });
  }

  // Existing Deck Ingestion & Modernization Listeners
  const btnCloseDeck = document.getElementById('btn-close-deck-importer');
  if (btnCloseDeck) btnCloseDeck.addEventListener('click', closeDeckImporter);

  const btnCancelDeck = document.getElementById('btn-cancel-deck-importer');
  if (btnCancelDeck) btnCancelDeck.addEventListener('click', closeDeckImporter);

  const btnDeckNext = document.getElementById('btn-deck-next');
  if (btnDeckNext) btnDeckNext.addEventListener('click', () => {
    setDeckImporterStep(deckImporterState.currentStep + 1);
  });

  const btnDeckBack = document.getElementById('btn-deck-back');
  if (btnDeckBack) btnDeckBack.addEventListener('click', () => {
    setDeckImporterStep(deckImporterState.currentStep - 1);
  });

  const btnDeckFinalize = document.getElementById('btn-deck-finalize');
  if (btnDeckFinalize) btnDeckFinalize.addEventListener('click', finalizeDeckConversion);

  const btnSampleDeck = document.getElementById('btn-load-sample-deck');
  if (btnSampleDeck) btnSampleDeck.addEventListener('click', loadSampleLegacyDeck);

  for (let i = 1; i <= 3; i++) {
    const tab = document.getElementById(`deck-step-tab-${i}`);
    if (tab) {
      tab.addEventListener('click', () => {
        if (i === 1 || deckImporterState.slides.length > 0) {
          setDeckImporterStep(i);
        }
      });
    }
  }

  // Deck File Dropzone & Picker
  const deckDropzone = document.getElementById('deck-file-dropzone');
  const deckFileInput = document.getElementById('deck-file-input');
  if (deckDropzone && deckFileInput) {
    deckDropzone.addEventListener('click', () => deckFileInput.click());
    deckDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        deckFileInput.click();
      }
    });
    deckDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      deckDropzone.classList.add('dragover');
    });
    deckDropzone.addEventListener('dragleave', () => deckDropzone.classList.remove('dragover'));
    deckDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      deckDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        parsePptxDeckFile(e.dataTransfer.files[0]);
      }
    });
    deckFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        parsePptxDeckFile(e.target.files[0]);
      }
    });
  }

  // Triage Batch Exclude / Keep All Actions
  const btnExcludeAll = document.getElementById('btn-deck-exclude-all');
  if (btnExcludeAll) {
    btnExcludeAll.addEventListener('click', () => {
      deckImporterState.graphics.forEach(g => {
        g.keep = false;
        g.altText = '';
      });
      renderGraphicsTriage();
    });
  }

  const btnSelectAll = document.getElementById('btn-deck-select-all');
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      deckImporterState.graphics.forEach(g => {
        g.keep = true;
      });
      renderGraphicsTriage();
    });
  }

  // Live Slide Interactive View Toggle Delegation (Chart View vs. WCAG Data Table)
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-slide-chart-mode"]');
    if (toggleBtn) {
      const mode = toggleBtn.dataset.mode || 'chart';
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.chartViewMode = mode;
        renderCurrentSlide();
      }
    }
  });

  // Tennessee Map Preset Selector
  if (selectMapPreset) {
    selectMapPreset.addEventListener('change', () => {
      const pKey = selectMapPreset.value;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map' && TN_MAP_PRESETS[pKey]) {
        slide.mapPreset = pKey;
        slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS[pKey]));
        if (pKey === 'fy26-jobs') {
          slide.title = "FY26 Grand Division Capital Investments & Job Creation";
          inputTitle.value = slide.title;
        } else if (pKey === 'bwc-dispute') {
          slide.title = "Workers' Compensation Dispute Resolution & Settlement Performance";
          inputTitle.value = slide.title;
        } else if (pKey === 'county-distress') {
          slide.title = "Targeted Community Opportunity Grants Across Tennessee";
          inputTitle.value = slide.title;
        }
        loadSlideIntoForm(currentSlideIndex);
        renderCurrentSlide();
        markDirty();
      }
    });
  }

  // Tennessee Map Presentation Mode Selector
  if (selectMapMode) {
    selectMapMode.addEventListener('change', () => {
      const mode = selectMapMode.value;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map') {
        if (!slide.mapData) slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
        slide.mapData.mapMode = mode;
        loadSlideIntoForm(currentSlideIndex);
        renderCurrentSlide();
        markDirty();
      }
    });
  }

  // Tennessee Map County Picker (County by County mode)
  if (selectMapCountyPicker) {
    selectMapCountyPicker.addEventListener('change', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map') {
        if (!slide.mapData) slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
        slide.mapData.selectedCounty = selectMapCountyPicker.value;
        renderCurrentSlide();
        markDirty();
      }
    });
  }

  // Tennessee Map Form Input Event Listeners
  [inputMapCaption, inputMapPrefix, inputMapUnit, inputMapWestVal, inputMapWestSub, inputMapMidVal, inputMapMidSub, inputMapEastVal, inputMapEastSub, inputMapStatewideVal, inputMapStatewideSub, inputMapCustomTitle, inputMapCustomMetric].forEach(el => {
    if (el) el.addEventListener('input', () => {
      updateSlideFromForm();
      renderCurrentSlide();
      markDirty();
    });
  });

  if (btnResetMapSel) {
    btnResetMapSel.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.mapData) {
        slide.mapData.selectedDivision = 'all';
        renderCurrentSlide();
        syncWithPresenterConsole();
      }
    });
  }

  // Strategic Pillars Sample Preset Loader
  const btnLoadPillars = document.getElementById('btn-load-pillars-preset');
  if (btnLoadPillars) {
    btnLoadPillars.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (!slide) return;
      const count = slide.layout === 'layout-pillars-4' ? 4 : 3;
      const presets = TN_PILLAR_PRESETS[count];
      slide.body = presets.map(p => `${p.title} | ${p.desc}`).join('\n');
      inputBody.value = slide.body;
      updateSlideFromForm();
    });
  }

  // Process Workflow Sample Preset Loader
  const btnLoadProcess = document.getElementById('btn-load-process-preset');
  if (btnLoadProcess) {
    btnLoadProcess.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (!slide) return;
      slide.body = TN_PROCESS_PRESETS.map((p, i) => `${i + 1}. ${p.title} | ${p.desc}`).join('\n');
      inputBody.value = slide.body;
      updateSlideFromForm();
    });
  }

  // Milestone Timeline Sample Preset Loader
  const btnLoadTimeline = document.getElementById('btn-load-timeline-preset');
  if (btnLoadTimeline) {
    btnLoadTimeline.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (!slide) return;
      slide.body = TN_TIMELINE_PRESETS.map(m => `[${m.date}] ${m.title} | ${m.desc}`).join('\n');
      inputBody.value = slide.body;
      updateSlideFromForm();
    });
  }

  // Policy Comparison Sample Preset Loader
  const btnLoadComparison = document.getElementById('btn-load-comparison-preset');
  if (btnLoadComparison) {
    btnLoadComparison.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (!slide) return;
      const leftText = `[${TN_COMPARISON_PRESETS.left.badge}] ${TN_COMPARISON_PRESETS.left.title}\n` + TN_COMPARISON_PRESETS.left.bullets.map(b => `• ${b}`).join('\n');
      const rightText = `[${TN_COMPARISON_PRESETS.right.badge}] ${TN_COMPARISON_PRESETS.right.title}\n` + TN_COMPARISON_PRESETS.right.bullets.map(b => `• ${b}`).join('\n');
      slide.body = `${leftText}\n===\n${rightText}`;
      inputBody.value = slide.body;
      updateSlideFromForm();
    });
  }

  // Executive Agenda Sample Preset Loader
  const btnLoadAgenda = document.getElementById('btn-load-agenda-preset');
  if (btnLoadAgenda) {
    btnLoadAgenda.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (!slide) return;
      slide.body = TN_AGENDA_PRESETS.map(a => `${a.num}. ${a.title} | ${a.desc}`).join('\n');
      inputBody.value = slide.body;
      updateSlideFromForm();
    });
  }

  // Section Break Sample Preset Loader
  const btnLoadSectionBreak = document.getElementById('btn-load-section-break-preset');
  if (btnLoadSectionBreak) {
    btnLoadSectionBreak.addEventListener('click', () => {
      const slide = appData.slides[currentSlideIndex];
      if (!slide) return;
      slide.kicker = 'SECTION 02 • STRATEGIC PRIORITIES';
      slide.title = 'Statewide Strategic Modernization & Governance';
      slide.body = 'Comprehensive alignment of civil infrastructure, digital services, and legislative accountability across all 95 Tennessee counties.';
      inputKicker.value = slide.kicker;
      inputTitle.value = slide.title;
      inputBody.value = slide.body;
      updateSlideFromForm();
    });
  }

  // Live Slide Interactive Tennessee Map Delegation (Map vs Table, Mode Switch, Division Filter, County Selection)
  document.addEventListener('click', (e) => {
    // Launch Fullscreen Video Theater from slide stage click
    const videoLaunchBtn = e.target.closest('[data-action="launch-video-theater"]');
    if (videoLaunchBtn) {
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.videoUrl) {
        launchFullscreenVideoTheater(slide);
      }
      return;
    }

    // Toggle Map vs WCAG Table
    const toggleMapBtn = e.target.closest('[data-action="toggle-slide-map-mode"]');
    if (toggleMapBtn) {
      const mode = toggleMapBtn.dataset.mode || 'map';
      const slide = appData.slides[currentSlideIndex];
      if (slide) {
        slide.mapViewMode = mode;
        renderCurrentSlide();
      }
      return;
    }

    // Switch Map Presentation Mode from Stage Header Pills
    const setModeBtn = e.target.closest('[data-action="set-map-mode"]');
    if (setModeBtn) {
      const mode = setModeBtn.dataset.mode;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map' && mode) {
        if (!slide.mapData) slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
        slide.mapData.mapMode = mode;
        loadSlideIntoForm(currentSlideIndex);
        renderCurrentSlide();
        markDirty();
      }
      return;
    }

    // Select / Filter Grand Division (from SVG path, label, or KPI card)
    const divBtn = e.target.closest('[data-action="select-map-division"]');
    if (divBtn) {
      const divKey = divBtn.dataset.division;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map') {
        if (!slide.mapData) slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
        slide.mapData.selectedDivision = (slide.mapData.selectedDivision === divKey) ? 'all' : divKey;
        renderCurrentSlide();
        syncWithPresenterConsole();
      }
      return;
    }

    // Reset Grand Division Filter to Statewide
    const resetDivBtn = e.target.closest('[data-action="reset-map-division"]');
    if (resetDivBtn) {
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map') {
        if (slide.mapData) slide.mapData.selectedDivision = 'all';
        renderCurrentSlide();
        syncWithPresenterConsole();
      }
      return;
    }

    // Select County (in County-by-County mode)
    const countyBtn = e.target.closest('[data-action="select-county"]');
    if (countyBtn) {
      const county = countyBtn.dataset.county;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map' && county) {
        if (!slide.mapData) slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
        slide.mapData.selectedCounty = (slide.mapData.selectedCounty === county) ? '' : county;
        if (selectMapCountyPicker) selectMapCountyPicker.value = slide.mapData.selectedCounty;
        renderCurrentSlide();
        markDirty();
      }
      return;
    }

    // Toggle County in Custom Group (in Custom mode)
    const toggleCountyBtn = e.target.closest('[data-action="toggle-custom-county"]');
    if (toggleCountyBtn) {
      const county = toggleCountyBtn.dataset.county;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map' && county) {
        if (!slide.mapData) slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
        if (!Array.isArray(slide.mapData.customCounties)) slide.mapData.customCounties = [];
        const idx = slide.mapData.customCounties.indexOf(county);
        if (idx >= 0) {
          slide.mapData.customCounties.splice(idx, 1);
        } else {
          slide.mapData.customCounties.push(county);
        }
        if (badgeCustomGroupCounter) badgeCustomGroupCounter.textContent = `${slide.mapData.customCounties.length} / 95`;
        renderCurrentSlide();
        markDirty();
      }
      return;
    }

    // Quick Cluster Preset Selection
    const clusterBtn = e.target.closest('[data-cluster]');
    if (clusterBtn) {
      const clusterKey = clusterBtn.dataset.cluster;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.layout === 'layout-tn-map') {
        if (!slide.mapData) slide.mapData = JSON.parse(JSON.stringify(TN_MAP_PRESETS['fy26-jobs']));
        if (clusterKey === 'all') {
          slide.mapData.customCounties = (window.TN_COUNTIES_DATA || []).map(c => c.name);
          slide.mapData.customTitle = "All 95 Tennessee Counties";
        } else if (clusterKey === 'clear') {
          slide.mapData.customCounties = [];
          slide.mapData.customTitle = "Custom Regional Group";
        } else if (window.TN_COUNTY_CLUSTERS && window.TN_COUNTY_CLUSTERS[clusterKey]) {
          const cluster = window.TN_COUNTY_CLUSTERS[clusterKey];
          slide.mapData.customCounties = [...cluster.counties];
          slide.mapData.customTitle = cluster.name;
        }
        if (inputMapCustomTitle) inputMapCustomTitle.value = slide.mapData.customTitle || '';
        if (badgeCustomGroupCounter) badgeCustomGroupCounter.textContent = `${(slide.mapData.customCounties || []).length} / 95`;
        renderCurrentSlide();
        markDirty();
      }
      return;
    }
  });

  // Interactive Map Tooltip Hover and Focus (Metro Nodes, Grand Divisions, County Paths)
  document.addEventListener('mouseover', handleMapTooltip);
  document.addEventListener('mouseout', handleMapTooltipExit);
  document.addEventListener('focusin', handleMapTooltip);
  document.addEventListener('focusout', handleMapTooltipExit);

  function handleMapTooltip(e) {
    const metroNode = e.target.closest('.tn-metro-group');
    const divPath = e.target.closest('.tn-division-path');
    const countyPath = e.target.closest('.tn-county-path');
    const tooltip = document.getElementById('tn-map-hover-tooltip');
    if (!tooltip) return;

    if (metroNode) {
      const metro = metroNode.dataset.metro || 'Metro Hub';
      const detail = metroNode.dataset.detail || '';
      tooltip.innerHTML = `
        <div style="font-weight: 700; color: #FFCC00; font-size: 0.8rem; margin-bottom: 2px;">★ ${escapeHtml(metro)}</div>
        <div style="font-size: 0.72rem; color: #E2E8F0; line-height: 1.35;">${escapeHtml(detail)}</div>
      `;
      tooltip.style.display = 'block';
    } else if (countyPath) {
      const countyName = countyPath.dataset.county;
      const fips = countyPath.dataset.fips;
      const division = countyPath.dataset.division;
      const slide = appData.slides[currentSlideIndex];
      const isCustom = slide && slide.mapData && slide.mapData.mapMode === 'custom';
      const isInGroup = isCustom && (slide.mapData.customCounties || []).includes(countyName);
      tooltip.innerHTML = `
        <div style="font-weight: 700; color: #38BDF8; font-size: 0.8rem; margin-bottom: 2px;">${escapeHtml(countyName)} County</div>
        <div style="font-size: 0.72rem; color: #FFFFFF;">${escapeHtml(division)} Grand Division • FIPS 47${escapeHtml(fips)}</div>
        ${isCustom ? `<div style="font-size: 0.7rem; color: ${isInGroup ? '#4ADE80' : '#FCA5A5'}; font-weight: 700; margin-top: 2px;">${isInGroup ? '✓ In Custom Group' : '○ Not in group (click to toggle)'}</div>` : ''}
      `;
      tooltip.style.display = 'block';
    } else if (divPath) {
      const divKey = divPath.dataset.division;
      const slide = appData.slides[currentSlideIndex];
      if (slide && slide.mapData && slide.mapData.divisions && slide.mapData.divisions[divKey]) {
        const divData = slide.mapData.divisions[divKey];
        const prefix = slide.mapData.prefix || '';
        const unit = slide.mapData.unit || '';
        tooltip.innerHTML = `
          <div style="font-weight: 700; color: #38BDF8; font-size: 0.8rem; margin-bottom: 2px;">${escapeHtml(divData.name)} (${divData.countiesCount} Counties)</div>
          <div style="font-size: 0.75rem; font-weight: 700; color: #FFFFFF;">Metric: ${prefix}${escapeHtml(divData.value)}${unit}</div>
          <div style="font-size: 0.7rem; color: #CBD5E1; margin-top: 2px;">${escapeHtml(divData.secondary || '')}</div>
          <div style="font-size: 0.68rem; color: #94A3B8; margin-top: 2px; font-style: italic;">Anchors: ${(divData.metros || []).join(', ')}</div>
        `;
        tooltip.style.display = 'block';
      }
    }
  }

  function handleMapTooltipExit(e) {
    if (e.target.closest('.tn-metro-group') || e.target.closest('.tn-division-path') || e.target.closest('.tn-county-path')) {
      const tooltip = document.getElementById('tn-map-hover-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }
  }

  // Export Actions
  const btnExpFolder = document.getElementById('btn-export-folder');
  if (btnExpFolder) btnExpFolder.addEventListener('click', saveToProjectFolder);
  const btnExpZip = document.getElementById('btn-export-zip');
  if (btnExpZip) btnExpZip.addEventListener('click', exportToZipBundle);

  const btnSaveProjFolder = document.getElementById('btn-save-project-folder');
  if (btnSaveProjFolder) btnSaveProjFolder.addEventListener('click', saveToProjectFolder);

  const btnMediaBundleFolder = document.getElementById('btn-media-bundle-folder');
  if (btnMediaBundleFolder) btnMediaBundleFolder.addEventListener('click', saveToProjectFolder);
  const btnMediaBundleZip = document.getElementById('btn-media-bundle-zip');
  if (btnMediaBundleZip) btnMediaBundleZip.addEventListener('click', exportToZipBundle);

  // Revision History & Snapshots
  const btnOpenHist = document.getElementById('btn-open-history');
  if (btnOpenHist) btnOpenHist.addEventListener('click', openHistoryModal);
  const btnCloseHist = document.getElementById('btn-close-history');
  if (btnCloseHist) btnCloseHist.addEventListener('click', closeHistoryModal);
  const btnCloseHistFooter = document.getElementById('btn-close-history-footer');
  if (btnCloseHistFooter) btnCloseHistFooter.addEventListener('click', closeHistoryModal);

  const btnCreateCkpt = document.getElementById('btn-create-checkpoint');
  if (btnCreateCkpt) {
    btnCreateCkpt.addEventListener('click', () => {
      const input = document.getElementById('custom-checkpoint-name');
      const name = input ? input.value.trim() : '';
      recordSnapshot('Manual Checkpoint', name || 'User Created Snapshot');
      if (input) input.value = '';
      renderSnapshotTimeline();
    });
  }

  const btnClearHist = document.getElementById('btn-clear-history');
  if (btnClearHist) btnClearHist.addEventListener('click', clearAllSnapshots);

  const timelineList = document.getElementById('snapshot-timeline-list');
  if (timelineList) {
    timelineList.addEventListener('click', (e) => {
      const revertBtn = e.target.closest('[data-action="revert-snapshot"]');
      if (revertBtn) {
        restoreSnapshot(revertBtn.dataset.id);
        return;
      }
      const exportBtn = e.target.closest('[data-action="export-snapshot"]');
      if (exportBtn) {
        exportSnapshotJson(exportBtn.dataset.id);
        return;
      }
      const delBtn = e.target.closest('[data-action="delete-snapshot"]');
      if (delBtn) {
        deleteSnapshot(delBtn.dataset.id);
        return;
      }
    });
  }

  // Export & Accessible Document Actions
  const btnExportOutlinePdf = document.getElementById('btn-export-outline-pdf');
  if (btnExportOutlinePdf) btnExportOutlinePdf.addEventListener('click', exportOutlinePdf);

  const btnExportVisualPdf = document.getElementById('btn-export-visual-pdf');
  if (btnExportVisualPdf) btnExportVisualPdf.addEventListener('click', exportVisualSlidesPdf);

  const btnExportHandoutPdf = document.getElementById('btn-export-handout-pdf');
  if (btnExportHandoutPdf) btnExportHandoutPdf.addEventListener('click', exportSpeakerHandoutPdf);

  const btnExportOutlineText = document.getElementById('btn-export-outline-text');
  if (btnExportOutlineText) btnExportOutlineText.addEventListener('click', exportAccessibleOutline);

  const btnExportCert = document.getElementById('btn-export-cert-pdf');
  if (btnExportCert) btnExportCert.addEventListener('click', generateWcagCertificate);

  const btnExportPptx = document.getElementById('btn-export-pptx');
  if (btnExportPptx) btnExportPptx.addEventListener('click', exportToPptx);

  const btnExportPdf = document.getElementById('btn-export-pdf');
  if (btnExportPdf) btnExportPdf.addEventListener('click', exportVisualSlidesPdf);

  const btnExportOutline = document.getElementById('btn-export-outline');
  if (btnExportOutline) btnExportOutline.addEventListener('click', exportOutlinePdf);

  const btnDownloadHtml = document.getElementById('btn-download-html');
  if (btnDownloadHtml) {
    btnDownloadHtml.addEventListener('click', () => {
      downloadFileFallback(generateUpdatedHtmlFile(), 'tn-presentation.html');
    });
  }

  // Dropzone & Media
  const dropzone = document.getElementById('image-dropzone');
  const fileInput = document.getElementById('media-file-input');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
    handleDroppedMedia(e.dataTransfer, dropzone);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  });

  document.getElementById('btn-remove-image').addEventListener('click', () => {
    const slide = appData.slides[currentSlideIndex];
    if (slide) {
      slide.mediaUrl = '';
      slide.mediaAlt = '';
      inputImageUrl.value = '';
      mediaPreviewBox.style.display = 'none';
      markDirty();
      renderCurrentSlide();
      updateMediaAssetStats();
    }
  });

  // Alt-Text Modal Confirm
  document.getElementById('btn-save-alt-text').addEventListener('click', () => {
    const altText = document.getElementById('alt-text-input').value.trim();
    const isDec = document.getElementById('chk-is-decorative').checked;

    if (!isDec && altText.length === 0) {
      alert('Please enter descriptive alternative text, or check "Mark as decorative image" to ensure WCAG AA compliance.');
      return;
    }

    const slide = appData.slides[currentSlideIndex];
    if (slide && pendingImageUpload) {
      slide.mediaUrl = pendingImageUpload;
      slide.mediaAlt = isDec ? '' : altText;
      slide.isDecorative = isDec;

      inputImageUrl.value = pendingImageUpload;
      mediaPreviewImg.src = pendingImageUpload;
      mediaPreviewImg.alt = slide.mediaAlt;
      mediaPreviewBox.style.display = 'block';

      markDirty();
      renderCurrentSlide();
      updateMediaAssetStats();
    }

    document.getElementById('modal-alt-guardrail').classList.remove('active');
    pendingImageUpload = null;
  });

  // Laser & Pen Buttons
  document.getElementById('hud-laser-btn').addEventListener('click', toggleLaser);
  document.getElementById('hud-pen-btn').addEventListener('click', togglePen);
  document.getElementById('hud-clear-pen-btn').addEventListener('click', clearCurrentSlideAnnotations);

  window.addEventListener('mousemove', (e) => {
    if (isPresenting && isLaserActive) {
      laserDot.style.left = `${e.clientX}px`;
      laserDot.style.top = `${e.clientY}px`;
    }
  });

  canvasEl.addEventListener('mousedown', (e) => {
    if (!isPenActive) return;
    isDrawing = true;
    const rect = canvasEl.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!annotationsBySlide[currentSlideIndex]) {
      annotationsBySlide[currentSlideIndex] = [];
    }
    annotationsBySlide[currentSlideIndex].push({
      color: penColor,
      size: penSize,
      points: [pt]
    });
    ctx.beginPath();
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pt.x, pt.y);
  });

  canvasEl.addEventListener('mousemove', (e) => {
    if (!isDrawing || !isPenActive) return;
    const rect = canvasEl.getBoundingClientRect();
    const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const strokes = annotationsBySlide[currentSlideIndex];
    strokes[strokes.length - 1].points.push(pt);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  });

  window.addEventListener('mouseup', () => {
    isDrawing = false;
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;

    if (isVideoPlayingFullscreen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitFullscreenVideoTheater(false);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        handleVideoTheaterAdvance('forward');
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handleVideoTheaterAdvance('backward');
        return;
      }
    }

    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'f':
      case 'F':
        if (!isPresenting) enterFullscreenPresentation();
        break;
      case 'Escape':
      case 'e':
      case 'E':
        if (isPresenting) exitFullscreenPresentation();
        break;
      case 'l':
      case 'L':
        if (isPresenting) toggleLaser();
        break;
      case 'p':
      case 'P':
        if (isPresenting) togglePen();
        break;
      case 'o':
      case 'O':
        e.preventDefault();
        openPresenterConsole();
        break;
      case 'b':
      case 'B':
        if (isPresenting) {
          e.preventDefault();
          toggleBlackScreen();
        }
        break;
      case 's':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          saveToFileSystem();
        }
        break;
    }
  });

  window.addEventListener('resize', () => {
    rescalePresentationViewports();
    if (isPresenting) resizeAnnotationCanvas();
  });
  document.addEventListener('fullscreenchange', () => {
    rescalePresentationViewports();
    if (isPresenting) resizeAnnotationCanvas();
  });
}

function openAltGuardrailWithImage(imageSource, defaultAlt = '') {
  pendingImageUpload = imageSource;
  const altPreview = document.getElementById('alt-modal-preview');
  if (altPreview) altPreview.src = imageSource;
  const altInput = document.getElementById('alt-text-input');
  if (altInput) altInput.value = defaultAlt || '';
  const chkDec = document.getElementById('chk-is-decorative');
  if (chkDec) chkDec.checked = false;
  const modal = document.getElementById('modal-alt-guardrail');
  if (modal) modal.classList.add('active');
}

function handleImageFile(file, defaultAlt = '') {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    alert('Please upload an image file (PNG, JPG, SVG, WebP, AVIF).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    openAltGuardrailWithImage(evt.target.result, defaultAlt || file.name.replace(/\.[^.]+$/, ''));
  };
  reader.readAsDataURL(file);
}

function isLikelyImageUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  if (s.startsWith('data:image/') || s.startsWith('blob:')) return true;
  if (/^https?:\/\/.*\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(s)) return true;
  if (/^https?:\/\/.*(?:gstatic\.com|googleusercontent\.com|unsplash\.com|wikimedia\.org|imgur\.com)/i.test(s)) return true;
  return /^https?:\/\//i.test(s);
}

async function extractImageFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return null;

  // 1. Local files or synthetic browser file objects
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (file && file.type && file.type.startsWith('image/')) {
        return {
          type: 'file',
          file: file,
          alt: file.name.replace(/\.[^.]+$/, '')
        };
      }
    }
  }

  // 2. dataTransfer.items file objects
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item && item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          return {
            type: 'file',
            file: file,
            alt: file.name.replace(/\.[^.]+$/, '')
          };
        }
      }
    }
  }

  // 3. HTML Payload (Standard for Google Images and web page images)
  const html = dataTransfer.getData('text/html');
  if (html && html.trim().length > 0) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Check for Google Images redirect link containing original high-res imgurl:
      // e.g. <a href="https://www.google.com/imgres?imgurl=https%3A%2F%2F...&imgrefurl=..."><img src="..."></a>
      const links = doc.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const imgurlMatch = href.match(/[?&]imgurl=([^&]+)/i);
        if (imgurlMatch && imgurlMatch[1]) {
          const highResUrl = decodeURIComponent(imgurlMatch[1]);
          const innerImg = link.querySelector('img');
          const alt = (innerImg && (innerImg.alt || innerImg.title)) ? (innerImg.alt || innerImg.title) : '';
          return {
            type: 'url',
            url: highResUrl,
            fallbackUrl: innerImg ? innerImg.src : null,
            alt: alt.trim()
          };
        }
      }

      // Check for direct <img> in dropped HTML
      const img = doc.querySelector('img');
      if (img && img.src && img.src.trim().length > 0) {
        return {
          type: 'url',
          url: img.src.trim(),
          alt: (img.alt || img.title || '').trim()
        };
      }
    } catch (err) {
      console.warn('Could not parse dropped HTML snippet:', err);
    }
  }

  // 4. URI-List Payload (Standard URL drag format)
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList && uriList.trim().length > 0) {
    const lines = uriList.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    for (const line of lines) {
      const imgurlMatch = line.match(/[?&]imgurl=([^&]+)/i);
      if (imgurlMatch && imgurlMatch[1]) {
        return {
          type: 'url',
          url: decodeURIComponent(imgurlMatch[1]),
          alt: ''
        };
      }
      if (isLikelyImageUrl(line)) {
        return {
          type: 'url',
          url: line,
          alt: ''
        };
      }
    }
  }

  // 5. Plain Text Payload
  const plainText = dataTransfer.getData('text/plain');
  if (plainText && plainText.trim().length > 0) {
    const text = plainText.trim();
    const imgurlMatch = text.match(/[?&]imgurl=([^&]+)/i);
    if (imgurlMatch && imgurlMatch[1]) {
      return {
        type: 'url',
        url: decodeURIComponent(imgurlMatch[1]),
        alt: ''
      };
    }
    if (isLikelyImageUrl(text)) {
      return {
        type: 'url',
        url: text,
        alt: ''
      };
    }
  }

  return null;
}

async function handleImageUrl(url, defaultAlt = '', fallbackUrl = null) {
  if (!url || typeof url !== 'string') return;
  url = url.trim();

  // If already a base64 data URI, launch guardrail directly
  if (url.startsWith('data:image/')) {
    openAltGuardrailWithImage(url, defaultAlt);
    return;
  }

  let resolvedImage = null;

  // Attempt 1: Fetch as blob to preserve original bytes as offline data URL
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith('image/')) {
        resolvedImage = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (err) {
    // CORS or network policy prevented direct fetch
  }

  // Attempt 2: If fetch was blocked by CORS, try canvas conversion via HTML Image
  if (!resolvedImage) {
    resolvedImage = await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (taintErr) {
          // Canvas tainted due to CORS - fall back to direct URL string
          resolve(url);
        }
      };
      img.onerror = () => {
        // If highResUrl failed (e.g. 403 hotlink protection), try fallback thumbnail url
        if (fallbackUrl && fallbackUrl !== url) {
          const fbImg = new Image();
          fbImg.onload = () => resolve(fallbackUrl);
          fbImg.onerror = () => resolve(null);
          fbImg.src = fallbackUrl;
        } else {
          resolve(null);
        }
      };
      img.src = url;
    });
  }

  // Use converted data URL, fallback thumbnail, or direct URL string
  const finalSrc = resolvedImage || fallbackUrl || url;
  if (finalSrc) {
    openAltGuardrailWithImage(finalSrc, defaultAlt);
  } else {
    alert('Could not load the dropped image. The external server may restrict direct hotlinking.');
  }
}

async function handleDroppedMedia(dataTransfer, targetDropzoneEl = null) {
  if (targetDropzoneEl) {
    targetDropzoneEl.classList.add('processing');
  }

  try {
    const extracted = await extractImageFromDataTransfer(dataTransfer);
    if (!extracted) {
      alert('No photo found in dropped content. Please drop an image file or drag an image directly from Google Images or a web page.');
      return;
    }

    if (extracted.type === 'file') {
      handleImageFile(extracted.file, extracted.alt);
    } else if (extracted.type === 'url') {
      await handleImageUrl(extracted.url, extracted.alt, extracted.fallbackUrl);
    }
  } finally {
    if (targetDropzoneEl) {
      targetDropzoneEl.classList.remove('processing');
    }
  }
}

init();
