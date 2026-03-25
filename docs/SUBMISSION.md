# SOLIDUS -- StableHacks 2026 Submission Guide

**Hackathon:** StableHacks 2026 (DoraHacks)
**Deadline:** March 29, 2026
**Prize Pool:** $202K+
**Partners:** AMINA Bank, Solana Foundation, Tenity, UBS, Keyrock, Fireblocks
**Top 10 Reward:** Demo Day in Zurich (April 8, 2026)

---

## 1. DORAHACKS SUBMISSION TEXT

Copy-paste the following into the DoraHacks BUIDL submission form.

---

### Project Name

Solidus

### One-Liner

Protocol-level compliance and issuance infrastructure that makes stablecoins institutional-grade -- built on Solana with Token-2022.

### Description (Full Submission Text)

**The Problem**

$4 trillion in institutional capital sits on the sidelines of stablecoin markets. Not because institutions lack interest -- but because the infrastructure does not meet their standards. Current stablecoin rails have no protocol-level compliance, no programmable controls for treasurers, and no real-time reserve transparency. Banks move $5 trillion per day through SWIFT. They will not migrate to rails they cannot audit, restrict, or programmatically control.

**The Solution**

Solidus is a protocol-level compliance and issuance engine for institutional stablecoins on Solana. It embeds compliance directly into the token architecture using Solana's Token-2022 extensions, delivering three capabilities no competitor offers natively:

1. **Programmable Compliance** -- KYC/AML verification enforced at the mint and transfer level via Token-2022. Whitelist-based transfer restrictions are checked on-chain before every token movement. Non-whitelisted transfers are rejected by the protocol itself -- no middleware, no human in the loop.

2. **Institutional Controls** -- Role-based access control (Admin, Issuer, Compliance Officer) with on-chain PDA-based permissions. Account freeze/unfreeze for regulatory holds. Configurable mint caps to prevent unauthorized issuance. Two-step admin transfer to eliminate single-point-of-failure key management. Emergency pause to halt all protocol operations instantly.

3. **Reserve Transparency** -- On-chain reserve proof hash anchoring with timestamped attestations. SHA-256 hashes of off-chain reserve attestations are submitted and stored on-chain, creating an immutable audit trail verifiable by any party.

**Technical Architecture**

- **Smart Contract:** Anchor 0.30.1 program on Solana using Token-2022 (SPL Token-2022 with TransferChecked for transfer hook compatibility). 1,070 lines of Rust with 15 instructions covering the full institutional lifecycle: initialize, role management, whitelist management, compliant minting/burning, compliant transfers, freeze/unfreeze, reserve proof submission, emergency pause, and admin transfer.

- **Compliance Engine:** Every mint and transfer instruction validates whitelist status and freeze state on-chain before execution. The `compliant_transfer` instruction uses Token-2022's `TransferChecked` to ensure transfer hook compatibility. Non-compliant transactions are rejected at the protocol level with descriptive error codes.

- **Backend API:** Node.js/Express REST API with 16+ endpoints for transaction building, wallet queries, PDA derivation, and protocol status. Implements the unsigned transaction pattern -- the backend constructs transactions and returns them for client-side wallet signing. Includes Helmet security headers, CORS origin whitelisting, per-endpoint rate limiting, request ID tracking, and compliance middleware.

- **On-Chain Events:** Every state change emits an Anchor event (ProtocolInitialized, RoleAssigned, StablecoinMinted, CompliantTransferExecuted, AccountFrozenEvent, ReserveProofSubmitted, etc.), enabling off-chain indexing and regulatory audit trails.

**Why Solana + Token-2022**

Solana's Token-2022 standard is the first programmable token standard capable of institutional-grade compliance enforcement. Transfer hooks, permanent delegates, and confidential transfer extensions provide the primitives that institutional stablecoins require. Combined with 400ms finality and sub-penny transaction costs, Solana is the only chain where institutional stablecoin infrastructure can operate at scale without compromising on speed or cost.

**What Makes Solidus Different**

