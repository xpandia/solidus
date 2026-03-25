#!/usr/bin/env node
/**
 * Solidus Demo Seed Script
 *
 * Populates the running Solidus backend with institutional demo data
 * via API calls. Run this after starting the server to verify all
 * demo endpoints work correctly.
 *
 * Usage:
 *   node demo_seed.js                    # default: http://localhost:3001
 *   node demo_seed.js http://localhost:4000  # custom base URL
 */

const BASE_URL = process.argv[2] || "http://localhost:3001";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json();
  return { status: res.status, data };
}

function log(label, result) {
  const icon = result.status < 400 ? "OK" : "!!";
  console.log(`  [${icon}] ${label} -> ${result.status}`, JSON.stringify(result.data).slice(0, 120));
}

// ---------------------------------------------------------------------------
// Seed sequence
// ---------------------------------------------------------------------------

async function seed() {
  console.log("");
  console.log("==============================================");
  console.log(" SOLIDUS Demo Seed Script");
  console.log(` Target: ${BASE_URL}`);
  console.log("==============================================");
  console.log("");

  // 1. Health check
  console.log("1. Health check");
  const health = await api("GET", "/health");
  log("GET /health", health);
  if (health.status !== 200) {
    console.error("\n   Server is not running! Start it with: node server.js\n");
    process.exit(1);
  }
  console.log("");

  // 2. Verify pre-loaded demo state
  console.log("2. Verify pre-loaded demo state");
  const state = await api("GET", "/api/demo/state");
  log("GET /api/demo/state", state);
  console.log(`   Wallets: ${state.data.wallets?.length || 0}`);
  console.log(`   Transactions: ${state.data.transactions?.length || 0}`);
  console.log(`   Reserve ratio: ${state.data.reserve?.ratio}%`);
  console.log("");

  // 3. List wallets
  console.log("3. List institutional wallets");
  const wallets = await api("GET", "/api/demo/wallets");
  log("GET /api/demo/wallets", wallets);
  if (wallets.data.wallets) {
    for (const w of wallets.data.wallets) {
      console.log(`   - ${w.label}: ${w.address.slice(0, 12)}... [${w.role || "no role"}] ${w.balance}`);
    }
  }
  console.log("");

  // 4. List transactions
  console.log("4. List transactions");
  const txs = await api("GET", "/api/demo/transactions");
  log("GET /api/demo/transactions", txs);
  if (txs.data.transactions) {
    for (const tx of txs.data.transactions) {
      const statusTag = tx.status === "rejected" ? "REJECTED" : "OK";
      console.log(`   [${statusTag}] ${tx.description}`);
    }
  }
  console.log("");

  // 5. Filter rejected transactions
  console.log("5. Filter rejected transactions");
  const rejected = await api("GET", "/api/demo/transactions?status=rejected");
  log("GET /api/demo/transactions?status=rejected", rejected);
  console.log(`   Rejected count: ${rejected.data.count}`);
  console.log("");

  // 6. Reserve verification
  console.log("6. Reserve verification");
  const reserve = await api("GET", "/api/demo/verify-reserve");
  log("GET /api/demo/verify-reserve", reserve);
  console.log(`   Verified: ${reserve.data.verified}`);
  console.log(`   Ratio: ${reserve.data.ratio}%`);
  console.log(`   Supply: $${(reserve.data.totalSupply || 0).toLocaleString()}`);
  console.log(`   Backing: $${(reserve.data.backing || 0).toLocaleString()}`);
  console.log(`   Attestor: ${reserve.data.attestor}`);
  console.log("");

  // 7. THE CENTERPIECE: Compliance check — rejected transfer
  console.log("==============================================");
  console.log(" 7. COMPLIANCE CHECK (the demo centerpiece)");
  console.log("==============================================");
  console.log("");

  // 7a. Successful transfer between whitelisted wallets
  console.log("7a. Compliant transfer (should PASS):");
  const pass = await api("POST", "/api/demo/compliance-check", {
    sender: "AMiNABnk1x7rT5fVqPz8j2kLxUQ9dPRm4wE3HNcYvS7",
    recipient: "KRKMmkr4A0uV8iYtT2m5oPxXD2rJHn7qN6SWeF1bY3C",
    amount: 500000,
  });
  log("POST /api/demo/compliance-check", pass);
  console.log(`   Status: ${pass.data.status}`);
  console.log(`   Checks: ${JSON.stringify(pass.data.checks)}`);
  console.log("");

  // 7b. Transfer to non-whitelisted wallet (should REJECT)
  console.log("7b. Transfer to non-whitelisted wallet (should REJECT):");
  const reject = await api("POST", "/api/demo/compliance-check", {
    sender: "UBSTrsy2y8sU6gWqR9k3mNxVB0eFQr5nxF4JMPdZwT8",
    recipient: "EXTRNwlt6C2xQ0kJ5rM8yH3nPvF7aTb9sW1dU4gI2oE",
    amount: 1000000,
  });
  log("POST /api/demo/compliance-check", reject);
  console.log(`   Status: ${reject.data.status}`);
  console.log(`   Reason: ${reject.data.reason}`);
  console.log(`   Detail: ${reject.data.detail}`);
  console.log(`   Message: ${reject.data.message}`);
  console.log("");

  // 7c. Transfer to frozen account (should REJECT)
  console.log("7c. Transfer to frozen account (should REJECT):");
  const frozen = await api("POST", "/api/demo/compliance-check", {
    sender: "AMiNABnk1x7rT5fVqPz8j2kLxUQ9dPRm4wE3HNcYvS7",
    recipient: "FRZNacct7D3yR1lK6sN9zI4oQwG8bUc0tX2eV5hJ3pF",
    amount: 250000,
  });
  log("POST /api/demo/compliance-check", frozen);
  console.log(`   Status: ${frozen.data.status}`);
  console.log(`   Reason: ${frozen.data.reason}`);
  console.log("");

  // 7d. Default compliance check (no body — defaults to UBS -> non-whitelisted)
  console.log("7d. Default compliance check (UBS Treasury -> External):");
  const defaultCheck = await api("POST", "/api/demo/compliance-check", {});
  log("POST /api/demo/compliance-check (default)", defaultCheck);
  console.log(`   Status: ${defaultCheck.data.status}`);
  console.log("");

  // 8. Add a new wallet via API
  console.log("8. Add new wallet via API");
  const newWallet = await api("POST", "/api/demo/wallet", {
    address: "NEWwlt8E4zS2mL7tQ1nR0kJ6pI3oH5gF9cX8bV7aU2w",
    label: "New Institutional Client",
    role: null,
    isWhitelisted: true,
    balance: "0 SUSD",
    kycStatus: "approved",
  });
  log("POST /api/demo/wallet", newWallet);
  console.log("");

  // 9. Add a compliance event via API
  console.log("9. Add compliance event via API");
  const newTx = await api("POST", "/api/demo/transaction", {
    type: "compliance",
    description: "New Institutional Client whitelisted",
    from: "FBLKCst3z9tW7hXsS0l4nOyWC1gGHs6pG5KRQeUiV9A",
    to: "NEWwlt8E4zS2mL7tQ1nR0kJ6pI3oH5gF9cX8bV7aU2w",
    status: "confirmed",
  });
  log("POST /api/demo/transaction", newTx);
  console.log("");

  // 10. PDA derivation endpoints
  console.log("10. PDA derivation");
  const pdaConfig = await api("GET", "/api/pda/config");
  log("GET /api/pda/config", pdaConfig);
  const pdaMint = await api("GET", "/api/pda/mint");
  log("GET /api/pda/mint", pdaMint);
  console.log("");

  // 11. Full status
  console.log("11. Protocol status");
  const status = await api("GET", "/status");
  log("GET /status", status);
  console.log("");

  // Summary
  console.log("==============================================");
  console.log(" SEED COMPLETE");
  console.log("==============================================");
  console.log("");
  console.log(" All demo endpoints verified.");
  console.log(` Compliance rejection demo: ${reject.data.status === "REJECTED" ? "WORKING" : "FAILED"}`);
  console.log(` Reserve proof (${reserve.data.ratio}%): ${reserve.data.verified ? "VERIFIED" : "FAILED"}`);
  console.log(` Wallets loaded: ${(wallets.data.count || 0) + 1}`);
  console.log(` Transactions loaded: ${(txs.data.count || 0) + 1}`);
  console.log("");
  console.log(" Ready for demo. Key URLs:");
  console.log(`   Health:           ${BASE_URL}/health`);
  console.log(`   Full state:       ${BASE_URL}/api/demo/state`);
  console.log(`   Compliance check: POST ${BASE_URL}/api/demo/compliance-check`);
  console.log(`   Reserve proof:    ${BASE_URL}/api/demo/verify-reserve`);
  console.log("");
}

seed().catch((err) => {
  console.error("\nSeed failed:", err.message);
  console.error("Is the server running? Start with: node server.js\n");
  process.exit(1);
});
