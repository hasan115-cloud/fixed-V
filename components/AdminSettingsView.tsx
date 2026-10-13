"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  UserCheck
} from "lucide-react";
import {
  changeAdminCredentials,
  fetchServerInfo,
  getAdminStatus,
  getDownloadExtensionUrl,
  verifyAdminPassword
} from "../api";

export const AdminSettingsView: React.FC = () => {
  const [adminUser, setAdminUser] = useState("admin");
  const [serverUrl, setServerUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<"IDLE" | "SUCCESS" | "FAILED">("IDLE");
  const [verifyPasswordInput, setVerifyPasswordInput] = useState("");

  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    getAdminStatus().then(data => {
      if (data?.username) {
        setAdminUser(data.username);
        setNewUsername(data.username);
      }
    }).catch(() => {});

    fetchServerInfo().then(data => {
      if (data?.serverUrl) setServerUrl(data.serverUrl);
    }).catch(() => {});
  }, []);

  const showStatus = (text: string, isError = false) => {
    setStatusMsg({ text, isError });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerifyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPasswordInput) return;
    setIsVerifying(true);
    setVerificationResult("IDLE");
    try {
      const res = await verifyAdminPassword(verifyPasswordInput);
      if (res.valid) {
        setVerificationResult("SUCCESS");
        showStatus("Admin authentication verified successfully.");
      } else {
        setVerificationResult("FAILED");
        showStatus("Invalid password. Authentication failed.", true);
      }
    } catch {
      setVerificationResult("FAILED");
      showStatus("Incorrect password or verification failed.", true);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showStatus("Please enter your current admin password.", true);
      return;
    }
    if (!newPassword) {
      showStatus("Please enter a new password.", true);
      return;
    }
    if (newPassword.length < 6) {
      showStatus("New password must be at least 6 characters long.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showStatus("New password and confirm password do not match.", true);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changeAdminCredentials(
        currentPassword,
        newUsername.trim() || adminUser,
        newPassword
      );
      showStatus(res.message || "Admin credentials updated successfully!");
      if (newUsername.trim()) setAdminUser(newUsername.trim());
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showStatus(err.message || "Failed to update admin credentials.", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const windowsRegistrySnippet = `Windows Registry Editor Version 5.00

; Enforce PhishGuard Extension on Managed Windows Workstations
; Disables user right-click "Remove from Chrome" and browser uninstall toggle
[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist]
"1"="phishguard_extension_id;https://clients2.google.com/service/update2/crx"

; Optional: Allow auto-update and prevent developer bypass
[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome]
"ExtensionInstallSources"=hex(7):2a,00,2a,00,00,00`;

  const macosProfileSnippet = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- PhishGuard Chrome Force-Install Policy for macOS MDM (Jamf / Intune / Kandji) -->
<plist version="1.0">
<dict>
    <key>PayloadDisplayName</key>
    <string>PhishGuard Enterprise Protection</string>
    <key>PayloadType</key>
    <string>com.google.Chrome</string>
    <key>ExtensionInstallForcelist</key>
    <array>
        <string>phishguard_extension_id;https://clients2.google.com/service/update2/crx</string>
    </array>
</dict>
</plist>`;

  const linuxJsonSnippet = `// /etc/opt/chrome/policies/managed/phishguard_policy.json
{
  "ExtensionInstallForcelist": [
    "phishguard_extension_id;https://clients2.google.com/service/update2/crx"
  ],
  "ExtensionInstallSources": [
    "https://*/*"
  ]
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#0e0e0e] border border-[#262626] p-5 rounded-xl">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-white" />
            <span>Admin Security & Enterprise Governance</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Manage administrative credentials, audit authentication tokens, and configure enterprise-grade uninstall prevention policies.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#161616] border border-[#262626] px-3.5 py-2 rounded-lg text-xs font-mono">
          <KeyRound className="w-4 h-4 text-emerald-400" />
          <span className="text-neutral-300">Active Admin: <strong className="text-white">{adminUser}</strong></span>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-all ${
            statusMsg.isError
              ? "bg-rose-500/15 border border-rose-500/30 text-rose-300"
              : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="opacity-70 hover:opacity-100 text-xs">✕</button>
        </div>
      )}

      {/* Grid: Credentials & Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Change Admin Credentials */}
        <div className="bg-[#0e0e0e] border border-[#262626] p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-neutral-100">Administrator Credentials</h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                SHA-256 + Salt
              </span>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Update central hub administrative access credentials. Passwords are never stored in plaintext and are hashed using cryptographic salt plus SHA-256.
            </p>

            <form onSubmit={handleChangeCredentials} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Current Admin Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    placeholder="Enter current admin password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#161616] border border-[#262626] text-neutral-200 text-xs px-3 py-2 pr-9 rounded focus:outline-none focus:border-white font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-200"
                  >
                    {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                  Admin Username
                </label>
                <input
                  type="text"
                  placeholder="admin"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full bg-[#161616] border border-[#262626] text-neutral-200 text-xs px-3 py-2 rounded focus:outline-none focus:border-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    New Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-[#161616] border border-[#262626] text-neutral-200 text-xs px-3 py-2 pr-9 rounded focus:outline-none focus:border-white font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-200"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Confirm New Password <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type={showNewPass ? "text" : "password"}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#161616] border border-[#262626] text-neutral-200 text-xs px-3 py-2 rounded focus:outline-none focus:border-white font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-bold py-2 rounded transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{isSubmitting ? "Updating Credentials..." : "Save Admin Credentials"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Panel 2: Test Admin Access & System Enrollment Token */}
        <div className="space-y-6">
          {/* Quick Access Verification */}
          <div className="bg-[#0e0e0e] border border-[#262626] p-5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-neutral-100">Verify Admin Session</h3>
              </div>
              {verificationResult === "SUCCESS" && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                  AUTHENTICATED
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Test whether current password authenticates against database hash without making modifications.
            </p>

            <form onSubmit={handleVerifyAccess} className="flex gap-2">
              <input
                type="password"
                placeholder="Enter password to verify..."
                value={verifyPasswordInput}
                onChange={e => setVerifyPasswordInput(e.target.value)}
                className="flex-1 bg-[#161616] border border-[#262626] text-neutral-200 text-xs px-3 py-2 rounded focus:outline-none focus:border-white font-mono"
                required
              />
              <button
                type="submit"
                disabled={isVerifying}
                className="bg-[#262626] hover:bg-[#333333] text-white text-xs font-semibold px-4 py-2 rounded transition-colors shrink-0"
              >
                {isVerifying ? "Verifying..." : "Verify Access"}
              </button>
            </form>
          </div>

          {/* Quick Download & Target Hub */}
          <div className="bg-[#0e0e0e] border border-[#262626] p-5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-neutral-100">Enterprise Agent Deployment Package</h3>
              </div>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Download the dynamic extension bundle pre-configured with this central server URL ({serverUrl || "active server"}).
            </p>

            <div className="flex items-center gap-3">
              <a
                href={getDownloadExtensionUrl()}
                download="phishguard-extension.zip"
                className="flex-1 flex items-center justify-center gap-2 bg-[#179c54] hover:bg-[#158849] text-white text-xs font-bold py-2 rounded shadow transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Extension Package (.ZIP)</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Policy & Uninstall Prevention Guide */}
      <div className="bg-[#0e0e0e] border border-[#262626] p-6 rounded-xl space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-neutral-100">
              Extension Uninstall Prevention & Enterprise Policy Enforcement
            </h3>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed max-w-4xl">
            In standard Google Chrome, standard browser extensions installed by an end user cannot programmatically remove or hide the native browser context menu item <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-white font-mono font-semibold">"Remove from Chrome"</code> or the toggle in <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-white font-mono font-semibold">chrome://extensions</code>.
            This is an intentional security boundary enforced by Chromium.
          </p>
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Enterprise Mandate:</strong> To prevent employees or workstations from disabling or removing PhishGuard, deploy it via <strong>Chrome Enterprise Management Policy</strong> (<code className="font-mono text-white">ExtensionInstallForcelist</code>). When installed via enterprise policy, Chrome locks the extension, disables uninstallation, and displays <strong className="text-white">"Installed by your administrator"</strong> with no option for the user to disable or remove it.
            </span>
          </div>
        </div>

        {/* OS Policy Snippets */}
        <div className="space-y-4">
          {/* Windows GPO */}
          <div className="bg-[#141414] border border-[#262626] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>1. Windows Active Directory / Registry GPO (Prevents Uninstall)</span>
              </div>
              <button
                onClick={() => copyToClipboard(windowsRegistrySnippet, "win")}
                className="text-xs bg-[#222222] hover:bg-[#333333] text-neutral-200 px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
              >
                {copiedKey === "win" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "win" ? "Copied" : "Copy .REG Script"}</span>
              </button>
            </div>
            <pre className="bg-[#080808] border border-[#1f1f1f] text-[11px] font-mono text-neutral-300 p-3 rounded overflow-x-auto whitespace-pre">
              {windowsRegistrySnippet}
            </pre>
          </div>

          {/* macOS MDM */}
          <div className="bg-[#141414] border border-[#262626] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <FileCode2 className="w-4 h-4 text-emerald-400" />
                <span>2. macOS MDM Configuration Profile (Jamf Pro / Microsoft Intune / Kandji)</span>
              </div>
              <button
                onClick={() => copyToClipboard(macosProfileSnippet, "mac")}
                className="text-xs bg-[#222222] hover:bg-[#333333] text-neutral-200 px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
              >
                {copiedKey === "mac" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "mac" ? "Copied" : "Copy .PLIST Payload"}</span>
              </button>
            </div>
            <pre className="bg-[#080808] border border-[#1f1f1f] text-[11px] font-mono text-neutral-300 p-3 rounded overflow-x-auto whitespace-pre">
              {macosProfileSnippet}
            </pre>
          </div>

          {/* Linux Managed Policy */}
          <div className="bg-[#141414] border border-[#262626] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <FileCode2 className="w-4 h-4 text-emerald-400" />
                <span>3. Linux Managed Policy (/etc/opt/chrome/policies/managed)</span>
              </div>
              <button
                onClick={() => copyToClipboard(linuxJsonSnippet, "linux")}
                className="text-xs bg-[#222222] hover:bg-[#333333] text-neutral-200 px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
              >
                {copiedKey === "linux" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "linux" ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>
            <pre className="bg-[#080808] border border-[#1f1f1f] text-[11px] font-mono text-neutral-300 p-3 rounded overflow-x-auto whitespace-pre">
              {linuxJsonSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