Most stablecoin compliance solutions wrap compliant processes around non-compliant tokens. Solidus inverts this: compliance is an architectural primitive embedded at the protocol layer. Every downstream application that uses a Solidus-issued stablecoin inherits compliance automatically. No middleware. No wrappers. No trust assumptions.

A transfer to a non-whitelisted address does not fail silently or get caught in a monitoring dashboard after the fact. It is rejected on-chain, in under a second, by the protocol itself. That is the architectural insight that separates protocol-level compliance from application-level compliance.

**Built for Institutional Partners**

Solidus is designed for the exact institutions represented by StableHacks partners. AMINA Bank (FINMA-regulated digital asset bank), UBS (global institutional treasury), Fireblocks (institutional custody infrastructure), and Keyrock (institutional market making) all require the compliance guarantees that Solidus provides at the protocol level. Solidus is not a competitor to these institutions -- it is the compliance infrastructure layer they need to confidently issue and operate stablecoins.

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

## 2. TRACK SELECTION

### Recommended Track: Institutional Permissioned DeFi Vaults

**Why this track wins:**

| Track | Fit Score | Rationale |
|-------|-----------|-----------|
| **Institutional Permissioned DeFi Vaults** | 9/10 | Direct match. Solidus provides permissioned access (whitelist), role-based controls (Admin/Issuer/Compliance), account freeze, and protocol-level compliance -- exactly what "institutional permissioned" means. The vault metaphor maps to the controlled issuance/redemption cycle with mint caps. |
| Cross-Border Stablecoin Treasury | 7/10 | Solidus enables cross-border use, but the current implementation focuses on compliance controls rather than cross-border payment flows specifically. No multi-currency support yet. |
| Programmable Stablecoin Payments | 7/10 | The transfer hook compliance logic is programmable payments, but the term "payments" implies a consumer/merchant flow that Solidus does not currently address. |
| RWA-Backed Stablecoin & Commodity Vaults | 5/10 | Reserve proof hash anchoring touches RWA backing, but Solidus is not an RWA tokenization platform. Weaker fit. |

**Submission strategy:** Lead with the permissioned access control narrative. The judges for this track care about: Who can access the vault? How are permissions enforced? Can permissions be revoked? Is there regulatory alignment? Solidus answers all four at the protocol level.

**Secondary track (if allowed to submit to two):** Cross-Border Stablecoin Treasury. Frame the whitelist as a cross-border counterparty management system and the compliance engine as the regulatory bridge between jurisdictions.

---

## 3. DEMO VIDEO SCRIPT (3 Minutes)

### Production Requirements

- **Duration:** 2:50 - 3:00 (hard stop at 3:00)
- **Resolution:** 1920x1080 minimum
- **Format:** MP4, H.264
- **Audio:** Clear voiceover + subtle background music (15-20% volume)
- **Recording:** OBS Studio or Loom (screen capture + voiceover)
- **Style:** Confident, technical, institutional. No hype. Show real transactions.

---

### Scene 1: The Hook [0:00 - 0:10]

**Visual:** Black screen. White text fades in:

> "$4 trillion in institutional capital is waiting for stablecoin infrastructure that doesn't exist yet."

Hold 3 seconds. Fade to Solidus logo.

**Voiceover:** "Four trillion dollars. That is how much institutional capital is waiting on the sidelines -- because stablecoin rails have no compliance layer."

---

### Scene 2: The Solution [0:10 - 0:25]

**Visual:** Solidus landing page hero section. Scroll slowly through the three pillars (Programmable Compliance, Institutional Controls, Reserve Transparency).

**Voiceover:** "Solidus is the missing layer. A protocol-level compliance engine for institutional stablecoins on Solana. Compliance is not bolted on after the fact. It is built into the token itself, using Solana's Token-2022 extensions."

---

### Scene 3: Smart Contract Architecture [0:25 - 0:55]

**Visual:** Split screen -- code editor showing `program.rs` on the left, terminal/Solana Explorer on the right.

**Show in the code (highlight each section for 3-5 seconds):**

