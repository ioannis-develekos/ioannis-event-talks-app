/**
 * BigQuery Release Notes & Social Tracker - Client Application
 */

class ReleaseNotesApp {
  constructor() {
    this.entries = [];
    this.totalUpdates = 0;
    this.selectedItemIds = new Set();
    this.currentCategory = "all";
    this.searchQuery = "";
    this.isLoading = false;

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
      categoryFilters: document.getElementById("category-filters"),
      totalReleasesCount: document.getElementById("total-releases-count"),
      totalUpdatesCount: document.getElementById("total-updates-count"),
      lastUpdatedText: document.getElementById("last-updated-text"),
      selectionBar: document.getElementById("selection-bar"),
      selectedCount: document.getElementById("selected-count"),
      tweetSelectedBtn: document.getElementById("tweet-selected-btn"),
      clearSelectionBtn: document.getElementById("clear-selection-btn"),
      tweetModal: document.getElementById("tweet-modal"),
      closeModalBtn: document.getElementById("close-modal-btn"),
      tweetTextarea: document.getElementById("tweet-textarea"),
      charCount: document.getElementById("char-count"),
      charCounterContainer: document.getElementById("char-counter-container"),
      tweetPreviewText: document.getElementById("tweet-preview-text"),
      postTweetBtn: document.getElementById("post-tweet-btn"),
      postFbBtn: document.getElementById("post-fb-btn"),
      copyTweetBtn: document.getElementById("copy-tweet-btn"),
      themeToggleBtn: document.getElementById("theme-toggle-btn"),
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

    this.init();
  }

  init() {
    this.setupTheme();
    this.setupEventListeners();
    this.fetchReleaseNotes();
  }

  /* ========================================================================
     Theme Management
     ======================================================================== */
  setupTheme() {
    const savedTheme = localStorage.getItem("bq_rn_theme");
    if (savedTheme) {
      document.body.className = savedTheme;
    } else {
      // Default to dark theme
      document.body.className = "theme-dark";
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
    // Refresh button
    this.dom.refreshBtn.addEventListener("click", () => this.refreshFeed(true));

    // Export CSV button
    if (this.dom.exportCsvBtn) {
      this.dom.exportCsvBtn.addEventListener("click", () => this.exportToCSV(false));
    }

    // Theme toggle
    this.dom.themeToggleBtn.addEventListener("click", () => this.toggleTheme());

    // Search Input
    this.dom.searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.dom.clearSearchBtn.style.display = this.searchQuery ? "block" : "none";
      this.render();
    });

    this.dom.clearSearchBtn.addEventListener("click", () => {
      this.dom.searchInput.value = "";
      this.searchQuery = "";
      this.dom.clearSearchBtn.style.display = "none";
      this.render();
      this.dom.searchInput.focus();
    });

    // Category Filter Pills
    this.dom.categoryFilters.addEventListener("click", (e) => {
      const pill = e.target.closest(".filter-pill");
      if (!pill) return;

      this.dom.categoryFilters.querySelectorAll(".filter-pill").forEach((btn) => {
        btn.classList.remove("active");
      });
      pill.classList.add("active");

      this.currentCategory = pill.getAttribute("data-category");
      this.render();
    });

    // Floating Selection Bar Actions
    this.dom.clearSelectionBtn.addEventListener("click", () => this.clearSelection());
    this.dom.tweetSelectedBtn.addEventListener("click", () => this.openTweetModalForSelected());
    if (this.dom.exportSelectedCsvBtn) {
      this.dom.exportSelectedCsvBtn.addEventListener("click", () => this.exportToCSV(true));
    }

    // Tweet Modal Actions
    this.dom.closeModalBtn.addEventListener("click", () => this.closeTweetModal());
    this.dom.tweetModal.addEventListener("click", (e) => {
      if (e.target === this.dom.tweetModal) this.closeTweetModal();
    });

    this.dom.tweetTextarea.addEventListener("input", () => this.updateTweetModalState());

