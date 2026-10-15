import http from "http";
import assert from "assert";

const BASE_URL = process.env.TEST_SERVER_URL || "http://127.0.0.1:3000";

console.log("=================================================");
console.log("PhishGuard Enterprise E2E Integration Test Suite");
console.log("Target Server:", BASE_URL);
console.log("=================================================\n");

let passedCount = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`[TEST ${totalTests}] ${name} ... `);
  try {
    await fn();
    passedCount++;
    console.log("✓ PASS");
  } catch (err) {
    console.log("✕ FAIL");
    console.error("   Error:", err.message);
  }
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, ok: res.ok, json, text };
}

async function main() {
  const testClientId = `test-agent-${Date.now().toString(36)}`;
  let testRuleId = "";
  let testRemovalRequestId = "";
  let testRemovalAuthToken = "";

  // 1. Health check
  await runTest("GET /api/health returns operational status", async () => {
    const res = await api("/api/health", { method: "GET" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.status, "ok");
  });

  // 2. Info endpoint
  await runTest("GET /api/info returns server configuration", async () => {
    const res = await api("/api/info", { method: "GET" });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json?.serverUrl);
    assert.strictEqual(res.json?.status, "operational");
  });

  // 3. Extension ZIP download & dynamic configuration injection
  await runTest("GET /api/download-extension packages valid zip", async () => {
    const res = await fetch(`${BASE_URL}/api/download-extension`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get("content-type") || "";
    assert.ok(contentType.includes("zip") || contentType.includes("octet-stream"));
    const buffer = await res.arrayBuffer();
    assert.ok(buffer.byteLength > 5000, "ZIP buffer must contain extension assets");
  });

  // 4. Client Registration (Enrollment)
  await runTest("POST /api/clients/register enrolls device with stable ID", async () => {
    const res = await api("/api/clients/register", {
      method: "POST",
      body: JSON.stringify({
        clientId: testClientId,
        clientName: "Audit-Workstation-01",
        os: "Linux",
        browser: "Chrome 122",
        platform: "x86_64",
        extensionVersion: "1.4"
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.success, true);
    assert.strictEqual(res.json?.client?.id, testClientId);
    assert.strictEqual(res.json?.client?.status, "ENROLLED");
  });

  // 5. Client Heartbeat
  await runTest("POST /api/clients/heartbeat updates telemetry and last_seen", async () => {
    const res = await api("/api/clients/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        clientId: testClientId,
        clientName: "Audit-Workstation-01",
        ruleVersion: 1,
        stats: { total: 10, safe: 8, suspicious: 1, phishing: 1 }
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.success, true);
    assert.ok(typeof res.json?.ruleVersion === "number");
  });

  // 6. Security Rule Management (Add Whitelist Rule)
  await runTest("POST /api/rules/whitelist adds central allowed pattern", async () => {
    const pattern = `safe-partner-${Date.now().toString(36)}.org`;
    const res = await api("/api/rules/whitelist", {
      method: "POST",
      body: JSON.stringify({
        pattern,
        description: "Automated audit whitelist test rule"
      })
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json?.rule?.id);
    testRuleId = res.json?.rule?.id;
  });

  // 7. Security Rule Sync
  await runTest("GET /api/rules verifies central rule synchronization", async () => {
    const res = await api("/api/rules", { method: "GET" });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json?.whitelist));
    assert.ok(Array.isArray(res.json?.phishing));
  });

  // 8. Single URL Scan Endpoint
  await runTest("POST /api/scan evaluates and persists URL classification", async () => {
    const res = await api("/api/scan", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example-test-safe-audit.com/portal",
        source: "e2e-audit",
        clientId: testClientId,
        clientName: "Audit-Workstation-01"
      })
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json?.verdict);
    assert.strictEqual(res.json?.action, "ALLOWED");
  });

  // 9. URL Events Batch Telemetry
  await runTest("POST /api/url-events records durable telemetry queue", async () => {
    const eventId = `evt-audit-${Date.now()}`;
    const res = await api("/api/url-events", {
      method: "POST",
      body: JSON.stringify({
        clientId: testClientId,
        clientName: "Audit-Workstation-01",
        events: [
          {
            eventId,
            url: "https://secure-login-portal-test.net",
            source: "e2e-audit-batch",
            observedAt: new Date().toISOString()
          }
        ]
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.success, true);
    assert.ok(res.json?.acknowledgedIds?.includes(eventId));
  });

  // 10. Threat Alert Reporting & Status Update
  await runTest("POST /api/threats/alert & PATCH /api/threats/:id lifecycle", async () => {
    const alertRes = await api("/api/threats/alert", {
      method: "POST",
      body: JSON.stringify({
        clientId: testClientId,
        clientName: "Audit-Workstation-01",
        url: "http://malicious-phishing-login-test.xyz/verify",
        domain: "malicious-phishing-login-test.xyz",
        score: 0.98,
        reasons: ["Phishing pattern matched", "Suspicious credential field"],
        source: "e2e-audit"
      })
    });
    assert.strictEqual(alertRes.status, 200);
    assert.ok(alertRes.json?.alert?.id);
    const alertId = alertRes.json?.alert?.id;

    // Acknowledge alert
    const patchRes = await api(`/api/threats/${alertId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ACKNOWLEDGED" })
    });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.json?.success, true);
  });

  // 11. Admin Removal Request Workflow
  await runTest("Removal Request workflow (Create -> Approve -> Consume Token)", async () => {
    // A. Create removal request from extension
    const createRes = await api("/api/removal-requests/create", {
      method: "POST",
      body: JSON.stringify({
        clientId: testClientId,
        clientName: "Audit-Workstation-01",
        reason: "Hardware decomission audit"
      })
    });
    assert.strictEqual(createRes.status, 200);
    assert.ok(createRes.json?.request?.id);
    testRemovalRequestId = createRes.json?.request?.id;
    assert.strictEqual(createRes.json?.request?.status, "PENDING");

    // B. Admin Review & Approval
    const reviewRes = await api(`/api/removal-requests/${testRemovalRequestId}/review`, {
      method: "POST",
      body: JSON.stringify({
        decision: "APPROVE",
        username: "admin",
        password: "admin123",
        note: "Approved by enterprise security admin"
      })
    });
    assert.strictEqual(reviewRes.status, 200);
    assert.strictEqual(reviewRes.json?.request?.status, "APPROVED");
    assert.ok(reviewRes.json?.request?.authorizationToken);
    testRemovalAuthToken = reviewRes.json?.request?.authorizationToken;

    // C. Extension consumes authorization token
    const consumeRes = await api("/api/removal-requests/verify-token", {
      method: "POST",
      body: JSON.stringify({
        clientId: testClientId,
        token: testRemovalAuthToken
      })
    });
    assert.strictEqual(consumeRes.status, 200);
    assert.strictEqual(consumeRes.json?.authorized, true);
  });

  // 12. Dashboard Statistics & Aggregations
  await runTest("GET /api/stats computes metrics from persisted records", async () => {
    const res = await api("/api/stats", { method: "GET" });
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.json?.totalSystems === "number");
    assert.ok(typeof res.json?.urlsMonitored === "number");
    assert.ok(res.json?.breakdown);
  });

  // 13. Security Rule Enable/Disable & Update via PATCH
  await runTest("PATCH /api/rules/whitelist/:id toggles rule active state", async () => {
    if (!testRuleId) return;
    const patchRes = await api(`/api/rules/whitelist/${testRuleId}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: false, description: "Temporarily disabled rule" })
    });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.json?.success, true);
    assert.strictEqual(patchRes.json?.rule?.enabled, false);

    // Re-enable
    const reEnableRes = await api(`/api/rules/whitelist/${testRuleId}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: true })
    });
    assert.strictEqual(reEnableRes.status, 200);
    assert.strictEqual(reEnableRes.json?.rule?.enabled, true);
  });

  // 14. Direct Admin On-Device Verify Uninstall Endpoint
  await runTest("POST /api/admin/verify-uninstall authorizes valid admin credentials", async () => {
    const res = await api("/api/admin/verify-uninstall", {
      method: "POST",
      body: JSON.stringify({
        username: "admin",
        password: "admin123",
        clientId: "test-device-uninstall-verify",
        clientName: "Test Device"
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json?.authorized, true);
  });

  // 15. Reports Endpoint with Date and Time Filters
  await runTest("GET /api/reports?startDate=...&endDate=... computes filtered metrics", async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000).toISOString();
    const future = new Date(now.getTime() + 3600 * 1000).toISOString();
    const res = await api(`/api/reports?startDate=${encodeURIComponent(oneHourAgo)}&endDate=${encodeURIComponent(future)}`, { method: "GET" });
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.json?.summary?.totalEvaluated === "number");
    assert.ok(Array.isArray(res.json?.events));
    assert.ok(Array.isArray(res.json?.topThreatDomains));
  });

  // Cleanup created rule
  if (testRuleId) {
    await api(`/api/rules/whitelist/${testRuleId}`, { method: "DELETE" }).catch(() => {});
  }

  console.log("\n=================================================");
  console.log(`Test Results: ${passedCount} / ${totalTests} passed`);
  console.log("=================================================");

  if (passedCount !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
