// PhishGuard Popup v1.4

let currentTabUrl  = "";
let currentDomain  = "";
let isTrusted      = false;
let currentServer  = (typeof PHISHGUARD_DEFAULT_CONFIG !== "undefined" && PHISHGUARD_DEFAULT_CONFIG.SERVER_URL)
    ? PHISHGUARD_DEFAULT_CONFIG.SERVER_URL.trim().replace(/\/$/, "")
    : "";

function shorten(url, n = 45) {
    return url.length > n ? url.substring(0, n) + "…" : url;
}

function safeHost(url) {
    try { return new URL(url).hostname; } catch { return url; }
}

async function getServerUrl() {
    const { phishguardServerUrl } = await chrome.storage.local.get("phishguardServerUrl");
    const defaultUrl = (typeof PHISHGUARD_DEFAULT_CONFIG !== "undefined" && PHISHGUARD_DEFAULT_CONFIG.SERVER_URL)
        ? PHISHGUARD_DEFAULT_CONFIG.SERVER_URL.trim().replace(/\/$/, "")
        : "";
    if (phishguardServerUrl && phishguardServerUrl.trim()) {
        const trimmed = phishguardServerUrl.trim().replace(/\/$/, "");
        const isStoredLocal = trimmed.includes("localhost") || trimmed.includes("127.0.0.1") || trimmed.includes("0.0.0.0");
        const isDefaultRemote = defaultUrl && !defaultUrl.includes("localhost") && !defaultUrl.includes("127.0.0.1");
        if (isStoredLocal && isDefaultRemote) {
            currentServer = defaultUrl;
            await chrome.storage.local.set({ phishguardServerUrl: defaultUrl });
        } else {
            currentServer = trimmed;
        }
    } else if (defaultUrl) {
        currentServer = defaultUrl;
        await chrome.storage.local.set({ phishguardServerUrl: defaultUrl });
    }
    return currentServer;
}

