# SOLIDUS -- Investor Brief

**Confidential | March 2026**

---

## A. ONE-LINER (YC Style)

Solidus is the compliance and issuance layer that makes stablecoins safe enough for banks -- built on Solana.

---

## B. PROBLEM (With Data)

### Quantified Pain Point

- **$4T+ in institutional capital** remains on the sidelines of stablecoin markets due to the absence of protocol-level compliance infrastructure (Citi GPS, "The Future of Money," 2024; Bernstein Research, 2025).
- Stablecoin market cap crossed **$200B in 2025** (DefiLlama), yet institutional participants represent less than 5% of transaction volume.
- **$5T/day** flows through SWIFT. Banks will not migrate to rails they cannot audit, restrict, or programmatically control in real time.

### Current Solutions and Why They Fail

| Solution | Failure Mode |
|----------|-------------|
| **Circle (CCTP)** | Off-chain compliance only. No per-token programmable rules. Quarterly reserve PDFs. |
| **Fireblocks** | Custodial layer -- compliance is application-level, not protocol-level. Institutions still need to bolt on KYC/AML. |
| **Paxos** | Issuer-level controls only. Cannot enforce per-institution, per-token compliance rulesets. |
| **Manual compliance** | Expensive ($500K+/yr for compliance teams), error-prone, impossible to scale on-chain. |

The fundamental gap: **compliance is treated as an afterthought, not an architectural primitive.** Every existing solution wraps compliant processes around non-compliant tokens. Solidus embeds compliance into the token itself.

---

## C. SOLUTION

### How Solidus Is 10x Better

Solidus is a **protocol-level compliance and issuance engine** for stablecoins on Solana using Token-2022 extensions. It delivers three capabilities that no competitor offers natively:

1. **Programmable Compliance** -- KYC/AML verification is embedded at the mint level via Solana's transfer hooks. Rules travel with the token. Not bolted on. Structural.
2. **Institutional Controls** -- Role-based access, transfer restrictions, velocity limits, and whitelisted counterparties -- all enforced on-chain, per institution, per token.
3. **Real-Time Reserve Transparency** -- Oracle-fed proof-of-reserves via Pyth Network, verifiable every block (~400ms), not every quarter.

**Key architectural insight:** Compliance at the protocol layer means every downstream application inherits it automatically. No middleware. No wrappers. No trust assumptions.

---

## D. WHY NOW

1. **Regulatory inflection.** MiCA enforcement begins in the EU (2025-2026). US state-level money transmitter licensing is accelerating. Institutions cannot adopt stablecoins without protocol-level compliance. The regulatory window demands infrastructure that does not yet exist.
2. **Technology maturity.** Solana's Token-2022 extensions (transfer hooks, confidential transfers, permanent delegates) create the first programmable token standard capable of institutional-grade compliance. This primitive is less than 18 months old.
3. **Market timing.** Visa, PayPal (PYUSD), Franklin Templeton, and BlackRock (BUIDL) are all actively building stablecoin/tokenization strategies. They need infrastructure partners, not competitors. Solidus is positioned as the compliance layer these issuers require.
4. **Solana dominance.** Solana processes 65M+ daily transactions at sub-penny costs. It is the highest-throughput chain with institutional DeFi momentum (Jupiter, Marinade, Jito). The institutional stablecoin layer on Solana does not exist yet.

---

## E. MARKET SIZING

| Metric | Value | Source / Methodology |
|--------|-------|---------------------|
| **TAM** | **$4.5T** | Global institutional stablecoin settlement volume projected by 2027 (Citi GPS, BCG, Bernstein). Includes treasury management, cross-border payments, and trade finance. |
| **SAM** | **$320B** | Institutions actively exploring on-chain treasury and settlement on high-throughput L1 chains. Derived from: ~200 major banks/fintechs with announced stablecoin initiatives x avg. $1.6B annual settlement volume. |
| **SOM** | **$12B** | First-mover capture via 3-5 institutional partnerships in Year 1. Conservative: 3 mid-size institutions x $4B avg. settlement volume. Solidus captures infrastructure fees on this volume. |

