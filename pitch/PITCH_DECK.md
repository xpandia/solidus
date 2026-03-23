# Solidus Pitch Deck

**StableHacks 2026 | DoraHacks**

---

## Slide 1: Title

### SOLIDUS
**Institutional-grade stablecoin infrastructure. Built on Solana.**

*One-liner:* "We make stablecoins safe enough for the world's largest institutions — and fast enough for the world's most demanding blockchains."

**Speaker Notes:**
Walk on stage. Pause. Let the silence build for two seconds. Then deliver the one-liner like it's obvious — like it's strange nobody built this before. No rush. This is the first impression. Own the room before you say a word. If presenting on video, start with a clean black screen fading into the Solidus logo.

---

## Slide 2: The Problem

### $4 Trillion Is Waiting

Institutional capital wants in. Stablecoins can't let them through.

- **No compliance layer.** KYC/AML is an afterthought. Regulators see a liability, not a product.
- **No programmable controls.** CFOs need whitelists, velocity limits, role-based permissions. They get a raw token and a "good luck."
- **No transparency.** Reserve attestations arrive as PDFs. Quarterly. In 2026.

> "Banks move $5 trillion per day through SWIFT. They won't touch a rail they can't audit in real time."

**Speaker Notes:**
This is the tension slide. Paint the picture of a world where trillions are stuck. Speak slowly on the three bullets — each one is a door that's locked. The quote at the bottom is your anchor. Pause after reading it. Let the audience feel the gap. You are not selling a product yet. You are selling a problem that demands to be solved. If anyone in the audience works in TradFi or compliance, this slide should make them nod.

---

## Slide 3: The Solution

### Solidus: The Missing Layer

A **protocol-level compliance and issuance engine** for stablecoins on Solana.

Three things institutions have never had — until now:

1. **Programmable Compliance** — KYC/AML verification baked into the mint. Not bolted on after. Not optional. Structural.
2. **Institutional Controls** — Role-based access, transfer restrictions, and velocity limits enforced on-chain. The treasurer sleeps at night.
3. **Real-Time Reserve Transparency** — Oracle-fed proof-of-reserves, verifiable every block. Not every quarter. Every. Block.

**Speaker Notes:**
Shift your energy here. The problem was heavy. The solution is clean. Deliver each of the three pillars with conviction, like you're unveiling something that should have existed years ago. On "every block" — slow down and repeat it. That contrast (quarterly vs. every block) is the rhetorical kill shot. This is where the audience should think: "Oh. That's actually different."

---

## Slide 4: How It Works

### Three Steps. That's It.

```
CONFIGURE  -->  ISSUE  -->  OPERATE
```

**Step 1: Configure**
Institutions define compliance rules through the Solidus dashboard or SDK — KYC tiers, transfer limits, whitelisted counterparties. Five minutes, not five months.

**Step 2: Issue**
Stablecoins mint through the Solidus program on Solana. Compliance rules are embedded at the token level using Token-2022 extensions. The rules travel with the token.

**Step 3: Operate**
Every transfer validates on-chain against the institution's ruleset. Reserve status publishes in real-time via Pyth oracles. Full audit trail. Zero ambiguity. Zero trust assumptions.

**Speaker Notes:**
Simplicity sells. Three steps on screen, three sentences each. Point to each step as you explain it. The key phrase is "the rules travel with the token" — that's the architectural insight that separates Solidus from wrappers and middleware. Emphasize that this isn't a dashboard sitting on top of a dumb token. The compliance is *in* the token. That's the breakthrough.

---

## Slide 5: Demo Screenshots

### See It Working

**Screen 1 — Dashboard Overview**
A clean, dark-themed dashboard showing the institution's stablecoin deployment. Top metrics: total supply, active wallets, compliance status (green checkmarks), reserve ratio (100.2%). A live transaction feed scrolls on the right.

**Screen 2 — Compliance Configuration**
A form where the issuer sets KYC tier requirements, maximum transfer amounts per tier, velocity limits (e.g., $50K/24hr for Tier 1), and a whitelist of approved counterparty addresses. Toggle switches for each rule. Clean. Institutional. Not crypto-native UI — banker-grade UI.

**Screen 3 — Minting Flow**
The issuer clicks "Mint." A modal shows: amount, destination wallet, compliance check results (all green), reserve verification (oracle-confirmed). One confirmation. Tokens appear. Transaction hash links to Solana Explorer.

**Screen 4 — Transfer Hook in Action**
A transfer attempt between two wallets. The on-chain compliance engine evaluates: KYC status (verified), velocity limit (under threshold), whitelist status (approved). Transfer succeeds. Below it: a blocked transfer — recipient not KYC'd. Red status. Rejected on-chain. No human in the loop.