async function updateServerStatusUI() {
    const srv = await getServerUrl();
    const dot = document.getElementById("serverStatusDot");
    const txt = document.getElementById("serverStatusText");

    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${srv}/api/health`, { signal: controller.signal });
        clearTimeout(t);
        if (res.ok) {
            dot.className = "status-dot online";
            txt.textContent = "Protected";
            txt.style.color = "#4ade80";
        } else {
            dot.className = "status-dot offline";
            txt.textContent = "Offline";
            txt.style.color = "#ff6b7a";
        }
    } catch {
        dot.className = "status-dot offline";
        txt.textContent = "Offline";
        txt.style.color = "#ff6b7a";
    }
}

function renderResult(data) {
    const area        = document.getElementById("verdictArea");
    const reasonsArea = document.getElementById("reasonsArea");
    const reasonsList = document.getElementById("reasonsList");

    if (!data || !data.verdict || data.verdict === "ERROR") {
        area.className = "verdict-card vc-loading";
        area.innerHTML = `
            <div style="color:#ff6b7a;font-size:0.9rem;font-weight:600;">Scan Inconclusive</div>
            <div style="font-size:0.72rem;color:#9aabc4;margin-top:5px;">Unable to reach detection backend or network timeout. Check Central Server configuration.</div>`;
        reasonsArea.style.display = "none";
        return;
    }

    if (data.trusted) {
        area.className = "verdict-card vc-safe";
        area.innerHTML = `
            <div class="verdict-icon verdict-safe">✓</div>
            <div class="verdict-label verdict-safe">Trusted Domain</div>
            <div class="verdict-score">Matched administrator whitelist or local trusted list.</div>`;
        reasonsArea.style.display = "none";
        return;
    }

    const verdict = data.verdict;
    const score   = data.score ?? data.risk_score ?? 0;
    const percent = (score * 100).toFixed(1);

    const MAP = {
        PHISHING:   { icon: "🛑", label: "Phishing Site Blocked", color: "verdict-phishing",  bg: "vc-phishing"  },
        SUSPICIOUS: { icon: "⚠️", label: "Suspicious Warning",    color: "verdict-suspicious", bg: "vc-suspicious" },
        SAFE:       { icon: "✅", label: "Safe Domain",           color: "verdict-safe",       bg: "vc-safe"       },
    };
    const cfg = MAP[verdict] || MAP.SAFE;

    area.className = `verdict-card ${cfg.bg}`;
    area.innerHTML = `
        <div class="verdict-icon ${cfg.color}">${cfg.icon}</div>
        <div class="verdict-label ${cfg.color}">${cfg.label}</div>
        <div class="verdict-score">Risk Probability: ${percent}%</div>
        <a href="#" id="dashboardLink" style="font-size:0.68rem;color:#ffffff;text-decoration:none;display:inline-block;margin-top:6px;">Open Dashboard →</a>`;

    document.getElementById("dashboardLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: currentServer });
    });

    const reasons = data.reasons || [];
    if (reasons.length > 0) {
        reasonsArea.style.display = "block";
        reasonsList.innerHTML = "";
        reasons.slice(0, 4).forEach(r => {
            const div = document.createElement("div");
            div.className = "reason-item";
            div.textContent = String(r);
            reasonsList.appendChild(div);
        });
    } else {
        reasonsArea.style.display = "none";
    }
}

function loadPageStats(tabId) {
    chrome.runtime.sendMessage({ action: "getStats", tabId }, (stats) => {
        if (!stats || stats.total === 0) return;
        const bar = document.getElementById("statsBar");
        bar.style.display = "flex";
        document.getElementById("statTotal").textContent      = `${stats.total} scanned`;
        document.getElementById("statPhishing").textContent   = `${stats.phishing} phishing`;
        document.getElementById("statSuspicious").textContent = `${stats.suspicious} suspicious`;
        document.getElementById("statSafe").textContent       = `${stats.safe} safe`;
    });
}

function renderTrustRow() {
    const row = document.getElementById("trustRow");
    if (!currentDomain) { row.style.display = "none"; return; }
    row.style.display = "flex";

    const btn     = document.getElementById("trustBtn");
    const unbtn   = document.getElementById("untrustBtn");
    const label   = document.getElementById("trustLabel");

    if (isTrusted) {
        label.textContent   = `${currentDomain} is trusted`;
        btn.textContent     = "✅ Trusted";
        btn.className       = "btn-trust trusted";
        unbtn.style.display = "inline";
    } else {
        label.textContent   = `Trust ${currentDomain}?`;
        btn.textContent     = "+ Trust";
        btn.className       = "btn-trust";
        unbtn.style.display = "none";
    }
}

function toggleTrust() {
    if (!currentDomain) return;
    if (isTrusted) {
        chrome.runtime.sendMessage({ action: "untrustDomain", domain: currentDomain }, () => {
            isTrusted = false;
            renderTrustRow();
        });
    } else {
        chrome.runtime.sendMessage({ action: "trustDomain", domain: currentDomain }, () => {
            isTrusted = true;
            renderTrustRow();
        });
    }
}

async function checkTrusted() {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "getTrustedDomains" }, (domains) => {
            if (chrome.runtime.lastError) { resolve(false); return; }
            resolve((domains || []).includes(currentDomain));
        });
    });
}

function showLoading() {
    const area = document.getElementById("verdictArea");
    area.className = "verdict-card vc-loading";
    area.innerHTML = `
        <div class="spinner"></div>
        <div style="margin-top:6px;font-size:0.85rem;color:#9aabc4;">Scanning telemetry...</div>`;
    document.getElementById("reasonsArea").style.display  = "none";
    document.getElementById("statsBar").style.display     = "none";
}

async function scanCurrentTab(forceRescan = false) {
    showLoading();

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab  = tabs[0];

    if (!tab || !tab.url || !tab.url.startsWith("http")) {
        renderResult({ verdict: "ERROR" });
        document.getElementById("currentUrl").textContent = "Non-web address (internal / chrome page)";
        return;
    }

    currentTabUrl = tab.url;
    currentDomain = safeHost(tab.url);
    document.getElementById("currentUrl").textContent = shorten(tab.url);

    isTrusted = await checkTrusted();
    renderTrustRow();

    if (isTrusted) {
        renderResult({ verdict: "SAFE", trusted: true });
        loadPageStats(tab.id);
        return;
    }

    if (!forceRescan) {
        const stored = await chrome.storage.local.get(`tabScan_${tab.id}`);
        const cached = stored[`tabScan_${tab.id}`];
        const CACHE_MAX = 15 * 60 * 1000;
        if (cached && cached.url === tab.url && (Date.now() - cached.time) < CACHE_MAX) {
            renderResult(cached.data);
            loadPageStats(tab.id);
            return;
        }
    }

    // Ask background service worker to scan and relay telemetry to central server
    chrome.runtime.sendMessage({
        action: "scan",
        url: tab.url,
        source: forceRescan ? "extension-popup-rescan" : "extension-popup"
    }, (data) => {
        if (chrome.runtime.lastError || !data) {
            renderResult({ verdict: "ERROR" });
        } else {
            renderResult(data);
            loadPageStats(tab.id);
        }
    });
}

async function getSoundEnabled() {
    const { pgSoundEnabled } = await chrome.storage.local.get("pgSoundEnabled");
    return pgSoundEnabled !== false;
}

async function toggleSound() {
    const current = await getSoundEnabled();
    const next = !current;
    await chrome.storage.local.set({ pgSoundEnabled: next });
    document.getElementById("soundBtn").textContent = next ? "🔔" : "🔕";
    document.getElementById("soundBtn").title = next ? "Sound ON (click to mute)" : "Sound OFF (click to enable)";
}

async function initSoundBtn() {
    const on = await getSoundEnabled();
    const btn = document.getElementById("soundBtn");
    btn.textContent = on ? "🔔" : "🔕";
    btn.title = on ? "Sound ON (click to mute)" : "Sound OFF (click to enable)";
}

// ─── Admin-Protected Extension Uninstall Control ────────────────────────────
function initUninstallProtection() {

    const openBtn       = document.getElementById("openUninstallModalBtn");
    const closeBtn      = document.getElementById("closeUninstallModalBtn");
    const cancelBtn     = document.getElementById("cancelUninstallBtn");
    const submitReqBtn  = document.getElementById("submitRequestBtn");
    const toggleAuthBtn = document.getElementById("toggleDirectAuthBtn");
    const directFields  = document.getElementById("directAuthFields");
    const reasonInput   = document.getElementById("removalReasonInput");
    const userInput     = document.getElementById("adminUserInput");
    const passInput     = document.getElementById("adminPassInput");
    const form          = document.getElementById("uninstallForm");
    const errBox        = document.getElementById("uninstallError");
    const successNotice = document.getElementById("uninstallSuccessNotice");
    const submitBtn     = document.getElementById("submitUninstallBtn");

    if (!modal || !openBtn || !form) return;

    let showDirect = false;
    toggleAuthBtn?.addEventListener("click", () => {
        showDirect = !showDirect;
        if (directFields) directFields.style.display = showDirect ? "block" : "none";
        toggleAuthBtn.textContent = showDirect ? "Hide Direct Authorization" : "Have Token / Admin Credentials?";
    });

    const showModal = () => {
        modal.style.display = "flex";
        errBox.style.display = "none";
        errBox.textContent = "";
        successNotice.style.display = "none";
        if (reasonInput) reasonInput.value = "";
        userInput.value = "";
        passInput.value = "";
        submitBtn.disabled = false;
        submitBtn.textContent = "Authorize & Remove";
        if (submitReqBtn) {
            submitReqBtn.disabled = false;
            submitReqBtn.textContent = "Submit Removal Request";
        }
    };

    const hideModal = () => {
        modal.style.display = "none";
    };

    openBtn.addEventListener("click", showModal);
    closeBtn?.addEventListener("click", hideModal);
    cancelBtn?.addEventListener("click", hideModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) hideModal();
    });

    // 1. Submit Enterprise Removal Request
    submitReqBtn?.addEventListener("click", async () => {
        const reason = (reasonInput?.value || "").trim() || "User requested agent removal";
        submitReqBtn.disabled = true;
        submitReqBtn.textContent = "Sending Request to Admin...";
        errBox.style.display = "none";

        try {
            const srv = await getServerUrl();
            const { phishguardClientId, phishguardClientName } = await chrome.storage.local.get([
                "phishguardClientId",
                "phishguardClientName"
            ]);

            const res = await fetch(`${srv}/api/removal-requests/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: phishguardClientId || "agent-workstation",
                    clientName: phishguardClientName || "Protected Workstation",
                    reason
                })
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.success) {
                // Display mandated message:
                // "Your extension removal request has been sent to the administrator. Please wait for approval. PhishGuard protection remains active while your request is pending."
                successNotice.style.display = "block";
                document.getElementById("requestModeSection").style.display = "none";
                submitReqBtn.style.display = "none";

                // Save request ID in local storage for tracking
                await chrome.storage.local.set({
                    phishguardRemovalRequestId: data.request?.id,
                    phishguardRemovalRequestedAt: new Date().toISOString()
                });
            } else {
                errBox.style.display = "block";
                errBox.textContent = data.error || "Failed to submit removal request to central server.";
                submitReqBtn.disabled = false;
                submitReqBtn.textContent = "Submit Removal Request";
            }
        } catch (netErr) {
            errBox.style.display = "block";
            errBox.textContent = "Error: Cannot connect to Central Security Server to log removal request.";
            submitReqBtn.disabled = false;
            submitReqBtn.textContent = "Submit Removal Request";
        }
    });

    // 2. Direct Token or Admin Credential Authorization & Uninstall
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const inputVal = userInput.value.trim();
        const password = passInput.value;

        if (!inputVal) {
            errBox.style.display = "block";
            errBox.textContent = "Please enter an Authorization Token or Admin Username.";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying with Server...";
        errBox.style.display = "none";

        try {
            const srv = await getServerUrl();
            const { phishguardClientId, phishguardClientName } = await chrome.storage.local.get([
                "phishguardClientId",
                "phishguardClientName"
            ]);

            const cid = phishguardClientId || "agent-workstation";

            let res;
            let data;

            if (inputVal.startsWith("pg_auth_")) {
                // Token-based authorization
                res = await fetch(`${srv}/api/removal-requests/verify-token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clientId: cid,
                        token: inputVal
                    })
                });
                data = await res.json().catch(() => ({}));
            } else {
                // Admin username + password authorization
                if (!password) {
                    errBox.style.display = "block";
                    errBox.textContent = "Admin password is required when authenticating with admin username.";
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Authorize & Remove";
                    return;
                }

                res = await fetch(`${srv}/api/admin/verify-uninstall`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: inputVal,
                        password,
                        clientId: cid,
                        clientName: phishguardClientName || "Protected Workstation"
                    })
                });
                data = await res.json().catch(() => ({}));
            }

            if (res.ok && data.authorized) {
                // Success: Credentials or token verified by central server!
                submitBtn.style.background = "#198754";
                submitBtn.textContent = "✓ Authorized! Uninstalling...";
                errBox.style.display = "none";

                // Clear extension storage and trigger uninstallation
                setTimeout(() => {
                    chrome.storage.local.clear(() => {
                        if (chrome.management && chrome.management.uninstallSelf) {
                            chrome.management.uninstallSelf({ showConfirmDialog: true }, () => {
                                if (chrome.runtime.lastError) {
                                    chrome.tabs.create({ url: "chrome://extensions" });
                                }
                            });
                        } else {
                            chrome.tabs.create({ url: "chrome://extensions" });
                        }
                    });
                }, 400);
            } else {
                // Authorization denied
                const errMsg = data.error || "Access Denied: Invalid Authorization Token or Admin Credentials.";
                errBox.style.display = "block";
                errBox.textContent = `🛑 ${errMsg}`;
                passInput.value = "";
                passInput.focus();

                // Relay unauthorized tamper attempt to central threat monitoring
                fetch(`${srv}/api/threats/alert`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        clientId: cid,
                        clientName: phishguardClientName || "Protected Workstation",
                        url: "chrome-extension://tamper-protection/unauthorized-uninstall-attempt",
                        domain: "chrome-extension://phishguard-agent",
                        score: 0.99,
                        reasons: [
                            `Tamper Alert: Unauthorized extension uninstall attempt denied (Input: "${inputVal}")`
                        ],
                        source: "tamper-protection"
                    })
                }).catch(() => {});

                // Enforce cooldown
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Authorize & Remove";
                }, 2000);
            }
        } catch (netErr) {
            errBox.style.display = "block";
            errBox.textContent = "Error: Cannot reach Central Security Server to authorize removal.";
            submitBtn.disabled = false;
            submitBtn.textContent = "Authorize & Remove";
        }
    });
}

function initServerSettingsModal() {
    const pill = document.getElementById("serverStatusPill");
    const modal = document.getElementById("serverSettingsModal");
    const closeBtn = document.getElementById("closeServerSettingsBtn");
    const testBtn = document.getElementById("testServerBtn");
    const resetBtn = document.getElementById("resetServerBtn");
    const saveBtn = document.getElementById("saveServerBtn");
    const urlInput = document.getElementById("customServerUrlInput");
    const errBox = document.getElementById("serverSettingsError");
    const succBox = document.getElementById("serverSettingsSuccess");
    const devIdSpan = document.getElementById("diagnosticClientId");
    const statusSpan = document.getElementById("diagnosticStatusText");
    const pingSpan = document.getElementById("diagnosticPingText");

    if (!pill || !modal) return;

    const openModal = async () => {
        if (errBox) errBox.style.display = "none";
        if (succBox) succBox.style.display = "none";
        modal.style.display = "flex";

        const { phishguardClientId, phishguardServerUrl } = await chrome.storage.local.get(["phishguardClientId", "phishguardServerUrl"]);
        const srv = await getServerUrl();
        if (devIdSpan) devIdSpan.textContent = phishguardClientId || "(Enrolling...)";
        if (urlInput) urlInput.value = phishguardServerUrl || srv;

        runDiagnosticPing(srv);
    };

    const closeModal = () => {
        modal.style.display = "none";
    };

    const runDiagnosticPing = async (targetUrl) => {
        if (statusSpan) {
            statusSpan.textContent = "Pinging...";
            statusSpan.style.color = "#ffc107";
        }
        if (pingSpan) pingSpan.textContent = "--";
        const t0 = performance.now();
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(`${targetUrl}/api/health`, { signal: controller.signal });
            clearTimeout(timer);
            const elapsed = Math.round(performance.now() - t0);
            if (res.ok) {
                if (statusSpan) {
                    statusSpan.textContent = "Connected & Active";
                    statusSpan.style.color = "#4ade80";
                }
                if (pingSpan) pingSpan.textContent = `${elapsed}ms (HTTP 200 OK)`;
                return true;
            } else {
                if (statusSpan) {
                    statusSpan.textContent = `Server Error (${res.status})`;
                    statusSpan.style.color = "#ff6b7a";
                }
                if (pingSpan) pingSpan.textContent = `HTTP ${res.status}`;
                return false;
            }
        } catch {
            if (statusSpan) {
                statusSpan.textContent = "Unreachable / Offline";
                statusSpan.style.color = "#ff6b7a";
            }
            if (pingSpan) pingSpan.textContent = "Network Timeout / Error";
            return false;
        }
    };

    pill.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);

    testBtn?.addEventListener("click", async () => {
        if (errBox) errBox.style.display = "none";
        if (succBox) succBox.style.display = "none";
        const val = (urlInput?.value || "").trim().replace(/\/$/, "");
        if (!val) {
            if (errBox) {
                errBox.style.display = "block";
                errBox.textContent = "Please enter a valid Server URL to test.";
            }
            return;
        }
        testBtn.disabled = true;
        testBtn.textContent = "Testing...";
        const ok = await runDiagnosticPing(val);
        testBtn.disabled = false;
        testBtn.textContent = "Test Ping";
        if (ok) {
            if (succBox) {
                succBox.style.display = "block";
                succBox.textContent = "✓ Server is reachable and healthy.";
            }
        } else {
            if (errBox) {
                errBox.style.display = "block";
                errBox.textContent = "✕ Server is unreachable. Check URL and connection.";
            }
        }
    });

    resetBtn?.addEventListener("click", async () => {
        const defaultUrl = (typeof PHISHGUARD_DEFAULT_CONFIG !== "undefined" && PHISHGUARD_DEFAULT_CONFIG.SERVER_URL)
            ? PHISHGUARD_DEFAULT_CONFIG.SERVER_URL.trim().replace(/\/$/, "")
            : "";
        if (defaultUrl) {
            if (urlInput) urlInput.value = defaultUrl;
            await chrome.storage.local.set({ phishguardServerUrl: defaultUrl });
            currentServer = defaultUrl;
            if (succBox) {
                succBox.style.display = "block";
                succBox.textContent = "Reset to default production endpoint.";
            }
            updateServerStatusUI();
            runDiagnosticPing(defaultUrl);
        }
    });

    saveBtn?.addEventListener("click", async () => {
        if (errBox) errBox.style.display = "none";
        if (succBox) succBox.style.display = "none";
        const val = (urlInput?.value || "").trim().replace(/\/$/, "");
        if (!val) {
            if (errBox) {
                errBox.style.display = "block";
                errBox.textContent = "Server URL cannot be empty.";
            }
            return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        await chrome.storage.local.set({ phishguardServerUrl: val });
        currentServer = val;
        chrome.runtime.sendMessage({ action: "updateRulesNow" }).catch(() => {});
        updateServerStatusUI();
        await runDiagnosticPing(val);
        saveBtn.disabled = false;
        saveBtn.textContent = "Save & Sync";
        if (succBox) {
            succBox.style.display = "block";
            succBox.textContent = "✓ Saved! Server URL updated and synchronizing.";
        }
        setTimeout(() => closeModal(), 1200);
    });
}

document.getElementById("rescanBtn")?.addEventListener("click", () => scanCurrentTab(true));
document.getElementById("trustBtn")?.addEventListener("click", toggleTrust);
document.getElementById("untrustBtn")?.addEventListener("click", toggleTrust);
document.getElementById("soundBtn")?.addEventListener("click", toggleSound);

scanCurrentTab();
initSoundBtn();
updateServerStatusUI();
initUninstallProtection();
initServerSettingsModal();