---

## F. UNIT ECONOMICS

### Revenue Model: Protocol Fees + Enterprise Licensing

| Metric | Assumption | Value |
|--------|-----------|-------|
| **Protocol fee** | 1-3 basis points on issuance/redemption | $0.0001 - $0.0003 per dollar |
| **Year 1 volume (SOM)** | $12B settlement volume | -- |
| **Year 1 protocol revenue** | 2 bps average | **$2.4M ARR** |
| **Enterprise license** | $100K-$500K/yr per institution | **$300K-$2.5M ARR** |
| **Blended Year 1 revenue** | Protocol + 3-5 enterprise deals | **$3M-$5M ARR** |

### LTV Calculation

- Average enterprise contract: $250K/yr
- Average retention: 5+ years (switching costs are extreme -- compliance rulesets are deeply embedded)
- **LTV: $1.25M per enterprise customer**

### CAC by Channel

| Channel | Est. CAC | Notes |
|---------|----------|-------|
| Direct enterprise sales | $50K-$100K | Long sales cycle (6-12 months), high ACV justifies it |
| Solana ecosystem partnerships | $10K-$25K | Co-marketing with Solana Foundation, hackathon presence |
| Developer community / SDK adoption | $5K-$15K | Bottom-up: devs build on Solidus SDK, pull institutions up |

### Key Ratios

| Metric | Value |
|--------|-------|
| **LTV:CAC** | **12.5x - 25x** (enterprise channel) |
| **Gross margin** | **85-92%** (software + protocol fees, minimal COGS) |
| **Burn multiple target** | **<2x** by Month 18 |
| **CAC payback period** | **3-6 months** (enterprise license covers CAC in first annual payment) |

---

## G. COMPETITIVE MOAT

### Primary Moat: Architectural Advantage + Switching Costs

Solidus embeds compliance at the **protocol layer** (Solana Token-2022 transfer hooks). Competitors would need to rebuild their entire token architecture to match -- not a feature sprint, but a multi-year re-architecture effort.

Once an institution configures compliance rulesets, KYC tiers, and whitelisted counterparties through Solidus, the switching cost is prohibitive: regulatory re-certification, re-integration, and operational risk.

### Competitive Landscape

| Capability | Solidus | Circle CCTP | Fireblocks | Paxos | Chainalysis |
|-----------|---------|-------------|------------|-------|-------------|
| On-chain compliance (protocol-level) | Native | Off-chain | Custodial | Issuer-only | Monitoring only |
| Programmable per-token rules | Yes | No | API-based | Limited | No |
| Real-time reserve proof | Every block | Quarterly PDF | N/A | Monthly | N/A |
| Transaction cost | ~$0.001 | $0.10-$5.00 | Custodial fees | $0.10+ | N/A |
| Finality | 400ms | Variable | Variable | Variable | N/A |
| Open issuance (any institution) | Yes | Circle only | No | Paxos only | N/A |

### Defensibility Assessment

1. **Architectural moat** (strong) -- Protocol-level compliance cannot be replicated as a wrapper.
2. **Switching costs** (strong) -- Compliance rulesets are deeply embedded and require regulatory re-approval to migrate.
3. **Data moat** (growing) -- On-chain compliance data becomes an institutional trust layer over time.
4. **First-mover** (moderate, time-sensitive) -- Token-2022 institutional compliance is an unoccupied niche. Window is 12-18 months.

---

## H. GO-TO-MARKET

### Beachhead (First 1,000 Users)

Not user-count-driven. This is an enterprise B2B play. Beachhead = **first 5 institutional deployments**.

1. **Target profile:** Mid-size neobanks and fintechs already experimenting with stablecoins (e.g., Nubank, Mercado Pago, Revolut, Wise).
2. **Entry point:** Free Solidus SDK for devnet testing. White-glove onboarding for mainnet deployment.
3. **Proof point:** First institution issues a compliant stablecoin on Solana mainnet via Solidus. This becomes the reference case for every subsequent deal.

