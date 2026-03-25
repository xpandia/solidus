# SOLIDUS -- StableHacks 2026 Submission

**Compliance is IN the token, not bolted on.**

**Hackathon:** StableHacks 2026 (DoraHacks)
**Deadline:** March 29, 2026
**Track:** Institutional Permissioned DeFi Vaults
**Prize Pool:** $202K+
**Partners:** AMINA Bank, Solana Foundation, Tenity, UBS, Keyrock, Fireblocks
**Top 10 Reward:** Demo Day in Zurich (April 8, 2026)

---

## 1. THE CORE INSIGHT

Most stablecoin compliance solutions wrap compliant processes around non-compliant tokens. Solidus inverts this: compliance is an architectural primitive embedded at the protocol layer. Every downstream application that uses a Solidus-issued stablecoin inherits compliance automatically.

**The demo centerpiece:** A transfer to a non-whitelisted address is rejected on-chain, in real time, by the protocol itself. Not by a compliance officer. Not by a monitoring dashboard after the fact. By the token.

---

## 2. DORAHACKS SUBMISSION TEXT

### Project Name

Solidus

### One-Liner

Protocol-level compliance and issuance infrastructure that makes stablecoins institutional-grade -- built on Solana with Token-2022.

### Description

**The Problem**

$4 trillion in institutional capital sits on the sidelines of stablecoin markets. Not because institutions lack interest -- but because the infrastructure does not meet their standards. Current stablecoin rails have no protocol-level compliance, no programmable controls for treasurers, and no real-time reserve transparency. Banks move $5 trillion per day through SWIFT. They will not migrate to rails they cannot audit, restrict, or programmatically control.

**The Solution**

Solidus is a protocol-level compliance and issuance engine for institutional stablecoins on Solana. It embeds compliance directly into the token architecture using Solana's Token-2022 extensions, delivering three capabilities no competitor offers natively:

1. **Programmable Compliance** -- KYC/AML verification enforced at the mint and transfer level via Token-2022. Whitelist-based transfer restrictions are checked on-chain before every token movement. Non-whitelisted transfers are rejected by the protocol itself -- no middleware, no human in the loop.

2. **Institutional Controls** -- Role-based access control (Admin, Issuer, Compliance Officer) with on-chain PDA-based permissions. Account freeze/unfreeze for regulatory holds. Configurable mint caps. Two-step admin transfer. Emergency pause.

3. **Reserve Transparency** -- On-chain reserve proof hash anchoring with timestamped attestations. SHA-256 hashes of off-chain reserve attestations stored on-chain, creating an immutable audit trail verifiable by any party.

**Technical Architecture**

- **Smart Contract:** Anchor 0.30.1 program on Solana using Token-2022. 1,070 lines of Rust with 15 instructions covering the full institutional lifecycle.
- **Compliance Engine:** Every mint and transfer validates whitelist status and freeze state on-chain before execution. Non-compliant transactions rejected at the protocol level with descriptive error codes.
- **Backend API:** Node.js/Express REST API with 20+ endpoints. Unsigned transaction pattern -- backend builds transactions, client signs. Helmet headers, CORS, rate limiting, compliance middleware.
- **On-Chain Events:** Every state change emits Anchor events for off-chain indexing and regulatory audit trails.

**What We Built vs. What Is Planned**

Built and working:
- Complete Anchor program (1,070 lines Rust) with all 15 instructions
- On-chain whitelist enforcement with protocol-level transfer rejection
- Role-based access control (Admin, Issuer, ComplianceOfficer)
- Account freeze/unfreeze for regulatory holds
- Reserve proof hash anchoring with timestamps
- Full REST API with demo mode, compliance check endpoint, seed data
- Compliance rejection demo flow (the centerpiece)

Planned / roadmap:
- Mainnet deployment (pending security audit)
- Multi-jurisdiction compliance rule engine
- Confidential transfer support (Token-2022 extension)
- Transfer hook integration for programmable compliance callbacks
- Frontend dashboard for compliance officers
- Formal verification of critical program paths

