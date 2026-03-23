# Solidus

**The infrastructure that makes stablecoins institutional-grade. Built on Solana.**

---

## Vision

> "Stablecoins should be as reliable as gravity. Solidus makes them invisible — the way the best infrastructure always is."

---

## The Problem

Institutions want to move trillions through stablecoins. They can't — and here's why:

- **No compliance layer.** Existing stablecoin rails lack KYC/AML enforcement at the protocol level, making institutional adoption a regulatory minefield.
- **No programmable controls.** Treasurers need whitelisting, freeze capabilities, and role-based permissions. Today, they get a raw token and a prayer.
- **No transparency.** Reserve attestations are PDFs published quarterly. Institutions need real-time, on-chain proof of backing.

The result: **$4T+ in institutional capital sits on the sidelines**, waiting for stablecoin infrastructure that meets their standards.

---

## The Solution

Solidus is a **protocol-level compliance and issuance layer** for stablecoins on Solana. It gives institutions three things they've never had:

1. **Programmable compliance** — Whitelist-based transfer restrictions enforced on-chain via Token-2022.
2. **Institutional controls** — Role-based access (Admin, Issuer, Compliance Officer), account freeze/unfreeze, configurable mint caps, and two-step admin transfer.
3. **Reserve transparency** — On-chain reserve proof hash anchoring with timestamped attestations.

---

## How It Works

### Step 1: Configure
The admin initializes the protocol, assigns roles, and whitelists counterparties via the Solidus API or directly on-chain.

### Step 2: Issue
Stablecoins are minted through the Solidus Anchor program on Solana using Token-2022, with compliance checks (whitelist + freeze status) enforced at mint time.

### Step 3: Operate
Every transfer is validated on-chain against whitelist and freeze state. Reserve proof hashes can be submitted and verified on-chain. Full audit trail via Anchor events.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | Solana (Token-2022 / Token Extensions) |
| **Smart Contracts** | Anchor 0.30.1 (Rust) |
| **Token Standard** | SPL Token-2022 with TransferChecked |
| **Reserve Proofs** | On-chain hash anchoring (manual attestation) |
| **Frontend** | Static landing page (HTML/CSS/JS) |
| **Backend / API** | Node.js + Express (transaction builder + relay) |

---

## Architecture

```
+--------------------------------------------------+
|                 Solidus Protocol                  |
+----------+--------------+------------------------+
|  Issuer  |  Compliance  |  Reserve Transparency  |
|  Module  |    Engine    |    (Hash Anchoring)    |
+----------+--------------+------------------------+
|          Solana Token-2022 Extensions             |
+--------------------------------------------------+
|                 Solana Runtime                    |
+--------------------------------------------------+
```

---

## Current Features

- [x] Role-based access control (Admin, Issuer, Compliance Officer)
- [x] Token-2022 mint with TransferChecked for hook compatibility
- [x] Address whitelisting for transfers
- [x] Account freeze / unfreeze
- [x] Configurable mint cap
- [x] Two-step admin transfer (initiate + accept)
- [x] Emergency pause / unpause
- [x] On-chain reserve proof hash submission
- [x] REST API for transaction building (unsigned tx pattern)
- [x] Anchor discriminator computation (sha256-based)
- [x] Landing page

---

## Project Structure

```
01-Solidus/
+-- src/
|   +-- contracts/
|   |   +-- program.rs       # Anchor program (Token-2022)
|   |   +-- Cargo.toml       # Rust dependencies
|   |   +-- Anchor.toml      # Anchor configuration
|   +-- backend/
|   |   +-- server.js        # Express API server
|   |   +-- package.json     # Node.js dependencies
|   |   +-- .env.example     # Environment variable template
|   +-- frontend/
|       +-- index.html        # Landing page
+-- docs/                     # Pitch materials, audit report
+-- README.md
```

---

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v1.18+)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (v0.30.1)
- [Node.js](https://nodejs.org/) (v18+)

### 1. Build the Anchor Program

```bash
cd src/contracts
anchor build
```

After building, update the program ID in `program.rs` (`declare_id!`) and `Anchor.toml` with the generated keypair:

```bash
solana-keygen pubkey target/deploy/solidus-keypair.json
```

### 2. Deploy to Devnet

```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

### 3. Run the Backend

```bash
cd src/backend
cp .env.example .env
# Edit .env with your deployed program ID and RPC URL
npm install
npm start
```

The API will be available at `http://localhost:3001`.

### 4. View the Landing Page

Open `src/frontend/index.html` in your browser.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | Protocol status (config, supply, pause state) |
| GET | `/api/wallet/:address/balance` | SOL + token balance |
| GET | `/api/wallet/:address/role` | Role lookup |
| GET | `/api/wallet/:address/whitelist` | Whitelist status |
| GET | `/api/wallet/:address/freeze` | Freeze status |
| POST | `/api/tx/mint` | Build mint transaction |
| POST | `/api/tx/burn` | Build burn transaction |
| POST | `/api/tx/transfer` | Build compliant transfer transaction |
| POST | `/api/tx/freeze` | Build freeze transaction |
| POST | `/api/tx/unfreeze` | Build unfreeze transaction |
| POST | `/api/tx/submit` | Submit signed transaction |
| GET | `/api/tx/:signature` | Transaction lookup |
| GET | `/api/pda/*` | PDA address derivation helpers |

---

## Team

| Role | Responsibility |
|---|---|
| **Protocol Engineer** | Anchor programs, Token-2022 integration, on-chain compliance logic |
| **Frontend Engineer** | Landing page, wallet integration |
| **Product / Design** | UX flows, pitch deck, documentation |

---

## License

MIT

---

<p align="center">
  <strong>Solidus</strong> — Institutional-grade stablecoin infrastructure.<br>
  Built for StableHacks 2026 on DoraHacks.
</p>
