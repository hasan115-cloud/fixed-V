// PhishGuard Extension Configuration
// Pre-configured by PhishGuard Enterprise Security Hub on download or customizable in popup settings
const PHISHGUARD_DEFAULT_CONFIG = {
    SERVER_URL: "https://ais-dev-ooxrwsnfmpqlbs4x62oua7-361661540763.asia-southeast1.run.app"
};

if (typeof self !== "undefined") {
    self.PHISHGUARD_DEFAULT_CONFIG = PHISHGUARD_DEFAULT_CONFIG;
}
if (typeof window !== "undefined") {
    window.PHISHGUARD_DEFAULT_CONFIG = PHISHGUARD_DEFAULT_CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = PHISHGUARD_DEFAULT_CONFIG;
}