### Channel Strategy

| Channel | Motion | Timeline |
|---------|--------|----------|
| Solana Foundation partnership | Co-marketing, ecosystem grants, institutional introductions | Q2-Q3 2026 |
| Direct enterprise sales | Outbound to compliance/treasury teams at target institutions | Q3 2026+ |
| Developer SDK adoption | Bottom-up: devs discover Solidus via documentation, hackathons, open-source | Ongoing |
| Conference/event presence | Solana Breakpoint, Token2049, Money20/20 | Q3-Q4 2026 |

### Viral Coefficient

Not applicable in the traditional sense. Network effects are B2B: **every institution on Solidus increases the value for every other institution** (shared compliance standards, interoperable whitelists, cross-institution settlement).

### Partnership Strategy

- **Solana Foundation** -- Ecosystem grant + institutional introductions
- **Stablecoin issuers** (Circle, Tether, PayPal) -- Solidus is not a competitor; it is their institutional distribution layer
- **Compliance providers** (Chainalysis, Elliptic) -- Integration partnerships for KYC/AML data feeds
- **Audit firms** (Certik, OtterSec) -- Co-branded security for institutional trust

---

## I. BUSINESS MODEL

### Revenue Streams

| Stream | Pricing | Margin |
|--------|---------|--------|
| **Protocol fees** | 1-3 bps on issuance/redemption volume | ~95% (on-chain, automated) |
| **Enterprise licensing** | $100K-$500K/yr per institution | ~90% (software license) |
| **SDK/API access (production tier)** | Usage-based, $0.01-$0.10 per API call | ~85% |
| **Compliance-as-a-Service** | $5K-$25K/mo for existing stablecoin projects | ~80% |

### Unit Economics at Scale (Year 3)

- **$50B+ settlement volume** flowing through Solidus
- **15-25 institutional partners** paying enterprise licenses
- **ARR: $15M-$25M** (blended protocol fees + licensing)
- **Gross margin: 88%+**

### Path to Profitability

- Break-even at ~$8M ARR (achievable Year 2)
- Capital-efficient model: protocol fees scale with volume, not headcount
- Cash flow positive by Q4 2027 at projected growth rate

---

## J. 3-YEAR FINANCIAL PROJECTIONS

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **Settlement Volume** | $12B | $50B | $150B |
| **Institutional Partners** | 3-5 | 10-15 | 20-30 |
| **ARR** | $3M-$5M | $10M-$15M | $25M-$40M |
| **MRR (end of year)** | $400K | $1.2M | $3.3M |
| **Gross Margin** | 85% | 88% | 90% |
| **Monthly Burn Rate** | $180K | $350K | $500K |
| **Team Size** | 8 | 18 | 35 |
| **Cash Position (pre-raise)** | $2M | $6M | $15M |

---

## K. TEAM REQUIREMENTS

### Founding Team Composition

| Role | Priority | Profile |
|------|----------|---------|
| **CEO / BD Lead** | Critical | Enterprise sales background in fintech/banking. Regulatory fluency. Network in institutional finance. |
| **CTO / Protocol Lead** | Critical | Deep Solana/Rust expertise. Shipped production-grade protocol infrastructure. Security-first mindset. |
| **Head of Compliance** | Critical | Former bank compliance officer or fintech regulatory counsel. MiCA / US MSB licensing expertise. |

### First 10 Hires

1. Senior Solana/Rust engineer
2. Smart contract security engineer
3. Enterprise sales lead
4. DevRel / Developer advocate
5. Frontend engineer (institutional dashboard)
6. Compliance analyst
7. Solutions architect (customer onboarding)
8. Backend engineer (API/SDK)
9. Product designer
10. Marketing lead (B2B / institutional)

### Advisory Board

