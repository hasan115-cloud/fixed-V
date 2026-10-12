// PhishGuard Enterprise Webmail Phishing Protection Content Script
// Comprehensive real-time protection for Yahoo Mail, Gmail, Outlook Web, and corporate webmail
(function () {
    if (window !== window.top) return;

    const processed  = new WeakSet();
    const verdictMap = new Map();
    const anchorMap  = new Map(); // normalizedUrl -> Set<HTMLAnchorElement>

    function detectEmailService() {
        const host = window.location.hostname.toLowerCase();
        if (host.includes("yahoo.")) return "Yahoo Mail";
        if (host.includes("google.com")) return "Gmail";
        if (host.includes("outlook.") || host.includes("office.") || host.includes("office365.")) return "Outlook Web";
        return "Webmail";
    }

    const currentProvider = detectEmailService();

    function safeHost(url) {
        try { return new URL(url).hostname; } catch { return url; }
    }

    /**
     * Unwraps redirect wrappers, tracking URLs, and encoded target parameters
     * Handles Yahoo Mail (r.mail.yahoo.com), Google (google.com/url?q=), Outlook SafeLinks, and encoded queries
     */
    function extractDestinationUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== "string") return "";
        let trimmed = rawUrl.trim();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return "";

        try {
            const parsed = new URL(trimmed);
            const host = parsed.hostname.toLowerCase();

            // 1. Yahoo Mail redirect wrappers
            // e.g. https://r.mail.yahoo.com/default/... or https://*.mail.yahoo.com/redirect?to=...
            if (host.includes("yahoo.com") || host.includes("yahoo.net")) {
                const targetParam = parsed.searchParams.get("to") ||
                                    parsed.searchParams.get("url") ||
                                    parsed.searchParams.get("dest") ||
                                    parsed.searchParams.get("target") ||
                                    parsed.searchParams.get("u") ||
                                    parsed.searchParams.get("redir");
                if (targetParam && (targetParam.startsWith("http://") || targetParam.startsWith("https://"))) {
                    return extractDestinationUrl(decodeURIComponent(targetParam));
                }

                // Path-based Yahoo wrapper: https://r.mail.yahoo.com/r/url=https%3A%2F%2F...
                const match = trimmed.match(/[?&/]url=([^&]+)/i);
                if (match && match[1]) {
                    const decoded = decodeURIComponent(match[1]);
                    if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
                        return extractDestinationUrl(decoded);
                    }
                }
            }

            // 2. Google Mail redirect wrappers
            // e.g. https://www.google.com/url?q=https://...
            if (host.includes("google.") && parsed.pathname.startsWith("/url")) {
                const q = parsed.searchParams.get("q") || parsed.searchParams.get("url");
                if (q && (q.startsWith("http://") || q.startsWith("https://"))) {
                    return extractDestinationUrl(decodeURIComponent(q));
                }
            }

            // 3. Outlook Safelinks wrappers
            // e.g. https://*.safelinks.protection.outlook.com/?url=https://...
            if (host.includes("safelinks.protection.outlook.com")) {
                const u = parsed.searchParams.get("url");
                if (u && (u.startsWith("http://") || u.startsWith("https://"))) {
                    return extractDestinationUrl(decodeURIComponent(u));
                }
            }

            // 4. Generic tracking redirect parameters
            for (const paramName of ["url", "dest", "target", "redirect", "redirect_url", "link", "goto"]) {
                const val = parsed.searchParams.get(paramName);
                if (val && (val.startsWith("http://") || val.startsWith("https://"))) {
                    return extractDestinationUrl(decodeURIComponent(val));
                }
            }

            return trimmed;
        } catch {
            return trimmed;
        }
    }

    /**
     * Checks if anchor text displays a legitimate domain while destination points to a completely different domain
     * Example: Anchor text says "https://login.yahoo.com" but href points to "http://fake-security-update.xyz"
     */
    function isDeceptiveAnchorText(anchorText, destUrl) {
        if (!anchorText || !destUrl) return false;
        const text = anchorText.trim().toLowerCase();
        try {
            const destHost = new URL(destUrl).hostname.toLowerCase().replace(/^www\./, "");
            const domainPattern = /(https?:\/\/)?([a-z0-9-]+(\.[a-z0-9-]+)+)/i;
            const match = text.match(domainPattern);
            if (match && match[2]) {
                const displayedHost = match[2].toLowerCase().replace(/^www\./, "");
                // If displayed text looks like an official domain but destination is different
                if (displayedHost !== destHost && !destHost.endsWith("." + displayedHost)) {
                    return { displayed: displayedHost, actual: destHost };
                }
            }
        } catch { }
        return false;
    }

    let toastContainer = null;
    function getToastContainer() {
        if (!toastContainer || !document.body.contains(toastContainer)) {
            toastContainer = document.createElement("div");
            toastContainer.setAttribute("data-phishguard", "email-toasts");
            toastContainer.style.cssText =
                "position:fixed;top:18px;right:18px;z-index:2147483647;" +
                "display:flex;flex-direction:column;gap:8px;pointer-events:none;";
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    function showEmailToast(message, type = "phishing") {
        const bg = type === "phishing" ? "#7f1d1d" : "#78350f";
        const border = type === "phishing" ? "#ef4444" : "#f59e0b";
        const icon = type === "phishing" ? "🛑" : "⚠️";

        const t = document.createElement("div");
        t.style.cssText =
            `background:${bg};border:1px solid ${border};color:#ffffff;` +
            `padding:12px 16px;border-radius:8px;font-size:13px;` +
            `font-family:'Segoe UI',sans-serif;max-width:340px;` +
            `box-shadow:0 8px 24px rgba(0,0,0,0.6);pointer-events:auto;` +
            `transition:opacity 0.3s ease;line-height:1.45;`;
        t.innerHTML = `<div style="font-weight:bold;margin-bottom:2px;">${icon} PhishGuard Email Protection</div><div style="font-size:12px;opacity:0.95;">${message}</div>`;
        getToastContainer().appendChild(t);
        setTimeout(() => {
            t.style.opacity = "0";
            setTimeout(() => t.remove(), 350);
        }, 6000);
    }

    function applyEmailVerdict(a, destinationUrl, verdict, score, reasons = []) {
        const host = safeHost(destinationUrl);
        const anchorText = (a.textContent || "").trim();
        const deception = isDeceptiveAnchorText(anchorText, destinationUrl);

        if (verdict === "PHISHING" || deception) {
            a.style.cssText += "color:#ff4d5e!important;text-decoration:line-through!important;background:rgba(239,68,68,0.18)!important;padding:2px 6px!important;border-radius:4px!important;border:1px solid #ef4444!important;cursor:not-allowed!important;";
            
            const reasonText = deception
                ? `Deceptive URL mismatch (Text displays "${deception.displayed}" but points to "${deception.actual}")`
                : (reasons[0] || "Identified as malicious phishing destination");

            a.title = `⛔ PhishGuard [${currentProvider}]: BLOCKED PHISHING (${(score * 100).toFixed(0)}% risk)\nDestination: ${destinationUrl}\nReason: ${reasonText}`;

            // Add visual inline warning badge if not already present
            if (!a.parentNode?.querySelector(`[data-pg-email-badge="${a.href}"]`)) {
                const badge = document.createElement("span");
                badge.setAttribute("data-pg-email-badge", a.href);
                badge.style.cssText =
                    "display:inline-block;background:#dc2626;color:#ffffff;" +
                    "font-size:10px;font-family:'Segoe UI',sans-serif;font-weight:700;" +
                    "padding:2px 6px;border-radius:4px;margin-left:6px;" +
                    "vertical-align:middle;white-space:nowrap;cursor:default;line-height:1.4;";
                badge.textContent = `🛑 Phishing Link Blocked (${(score * 100).toFixed(0)}%)`;
                a.parentNode?.insertBefore(badge, a.nextSibling);
            }

            if (!a._pgEmailBound) {
                a._pgEmailBound = true;
                a.addEventListener("click", e => {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    showEmailToast(`Phishing link blocked in ${currentProvider}: ${host}`, "phishing");

                    // Report blocked in-page email click to central server
                    chrome.runtime.sendMessage({
                        action: "reportBlockedClick",
                        url: destinationUrl,
                        score: score,
                        source: `${currentProvider.toLowerCase().replace(/\s+/g, "-")}-phishing-click`
                    }).catch(() => {});

                    const proceed = confirm(
                        `🛑 PhishGuard Email Protection [${currentProvider}]\n\n` +
                        `Destination URL: ${destinationUrl}\n\n` +
                        `Risk Level: ${(score * 100).toFixed(0)}% (PHISHING THREAT)\n` +
                        `Reason: ${reasonText}\n\n` +
                        `This link was identified as a dangerous phishing or spoofed attack. Proceeding may compromise your credentials.\n\n` +
                        `Do you wish to override and open this link?`
                    );

                    if (proceed) {
                        window.open(destinationUrl, "_blank", "noopener,noreferrer");
                    }
                }, { capture: true });
            }
        } else if (verdict === "SUSPICIOUS") {
            a.style.cssText += "color:#f59e0b!important;border-bottom:2px dashed #f59e0b!important;background:rgba(245,158,11,0.12)!important;padding:1px 4px!important;border-radius:3px!important;";
            a.title = `⚠️ PhishGuard [${currentProvider}]: Suspicious Link (${(score * 100).toFixed(0)}% risk) — ${host}`;

            if (!a._pgEmailBound) {
                a._pgEmailBound = true;
                a.addEventListener("click", () => {
                    showEmailToast(`Warning: Suspicious destination link (${host}) in ${currentProvider}`, "suspicious");
                }, { capture: true });
            }
        } else if (verdict === "SAFE") {
            a.setAttribute("data-phishguard-safe", "1");
            a.title = `✅ PhishGuard [${currentProvider}]: Verified Safe Link (${host})`;
        }
    }

    function scanBatch(urls) {
        return new Promise(resolve => {
            const src = `${currentProvider.toLowerCase().replace(/\s+/g, "-")}-scanner`;
            chrome.runtime.sendMessage({ action: "bulkScan", urls, source: src }, res => {
                if (res?.results) {
                    res.results.forEach((r, i) => {
                        const targetUrl = urls[i];
                        if (r && r.verdict && r.verdict !== "ERROR") {
                            verdictMap.set(targetUrl, {
                                verdict: r.verdict,
                                score: r.score ?? r.risk_score ?? 0,
                                reasons: r.reasons || []
                            });
                        }
                    });
                }
                resolve();
            });
        });
    }

    /**
     * Comprehensive selectors covering:
     * - Yahoo Mail modern and classic DOM containers
     * - Gmail thread, reading pane, dynamic previews
     * - Outlook Web mail reader and preview frames
     */
    const EMAIL_SELECTORS = [
        // Yahoo Mail selectors (modern and classic)
        "[data-test-id='message-view-body'] a[href]",
        "[data-test-id='message-body-container'] a[href]",
        "[data-test-id='expanded-message-body'] a[href]",
        ".msg-body a[href]",
        ".email-wrapped a[href]",
        "#yiv-body a[href]",
        "[id^='yiv'] a[href]",
        ".yiv-msg a[href]",
        ".thread-item a[href]",
        "[data-test-id='card-item'] a[href]",

        // Gmail selectors
        ".a3s.aiL a[href]",
        ".a3s a[href]",
        "[data-message-id] a[href]",
        ".ii.gt a[href]",

        // Outlook Web selectors
        ".ReadMsgBody a[href]",
        "[data-content-type] a[href]",
        ".ItemPartBody a[href]",
        ".rps_ a[href]",
        "[aria-label='Message body'] a[href]"
    ];

    function collectEmailLinks() {
        const anchors = [];

        // 1. Target email content body selectors specifically
        EMAIL_SELECTORS.forEach(sel => {
            try {
                const els = document.querySelectorAll(sel);
                for (let i = 0; i < els.length; i++) anchors.push(els[i]);
            } catch { }
        });

        // 2. Fallback: if user is on Yahoo Mail, Gmail, or Outlook, also examine any anchor inside main mail regions
        if (anchors.length === 0) {
            try {
                const fallbacks = document.querySelectorAll("main a[href], role[region] a[href], div[role='main'] a[href]");
                for (let i = 0; i < fallbacks.length; i++) anchors.push(fallbacks[i]);
            } catch { }
        }

        const newUrlsToScan = [];

        anchors.forEach(a => {
            if (processed.has(a)) return;

            const rawHref = a.getAttribute("href") || a.href;
            if (!rawHref) return;

            const destUrl = extractDestinationUrl(rawHref);
            if (!destUrl || (!destUrl.startsWith("http://") && !destUrl.startsWith("https://"))) return;

            // Don't scan internal mail navigation tabs, compose shortcuts, or actions on the same host
            try {
                const destHost = new URL(destUrl).hostname.toLowerCase();
                const currentHost = window.location.hostname.toLowerCase();
                if (destHost === currentHost) {
                    // Check if it's a mail redirect URL that failed to extract
                    if (!rawHref.includes("/r/") && !rawHref.includes("redirect")) {
                        processed.add(a);
                        return;
                    }
                }
            } catch {
                return;
            }

            processed.add(a);

            if (!anchorMap.has(destUrl)) {
                anchorMap.set(destUrl, new Set());
            }
            anchorMap.get(destUrl).add(a);

            if (verdictMap.has(destUrl)) {
                const { verdict, score, reasons } = verdictMap.get(destUrl);
                applyEmailVerdict(a, destUrl, verdict, score, reasons);
                return;
            }

            newUrlsToScan.push(destUrl);
        });

        return [...new Set(newUrlsToScan)];
    }

    let scanRunning = false;
    let pendingScanQueue = [];

    async function processScanQueue() {
        if (scanRunning || pendingScanQueue.length === 0) return;
        scanRunning = true;

        try {
            const batch = pendingScanQueue.splice(0, 40);
            for (let i = 0; i < batch.length; i += 20) {
                const chunk = batch.slice(i, i + 20);
                await scanBatch(chunk);
                chunk.forEach(url => {
                    const verdictInfo = verdictMap.get(url);
                    if (verdictInfo) {
                        const boundAnchors = anchorMap.get(url);
                        if (boundAnchors) {
                            boundAnchors.forEach(a => {
                                applyEmailVerdict(a, url, verdictInfo.verdict, verdictInfo.score, verdictInfo.reasons);
                            });
                        }
                    }
                });
            }
        } finally {
            scanRunning = false;
            if (pendingScanQueue.length > 0) {
                setTimeout(processScanQueue, 500);
            }
        }
    }

    function scanEmailLinks() {
        const urls = collectEmailLinks();
        if (urls.length === 0) return;

        urls.forEach(u => {
            if (!pendingScanQueue.includes(u)) {
                pendingScanQueue.push(u);
            }
        });

        processScanQueue();
    }

    // Initial scans when email message opens
    setTimeout(scanEmailLinks, 1200);
    setTimeout(scanEmailLinks, 2500);

    // MutationObserver to catch dynamically opened emails, lazy-loaded threads, and scrolling
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
        let hasRelevantChanges = false;
        for (let i = 0; i < mutations.length; i++) {
            if (mutations[i].addedNodes.length > 0) {
                hasRelevantChanges = true;
                break;
            }
        }
        if (!hasRelevantChanges) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanEmailLinks, 800);
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener("DOMContentLoaded", () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    console.log(`PhishGuard webmail security engine active on ${currentProvider} (${window.location.hostname})`);
})();
