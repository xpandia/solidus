# Solidus Demo Script

**StableHacks 2026 | 3-Minute Live Demo**

---

## Pre-Demo Checklist

Before you go live, confirm every item:

- [ ] Solana Devnet is responsive (check status.solana.com)
- [ ] Wallet funded with SOL on Devnet (minimum 2 SOL)
- [ ] Dashboard loaded and logged in
- [ ] Browser tabs pre-staged: (1) Dashboard, (2) Solana Explorer, (3) Pyth oracle feed
- [ ] Screen resolution set to 1920x1080 — no scaling artifacts
- [ ] Notifications OFF on your machine
- [ ] Backup video loaded and ready to play (see Backup Plan below)
- [ ] Test the full flow once, end to end, 30 minutes before presenting

---

## The Flow

### Opening — Set the Frame [0:00 - 0:20]

**What's on screen:** Solidus dashboard, overview tab. Clean. Metrics visible.

**What to say:**
"This is Solidus. What you're looking at is an institutional stablecoin deployment running on Solana Devnet right now. It has compliance rules, reserve verification, and transfer controls — all enforced on-chain. Let me show you what that means in practice."

**Key emphasis:** "Running right now." Not a mockup. Not a Figma. Working code.

---

### Act 1: Configure Compliance Rules [0:20 - 0:55]

**What to do:**
1. Click on the "Compliance" tab in the dashboard
2. Show the compliance configuration panel
3. Set a KYC tier requirement to "Tier 2 — Institutional"
4. Set a velocity limit: $100,000 per 24 hours
5. Add a whitelisted wallet address
6. Click "Save Rules" — show the transaction confirmation on Solana

**What to say:**
"First, I'm an institutional issuer. I need to configure my compliance rules before I issue a single token. Here I'm setting KYC requirements — Tier 2, institutional level. I'm adding a velocity limit — no wallet can move more than $100K in 24 hours. And I'm whitelisting specific counterparty wallets. These rules aren't in a database. They're going on-chain right now."

*[Point to the transaction confirmation]*

"That's a Solana transaction. These rules are now embedded in the protocol. They can't be bypassed. They can't be ignored. They travel with every token I mint."

**Key emphasis:** "They travel with every token." This is the architectural differentiator.

---

### Act 2: Mint a Compliant Stablecoin [0:55 - 1:30]

**What to do:**
1. Navigate to the "Mint" tab
2. Enter amount: 10,000 SUSD (Solidus USD)
3. Select destination wallet (a KYC-verified wallet)
4. Show the pre-mint compliance check — all green
5. Click "Mint"
6. Show the transaction on Solana Explorer — token created with Token-2022 extensions

**What to say:**
"Now I mint. Ten thousand Solidus USD. Before the mint executes, the protocol checks: Is the destination wallet KYC-verified? Yes. Is the reserve backing confirmed by the oracle? Yes. Every check passes — so the mint goes through."

*[Switch to Solana Explorer tab]*

"On Solana Explorer, you can see this is a Token-2022 token with transfer hooks attached. Those hooks are the compliance engine. Every time this token moves, the rules fire. Automatically. On-chain."

**Key emphasis:** Show the Explorer view. Judges want to see real on-chain data, not UI polish.

---

### Act 3: The Transfer Hook — The Wow Moment [1:30 - 2:20]

This is the centerpiece. Spend the most time here.

**What to do:**
1. Go back to the dashboard
2. Initiate a transfer from Wallet A (KYC-verified) to Wallet B (KYC-verified, whitelisted)
3. Transfer succeeds — show the green confirmation
4. Now initiate a transfer from Wallet A to Wallet C (NOT KYC-verified)
5. Transfer is REJECTED on-chain — show the red failure state
6. Show the on-chain error on Solana Explorer: compliance hook rejected the transfer

**What to say:**
"Here's where it gets interesting. I'm transferring 1,000 SUSD from Wallet A to Wallet B. Both are KYC-verified. Wallet B is on the whitelist. Transfer goes through. Done."

*[Pause. Let it land.]*

"Now watch this. Same token. Same sender. But this time I'm sending to Wallet C — a wallet that hasn't completed KYC. I hit transfer..."