- Former banking regulator (OCC, FDIC, or EU equivalent)
- Solana Foundation ecosystem lead
- Stablecoin issuer executive (Circle, Tether, or Paxos)
- Enterprise blockchain attorney

---

## L. FUNDING ASK

### Amount: $5M Seed Round

| Use of Funds | Allocation | % |
|-------------|-----------|---|
| Engineering (protocol + security) | $2M | 40% |
| Enterprise sales + BD | $1M | 20% |
| Compliance + legal (licensing, audit) | $750K | 15% |
| DevRel + ecosystem growth | $500K | 10% |
| Operations + overhead | $500K | 10% |
| Reserve | $250K | 5% |

### Milestones Per Tranche

| Tranche | Amount | Milestone |
|---------|--------|-----------|
| **Tranche 1** (close) | $2.5M | Mainnet launch, smart contract audit complete, first pilot institution signed |
| **Tranche 2** (Month 9) | $2.5M | 3+ institutions live, $5B+ settlement volume, SOC 2 Type II initiated |

### Expected Valuation Range

- **$20M-$30M post-money** (Seed)
- Comparable: infrastructure-layer crypto startups at seed (Wormhole pre-token, LayerZero seed, Pyth seed-equivalent rounds)

---

## M. RISKS AND MITIGATIONS

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **Regulatory uncertainty** -- Stablecoin regulation evolves unpredictably, especially in the US | High | Multi-jurisdictional strategy (start in MiCA-compliant EU, expand to US). Hire regulatory counsel as founding team member. Build framework-agnostic compliance engine. |
| 2 | **Solana concentration risk** -- Dependency on a single L1 chain | Medium | Architecture designed for multi-chain expansion (Ethereum L2s in roadmap). Token-2022 is the wedge, not the ceiling. |
| 3 | **Enterprise sales cycle** -- Institutional deals take 6-18 months to close | High | Begin with pilot programs (free tier). Reduce friction with self-serve SDK. Build pipeline of 20+ prospects to ensure 3-5 close per year. |
| 4 | **Smart contract security** -- Protocol-level vulnerability could be catastrophic | Critical | Multiple independent audits (OtterSec, Certik). Formal verification where possible. Bug bounty program. Insurance coverage. |
| 5 | **Incumbent response** -- Circle, Paxos, or Fireblocks builds competing compliance layer | Medium | Architectural moat: competitors would need to rebuild from scratch on Token-2022. First-mover advantage compounds with each institutional deployment. Switching costs are extreme once rulesets are configured. |

---

## N. EXIT STRATEGY

### Potential Acquirers

| Acquirer | Strategic Rationale | Estimated Value |
|----------|-------------------|-----------------|
| **Circle** | Compliance infrastructure for USDC institutional distribution | $200M-$500M |
| **Visa / Mastercard** | On-chain settlement compliance for tokenized payments | $300M-$1B |
| **Fireblocks** | Protocol-level compliance complements custodial infrastructure | $150M-$400M |
| **Solana Labs / Foundation** | Core institutional infrastructure for the Solana ecosystem | $100M-$300M |
| **Coinbase** | Institutional stablecoin rails complement Base L2 strategy | $200M-$500M |

### Comparable Exits

| Company | Exit | Value | Year |
|---------|------|-------|------|
| **Paxos** (raised $540M) | Ongoing, $2.4B valuation | -- | 2023 |
| **Fireblocks** | Raised $550M at $8B valuation | -- | 2022 |
| **Chainalysis** | $8.6B valuation | -- | 2022 |
| **Circle** | SPAC/IPO attempt, valued at $9B | -- | 2022-2024 |

### IPO Timeline

- Possible at $100M+ ARR (Year 4-5)
- DPO or traditional IPO depending on regulatory environment
- Token launch as alternative/complement to equity IPO (infrastructure token for protocol governance)

---

*Prepared for investor due diligence. All projections are forward-looking estimates based on market research and comparable company analysis. Confidential -- do not distribute without permission.*