1. The `compliant_transfer` function (lines 267-311) -- highlight the whitelist and freeze checks
2. The `mint_stablecoin` function (lines 156-212) -- highlight the compliance validation before minting
3. The `freeze_account` function (lines 318-334) -- highlight Compliance Officer access control
4. The `submit_reserve_proof` function (lines 358-372) -- highlight on-chain hash anchoring

**Voiceover:** "Here is the Anchor program. Every mint validates the recipient is whitelisted and not frozen. Every transfer checks both sender and recipient against on-chain compliance state. A Compliance Officer can freeze any account instantly. And reserve attestations are anchored on-chain as SHA-256 hashes -- not quarterly PDFs."

---

### Scene 4: The Compliance Rejection -- The Key Moment [0:55 - 1:40]

**This is the centerpiece of the demo. Spend the most time here.**

**Visual:** Terminal or API client (Postman/Insomnia) showing API calls.

**Step 1 -- Show a successful compliant transfer:**

```
POST /api/tx/transfer
{
  "wallet": "<whitelisted-sender>",
  "recipient": "<whitelisted-recipient>",
  "amount": 1000
}
```

Response: Transaction built successfully. Show the transaction on Solana Explorer confirming.

**Voiceover:** "A transfer between two whitelisted, KYC-verified wallets. Both pass compliance checks. The transfer executes on Solana in under a second."

**Step 2 -- Show a rejected transfer (the wow moment):**

Attempt a transfer to a non-whitelisted address. Show the on-chain error:

```
Error: The target account is not on the whitelist. (NotWhitelisted)
```

**Voiceover:** [Pause 2 seconds before speaking]

"Now the same sender tries to transfer to a wallet that is not on the whitelist. The transaction is rejected. Not by a compliance officer. Not by a monitoring system after the fact. By the protocol itself. On-chain. In real time. The compliance rules travel with the token. There is no way to circumvent them."

**Step 3 -- Show a freeze operation:**

```
POST /api/tx/freeze
{
  "wallet": "<compliance-officer>",
  "target": "<suspicious-account>"
}
```

**Voiceover:** "And if a Compliance Officer needs to freeze an account -- one API call. The account is frozen on-chain. No transfers in or out until it is unfrozen. Institutional-grade controls, enforced at the protocol level."

---

### Scene 5: Reserve Transparency [1:40 - 2:10]

**Visual:** API call to `/status` endpoint showing protocol state -- total supply, reserve proof hash, last verification timestamp.

**Voiceover:** "Reserve transparency is not a quarterly PDF. It is an on-chain hash of the reserve attestation, timestamped and verifiable by anyone. The protocol tracks total supply, verification timestamps, and proof hashes -- all queryable via the REST API or directly on-chain."

---

### Scene 6: Architecture Overview [2:10 - 2:35]

**Visual:** Show the architecture diagram from the README. Then show the API endpoints table.

**Voiceover:** "The full stack: an Anchor program on Solana with Token-2022, a REST API that builds unsigned transactions for client-side wallet signing, and 16 endpoints covering the complete institutional lifecycle -- minting, burning, compliant transfers, freeze management, role assignment, and PDA derivation. Security includes Helmet headers, CORS whitelisting, rate limiting, and compliance middleware on every protected endpoint."

---

### Scene 7: Closing [2:35 - 3:00]

**Visual:** Solidus logo on dark background. GitHub URL. Text: "Built for StableHacks 2026."

**Voiceover:** "Configure compliance. Issue tokens. Transfer with on-chain enforcement. Verify reserves. All on Solana. All at the protocol level. Solidus -- the infrastructure that makes stablecoins institutional-grade."

[Hold logo for 3 seconds. Fade to black.]

---

### Video Recording Checklist

- [ ] Solana Devnet wallet funded (minimum 2 SOL)
- [ ] Backend server running (`npm start` from `src/backend`)
- [ ] Protocol initialized on Devnet with roles assigned
- [ ] At least 2 wallets whitelisted and 1 wallet NOT whitelisted (for rejection demo)
- [ ] Test the full flow end-to-end before recording
- [ ] OBS recording set to 1920x1080, 30fps minimum
- [ ] Microphone tested -- clear audio, no background noise
- [ ] Background music selected and volume set to 15-20%
- [ ] Video exported as MP4, H.264, under 100MB