**Screen 5 — Reserve Transparency**
A real-time reserve dashboard. Oracle feed from Pyth showing backing ratio, last update timestamp (seconds ago), historical chart. A "Verify On-Chain" button links directly to the Solana program's state. Fully auditable. No trust required.

**Speaker Notes:**
If presenting live, this is where you switch to the demo. If presenting with slides, walk through each screenshot and narrate the experience. Spend the most time on Screen 4 (the transfer hook) — that's the "wow" moment. A transfer getting blocked on-chain, in real-time, with no human intervention. That's the product. Everything else is context.

---

## Slide 6: Market Size

### The Opportunity Is Measured in Trillions

| Metric | Value |
|--------|-------|
| **TAM** | $4.5T — Global institutional stablecoin settlement volume (projected 2027) |
| **SAM** | $320B — Institutions actively exploring on-chain treasury and settlement on high-throughput chains |
| **SOM** | $12B — First-mover capture through 3-5 institutional partnerships in Year 1 |

> Stablecoin market cap crossed $200B in 2025. Institutional adoption is the next wave — and it needs infrastructure that doesn't exist yet.

**Speaker Notes:**
Don't apologize for big numbers. The TAM is real — cite the Citi report, the Boston Consulting Group projections, the Bernstein analysis. SAM narrows to institutions that are already experimenting (name Visa, PayPal, Franklin Templeton if appropriate). SOM is conservative and credible — "we need 3 to 5 partners, not 3,000 users." This slide should feel inevitable, not aspirational.

---

## Slide 7: Business Model

### How We Make Money

**Protocol Fees (Primary)**
- 1-3 basis points on issuance and redemption volume
- At $12B SOM and 2 bps average, that's $2.4M ARR from fees alone

**Enterprise Licensing (Secondary)**
- Custom deployment of Solidus for private institutional stablecoin programs
- Annual licensing: $100K-$500K per institution
- White-glove onboarding, custom compliance rulesets, SLA guarantees

**SDK & API Access (Growth)**
- Developer tier: Free (drives ecosystem adoption)
- Production tier: Usage-based pricing
- Compliance-as-a-Service API for existing stablecoin projects

> "We don't compete with stablecoins. We make them institutional-grade. Every major stablecoin is a potential customer."

**Speaker Notes:**
The basis points model is familiar to the audience — it's how traditional payment rails work. That makes it credible. The enterprise licensing is high-margin and sticky. The closing quote is critical: reframe Solidus as infrastructure, not competition. Circle, Tether, PayPal's PYUSD — they're not competitors. They're the market. Every stablecoin issuer who wants institutional distribution needs what we built.

---

## Slide 8: Competitive Advantage

### Why Us. Why Now. Why Solana.

| | Solidus | Circle (CCTP) | Fireblocks | Paxos |
|---|---|---|---|---|
| **On-Chain Compliance** | Native (Token-2022 hooks) | Off-chain only | Custodial layer | Issuer-level only |
| **Programmable Rules** | Per-token, per-institution | None | API-based | Limited |
| **Real-Time Reserves** | Oracle-verified every block | Quarterly PDF | N/A | Monthly attestation |
| **Speed** | 400ms finality (Solana) | Variable | Variable | Variable |
| **Cost per Txn** | ~$0.001 | $0.10-$5.00 | Custodial fees | $0.10+ |

**Our Moats:**
1. **First mover** on Token-2022 institutional compliance infrastructure
2. **Architectural advantage** — compliance at the protocol level, not the application level
3. **Solana-native** — 400ms finality, sub-penny costs, composable with the fastest-growing DeFi ecosystem

**Speaker Notes:**
The comparison table does the heavy lifting. Don't read every cell — point to the key differentiators: on-chain compliance (everyone else is off-chain or custodial), real-time reserves (everyone else is quarterly), and cost ($0.001 vs dollars). Then land on the three moats. "First mover" is time-sensitive — say it with urgency. "Architectural advantage" is the durable moat. This isn't a feature gap competitors can close with a sprint. It's a design decision they'd have to rebuild from scratch to match.

---

## Slide 9: Traction / Roadmap

### Where We Are. Where We're Going.

**Built During StableHacks (Now)**
- Anchor program deployed to Solana Devnet
- Token-2022 stablecoin with transfer hooks for compliance enforcement
- On-chain KYC credential verification (mock integration)
- Reserve oracle integration with Pyth Network
- Dashboard prototype: issue, transfer, monitor, configure compliance
- Landing page live

