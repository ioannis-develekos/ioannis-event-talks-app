/**
 * BigQuery Release Notes & Multi-Platform Social Broadcaster - Client Application
 */

class ReleaseNotesApp {
  constructor() {
    this.entries = [];
    this.totalUpdates = 0;
    this.selectedItemIds = new Set();
    this.starredItemIds = new Set(JSON.parse(localStorage.getItem("bq_starred_items") || "[]"));
    this.collapsedDateGroups = new Set();
    this.currentCategory = "all";
    this.currentTimeframe = "all"; // 'all', '7d', '30d', '90d', 'starred'
    this.currentPlatform = "twitter"; // 'twitter', 'facebook', 'linkedin', 'bluesky'
    this.searchQuery = "";
    this.isLoading = false;
    this.focusedCardIndex = -1;

    // Track visit timestamp for "NEW" badges
    this.lastVisitTimestamp = parseInt(localStorage.getItem("bq_last_visit_time") || "0", 10);
    localStorage.setItem("bq_last_visit_time", Date.now().toString());

    // DOM Element References
    this.dom = {
      entriesList: document.getElementById("entries-list"),
      loadingState: document.getElementById("loading-state"),
      errorState: document.getElementById("error-state"),
      errorMessage: document.getElementById("error-message"),
      emptyState: document.getElementById("empty-state"),
      refreshBtn: document.getElementById("refresh-btn"),
      searchInput: document.getElementById("search-input"),
      clearSearchBtn: document.getElementById("clear-search-btn"),
      searchSummaryBar: document.getElementById("search-summary-bar"),
      searchSummaryText: document.getElementById("search-summary-text"),
      resetSearchSummaryBtn: document.getElementById("reset-search-summary-btn"),
      categoryFilters: document.getElementById("category-filters"),
      timeframeFilters: document.getElementById("timeframe-filters"),
      countStarred: document.getElementById("count-starred"),
      totalReleasesCount: document.getElementById("total-releases-count"),
      totalUpdatesCount: document.getElementById("total-updates-count"),
      lastUpdatedText: document.getElementById("last-updated-text"),
      selectionBar: document.getElementById("selection-bar"),
      selectedCount: document.getElementById("selected-count"),
      tweetSelectedBtn: document.getElementById("tweet-selected-btn"),
      clearSelectionBtn: document.getElementById("clear-selection-btn"),
      tweetModal: document.getElementById("tweet-modal"),
      modalTitle: document.getElementById("modal-title"),
      closeModalBtn: document.getElementById("close-modal-btn"),
      tweetTextarea: document.getElementById("tweet-textarea"),
      charCount: document.getElementById("char-count"),
      charMaxLimit: document.getElementById("char-max-limit"),
      charCounterContainer: document.getElementById("char-counter-container"),
      tweetPreviewText: document.getElementById("tweet-preview-text"),
      previewAvatar: document.getElementById("preview-avatar"),
      previewName: document.getElementById("preview-name"),
      previewHandle: document.getElementById("preview-handle"),
      postTweetBtn: document.getElementById("post-tweet-btn"),
      postFbBtn: document.getElementById("post-fb-btn"),
      postLinkedinBtn: document.getElementById("post-linkedin-btn"),
      postBlueskyBtn: document.getElementById("post-bluesky-btn"),
      copyTweetBtn: document.getElementById("copy-tweet-btn"),
      themeToggleBtn: document.getElementById("theme-toggle-btn"),
      toggleCollapseAllBtn: document.getElementById("toggle-collapse-all-btn"),
      collapseIcon: document.getElementById("collapse-icon"),
      shortcutsHelpBtn: document.getElementById("shortcuts-help-btn"),
      shortcutsModal: document.getElementById("shortcuts-modal"),
      closeShortcutsModalBtn: document.getElementById("close-shortcuts-modal-btn"),
      closeShortcutsModalBottomBtn: document.getElementById("close-shortcuts-modal-bottom-btn"),
      ollamaHelpModal: document.getElementById("ollama-help-modal"),
      closeOllamaHelpBtn: document.getElementById("close-ollama-help-btn"),
      closeOllamaHelpBottomBtn: document.getElementById("close-ollama-help-bottom-btn"),
      checkOllamaBtn: document.getElementById("check-ollama-btn"),
      backToTopBtn: document.getElementById("back-to-top-btn"),
      offlineBanner: document.getElementById("offline-banner"),
      exportCsvBtn: document.getElementById("export-csv-btn"),
      exportSelectedCsvBtn: document.getElementById("export-selected-csv-btn"),
      toastContainer: document.getElementById("toast-container"),
      // AI Assistant DOM elements
      aiStatusBadge: document.getElementById("ai-status-badge"),
      aiModelWrap: document.getElementById("ai-model-wrap"),
      aiModelSelect: document.getElementById("ai-model-select"),
      aiCustomPromptWrap: document.getElementById("ai-custom-prompt-wrap"),
      aiCustomPromptInput: document.getElementById("ai-custom-prompt-input"),
      aiGenerateBtn: document.getElementById("ai-generate-btn"),
      aiRevertBtn: document.getElementById("ai-revert-btn"),
    };

    // AI Assistant State
    this.aiSelectedStyle = "viral";
    this.aiOriginalText = "";
    this.aiConnected = false;
    this.aiModel = "gemma4:26b";
    this.isStreaming = false;

    this.init();
  }

  init() {
    this.setupTheme();
    this.setupNetworkMonitoring();
    this.setupEventListeners();
    this.updateStarredCounter();
    this.fetchReleaseNotes();
  }

  /* ========================================================================
     Network Monitoring
     ======================================================================== */
  setupNetworkMonitoring() {
    const updateOnlineStatus = () => {
      if (!navigator.onLine) {
        if (this.dom.offlineBanner) this.dom.offlineBanner.style.display = "flex";
      } else {
        if (this.dom.offlineBanner) this.dom.offlineBanner.style.display = "none";
      }
    };
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();
  }