---

## 4. ZURICH DEMO DAY PREP (April 8, 2026)

If selected for the top 10, you will present in person at Demo Day in Zurich. The audience includes AMINA Bank executives, UBS representatives, Solana Foundation, Tenity partners, Keyrock, and Fireblocks. This is an institutional audience -- not a hackathon crowd.

### What to Prepare

**A. Presentation (5-7 minutes)**

Use the existing pitch deck (`pitch/pitch_deck.html`) with the following modifications:

1. **Replace placeholder URLs** with live deployed links (landing page, GitHub, API endpoint)
2. **Add team member names and photos** to the Team slide
3. **Update the Traction slide** with actual Devnet deployment data (program ID, transaction count, number of mints)
4. **Prepare a Mainnet deployment plan** -- judges will ask "when can this go live?" Have a concrete answer with milestones
5. **Prepare regulatory positioning** -- AMINA Bank is FINMA-regulated. Know MiCA requirements. Know Swiss DLT Act implications. Be ready to discuss how Solidus aligns with FINMA expectations for digital asset infrastructure

**B. Live Demo (3-5 minutes)**

Prepare a live demo that works on Solana Devnet (or Mainnet if deployed by then):

1. **Show a live mint** -- mint tokens to a whitelisted address on-chain
2. **Show a rejected transfer** -- attempt transfer to non-whitelisted address, show on-chain rejection
3. **Show a freeze operation** -- freeze an account, then show that transfers to/from that account fail
4. **Show reserve proof submission** -- submit a reserve proof hash and verify it on-chain
5. **Have a backup video** ready in case Devnet is slow or down

**C. Materials to Bring**

- [ ] Laptop with full development environment (Rust, Solana CLI, Anchor, Node.js)
- [ ] Presentation loaded and tested on venue projector format
- [ ] Backup demo video on USB drive
- [ ] One-page technical summary (printed, 20 copies) for judges and partners
- [ ] Business cards or contact QR codes
- [ ] Investor brief (`docs/INVESTOR_BRIEF.md`) printed for 1:1 conversations

**D. Key Talking Points for Partner Conversations**

**For AMINA Bank (FINMA-regulated digital asset bank):**
- Solidus provides the compliance infrastructure layer that a regulated bank needs to issue or custody stablecoins on Solana
- On-chain whitelist enforcement means AMINA's compliance rules travel with the token -- even when tokens move outside AMINA's direct custody
- Two-step admin transfer and emergency pause provide the operational controls regulators expect
- Ask: Would AMINA consider a pilot integration using Solidus for a permissioned stablecoin issuance?

**For UBS:**
- Frame Solidus as institutional treasury infrastructure -- programmable controls for corporate treasury stablecoin operations
- Emphasize the role-based access control: CFOs/treasurers can delegate issuance to specific operators while retaining admin control
- Mint cap enforcement prevents unauthorized issuance -- a key treasury control
- Ask: What compliance requirements would UBS need to see in a stablecoin infrastructure provider?

**For Fireblocks:**
- Solidus is complementary, not competitive -- Fireblocks provides custody, Solidus provides protocol-level compliance
- Integration opportunity: Fireblocks custody + Solidus compliance = end-to-end institutional stablecoin infrastructure
- The unsigned transaction pattern in the Solidus API is designed for custodial signing workflows (Fireblocks MPC signing)
- Ask: Would Fireblocks consider a technical integration where Solidus compliance checks are embedded in the Fireblocks transaction approval flow?

**For Keyrock (institutional market making):**
- Whitelisted transfers enable Keyrock to operate within a permissioned stablecoin ecosystem
- Freeze/unfreeze provides the regulatory tooling that market makers need to comply with exchange requirements
- Ask: What on-chain compliance features would Keyrock need to confidently make markets in a permissioned stablecoin?