**Q2 2026 — Mainnet Beta**
- Mainnet deployment with audited contracts
- First pilot institution onboarded
- SDK v1 release for developers

**Q3 2026 — Institutional Rollout**
- 3-5 institutional partnerships signed
- Compliance-as-a-Service API launch
- SOC 2 Type II certification process started

**Q4 2026 — Scale**
- Multi-stablecoin support (USDC, PYUSD, custom tokens)
- Cross-chain expansion (exploring Ethereum L2s)
- Cross-chain expansion (exploring Ethereum L2s)

**Speaker Notes:**
Start with what's real. Point to the working demo. "This isn't a whitepaper. This is working code on Solana Devnet, built in a hackathon weekend." Then walk forward through the roadmap. Each milestone should feel achievable and sequential — not a wish list. The Q4 fundraise signals ambition but isn't the ask today. Keep this slide moving — 45 seconds max.

---

## Slide 10: Team

### The People Behind the Protocol

| Role | Focus |
|------|-------|
| **Protocol Engineer** | Anchor/Rust programs, Token-2022 integration, on-chain compliance logic. Deep Solana expertise. |
| **Frontend Engineer** | Dashboard UI, wallet integration, institutional-grade user experience. |
| **Product & Design** | UX architecture, go-to-market strategy, institutional partnerships. |

**Why This Team:**
- Combined experience across blockchain infrastructure, institutional finance, and developer tooling
- Built and shipped during a hackathon — velocity is real, not theoretical
- Deep understanding of both the crypto-native and institutional sides of the equation

**Speaker Notes:**
Keep this human and brief. If presenting live, each team member should stand or wave. The key message isn't credentials — it's that this team built a working protocol in a weekend. That says more than any resume. If you have specific backgrounds worth highlighting (ex-bank, ex-protocol team, etc.), name them. Otherwise, let the product speak.

---

## Slide 11: The Ask

### What We Need to Win

**From StableHacks:**
- Recognition as the best institutional infrastructure project
- Access to the Solana Foundation and stablecoin issuer network
- Mentorship from judges with institutional finance expertise

**From Partners (Post-Hackathon):**
- **$5M Seed Round** to take Solidus from Devnet to audited Mainnet and scale
- Introductions to institutional pilot partners (banks, treasury teams, neobanks)
- Guidance on regulatory strategy (MiCA, US state-level MSB licensing)

**What You Get:**
- Early access to the protocol that becomes the compliance standard for institutional stablecoins on Solana
- Ground floor in a $4.5T market that's about to need exactly this

**Speaker Notes:**
Be direct. The hackathon ask is straightforward — say it with gratitude, not desperation. The post-hackathon ask is for the right people in the room. "$500K pre-seed" is specific and credible. Don't say "we're raising" in a vague way — name the number, name the use of funds (audit + mainnet + first hire). "What you get" reframes the ask as an opportunity. You're not begging. You're offering a seat.

---

## Slide 12: Closing

### The Infrastructure Is Missing. We Built It.

> "Stablecoins will move more value than Visa within five years. The only question is whether that happens on rails institutions can trust — or on rails they can't."

**Solidus makes the answer obvious.**

- Website: [solidus.finance]
- GitHub: [github.com/your-org/solidus]
- Contact: [team@solidus.finance]

*Built for StableHacks 2026. Built to last.*

**Speaker Notes:**
End where you started — with conviction, not with a whimper. Read the quote slowly. Let "Solidus makes the answer obvious" land as a statement, not a pitch. Then pause. If presenting live, say "Thank you" and stop talking. Do not ramble after the close. The silence after your last word is part of the presentation. If presenting on video, fade to the Solidus logo on black. Hold for 3 seconds. Cut.

---

## Presentation Timing Guide

| Slide | Duration | Cumulative |
|-------|----------|------------|
| 1. Title | 15s | 0:15 |
| 2. Problem | 45s | 1:00 |
| 3. Solution | 45s | 1:45 |
| 4. How It Works | 40s | 2:25 |
| 5. Demo | 60s | 3:25 |
| 6. Market Size | 30s | 3:55 |
| 7. Business Model | 35s | 4:30 |
| 8. Competitive Advantage | 35s | 5:05 |
| 9. Traction / Roadmap | 40s | 5:45 |
| 10. Team | 20s | 6:05 |
| 11. Ask | 30s | 6:35 |
| 12. Closing | 15s | 6:50 |

**Total: ~7 minutes** (adjust to hackathon time limit; cut Slides 7 and 10 for a 5-minute version)