  /* ========================================================================
     Theme Management
     ======================================================================== */
  setupTheme() {
    const savedTheme = localStorage.getItem("bq_rn_theme") || "theme-light";
    if (document.body) {
      document.body.className = savedTheme;
    }
  }

  toggleTheme() {
    const isDark = document.body.classList.contains("theme-dark");
    const newTheme = isDark ? "theme-light" : "theme-dark";
    document.body.className = newTheme;
    localStorage.setItem("bq_rn_theme", newTheme);
    this.showToast(`Switched to ${isDark ? "Light" : "Dark"} mode`, "info");
  }

  /* ========================================================================
     Event Listeners
     ======================================================================== */
  setupEventListeners() {
    if (this.dom.refreshBtn) {
      this.dom.refreshBtn.addEventListener("click", () => this.refreshFeed(true));
    }
    if (this.dom.exportCsvBtn) {
      this.dom.exportCsvBtn.addEventListener("click", () => this.exportToCSV(false));
    }
    if (this.dom.exportSelectedCsvBtn) {
      this.dom.exportSelectedCsvBtn.addEventListener("click", () => this.exportToCSV(true));
    }
    if (this.dom.themeToggleBtn) {
      this.dom.themeToggleBtn.addEventListener("click", () => this.toggleTheme());
    }
    if (this.dom.toggleCollapseAllBtn) {
      this.dom.toggleCollapseAllBtn.addEventListener("click", () => this.toggleCollapseAll());
    }

    // Shortcuts Modal
    if (this.dom.shortcutsHelpBtn) {
      this.dom.shortcutsHelpBtn.addEventListener("click", () => this.openShortcutsModal());
    }
    if (this.dom.closeShortcutsModalBtn) {
      this.dom.closeShortcutsModalBtn.addEventListener("click", () => this.closeShortcutsModal());
    }
    if (this.dom.closeShortcutsModalBottomBtn) {
      this.dom.closeShortcutsModalBottomBtn.addEventListener("click", () => this.closeShortcutsModal());
    }

    // Ollama Help Modal
    if (this.dom.aiStatusBadge) {
      this.dom.aiStatusBadge.addEventListener("click", () => {
        if (!this.aiConnected) {
          this.openOllamaHelpModal();
        }
      });
    }
    if (this.dom.closeOllamaHelpBtn) {
      this.dom.closeOllamaHelpBtn.addEventListener("click", () => this.closeOllamaHelpModal());
    }
    if (this.dom.closeOllamaHelpBottomBtn) {
      this.dom.closeOllamaHelpBottomBtn.addEventListener("click", () => this.closeOllamaHelpModal());
    }
    if (this.dom.checkOllamaBtn) {
      this.dom.checkOllamaBtn.addEventListener("click", async () => {
        await this.checkAiStatus();
        if (this.aiConnected) {
          this.closeOllamaHelpModal();
          this.showToast(`Connected to Ollama (${this.aiModel})! 🎉`, "success");
        } else {
          this.showToast("Still offline. Make sure 'ollama serve' is running in your terminal.", "error");
        }
      });
    }

    // Copy command buttons
    document.querySelectorAll(".btn-copy-code").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-copy");
        if (code) {
          await this.copyToClipboard(code);
          const originalText = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = originalText), 2000);
        }
      });
    });

    // Search Input
    if (this.dom.searchInput) {
      let searchDebounce;
      this.dom.searchInput.addEventListener("input", (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          this.searchQuery = e.target.value.trim().toLowerCase();
          if (this.dom.clearSearchBtn) {
            this.dom.clearSearchBtn.style.display = this.searchQuery ? "block" : "none";
          }
          this.render();
        }, 150);
      });
    }

    if (this.dom.clearSearchBtn) {
      this.dom.clearSearchBtn.addEventListener("click", () => {
        if (this.dom.searchInput) {
          this.dom.searchInput.value = "";
          this.dom.searchInput.focus();
        }
        this.searchQuery = "";
        this.dom.clearSearchBtn.style.display = "none";
        this.render();
      });
    }

    if (this.dom.resetSearchSummaryBtn) {
      this.dom.resetSearchSummaryBtn.addEventListener("click", () => this.resetFilters());
    }

    // Timeframe filters
    if (this.dom.timeframeFilters) {
      this.dom.timeframeFilters.querySelectorAll(".timeframe-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.dom.timeframeFilters.querySelectorAll(".timeframe-pill").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.currentTimeframe = btn.getAttribute("data-timeframe") || "all";
          this.render();
        });
      });
    }

    // Category filters
    if (this.dom.categoryFilters) {
      this.dom.categoryFilters.querySelectorAll(".filter-pill").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.dom.categoryFilters.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.currentCategory = btn.getAttribute("data-category") || "all";
          this.render();
        });
      });
    }

    // Selection Bar
    if (this.dom.tweetSelectedBtn) {
      this.dom.tweetSelectedBtn.addEventListener("click", () => this.openTweetModalForSelected());
    }
    if (this.dom.clearSelectionBtn) {
      this.dom.clearSelectionBtn.addEventListener("click", () => this.clearSelection());
    }

    // Modal
    if (this.dom.closeModalBtn) {
      this.dom.closeModalBtn.addEventListener("click", () => this.closeTweetModal());
    }
    if (this.dom.tweetModal) {
      this.dom.tweetModal.addEventListener("click", (e) => {
        if (e.target === this.dom.tweetModal) this.closeTweetModal();
      });
    }
    if (this.dom.tweetTextarea) {
      this.dom.tweetTextarea.addEventListener("input", () => this.updateTweetModalState());
    }

    // Platform Tab Buttons
    document.querySelectorAll(".platform-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".platform-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.currentPlatform = tab.getAttribute("data-platform") || "twitter";
        this.updatePlatformView();
      });
    });

    // AI Style Preset Buttons
    document.querySelectorAll(".btn-ai-style").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-ai-style").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.aiSelectedStyle = btn.getAttribute("data-style") || "viral";

        if (this.dom.aiCustomPromptWrap && this.dom.aiCustomPromptInput) {
          if (this.aiSelectedStyle === "custom") {
            this.dom.aiCustomPromptWrap.style.display = "block";
            this.dom.aiCustomPromptInput.focus();
          } else {
            this.dom.aiCustomPromptWrap.style.display = "none";
          }
        }
      });
    });

    // AI Actions
    if (this.dom.aiGenerateBtn) {
      this.dom.aiGenerateBtn.addEventListener("click", () => this.generateWithLocalAi());
    }
    if (this.dom.aiRevertBtn) {
      this.dom.aiRevertBtn.addEventListener("click", () => this.revertAiEdit());
    }

    // Hashtag Chips
    document.querySelectorAll(".tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const tag = chip.getAttribute("data-tag");
        if (tag) this.insertHashtag(tag);
      });
    });

    // Social Sharing in Modal
    if (this.dom.copyTweetBtn) {
      this.dom.copyTweetBtn.addEventListener("click", () => this.copyTweetText());
    }
    if (this.dom.postTweetBtn) {
      this.dom.postTweetBtn.addEventListener("click", () => this.postTweetToTwitter());
    }
    if (this.dom.postFbBtn) {
      this.dom.postFbBtn.addEventListener("click", () => this.postModalToFacebook());
    }
    if (this.dom.postLinkedinBtn) {
      this.dom.postLinkedinBtn.addEventListener("click", () => this.postModalToLinkedIn());
    }
    if (this.dom.postBlueskyBtn) {
      this.dom.postBlueskyBtn.addEventListener("click", () => this.postModalToBlueSky());
    }

    // Back to Top Button
    if (this.dom.backToTopBtn) {
      window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
          this.dom.backToTopBtn.style.display = "flex";
        } else {
          this.dom.backToTopBtn.style.display = "none";
        }
      });
      this.dom.backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    // Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
      if (this.dom.tweetModal && this.dom.tweetModal.style.display !== "none") {
        if (e.key === "Escape") {
          this.closeTweetModal();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          this.publishActivePlatform();
        }
        return;
      }

      if (this.dom.shortcutsModal && this.dom.shortcutsModal.style.display !== "none") {
        if (e.key === "Escape") this.closeShortcutsModal();
        return;
      }

      if (this.dom.ollamaHelpModal && this.dom.ollamaHelpModal.style.display !== "none") {
        if (e.key === "Escape") this.closeOllamaHelpModal();
        return;
      }

      if (document.activeElement === this.dom.searchInput) {
        if (e.key === "Escape") {
          this.dom.searchInput.blur();
        }
        return;
      }

      if (e.key === "/") {
        if (this.dom.searchInput) {
          e.preventDefault();
          this.dom.searchInput.focus();
          this.dom.searchInput.select();
        }
      } else if (e.key === "r" || e.key === "R") {
        this.refreshFeed(true);
      } else if (e.key === "?") {
        this.openShortcutsModal();
      } else if (e.key === "j" || e.key === "J") {
        this.navigateCards(1);
      } else if (e.key === "k" || e.key === "K") {
        this.navigateCards(-1);
      } else if (e.key === "x" || e.key === "X") {
        this.toggleFocusedCardSelection();
      } else if (e.key === "s" || e.key === "S") {
        this.toggleFocusedCardStar();
      } else if (e.key === "t" || e.key === "T") {
        this.openComposerForFocusedCard("twitter");
      } else if (e.key === "f" || e.key === "F") {
        this.openComposerForFocusedCard("facebook");
      }
    });
  }

  /* ========================================================================
     Keyboard Navigation Helpers
     ======================================================================== */
  navigateCards(direction) {
    const cards = Array.from(document.querySelectorAll(".update-card"));
    if (!cards.length) return;

    this.focusedCardIndex += direction;
    if (this.focusedCardIndex < 0) this.focusedCardIndex = 0;
    if (this.focusedCardIndex >= cards.length) this.focusedCardIndex = cards.length - 1;

    cards.forEach((c, idx) => {
      c.classList.toggle("keyboard-focused", idx === this.focusedCardIndex);
    });

    const targetCard = cards[this.focusedCardIndex];
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  getFocusedItem() {
    const cards = Array.from(document.querySelectorAll(".update-card"));
    const card = cards[this.focusedCardIndex];
    if (!card) return null;
    const itemId = card.getAttribute("data-item-id");
    return this.findItemById(itemId);
  }

  toggleFocusedCardSelection() {
    const found = this.getFocusedItem();
    if (found) {
      const isSelected = !this.selectedItemIds.has(found.item.id);
      this.toggleSelectItem(found.item.id, isSelected);
    }
  }

  toggleFocusedCardStar() {
    const found = this.getFocusedItem();
    if (found) {
      this.toggleStar(found.item.id);
    }
  }

  openComposerForFocusedCard(platform = "twitter") {
    const found = this.getFocusedItem();
    if (found) {
      this.currentPlatform = platform;
      this.openTweetModal(found.item.tweet_text);
    }
  }

  /* ========================================================================
     Modals
     ======================================================================== */
  openShortcutsModal() {
    if (this.dom.shortcutsModal) this.dom.shortcutsModal.style.display = "flex";
  }

  closeShortcutsModal() {
    if (this.dom.shortcutsModal) this.dom.shortcutsModal.style.display = "none";
  }

  openOllamaHelpModal() {
    if (this.dom.ollamaHelpModal) this.dom.ollamaHelpModal.style.display = "flex";
  }

  closeOllamaHelpModal() {
    if (this.dom.ollamaHelpModal) this.dom.ollamaHelpModal.style.display = "none";
  }

  /* ========================================================================
     Data Fetching
     ======================================================================== */
  async fetchReleaseNotes(forceRefresh = false) {
    if (this.isLoading) return;
    this.isLoading = true;

    if (this.dom.loadingState) this.dom.loadingState.style.display = "block";
    if (this.dom.errorState) this.dom.errorState.style.display = "none";
    if (this.dom.emptyState) this.dom.emptyState.style.display = "none";
    if (this.dom.entriesList) this.dom.entriesList.innerHTML = "";
    if (this.dom.refreshBtn) this.dom.refreshBtn.classList.add("loading");

    const endpoint = forceRefresh ? "/api/release-notes?refresh=1" : "/api/release-notes";

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Feed request failed with HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.status === "error") {
        throw new Error(json.message || "Failed to parse release notes feed");
      }

      // Handle both formats: json.entries or json.data.entries
      const payload = json.data || json;
      this.entries = payload.entries || json.entries || [];
      this.totalUpdates = payload.total_updates || json.total_updates || 0;

      // Update counters
      if (this.dom.totalReleasesCount) this.dom.totalReleasesCount.textContent = this.entries.length;
      if (this.dom.totalUpdatesCount) this.dom.totalUpdatesCount.textContent = this.totalUpdates;
      this.updateCategoryCounts();

      // Format updated timestamp
      const fetchedAt = payload.fetched_at || json.fetched_at;
      if (fetchedAt && this.dom.lastUpdatedText) {
        const dateObj = new Date(fetchedAt);
        this.dom.lastUpdatedText.textContent = `Updated ${dateObj.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      }

      if (this.dom.loadingState) this.dom.loadingState.style.display = "none";
      this.render();

      if (forceRefresh) {
        this.showToast("Feed refreshed live from Google Cloud!", "success");
      }
    } catch (err) {
      console.error("Error fetching release notes:", err);
      if (this.dom.loadingState) this.dom.loadingState.style.display = "none";
      if (this.dom.errorState) {
        this.dom.errorState.style.display = "block";
        if (this.dom.errorMessage) {
          this.dom.errorMessage.textContent = err.message || "Network error. Please try again.";
        }
      }
      this.showToast("Failed to load release notes feed", "error");
    } finally {
      this.isLoading = false;
      if (this.dom.loadingState) this.dom.loadingState.style.display = "none";
      if (this.dom.refreshBtn) this.dom.refreshBtn.classList.remove("loading");
    }
  }

  refreshFeed(force = true) {
    this.fetchReleaseNotes(force);
  }

  updateCategoryCounts() {
    const counts = {
      all: 0,
      feature: 0,
      change: 0,
      deprecated: 0,
      announcement: 0,
      security: 0,
      issue: 0,
    };

    for (const entry of this.entries) {
      for (const item of entry.items || []) {
        counts.all++;
        const cat = (item.category || "feature").toLowerCase();
        if (counts[cat] !== undefined) {
          counts[cat]++;
        }
      }
    }

    for (const [cat, count] of Object.entries(counts)) {
      const el = document.getElementById(`count-${cat}`);
      if (el) el.textContent = count;
    }
  }

  updateStarredCounter() {
    if (this.dom.countStarred) {
      this.dom.countStarred.textContent = this.starredItemIds.size;
    }
  }

  toggleStar(itemId) {
    if (this.starredItemIds.has(itemId)) {
      this.starredItemIds.delete(itemId);
      this.showToast("Removed from Starred", "info");
    } else {
      this.starredItemIds.add(itemId);
      this.showToast("Added to Starred! ⭐", "success");
    }
    localStorage.setItem("bq_starred_items", JSON.stringify(Array.from(this.starredItemIds)));
    this.updateStarredCounter();
    this.render();
  }

  /* ========================================================================
     Accordion Expand / Collapse
     ======================================================================== */
  toggleDateGroup(dateId) {
    if (this.collapsedDateGroups.has(dateId)) {
      this.collapsedDateGroups.delete(dateId);
    } else {
      this.collapsedDateGroups.add(dateId);
    }
    this.render();
  }

  toggleCollapseAll() {
    if (this.collapsedDateGroups.size === 0) {
      for (const entry of this.entries) {
        this.collapsedDateGroups.add(entry.id);
      }
      if (this.dom.collapseIcon) this.dom.collapseIcon.textContent = "📁";
      this.showToast("Collapsed all date sections", "info");
    } else {
      this.collapsedDateGroups.clear();
      if (this.dom.collapseIcon) this.dom.collapseIcon.textContent = "📂";
      this.showToast("Expanded all date sections", "info");
    }
    this.render();
  }

  /* ========================================================================
     Filtering & Search
     ======================================================================== */
  getFilteredEntries() {
    const query = this.searchQuery;
    const category = this.currentCategory;
    const timeframe = this.currentTimeframe;

    const now = Date.now();
    const daysLimit = {
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    }[timeframe];

    const result = [];

    for (const entry of this.entries) {
      if (daysLimit) {
        const entryTime = new Date(entry.date).getTime();
        if (!isNaN(entryTime) && now - entryTime > daysLimit) {
          continue;
        }
      }

      const matchingItems = [];
      for (const item of entry.items || []) {
        if (timeframe === "starred" && !this.starredItemIds.has(item.id)) {
          continue;
        }

        if (category !== "all") {
          const itemCat = (item.category || "").toLowerCase();
          if (itemCat !== category.toLowerCase()) {
            continue;
          }
        }

        if (query) {
          const textMatch = (item.text || "").toLowerCase().includes(query);
          const dateMatch = (entry.date || "").toLowerCase().includes(query);
          const catMatch = (item.category || "").toLowerCase().includes(query);
          if (!textMatch && !dateMatch && !catMatch) {
            continue;
          }
        }

        matchingItems.push(item);
      }

      if (matchingItems.length > 0) {
        result.push({
          ...entry,
          items: matchingItems,
        });
      }
    }

    return result;
  }

  highlightMatches(text, query) {
    if (!query || !text) return text;
    const escaped = query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.replace(regex, '<mark class="highlight">$1</mark>');
  }

  resetFilters() {
    this.searchQuery = "";
    this.currentCategory = "all";
    this.currentTimeframe = "all";
    if (this.dom.searchInput) this.dom.searchInput.value = "";
    if (this.dom.clearSearchBtn) this.dom.clearSearchBtn.style.display = "none";

    if (this.dom.categoryFilters) {
      this.dom.categoryFilters.querySelectorAll(".filter-pill").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-category") === "all");
      });
    }
    if (this.dom.timeframeFilters) {
      this.dom.timeframeFilters.querySelectorAll(".timeframe-pill").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-timeframe") === "all");
      });
    }

    this.render();
  }

  /* ========================================================================
     Rendering
     ======================================================================== */
  render() {
    if (!this.dom.entriesList) return;

    const filtered = this.getFilteredEntries();

    let totalFilteredItems = 0;
    for (const entry of filtered) {
      totalFilteredItems += entry.items.length;
    }

    // Update Search Summary Bar
    if (this.dom.searchSummaryBar && this.dom.searchSummaryText) {
      if (this.searchQuery || this.currentCategory !== "all" || this.currentTimeframe !== "all") {
        this.dom.searchSummaryBar.style.display = "flex";
        let desc = `Showing ${totalFilteredItems} updates`;
        if (this.searchQuery) desc += ` matching "${this.searchQuery}"`;
        if (this.currentCategory !== "all") desc += ` in [${this.currentCategory}]`;
        if (this.currentTimeframe !== "all") desc += ` (${this.currentTimeframe})`;
        this.dom.searchSummaryText.textContent = desc;
      } else {
        this.dom.searchSummaryBar.style.display = "none";
      }
    }

    if (!filtered.length) {
      this.dom.entriesList.innerHTML = "";
      if (this.dom.emptyState) this.dom.emptyState.style.display = "block";
      return;
    }

    if (this.dom.emptyState) this.dom.emptyState.style.display = "none";

    let html = "";
    for (const entry of filtered) {
      const isCollapsed = this.collapsedDateGroups.has(entry.id);

      html += `
        <div class="date-group" id="group-${entry.id}">
          <div class="date-group-header ${isCollapsed ? "collapsed" : ""}" data-date-id="${entry.id}">
            <div class="date-title-wrap">
              <svg class="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <h2>${this.escapeHtml(entry.date)}</h2>
              <span class="date-badge">${entry.items.length} ${entry.items.length === 1 ? "update" : "updates"}</span>
              <span class="date-toggle-chevron">▼</span>
            </div>
            <a href="${this.escapeHtml(entry.link)}" target="_blank" rel="noopener noreferrer" class="date-source-link" onclick="event.stopPropagation()">
              View on Google Docs ↗
            </a>
          </div>

          <div class="date-items ${isCollapsed ? "collapsed" : ""}">
            ${entry.items.map((item) => this.renderUpdateCard(entry, item)).join("")}
          </div>
        </div>
      `;
    }

    this.dom.entriesList.innerHTML = html;
    this.attachCardEventListeners();
    this.updateSelectionBar();
  }

  renderUpdateCard(entry, item) {
    const isSelected = this.selectedItemIds.has(item.id);
    const isStarred = this.starredItemIds.has(item.id);
    const categoryClass = (item.category || "feature").toLowerCase().replace(/[^a-z0-9]/g, "");

    const catIcon = {
      feature: "✨",
      change: "🔄",
      changed: "🔄",
      deprecated: "⚠️",
      security: "🛡️",
      issue: "🛠️",
      announcement: "📢",
    }[categoryClass] || "⚡";

    let itemHtml = item.html || this.escapeHtml(item.text);
    if (this.searchQuery) {
      itemHtml = this.highlightMatches(itemHtml, this.searchQuery);
    }

    const entryDateParsed = new Date(entry.date).getTime();
    const isRecent = !isNaN(entryDateParsed) && (Date.now() - entryDateParsed < 48 * 60 * 60 * 1000);

    return `
      <div class="update-card ${isSelected ? "selected" : ""}" data-item-id="${item.id}" id="card-${item.id}">
        <div class="update-header">
          <div class="update-header-left">
            <input type="checkbox" class="card-select-checkbox" data-item-id="${item.id}" ${isSelected ? "checked" : ""} aria-label="Select update">
            <span class="category-tag ${categoryClass}">
              <span>${catIcon}</span> ${this.escapeHtml(item.category)}
            </span>
            ${isRecent ? '<span class="badge-new-item">NEW</span>' : ""}
          </div>

          <div class="update-actions">
            <!-- Star -->
            <button class="btn-star-sm action-star-btn ${isStarred ? "starred" : ""}" data-item-id="${item.id}" title="${isStarred ? "Remove star" : "Bookmark update"}">
              ${isStarred ? "⭐" : "☆"}
            </button>

            <!-- Copy -->
            <button class="action-btn-sm action-copy-btn" data-item-id="${item.id}" title="Copy update text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>

            <!-- Facebook -->
            <button class="btn btn-fb-sm action-fb-btn" data-item-id="${item.id}" title="Share this update to Facebook">
              <svg class="fb-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              FB
            </button>

            <!-- LinkedIn -->
            <button class="btn btn-linkedin-sm action-linkedin-btn" data-item-id="${item.id}" title="Share to LinkedIn">
              <svg class="linkedin-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 0 0 1.63-1.64c0-.9-.73-1.63-1.63-1.63a1.64 1.64 0 0 0-1.64 1.63c0 .9.74 1.64 1.64 1.64m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
              </svg>
              IN
            </button>

            <!-- Twitter / X -->
            <button class="btn btn-tweet-sm action-tweet-btn" data-item-id="${item.id}" title="Post to X (Twitter)">
              <svg class="x-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Tweet
            </button>
          </div>
        </div>

        <div class="update-content">
          ${itemHtml}
        </div>
      </div>
    `;
  }

  attachCardEventListeners() {
    if (!this.dom.entriesList) return;

    // Accordion date headers
    this.dom.entriesList.querySelectorAll(".date-group-header").forEach((header) => {
      header.addEventListener("click", () => {
        const dateId = header.getAttribute("data-date-id");
        if (dateId) this.toggleDateGroup(dateId);
      });
    });

    // Checkboxes
    this.dom.entriesList.querySelectorAll(".card-select-checkbox").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const itemId = e.target.getAttribute("data-item-id");
        if (itemId) this.toggleSelectItem(itemId, e.target.checked);
      });
    });

    // Stars
    this.dom.entriesList.querySelectorAll(".action-star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-item-id");
        if (itemId) this.toggleStar(itemId);
      });
    });

    // Copy buttons
    this.dom.entriesList.querySelectorAll(".action-copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.getAttribute("data-item-id");
        const found = this.findItemById(itemId);
        if (found) {
          const formattedText = `📅 ${found.entry.date} [${found.item.category}]\n${found.item.text}\n\n🔗 Documentation: ${found.entry.link}`;
          await this.copyToClipboard(formattedText);

          const originalHTML = btn.innerHTML;
          btn.classList.add("copied");
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
          `;

          setTimeout(() => {
            btn.classList.remove("copied");
            btn.innerHTML = originalHTML;
          }, 2000);

          this.showToast("Update copied to clipboard!", "success");
        }
      });
    });

    // Facebook buttons
    this.dom.entriesList.querySelectorAll(".action-fb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-item-id");
        const found = this.findItemById(itemId);
        if (found) {
          this.postToFacebook(found.item.text, found.entry.link);
        }
      });
    });

    // LinkedIn buttons
    this.dom.entriesList.querySelectorAll(".action-linkedin-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-item-id");
        const found = this.findItemById(itemId);
        if (found) {
          this.postToLinkedIn(found.entry.link);
        }
      });
    });

    // Tweet buttons
    this.dom.entriesList.querySelectorAll(".action-tweet-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-item-id");
        const found = this.findItemById(itemId);
        if (found) {
          this.currentPlatform = "twitter";
          this.openTweetModal(found.item.tweet_text);
        }
      });
    });
  }

  /* ========================================================================
     Selection Handling
     ======================================================================== */
  toggleSelectItem(itemId, isSelected) {
    if (isSelected) {
      this.selectedItemIds.add(itemId);
    } else {
      this.selectedItemIds.delete(itemId);
    }

    const card = document.getElementById(`card-${itemId}`);
    if (card) {
      card.classList.toggle("selected", isSelected);
      const cb = card.querySelector(".card-select-checkbox");
      if (cb) cb.checked = isSelected;
    }

    this.updateSelectionBar();
  }

  clearSelection() {
    this.selectedItemIds.clear();
    if (this.dom.entriesList) {
      this.dom.entriesList.querySelectorAll(".update-card.selected").forEach((c) => c.classList.remove("selected"));
      this.dom.entriesList.querySelectorAll(".card-select-checkbox:checked").forEach((cb) => (cb.checked = false));
    }
    this.updateSelectionBar();
    this.showToast("Selection cleared", "info");
  }

  updateSelectionBar() {
    const count = this.selectedItemIds.size;
    if (this.dom.selectedCount) this.dom.selectedCount.textContent = count;

    if (this.dom.selectionBar) {
      if (count > 0) {
        this.dom.selectionBar.style.display = "block";
      } else {
        this.dom.selectionBar.style.display = "none";
      }
    }
  }

  openTweetModalForSelected() {
    if (this.selectedItemIds.size === 0) return;

    const selectedItems = [];
    for (const itemId of this.selectedItemIds) {
      const found = this.findItemById(itemId);
      if (found) selectedItems.push(found);
    }

    if (selectedItems.length === 1) {
      this.currentPlatform = "twitter";
      this.openTweetModal(selectedItems[0].item.tweet_text);
      return;
    }

    let compositeText = `⚡ Recent #BigQuery Updates (${selectedItems.length} Highlights):\n\n`;
    for (const it of selectedItems.slice(0, 3)) {
      const summary = it.item.text.length > 50 ? it.item.text.slice(0, 47) + "..." : it.item.text;
      compositeText += `• [${it.item.category}] ${summary}\n`;
    }
    compositeText += `\n🔗 https://cloud.google.com/bigquery/docs/release-notes\n#GoogleCloud #DataEngineering`;

    this.currentPlatform = "twitter";
    this.openTweetModal(compositeText);
  }

  /* ========================================================================
     Composer Modal & Social Publishing
     ======================================================================== */
  openTweetModal(initialText) {
    this.aiOriginalText = initialText || "";
    if (this.dom.tweetTextarea) this.dom.tweetTextarea.value = initialText || "";
    if (this.dom.tweetModal) this.dom.tweetModal.style.display = "flex";
    if (this.dom.aiRevertBtn) this.dom.aiRevertBtn.style.display = "none";
    this.updatePlatformView();
    this.updateTweetModalState();
    this.checkAiStatus();
    if (this.dom.tweetTextarea) this.dom.tweetTextarea.focus();
  }

  updatePlatformView() {
    const limits = {
      twitter: 280,
      bluesky: 300,
      linkedin: 3000,
      facebook: 5000,
    };
    const maxLimit = limits[this.currentPlatform] || 280;
    if (this.dom.charMaxLimit) this.dom.charMaxLimit.textContent = maxLimit;

    if (this.dom.previewAvatar && this.dom.previewName && this.dom.previewHandle) {
      if (this.currentPlatform === "twitter") {
        this.dom.previewAvatar.textContent = "🐦";
        this.dom.previewName.textContent = "BigQuery News Tracker";
        this.dom.previewHandle.textContent = "@BigQueryNotes";
      } else if (this.currentPlatform === "facebook") {
        this.dom.previewAvatar.textContent = "📘";
        this.dom.previewName.textContent = "BigQuery Developer Community";
        this.dom.previewHandle.textContent = "Facebook Page";
      } else if (this.currentPlatform === "linkedin") {
        this.dom.previewAvatar.textContent = "💼";
        this.dom.previewName.textContent = "Google Cloud BigQuery Advocates";
        this.dom.previewHandle.textContent = "LinkedIn Post";
      } else if (this.currentPlatform === "bluesky") {
        this.dom.previewAvatar.textContent = "🦋";
        this.dom.previewName.textContent = "BigQuery Updates";
        this.dom.previewHandle.textContent = "@bigquery.bsky.social";
      }
    }
  }

  closeTweetModal() {
    if (this.dom.tweetModal) this.dom.tweetModal.style.display = "none";
  }

  updateTweetModalState() {
    if (!this.dom.tweetTextarea) return;
    const text = this.dom.tweetTextarea.value;
    if (this.dom.tweetPreviewText) {
      this.dom.tweetPreviewText.textContent = text || "Type your message above to preview...";
    }

    const length = text.length;
    if (this.dom.charCount) this.dom.charCount.textContent = length;

    const limits = {
      twitter: 280,
      bluesky: 300,
      linkedin: 3000,
      facebook: 5000,
    };
    const maxLimit = limits[this.currentPlatform] || 280;

    if (this.dom.charCounterContainer) {
      this.dom.charCounterContainer.classList.remove("warning", "danger");
      if (length > maxLimit) {
        this.dom.charCounterContainer.classList.add("danger");
      } else if (length > maxLimit * 0.9) {
        this.dom.charCounterContainer.classList.add("warning");
      }
    }
  }

  insertHashtag(tag) {
    if (!this.dom.tweetTextarea) return;
    let current = this.dom.tweetTextarea.value;
    if (current.includes(tag)) {
      current = current.replace(new RegExp(`\\s*${tag}`, "g"), "");
    } else {
      current = `${current.trim()} ${tag}`;
    }
    this.dom.tweetTextarea.value = current;
    this.updateTweetModalState();
  }

  publishActivePlatform() {
    if (this.currentPlatform === "twitter") {
      this.postTweetToTwitter();
    } else if (this.currentPlatform === "facebook") {
      this.postModalToFacebook();
    } else if (this.currentPlatform === "linkedin") {
      this.postModalToLinkedIn();
    } else if (this.currentPlatform === "bluesky") {
      this.postModalToBlueSky();
    }
  }

  postTweetToTwitter() {
    if (!this.dom.tweetTextarea) return;
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) {
      this.showToast("Content cannot be empty", "error");
      return;
    }
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420,scrollbars=yes,resizable=yes");
    this.closeTweetModal();
    this.showToast("Opening Twitter / X composer...", "info");
  }

  postToFacebook(text, url) {
    const shareUrl = url || "https://cloud.google.com/bigquery/docs/release-notes";
    const quote = (text || "").trim();
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(quote)}`;
    window.open(fbUrl, "_blank", "width=600,height=500,scrollbars=yes,resizable=yes");
    this.showToast("Opening Facebook share dialog...", "info");
  }

  postModalToFacebook() {
    if (!this.dom.tweetTextarea) return;
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) {
      this.showToast("Content cannot be empty", "error");
      return;
    }
    const url = "https://cloud.google.com/bigquery/docs/release-notes";
    this.postToFacebook(text, url);
    this.closeTweetModal();
  }

  postToLinkedIn(url) {
    const shareUrl = url || "https://cloud.google.com/bigquery/docs/release-notes";
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedinUrl, "_blank", "width=600,height=550,scrollbars=yes,resizable=yes");
    this.showToast("Opening LinkedIn share dialog...", "info");
  }

  postModalToLinkedIn() {
    if (!this.dom.tweetTextarea) return;
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) {
      this.showToast("Content cannot be empty", "error");
      return;
    }
    this.copyToClipboard(text);
    const url = "https://cloud.google.com/bigquery/docs/release-notes";
    this.postToLinkedIn(url);
    this.closeTweetModal();
    this.showToast("Copied post text and opening LinkedIn...", "success");
  }

  postModalToBlueSky() {
    if (!this.dom.tweetTextarea) return;
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) {
      this.showToast("Content cannot be empty", "error");
      return;
    }
    const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    window.open(bskyUrl, "_blank", "width=600,height=500,scrollbars=yes,resizable=yes");
    this.closeTweetModal();
    this.showToast("Opening BlueSky composer...", "info");
  }

  copyTweetText() {
    if (!this.dom.tweetTextarea) return;
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) return;
    this.copyToClipboard(text);
    this.showToast("Post text copied to clipboard!", "success");
  }

  /* ========================================================================
     Local AI Assistant (Ollama with Token-Streaming)
     ======================================================================== */
  async checkAiStatus() {
    try {
      const res = await fetch("/api/ai/status");
      const data = await res.json();
      this.aiConnected = data.connected;

      if (this.dom.aiStatusBadge) {
        if (data.connected) {
          this.dom.aiStatusBadge.className = "ai-status-badge online";
          this.dom.aiStatusBadge.textContent = `🟢 Online: ${data.default_model}`;

          if (this.dom.aiModelSelect && data.models && data.models.length > 0) {
            this.dom.aiModelSelect.innerHTML = data.models
              .map((m) => `<option value="${m}" ${m === data.default_model ? "selected" : ""}>${m}</option>`)
              .join("");
            if (this.dom.aiModelWrap) this.dom.aiModelWrap.style.display = "block";
          }
        } else {
          this.dom.aiStatusBadge.className = "ai-status-badge offline";
          this.dom.aiStatusBadge.textContent = "⚠️ Ollama Offline (Help)";
          if (this.dom.aiModelWrap) this.dom.aiModelWrap.style.display = "none";
        }
      }
    } catch (e) {
      this.aiConnected = false;
      if (this.dom.aiStatusBadge) {
        this.dom.aiStatusBadge.className = "ai-status-badge offline";
        this.dom.aiStatusBadge.textContent = "⚠️ Ollama Offline (Help)";
      }
      if (this.dom.aiModelWrap) this.dom.aiModelWrap.style.display = "none";
    }
  }

  async generateWithLocalAi() {
    if (!this.dom.tweetTextarea) return;
    const currentText = this.dom.tweetTextarea.value.trim();
    if (!currentText) {
      this.showToast("Please enter some text or select an update first.", "error");
      return;
    }

    const selectedModel = this.dom.aiModelSelect && this.dom.aiModelSelect.value
      ? this.dom.aiModelSelect.value
      : this.aiModel;

    const customPrompt = this.dom.aiCustomPromptInput
      ? this.dom.aiCustomPromptInput.value.trim()
      : "";

    if (this.dom.aiGenerateBtn) {
      this.dom.aiGenerateBtn.classList.add("loading");
      this.dom.aiGenerateBtn.disabled = true;
      const originalBtnText = this.dom.aiGenerateBtn.querySelector(".ai-btn-text")
        ? this.dom.aiGenerateBtn.querySelector(".ai-btn-text").textContent
        : "Rewrite with Local AI";
      if (this.dom.aiGenerateBtn.querySelector(".ai-btn-text")) {
        this.dom.aiGenerateBtn.querySelector(".ai-btn-text").textContent = "Streaming from Ollama...";
      }

      this.dom.tweetTextarea.value = "";
      this.updateTweetModalState();

      try {
        const response = await fetch("/api/ai/generate?stream=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: currentText,
            style: this.aiSelectedStyle,
            custom_prompt: customPrompt,
            model: selectedModel,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`AI request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedAccumulator = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.token) {
                  streamedAccumulator += data.token;
                  this.dom.tweetTextarea.value = streamedAccumulator;
                  this.updateTweetModalState();
                }
                if (data.error) {
                  throw new Error(data.error);
                }
              } catch (jsonErr) {
                // Ignore parse warning for partial line
              }
            }
          }
        }

        if (streamedAccumulator.trim()) {
          this.dom.tweetTextarea.value = streamedAccumulator.trim();
          this.updateTweetModalState();
          if (this.dom.aiRevertBtn) this.dom.aiRevertBtn.style.display = "inline-flex";
          this.showToast(`Polished with local ${selectedModel}! ✨`, "success");
        } else {
          this.dom.tweetTextarea.value = currentText;
          this.updateTweetModalState();
          throw new Error("Model returned empty response. Please retry.");
        }
      } catch (err) {
        console.error("AI Streaming Generation Error:", err);
        this.dom.tweetTextarea.value = currentText;
        this.updateTweetModalState();
        this.showToast(err.message || "Failed to generate AI rewrite", "error");
      } finally {
        if (this.dom.aiGenerateBtn) {
          this.dom.aiGenerateBtn.classList.remove("loading");
          this.dom.aiGenerateBtn.disabled = false;
          if (this.dom.aiGenerateBtn.querySelector(".ai-btn-text")) {
            this.dom.aiGenerateBtn.querySelector(".ai-btn-text").textContent = originalBtnText;
          }
        }
      }
    }
  }

  revertAiEdit() {
    if (this.aiOriginalText && this.dom.tweetTextarea) {
      this.dom.tweetTextarea.value = this.aiOriginalText;
      this.updateTweetModalState();
      if (this.dom.aiRevertBtn) this.dom.aiRevertBtn.style.display = "none";
      this.showToast("Reverted to original text", "info");
    }
  }

  /* ========================================================================
     Export to CSV
     ======================================================================== */
  exportToCSV(onlySelected = false) {
    let itemsToExport = [];

    if (onlySelected && this.selectedItemIds.size > 0) {
      for (const itemId of this.selectedItemIds) {
        const found = this.findItemById(itemId);
        if (found) itemsToExport.push(found);
      }
    } else {
      const filtered = this.getFilteredEntries();
      for (const entry of filtered) {
        for (const item of entry.items || []) {
          itemsToExport.push({ entry, item });
        }
      }
    }

    if (!itemsToExport.length) {
      this.showToast("No updates available to export", "error");
      return;
    }

    const escapeCsv = (val) => {
      const str = (val || "").toString().replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = ["Date", "Category", "Summary", "Documentation Link", "Tweet Text"];
    const csvRows = [headers.map(escapeCsv).join(",")];

    for (const { entry, item } of itemsToExport) {
      csvRows.push([
        escapeCsv(entry.date),
        escapeCsv(item.category),
        escapeCsv(item.text),
        escapeCsv(entry.link),
        escapeCsv(item.tweet_text),
      ].join(","));
    }

    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `bigquery-release-notes-${onlySelected ? "selected-" : ""}${dateStamp}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.showToast(`Exported ${itemsToExport.length} updates to CSV!`, "success");
  }

  async copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (e) {
        console.warn("Clipboard API failed, attempting fallback", e);
      }
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }
    textArea.remove();
  }

  /* ========================================================================
     Helpers
     ======================================================================== */
  findItemById(itemId) {
    for (const entry of this.entries) {
      for (const item of entry.items || []) {
        if (item.id === itemId) {
          return { entry, item };
        }
      }
    }
    return null;
  }

  escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  showToast(message, type = "info") {
    if (!this.dom.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon = {
      success: "✓",
      error: "✕",
      info: "ℹ",
    }[type] || "ℹ";

    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3300);
  }
}

// Global initialization
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new ReleaseNotesApp();
});
