import { db } from "./db";

export interface ClassificationResult {
  url: string;
  domain: string;
  verdict: "SAFE" | "SUSPICIOUS" | "PHISHING";
  action: "ALLOWED" | "WARNING" | "BLOCKED";
  score: number;
  reasons: string[];
  ruleTriggered?: boolean;
  ruleType?: "WHITELIST" | "PHISHING" | null;
}

const KNOWN_SAFE_APEX = new Set([
  "google.com", "google.co.uk", "google.ca", "google.com.au",
  "microsoft.com", "office.com", "azure.com", "live.com", "outlook.com",
  "apple.com", "icloud.com",
  "amazon.com", "aws.amazon.com",
  "github.com", "gitlab.com", "stackoverflow.com", "npmjs.com",
  "youtube.com", "linkedin.com", "twitter.com", "x.com",
  "facebook.com", "instagram.com", "whatsapp.com",
  "wikipedia.org", "cloudflare.com", "dropbox.com", "slack.com",
  "zoom.us", "salesforce.com", "atlassian.com", "trello.com"
]);

const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "buzz", "club", "cam", "work", "fit", "rest", "surf", "icu", "bar", "live"
]);

const BRAND_TARGETS = [
  "paypal", "netflix", "microsoft", "apple", "google", "amazon", "chase",
  "bankofamerica", "wellsfargo", "citibank", "coinbase", "binance", "metamask",
  "outlook", "facebook", "instagram", "dhl", "fedex", "usps", "irs"
];

function extractDomain(urlStr: string): string {
  try {
    let clean = urlStr.trim();
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "http://" + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.toLowerCase();
  } catch {
    return urlStr.toLowerCase();
  }
}

function getApex(hostname: string): string {
  const parts = hostname.replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const compoundSlds = new Set(["co", "com", "org", "net", "gov", "edu"]);
  if (parts.length >= 3 && compoundSlds.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

export async function classifyUrl(rawUrl: string): Promise<ClassificationResult> {
  const domain = extractDomain(rawUrl);
  const apex = getApex(domain);

  // 1. Check Central Whitelist Rules
  try {
    const whitelist = await db.getWhitelistRules();
    for (const rule of whitelist) {
      if (rule.enabled === false) continue;
      const pat = rule.pattern.toLowerCase();
      if (domain === pat || domain.endsWith("." + pat) || rawUrl.toLowerCase().includes(pat)) {
        return {
          url: rawUrl,
          domain,
          verdict: "SAFE",
          action: "ALLOWED",
          score: 0.0,
          reasons: [`Whitelisted Rule Matched: ${rule.pattern}${rule.description ? ` (${rule.description})` : ""}`],
          ruleTriggered: true,
          ruleType: "WHITELIST"
        };
      }
    }
  } catch (err) {
    console.warn("Failed checking whitelist rules:", err);
  }

  // 2. Check Central Phishing Rules
  try {
    const phishingRules = await db.getPhishingRules();
    for (const rule of phishingRules) {
      if (rule.enabled === false) continue;
      const pat = rule.pattern.toLowerCase();
      if (domain === pat || domain.endsWith("." + pat) || rawUrl.toLowerCase().includes(pat)) {
        return {
          url: rawUrl,
          domain,
          verdict: "PHISHING",
          action: "BLOCKED",
          score: 0.99,
          reasons: [`Blacklisted Rule Triggered: ${rule.pattern}${rule.reason ? ` (${rule.reason})` : ""}`],
          ruleTriggered: true,
          ruleType: "PHISHING"
        };
      }
    }
  } catch (err) {
    console.warn("Failed checking phishing rules:", err);
  }

  // 3. Known safe top domains
  if (KNOWN_SAFE_APEX.has(apex)) {
    return {
      url: rawUrl,
      domain,
      verdict: "SAFE",
      action: "ALLOWED",
      score: 0.02,
      reasons: ["Verified legitimate enterprise domain"]
    };
  }

  // 4. Heuristic engine
  const reasons: string[] = [];
  let score = 0.05;

  // Direct IP address as host
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(domain)) {
    score += 0.55;
    reasons.push("Host is a raw numerical IP address");
  }

  // Suspicious TLD
  const tld = domain.split(".").pop() || "";
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 0.3;
    reasons.push(`Unusual or high-risk top-level domain (.${tld})`);
  }

  // Brand spoofing / impersonation check
  for (const brand of BRAND_TARGETS) {
    if (domain.includes(brand) && !apex.startsWith(brand + ".")) {
      score += 0.55;
      reasons.push(`Suspected brand impersonation targeting '${brand}'`);
      break;
    }
  }

  // URL Keywords
  const urlLower = rawUrl.toLowerCase();
  const suspiciousKeywords = ["login", "verify", "signin", "account-update", "confirm-identity", "banking", "credential", "suspend", "secure-portal"];
  let matchedKeywords = 0;
  for (const kw of suspiciousKeywords) {
    if (urlLower.includes(kw)) {
      matchedKeywords++;
    }
  }
  if (matchedKeywords > 0) {
    score += Math.min(0.35, matchedKeywords * 0.15);
    reasons.push(`Contains high-risk credential keywords (${matchedKeywords})`);
  }

  // Excessive subdomain depth or hyphens
  if (domain.split(".").length > 4) {
    score += 0.15;
    reasons.push("Excessive subdomain nesting depth");
  }
  const hyphenCount = (domain.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    score += 0.2;
    reasons.push("Abnormal hyphen count in hostname");
  }

  score = Math.min(1.0, Math.max(0.0, score));

  let verdict: "SAFE" | "SUSPICIOUS" | "PHISHING" = "SAFE";
  let action: "ALLOWED" | "WARNING" | "BLOCKED" = "ALLOWED";

  if (score >= 0.75) {
    verdict = "PHISHING";
    action = "BLOCKED";
  } else if (score >= 0.35) {
    verdict = "SUSPICIOUS";
    action = "WARNING";
  } else {
    verdict = "SAFE";
    action = "ALLOWED";
    if (reasons.length === 0) {
      reasons.push("No threat indicators detected");
    }
  }

  return {
    url: rawUrl,
    domain,
    verdict,
    action,
    score: parseFloat(score.toFixed(2)),
    reasons
  };
}