We are honest about scope. This is hackathon code, not production code. The architecture is right. The security audit is next.

### GitHub

https://github.com/xpandia/solidus

### Tech Stack

- Solana (Token-2022 / Token Extensions)
- Anchor 0.30.1 (Rust)
- SPL Token-2022 with TransferChecked
- Node.js + Express (REST API)
- On-chain reserve proof hash anchoring

### Team

Protocol Engineer, Frontend Engineer, Product & Design

---

## 3. TRACK SELECTION: Institutional Permissioned DeFi Vaults

**Why this track:**

| Requirement | How Solidus Delivers |
|-------------|---------------------|
| Permissioned access | On-chain whitelist -- only KYC-approved wallets can hold or transfer tokens |
| Role-based controls | Admin, Issuer, ComplianceOfficer enforced via PDAs |
| Institutional compliance | Protocol-level: non-whitelisted transfers rejected on-chain |
| Regulatory tooling | Freeze/unfreeze, emergency pause, reserve proof anchoring |
| Audit trail | Every state change emits Anchor events for regulatory reporting |

**Partners alignment:**

- **AMINA Bank (FINMA-regulated):** Solidus provides the compliance layer a regulated bank needs to issue stablecoins. On-chain whitelist enforcement means AMINA's compliance rules travel with the token.
- **UBS:** Institutional treasury infrastructure with programmable controls. Role-based delegation: CFOs retain admin control while delegating issuance.
- **Fireblocks:** Complementary, not competitive. Fireblocks custody + Solidus compliance = end-to-end infrastructure. The unsigned transaction pattern is designed for custodial MPC signing.
- **Keyrock:** Whitelisted transfers enable market making within a permissioned ecosystem. Freeze/unfreeze provides regulatory tooling for exchange compliance.

---

## 4. THE DEMO (Centerpiece: Compliance Rejection)

### Demo Flow (3 minutes)

**Scene 1 -- The hook (10s):**
"$4 trillion in institutional capital is waiting for stablecoin infrastructure that doesn't exist yet."

**Scene 2 -- Show the Anchor program (30s):**
Highlight `compliant_transfer` -- whitelist and freeze checks before every transfer.

**Scene 3 -- THE CENTERPIECE: Compliance rejection (45s):**

Step 1: Compliant transfer between whitelisted wallets -- succeeds.
```
POST /api/demo/compliance-check
{ "sender": "AMiNABnk1x...", "recipient": "KRKMmkr4A0...", "amount": 500000 }
-> { "status": "APPROVED", "checks": { all: true } }
```

Step 2: Transfer to non-whitelisted wallet -- REJECTED.
```
POST /api/demo/compliance-check
{ "sender": "UBSTrsy2y8...", "recipient": "EXTRNwlt6C...", "amount": 1000000 }
-> {
     "status": "REJECTED",
     "reason": "NotWhitelisted",
     "detail": "The target account is not on the whitelist. Transfer rejected by the protocol on-chain.",
     "message": "Compliance is IN the token, not bolted on."
   }
```

This is the moment. The protocol itself rejected the transfer. Not a compliance officer. Not a monitoring system. The token.

Step 3: Freeze an account -- one API call, frozen on-chain.

Step 4: Reserve verification -- 102% ratio, PwC Zurich attestation, on-chain hash.

**Scene 4 -- Architecture (25s):**
Full stack: Anchor program, REST API, 20+ endpoints, unsigned tx pattern.

**Scene 5 -- Close (10s):**
"Compliance is in the token. Not bolted on."

---

## 5. QUICK START

### Run the Backend

```bash
cd src/backend
npm install
node server.js
```

Server starts on http://localhost:3001 with seed data pre-loaded.

### Run the Demo Seed Script

```bash
node demo_seed.js
```

Exercises all demo endpoints, verifies compliance rejection, prints results.