    // AI Assistant Style Preset Buttons
    document.querySelectorAll(".btn-ai-style").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".btn-ai-style").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.aiSelectedStyle = btn.getAttribute("data-style");
        
        if (this.aiSelectedStyle === "custom") {
          this.dom.aiCustomPromptWrap.style.display = "block";
          this.dom.aiCustomPromptInput.focus();
        } else {
          this.dom.aiCustomPromptWrap.style.display = "none";
        }
      });
    });

    // AI Generate & Revert Buttons
    if (this.dom.aiGenerateBtn) {
      this.dom.aiGenerateBtn.addEventListener("click", () => this.generateWithLocalAi());
    }
    if (this.dom.aiRevertBtn) {
      this.dom.aiRevertBtn.addEventListener("click", () => this.revertAiEdit());
    }
    if (this.dom.aiStatusBadge) {
      this.dom.aiStatusBadge.addEventListener("click", () => {
        if (!this.aiConnected) {
          this.showToast("To use local AI: run 'ollama serve' and 'ollama pull gemma2:2b' in your terminal.", "info");
        }
      });
    }

    // Hashtag Chips in Tweet Modal
    document.querySelectorAll(".tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const tag = chip.getAttribute("data-tag");
        this.insertHashtag(tag);
      });
    });

    this.dom.postTweetBtn.addEventListener("click", () => this.postTweetToTwitter());
    if (this.dom.postFbBtn) {
      this.dom.postFbBtn.addEventListener("click", () => this.postModalToFacebook());
    }
    this.dom.copyTweetBtn.addEventListener("click", () => this.copyTweetText());

    // Keyboard Shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.dom.tweetModal.style.display !== "none") {
        this.closeTweetModal();
      } else if (
        e.key === "/" &&
        document.activeElement !== this.dom.searchInput &&
        document.activeElement !== this.dom.tweetTextarea
      ) {
        e.preventDefault();
        this.dom.searchInput.focus();
      }
    });
  }

  /* ========================================================================
     Data Fetching
     ======================================================================== */
  async fetchReleaseNotes(forceRefresh = false) {
    if (this.isLoading) return;
    this.isLoading = true;
    this.dom.refreshBtn.classList.add("loading");
    this.dom.refreshBtn.disabled = true;

    if (!this.entries.length) {
      this.dom.loadingState.style.display = "block";
      this.dom.errorState.style.display = "none";
      this.dom.emptyState.style.display = "none";
      this.dom.entriesList.innerHTML = "";
    }

    try {
      const url = `/api/release-notes${forceRefresh ? "?refresh=1" : ""}`;
      const response = await fetch(url);
      const json = await response.json();

      if (!response.ok || json.status !== "success") {
        throw new Error(json.message || "Failed to fetch release notes");
      }

      const data = json.data;
      this.entries = data.entries || [];
      this.totalUpdates = data.total_updates || 0;

      // Update Counts
      this.dom.totalReleasesCount.textContent = data.total_entries || 0;
      this.dom.totalUpdatesCount.textContent = this.totalUpdates;
      this.updateCategoryCounts();

      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      this.dom.lastUpdatedText.textContent = `Last refreshed at ${timeStr} ${data.from_cache ? "(cached)" : "(live)"}`;

      this.dom.loadingState.style.display = "none";
      this.dom.errorState.style.display = "none";

      this.render();

      if (forceRefresh) {
        this.showToast(`Feed updated! (${this.totalUpdates} updates available)`, "success");
      }
    } catch (err) {
      console.error("Error loading release notes:", err);
      if (!this.entries.length) {
        this.dom.loadingState.style.display = "none";
        this.dom.errorState.style.display = "block";
        this.dom.errorMessage.textContent = err.message;
      }
      this.showToast(`Refresh failed: ${err.message}`, "error");
    } finally {
      this.isLoading = false;
      this.dom.refreshBtn.classList.remove("loading");
      this.dom.refreshBtn.disabled = false;
    }
  }

  refreshFeed(force = true) {
    this.fetchReleaseNotes(force);
  }

  /* ========================================================================
     Counts & Filtering
     ======================================================================== */
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
      for (const item of entry.items) {
        counts.all++;
        const cat = (item.category || "").toLowerCase();
        if (cat.includes("feature")) counts.feature++;
        else if (cat.includes("change")) counts.change++;
        else if (cat.includes("deprecated")) counts.deprecated++;
        else if (cat.includes("announcement")) counts.announcement++;
        else if (cat.includes("security")) counts.security++;
        else if (cat.includes("issue") || cat.includes("fix")) counts.issue++;
      }
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal("count-all", counts.all);
    setVal("count-feature", counts.feature);
    setVal("count-change", counts.change);
    setVal("count-deprecated", counts.deprecated);
    setVal("count-announcement", counts.announcement);
    setVal("count-security", counts.security);
    setVal("count-issue", counts.issue);
  }

  getFilteredEntries() {
    const query = this.searchQuery;
    const cat = this.currentCategory.toLowerCase();

    return this.entries
      .map((entry) => {
        const matchingItems = entry.items.filter((item) => {
          // Category match
          if (cat !== "all") {
            const itemCat = (item.category || "").toLowerCase();
            if (!itemCat.includes(cat)) return false;
          }

          // Search query match
          if (query) {
            const inDate = entry.date.toLowerCase().includes(query);
            const inCategory = (item.category || "").toLowerCase().includes(query);
            const inText = (item.text || "").toLowerCase().includes(query);
            if (!inDate && !inCategory && !inText) return false;
          }

          return true;
        });

        if (matchingItems.length > 0) {
          return {
            ...entry,
            items: matchingItems,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  resetFilters() {
    this.searchQuery = "";
    this.dom.searchInput.value = "";
    this.dom.clearSearchBtn.style.display = "none";
    this.currentCategory = "all";
    this.dom.categoryFilters.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-category") === "all");
    });
    this.render();
  }

  /* ========================================================================
     Rendering
     ======================================================================== */
  render() {
    const filtered = this.getFilteredEntries();

    if (!filtered.length) {
      this.dom.entriesList.innerHTML = "";
      this.dom.emptyState.style.display = "block";
      return;
    }

    this.dom.emptyState.style.display = "none";

    let html = "";
    for (const entry of filtered) {
      html += `
        <div class="date-group" id="group-${entry.id}">
          <div class="date-group-header">
            <div class="date-title-wrap">
              <svg class="calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <h2>${this.escapeHtml(entry.date)}</h2>
              <span class="date-badge">${entry.items.length} ${entry.items.length === 1 ? "update" : "updates"}</span>
            </div>
            <a href="${this.escapeHtml(entry.link)}" target="_blank" rel="noopener noreferrer" class="date-source-link">
              View on Google Docs ↗
            </a>
          </div>

          <div class="date-items">
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

    return `
      <div class="update-card ${isSelected ? "selected" : ""}" data-item-id="${item.id}" id="card-${item.id}">
        <div class="update-header">
          <div class="update-header-left">
            <input type="checkbox" class="card-select-checkbox" data-item-id="${item.id}" ${isSelected ? "checked" : ""} aria-label="Select update for tweet">
            <span class="category-tag ${categoryClass}">
              <span>${catIcon}</span> ${this.escapeHtml(item.category)}
            </span>
          </div>

          <div class="update-actions">
            <button class="action-btn-sm action-copy-btn" data-item-id="${item.id}" title="Copy update text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>

            <button class="btn btn-fb-sm action-fb-btn" data-item-id="${item.id}" title="Share this update to Facebook">
              <svg class="fb-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              FB
            </button>

            <button class="btn btn-tweet-sm action-tweet-btn" data-item-id="${item.id}" title="Tweet about this update">
              <svg class="x-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Tweet
            </button>
          </div>
        </div>

        <div class="update-content">
          ${item.html}
        </div>
      </div>
    `;
  }

  attachCardEventListeners() {
    // Checkbox toggles
    this.dom.entriesList.querySelectorAll(".card-select-checkbox").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const itemId = e.target.getAttribute("data-item-id");
        this.toggleSelectItem(itemId, e.target.checked);
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

    // Facebook single buttons
    this.dom.entriesList.querySelectorAll(".action-fb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-item-id");
        const found = this.findItemById(itemId);
        if (found) {
          this.postToFacebook(found.item.text, found.entry.link);
        }
      });
    });

    // Tweet single buttons
    this.dom.entriesList.querySelectorAll(".action-tweet-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-item-id");
        const found = this.findItemById(itemId);
        if (found) {
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
    this.dom.entriesList.querySelectorAll(".update-card.selected").forEach((c) => {
      c.classList.remove("selected");
      const cb = c.querySelector(".card-select-checkbox");
      if (cb) cb.checked = false;
    });
    this.updateSelectionBar();
  }

  updateSelectionBar() {
    const count = this.selectedItemIds.size;
    this.dom.selectedCount.textContent = count;
    if (count > 0) {
      this.dom.selectionBar.style.display = "block";
    } else {
      this.dom.selectionBar.style.display = "none";
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
      this.openTweetModal(selectedItems[0].item.tweet_text);
      return;
    }

    // Multi-item composite tweet
    let compositeText = `⚡ Recent #BigQuery Updates (${selectedItems.length} Highlights):\n\n`;
    for (const it of selectedItems.slice(0, 3)) {
      const summary = it.item.text.length > 50 ? it.item.text.slice(0, 47) + "..." : it.item.text;
      compositeText += `• [${it.item.category}] ${summary}\n`;
    }
    compositeText += `\n🔗 https://cloud.google.com/bigquery/docs/release-notes\n#GoogleCloud #DataEngineering`;

    this.openTweetModal(compositeText);
  }

  /* ========================================================================
     Tweet Modal & Local AI Assistant
     ======================================================================== */
  openTweetModal(initialText) {
    this.aiOriginalText = initialText || "";
    this.dom.tweetTextarea.value = initialText || "";
    this.dom.tweetModal.style.display = "flex";
    if (this.dom.aiRevertBtn) this.dom.aiRevertBtn.style.display = "none";
    this.updateTweetModalState();
    this.checkAiStatus();
    this.dom.tweetTextarea.focus();
  }

  async checkAiStatus() {
    try {
      const res = await fetch("/api/ai/status");
      const data = await res.json();
      this.aiConnected = data.connected;

      if (data.connected) {
        this.dom.aiStatusBadge.className = "ai-status-badge online";
        this.dom.aiStatusBadge.textContent = `🟢 Online: ${data.default_model}`;

        if (data.models && data.models.length > 0) {
          this.dom.aiModelSelect.innerHTML = data.models
            .map((m) => `<option value="${m}" ${m === data.default_model ? "selected" : ""}>${m}</option>`)
            .join("");
          this.dom.aiModelWrap.style.display = "block";
        }
      } else {
        this.dom.aiStatusBadge.className = "ai-status-badge offline";
        this.dom.aiStatusBadge.textContent = "⚠️ Ollama Offline";
        this.dom.aiModelWrap.style.display = "none";
      }
    } catch (e) {
      this.aiConnected = false;
      this.dom.aiStatusBadge.className = "ai-status-badge offline";
      this.dom.aiStatusBadge.textContent = "⚠️ Ollama Offline";
      this.dom.aiModelWrap.style.display = "none";
    }
  }

  async generateWithLocalAi() {
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

    this.dom.aiGenerateBtn.classList.add("loading");
    this.dom.aiGenerateBtn.disabled = true;
    const originalBtnText = this.dom.aiGenerateBtn.querySelector(".ai-btn-text").textContent;
    this.dom.aiGenerateBtn.querySelector(".ai-btn-text").textContent = "Rewriting with Ollama...";

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentText,
          style: this.aiSelectedStyle,
          custom_prompt: customPrompt,
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (data.text && data.text.trim()) {
        this.dom.tweetTextarea.value = data.text.trim();
        this.updateTweetModalState();
        if (this.dom.aiRevertBtn) this.dom.aiRevertBtn.style.display = "inline-flex";
        this.showToast(`Rewritten with local ${data.model}! ✨`, "success");
      } else {
        throw new Error("Model returned an empty response. Please try another tone or prompt.");
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      this.showToast(err.message, "error");
    } finally {
      this.dom.aiGenerateBtn.classList.remove("loading");
      this.dom.aiGenerateBtn.disabled = false;
      this.dom.aiGenerateBtn.querySelector(".ai-btn-text").textContent = originalBtnText;
    }
  }

  revertAiEdit() {
    if (this.aiOriginalText) {
      this.dom.tweetTextarea.value = this.aiOriginalText;
      this.updateTweetModalState();
      if (this.dom.aiRevertBtn) this.dom.aiRevertBtn.style.display = "none";
      this.showToast("Reverted to original text", "info");
    }
  }

  closeTweetModal() {
    this.dom.tweetModal.style.display = "none";
  }

  updateTweetModalState() {
    const text = this.dom.tweetTextarea.value;
    this.dom.tweetPreviewText.textContent = text || "Type your tweet above to preview...";

    // Character counter logic
    const length = text.length;
    this.dom.charCount.textContent = length;

    this.dom.charCounterContainer.classList.remove("warning", "danger");
    if (length > 280) {
      this.dom.charCounterContainer.classList.add("danger");
    } else if (length > 250) {
      this.dom.charCounterContainer.classList.add("warning");
    }
  }

  insertHashtag(tag) {
    let current = this.dom.tweetTextarea.value;
    if (current.includes(tag)) {
      // Toggle off
      current = current.replace(new RegExp(`\\s*${tag}`, "g"), "");
    } else {
      // Add at end
      current = `${current.trim()} ${tag}`;
    }
    this.dom.tweetTextarea.value = current;
    this.updateTweetModalState();
  }

  postTweetToTwitter() {
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) {
      this.showToast("Tweet cannot be empty", "error");
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
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) {
      this.showToast("Content cannot be empty", "error");
      return;
    }
    const url = "https://cloud.google.com/bigquery/docs/release-notes";
    this.postToFacebook(text, url);
    this.closeTweetModal();
  }

  copyTweetText() {
    const text = this.dom.tweetTextarea.value.trim();
    if (!text) return;
    this.copyToClipboard(text);
    this.showToast("Tweet text copied to clipboard!", "success");
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
        for (const item of entry.items) {
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
        escapeCsv(item.tweet_text)
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
    
    // Fallback for older browsers or non-HTTPS contexts
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
      for (const item of entry.items) {
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