**For Solana Foundation:**
- Solidus is a showcase for Token-2022's institutional potential -- the exact use case Token-2022 was designed for
- Positioning: Solidus can be the reference implementation for institutional stablecoin compliance on Solana
- Ask: Ecosystem grant support for mainnet deployment, security audit, and institutional partner introductions

**E. Post-Demo-Day Follow-Up**

Within 24 hours of Demo Day:
1. Send personalized follow-up emails to every judge and partner you spoke with
2. Include: one-page summary, GitHub link, demo video link, and specific next step (pilot call, technical deep-dive, etc.)
3. Post on Twitter/X tagging @solaboracao, @aminabank, @doabordes, @SolanaFndn
4. Submit a DoraHacks project update with Demo Day photos/recap

---

## 5. QUICK START COMMANDS

### Build and Deploy the Smart Contract

```bash
# Prerequisites: Rust, Solana CLI (v1.18+), Anchor CLI (v0.30.1)

# Navigate to contracts directory
cd src/contracts

# Build the Anchor program
anchor build

# Get the generated program ID
solana-keygen pubkey target/deploy/solidus-keypair.json

# Update the program ID in program.rs (declare_id!) and Anchor.toml
# Then rebuild with the correct ID
anchor build

# Set Solana CLI to Devnet
solana config set --url devnet

# Fund your wallet (if needed)
solana airdrop 2

# Deploy to Devnet
anchor deploy --provider.cluster devnet
```

### Run the Backend API

```bash
# Navigate to backend directory
cd src/backend

# Copy environment template and configure
cp .env.example .env
# Edit .env: set PROGRAM_ID to your deployed program ID
# Edit .env: set SOLANA_RPC_URL (default: https://api.devnet.solana.com)

# Install dependencies
npm install

# Start the server
npm start
# API available at http://localhost:3001
```

### Verify Deployment

```bash
# Check API health
curl http://localhost:3001/health

# Check protocol status
curl http://localhost:3001/status

# Check a wallet's role
curl http://localhost:3001/api/wallet/<ADDRESS>/role

# Check whitelist status
curl http://localhost:3001/api/wallet/<ADDRESS>/whitelist

# Derive PDA addresses
curl http://localhost:3001/api/pda/config
curl http://localhost:3001/api/pda/mint
```

### View the Landing Page

```bash
# Open in browser
open src/frontend/index.html
```

### Pre-Submission Deployment Checklist

- [ ] Anchor program builds without errors (`anchor build`)
- [ ] Program deployed to Devnet with real program ID (not placeholder)
- [ ] Program ID updated in `program.rs`, `Anchor.toml`, and `.env`
- [ ] Backend API running and responding to `/health`
- [ ] At least one successful mint transaction on Devnet
- [ ] At least one successful compliant transfer on Devnet
- [ ] At least one rejected transfer (non-whitelisted) demonstrated
- [ ] Demo video recorded and uploaded
- [ ] Landing page accessible (deployed to Vercel/Netlify or GitHub Pages)
- [ ] DoraHacks BUIDL page created with submission text above
- [ ] GitHub repo public with clean README

---

## SUBMISSION TIMELINE

| Day | Date | Action |
|-----|------|--------|
| Day 1 | March 23 (Mon) | Finalize smart contract, deploy to Devnet, test all instructions |
| Day 2 | March 24 (Tue) | Fix backend discriminators, test API end-to-end, deploy landing page |
| Day 3 | March 25 (Wed) | Record demo video (follow script above), iterate on audio/visual |
| Day 4 | March 26 (Thu) | Upload video, create DoraHacks BUIDL page, paste submission text |
| Day 5 | March 27 (Fri) | Review submission, test all links, have someone external review |
| Day 6 | March 28 (Sat) | Buffer day -- fix anything broken, polish submission text |
| Deadline | March 29 (Sun) | Final submission on DoraHacks before cutoff |

---

*This document was prepared for the StableHacks 2026 submission. All content is ready for copy-paste into DoraHacks.*