*[Click. Wait for the rejection.]*

"Rejected. Not by me. Not by a compliance officer. By the protocol itself. On-chain. In under a second. That's the transfer hook in action. No human in the loop. No way to circumvent it. The compliance is in the token."

**Key emphasis:** The contrast between the successful and rejected transfer is the entire demo. Pause dramatically before revealing the rejection. Let the audience see it happen in real time.

---

### Act 4: Reserve Transparency [2:20 - 2:50]

**What to do:**
1. Navigate to the "Reserves" tab
2. Show the real-time reserve ratio (should read ~100%)
3. Show the Pyth oracle feed — last update timestamp in seconds
4. Click "Verify On-Chain" to show the program state on Solana Explorer

**What to say:**
"Last piece. Reserves. This dashboard shows the reserve ratio in real time — not quarterly, not monthly, right now. That number is fed by a Pyth oracle. You can see it updated seconds ago. And if you don't trust our dashboard — good. Click 'Verify On-Chain' and check the Solana program state yourself. Full transparency. No trust required."

**Key emphasis:** "No trust required." That's the closing line of the technical demo.

---

### Closing — Land the Plane [2:50 - 3:00]

**What's on screen:** Dashboard overview, everything green.

**What to say:**
"Configure. Mint. Transfer with compliance. Verify reserves. All on-chain. All on Solana. All in under three minutes. That's Solidus."

*[Stop talking. Pause. Let the silence do the work.]*

---

## Key Moments to Emphasize

These are the four moments that win or lose the demo:

1. **The compliance rules going on-chain** (Act 1) — Show the Solana transaction. This proves it's real.
2. **The Token-2022 extensions on Explorer** (Act 2) — Judges who know Solana will recognize this immediately. It's technically impressive.
3. **The rejected transfer** (Act 3) — This is the "holy shit" moment. A token that enforces its own compliance rules. No middleware. No API call. On-chain.
4. **The oracle timestamp** (Act 4) — "Updated 4 seconds ago" hits differently than "published Q3 2025."

---

## Delivery Tips

- **Speed:** Talk at 80% of your natural speed. Demos feel faster to the audience than they do to you.
- **Clicking:** Click deliberately. Don't mouse-hunt. Know exactly where every button is before you go live.
- **Errors:** If something takes longer than expected to load, narrate. "Solana Devnet is confirming the transaction — this takes about a second on mainnet." Turn wait times into talking points.
- **Eye contact:** If presenting in person, look at the audience during "what to say" moments. Look at the screen only when clicking or pointing.
- **The pause:** After the rejected transfer, stop talking for 2-3 full seconds. Silence after impact is more powerful than explanation.

---

## Backup Plan

### If Solana Devnet Is Down or Slow

1. **Announce it:** "Devnet is running slow right now, so I've prepared a recorded walkthrough of the same flow."
2. **Play the backup video** (60-90 seconds, pre-recorded with the same flow)
3. **Narrate over it** using the same script above
4. **Show the code:** Pull up the Anchor program in your editor. Walk through the transfer hook logic. "Here's the Rust code that enforces compliance on every transfer. Even if I can't show it live, the code is deployed and verifiable."

### If a Transaction Fails

1. Do NOT panic or apologize
2. Say: "This is Devnet — transactions occasionally fail due to network conditions. On mainnet, this confirms in 400 milliseconds. Let me try once more."
3. Retry once
4. If it fails again, pivot to the backup video or code walkthrough

### If the Dashboard Won't Load

1. Open Solana Explorer directly
2. Show the deployed program, the minted tokens, and the transfer hook program
3. Narrate the flow using Explorer as your visual
4. Say: "The UI is a convenience layer. The protocol works whether or not the dashboard is up. Let me show you the on-chain state directly."

### If You Run Over Time

Cut Act 4 (Reserve Transparency). The transfer hook demo (Act 3) is the closer if time is tight. End with: "And all of this is backed by real-time oracle-verified reserves — which I'd love to show you in the Q&A."

---

## Final Reminders

- The demo is not about showing features. It's about showing one moment of magic: a token that enforces its own rules.
- Everything else — the dashboard, the minting, the reserves — is context for that moment.
- If you nail the rejected transfer, you win.