### Key Demo Commands (curl)

```bash
# Health + endpoints list
curl http://localhost:3001/health | jq

# All institutional wallets
curl http://localhost:3001/api/demo/wallets | jq

# All transactions (including the rejected one)
curl http://localhost:3001/api/demo/transactions | jq

# Only rejected transactions
curl "http://localhost:3001/api/demo/transactions?status=rejected" | jq

# Reserve verification (102% ratio)
curl http://localhost:3001/api/demo/verify-reserve | jq

# THE DEMO: Compliant transfer (APPROVED)
curl -X POST http://localhost:3001/api/demo/compliance-check \
  -H "Content-Type: application/json" \
  -d '{"sender":"AMiNABnk1x7rT5fVqPz8j2kLxUQ9dPRm4wE3HNcYvS7","recipient":"KRKMmkr4A0uV8iYtT2m5oPxXD2rJHn7qN6SWeF1bY3C","amount":500000}' | jq

# THE DEMO: Non-whitelisted transfer (REJECTED)
curl -X POST http://localhost:3001/api/demo/compliance-check \
  -H "Content-Type: application/json" \
  -d '{"sender":"UBSTrsy2y8sU6gWqR9k3mNxVB0eFQr5nxF4JMPdZwT8","recipient":"EXTRNwlt6C2xQ0kJ5rM8yH3nPvF7aTb9sW1dU4gI2oE","amount":1000000}' | jq
```

---

## 6. ZURICH DEMO DAY PREP (April 8, 2026)

### If Selected for Top 10

**Audience:** AMINA Bank executives, UBS representatives, Solana Foundation, Tenity partners, Keyrock, Fireblocks. This is an institutional audience.

**Presentation (5-7 min):**
1. Open with the rejected transfer demo -- live, on the projector
2. Architecture overview: Anchor program + Token-2022 + REST API
3. Partner alignment: how Solidus complements each partner's business
4. Roadmap: audit, mainnet, multi-jurisdiction compliance rules
5. Ask: pilot integration discussions with AMINA, Fireblocks

**Live Demo (3-5 min):**
1. Show compliant transfer -- succeeds between whitelisted wallets
2. Show rejected transfer -- fails to non-whitelisted address (the wow moment)
3. Show freeze operation -- account frozen by Compliance Officer
4. Show reserve proof -- 102% ratio, PwC attestation, on-chain hash
5. Backup video on USB drive in case Devnet is slow

**Partner Talking Points:**

For AMINA Bank: "Solidus is the compliance layer. Your rules travel with the token, even outside AMINA custody."

For UBS: "Programmable treasury controls. Delegate issuance, retain admin. Mint caps prevent unauthorized issuance."

For Fireblocks: "Complementary. Fireblocks custody + Solidus compliance. Our unsigned tx pattern is designed for MPC signing."

For Keyrock: "Whitelisted trading within a permissioned ecosystem. Regulatory tooling built in."

**Bring:**
- [ ] Laptop with full dev environment
- [ ] Backup demo video on USB
- [ ] 20 printed one-page technical summaries
- [ ] Investor brief (docs/INVESTOR_BRIEF.md)

---

## 7. SUBMISSION TIMELINE

| Day | Date | Action |
|-----|------|--------|
| Day 1 | Mar 23 (Mon) | Smart contract finalized, deployed to Devnet |
| Day 2 | Mar 24 (Tue) | Backend demo-ready, API tested end-to-end |
| Day 3 | Mar 25 (Wed) | Record demo video (compliance rejection = centerpiece) |
| Day 4 | Mar 26 (Thu) | Upload video, create DoraHacks BUIDL page |
| Day 5 | Mar 27 (Fri) | Review, test all links, external review |
| Day 6 | Mar 28 (Sat) | Buffer day |
| Deadline | Mar 29 (Sun) | Final submission on DoraHacks |

---

*Compliance is in the token. Not bolted on. That is Solidus.*
