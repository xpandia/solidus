/**
 * Solidus — Institutional Stablecoin Infrastructure API
 *
 * Express.js backend that provides:
 *   - REST endpoints for all stablecoin operations
 *   - Transaction building helpers (unsigned txs returned to client for signing)
 *   - Compliance-check middleware
 *   - Health / status endpoints
 */

require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");

const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} = require("@solana/spl-token");
const { AnchorProvider, Program, BN, web3 } = require("@coral-xyz/anchor");

// ---------------------------------------------------------------------------
// Configuration — environment variables with validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = [];
const OPTIONAL_ENV_VARS = ["PORT", "SOLANA_RPC_URL", "PROGRAM_ID", "CORS_ORIGINS"];

// Warn about missing optional vars in production
if (process.env.NODE_ENV === "production") {
  if (!process.env.SOLANA_RPC_URL) {
    console.warn("[config] WARNING: SOLANA_RPC_URL not set, using devnet default");
  }
  if (!process.env.PROGRAM_ID) {
    console.warn("[config] WARNING: PROGRAM_ID not set, using placeholder");
  }
}

const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

let PROGRAM_ID;
try {
  PROGRAM_ID = new PublicKey(
    process.env.PROGRAM_ID || "So1idusXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  );
} catch (err) {
  console.error("[config] FATAL: Invalid PROGRAM_ID:", process.env.PROGRAM_ID);
  process.exit(1);
}

const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:5173"];

// Token-2022 program ID
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

// ---------------------------------------------------------------------------
// Anchor discriminator calculation
// ---------------------------------------------------------------------------

/**
 * Compute the Anchor instruction discriminator.
 * Anchor uses the first 8 bytes of sha256("global:<instruction_name>").
 */
function anchorDiscriminator(instructionName) {
  const hash = crypto.createHash("sha256").update(`global:${instructionName}`).digest();
  return hash.subarray(0, 8);
}

// Pre-compute all discriminators at startup
const DISCRIMINATORS = {
  initialize: anchorDiscriminator("initialize"),
  set_role: anchorDiscriminator("set_role"),
  revoke_role: anchorDiscriminator("revoke_role"),
  add_to_whitelist: anchorDiscriminator("add_to_whitelist"),
  remove_from_whitelist: anchorDiscriminator("remove_from_whitelist"),
  mint_stablecoin: anchorDiscriminator("mint_stablecoin"),
  burn_stablecoin: anchorDiscriminator("burn_stablecoin"),
  compliant_transfer: anchorDiscriminator("compliant_transfer"),
  freeze_account: anchorDiscriminator("freeze_account"),
  unfreeze_account: anchorDiscriminator("unfreeze_account"),
  submit_reserve_proof: anchorDiscriminator("submit_reserve_proof"),
  pause: anchorDiscriminator("pause"),
  unpause: anchorDiscriminator("unpause"),
  transfer_admin: anchorDiscriminator("transfer_admin"),
  accept_admin: anchorDiscriminator("accept_admin"),
  set_mint_cap: anchorDiscriminator("set_mint_cap"),
};

// ---------------------------------------------------------------------------
// Solana connection (read-only, no wallet — txs are built unsigned)
// ---------------------------------------------------------------------------

const connection = new Connection(RPC_URL, "confirmed");

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

function isValidPublicKey(value) {
  if (!value || typeof value !== "string") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function isValidAmount(value) {
  if (value === undefined || value === null) return false;
  // Accept string or number, must be a positive integer
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return false;
  if (num <= 0 || !Number.isInteger(num)) return false;
  // Must fit in u64 (< 2^64)
  if (num > Number.MAX_SAFE_INTEGER) return false;
  return true;
}

function validatePublicKey(value, fieldName) {
  if (!isValidPublicKey(value)) {
    return { error: `Invalid or missing ${fieldName}: must be a valid Solana public key` };
  }
  return null;
}

function validateAmount(value) {
  if (!isValidAmount(value)) {
    return { error: "Invalid amount: must be a positive integer" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

function deriveConfigPDA() {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
}

function deriveMintPDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stablecoin_mint")],
    PROGRAM_ID
  );
}

function deriveRolePDA(user) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("role"), new PublicKey(user).toBuffer()],
    PROGRAM_ID
  );
}

function deriveWhitelistPDA(user) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist"), new PublicKey(user).toBuffer()],
    PROGRAM_ID
  );
}

function deriveFreezePDA(user) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("freeze"), new PublicKey(user).toBuffer()],
    PROGRAM_ID
  );
}

// ---------------------------------------------------------------------------
// Express App
// ---------------------------------------------------------------------------

const app = express();

// Security headers
app.use(helmet());

// CORS — allow all origins for demo
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));

// Request logging
app.use(morgan("short"));

// Global rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use(limiter);

// Stricter rate limit for transaction submission
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Transaction submission rate limit exceeded. Try again later." },
});

// Assign a unique request ID
app.use((req, _res, next) => {
  req.requestId = req.headers["x-request-id"] || uuidv4();
  next();
});

// ---------------------------------------------------------------------------
// Compliance middleware — reusable guard for protected endpoints
// ---------------------------------------------------------------------------

function complianceCheck(requiredRole) {
  return async (req, res, next) => {
    try {
      const wallet = req.body.wallet || req.query.wallet;
      if (!wallet) {
        return res.status(400).json({ error: "wallet address is required" });
      }

      // Validate public key format
      const walletErr = validatePublicKey(wallet, "wallet");
      if (walletErr) return res.status(400).json(walletErr);

      // If no specific role is required, just pass through
      if (!requiredRole) return next();

      // Check on-chain role PDA
      const [rolePDA] = deriveRolePDA(wallet);
      const roleInfo = await connection.getAccountInfo(rolePDA);

      if (!roleInfo) {
        return res.status(403).json({ error: "No role assigned to this wallet" });
      }

      // Role data layout (after 8-byte Anchor discriminator):
      //   user: Pubkey (32) | role: u8 (1) | granted_at: i64 (8) |
      //   granted_by: Pubkey (32) | is_active: bool (1) | bump: u8 (1)
      const data = roleInfo.data;
      if (data.length < 8 + 32 + 1 + 8 + 32 + 1) {
        return res.status(500).json({ error: "Corrupt role account data" });
      }
      const roleValue = data[8 + 32]; // role enum index
      const isActive = data[8 + 32 + 1 + 8 + 32] === 1;

      const roleMap = { 0: "Admin", 1: "Issuer", 2: "ComplianceOfficer" };
      const roleName = roleMap[roleValue];

      if (!isActive) {
        return res.status(403).json({ error: "Role is not active" });
      }

      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!allowed.includes(roleName)) {
        return res.status(403).json({
          error: `Required role: ${allowed.join(" or ")}. Found: ${roleName}`,
        });
      }

      req.role = roleName;
      next();
    } catch (err) {
      console.error("[compliance]", err.message);
      return res.status(500).json({ error: "Compliance check failed" });
    }
  };
}

// ---------------------------------------------------------------------------
// Utility: build a serialised unsigned transaction
// ---------------------------------------------------------------------------

async function buildSerializedTx(instructions, feePayer) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: new PublicKey(feePayer),
  });

  instructions.forEach((ix) => tx.add(ix));

  return {
    transaction: tx
      .serialize({ requireAllSignatures: false })
      .toString("base64"),
    blockhash,
    lastValidBlockHeight,
  };
}

// ---------------------------------------------------------------------------
// Health & Status
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "solidus-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    network: RPC_URL.includes("devnet") ? "devnet" : RPC_URL.includes("mainnet") ? "mainnet-beta" : "custom",
    programId: PROGRAM_ID.toBase58(),
    uptime: process.uptime(),
    demoMode: true,
    endpoints: {
      health: "GET /health",
      status: "GET /status",
      demoState: "GET /api/demo/state",
      demoWallets: "GET /api/demo/wallets",
      demoTransactions: "GET /api/demo/transactions",
      demoReserve: "GET /api/demo/verify-reserve",
      demoComplianceCheck: "POST /api/demo/compliance-check",
      txMint: "POST /api/tx/mint",
      txBurn: "POST /api/tx/burn",
      txTransfer: "POST /api/tx/transfer",
      txFreeze: "POST /api/tx/freeze",
      txUnfreeze: "POST /api/tx/unfreeze",
      txSubmit: "POST /api/tx/submit",
      txLookup: "GET /api/tx/:signature",
      walletBalance: "GET /api/wallet/:address/balance",
      walletRole: "GET /api/wallet/:address/role",
      walletWhitelist: "GET /api/wallet/:address/whitelist",
      walletFreeze: "GET /api/wallet/:address/freeze",
      pdaConfig: "GET /api/pda/config",
      pdaMint: "GET /api/pda/mint",
      pdaRole: "GET /api/pda/role/:address",
      pdaWhitelist: "GET /api/pda/whitelist/:address",
      pdaFreeze: "GET /api/pda/freeze/:address",
    },
  });
});

app.get("/status", async (_req, res) => {
  try {
    const [configPDA] = deriveConfigPDA();
    const [mintPDA] = deriveMintPDA();
    const slot = await connection.getSlot();
    const configInfo = await connection.getAccountInfo(configPDA);

    const payload = {
      network: RPC_URL,
      programId: PROGRAM_ID.toBase58(),
      configPDA: configPDA.toBase58(),
      mintPDA: mintPDA.toBase58(),
      currentSlot: slot,
      configInitialized: configInfo !== null,
    };

    if (configInfo) {
      const data = configInfo.data;
      // Updated layout with pending_admin and mint_cap fields:
      //   discriminator: 8 | admin: 32 | pending_admin: 32 | mint: 32 |
      //   total_supply: 8 | mint_cap: 8 | is_paused: 1 |
      //   reserve_proof_hash: 32 | reserve_verified_at: 8 |
      //   bump: 1 | mint_bump: 1 | decimals: 1
      const admin = new PublicKey(data.subarray(8, 40)).toBase58();
      const pendingAdmin = new PublicKey(data.subarray(40, 72)).toBase58();
      const totalSupply = new BN(data.subarray(104, 112), "le").toString();
      const mintCap = new BN(data.subarray(112, 120), "le").toString();
      const isPaused = data[120] === 1;
      const reserveVerifiedAt = new BN(data.subarray(153, 161), "le").toNumber();
      const decimals = data[163];

      Object.assign(payload, {
        admin,
        pendingAdmin: pendingAdmin === PublicKey.default.toBase58() ? null : pendingAdmin,
        totalSupply,
        mintCap,
        isPaused,
        reserveVerifiedAt:
          reserveVerifiedAt > 0
            ? new Date(reserveVerifiedAt * 1000).toISOString()
            : null,
        decimals,
      });
    }

    res.json(payload);
  } catch (err) {
    console.error("[status]", err.message);
    res.status(500).json({ error: "Failed to fetch protocol status" });
  }
});

// ---------------------------------------------------------------------------
// Wallet utilities
// ---------------------------------------------------------------------------

app.get("/api/wallet/:address/balance", async (req, res) => {
  try {
    const addrErr = validatePublicKey(req.params.address, "address");
    if (addrErr) return res.status(400).json(addrErr);

    const pubkey = new PublicKey(req.params.address);
    const solBalance = await connection.getBalance(pubkey);
    const [mintPDA] = deriveMintPDA();

    let tokenBalance = "0";
    try {
      const ata = await getAssociatedTokenAddress(
        mintPDA,
        pubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      const tokenAccount = await connection.getTokenAccountBalance(ata);
      tokenBalance = tokenAccount.value.uiAmountString;
    } catch {
      // Token account may not exist yet
    }

    res.json({
      address: req.params.address,
      solBalance: solBalance / LAMPORTS_PER_SOL,
      tokenBalance,
    });
  } catch (err) {
    console.error("[balance]", err.message);
    res.status(400).json({ error: "Invalid address or fetch failed" });
  }
});

app.get("/api/wallet/:address/role", async (req, res) => {
  try {
    const addrErr = validatePublicKey(req.params.address, "address");
    if (addrErr) return res.status(400).json(addrErr);

    const [rolePDA] = deriveRolePDA(req.params.address);
    const info = await connection.getAccountInfo(rolePDA);

    if (!info) {
      return res.json({ address: req.params.address, role: null, isActive: false });
    }

    const data = info.data;
    const roleValue = data[8 + 32];
    const isActive = data[8 + 32 + 1 + 8 + 32] === 1;
    const roleMap = { 0: "Admin", 1: "Issuer", 2: "ComplianceOfficer" };

    res.json({
      address: req.params.address,
      role: roleMap[roleValue] || "Unknown",
      isActive,
    });
  } catch (err) {
    console.error("[role]", err.message);
    res.status(400).json({ error: "Failed to fetch role" });
  }
});

app.get("/api/wallet/:address/whitelist", async (req, res) => {
  try {
    const addrErr = validatePublicKey(req.params.address, "address");
    if (addrErr) return res.status(400).json(addrErr);

    const [wlPDA] = deriveWhitelistPDA(req.params.address);
    const info = await connection.getAccountInfo(wlPDA);

    if (!info) {
      return res.json({ address: req.params.address, isWhitelisted: false });
    }

    const isWhitelisted = info.data[8 + 32] === 1;
    res.json({ address: req.params.address, isWhitelisted });
  } catch (err) {
    console.error("[whitelist]", err.message);
    res.status(400).json({ error: "Failed to check whitelist" });
  }
});

app.get("/api/wallet/:address/freeze", async (req, res) => {
  try {
    const addrErr = validatePublicKey(req.params.address, "address");
    if (addrErr) return res.status(400).json(addrErr);

    const [freezePDA] = deriveFreezePDA(req.params.address);
    const info = await connection.getAccountInfo(freezePDA);

    if (!info) {
      return res.json({ address: req.params.address, isFrozen: false });
    }

    const isFrozen = info.data[8 + 32] === 1;
    res.json({ address: req.params.address, isFrozen });
  } catch (err) {
    console.error("[freeze]", err.message);
    res.status(400).json({ error: "Failed to check freeze state" });
  }
});

// ---------------------------------------------------------------------------
// Transaction builders — return unsigned serialized transactions
// ---------------------------------------------------------------------------

/**
 * POST /api/tx/mint
 * Body: { wallet, recipient, amount }
 * Returns an unsigned transaction for the client wallet to sign.
 */
app.post("/api/tx/mint", complianceCheck("Issuer"), async (req, res) => {
  try {
    const { wallet, recipient, amount } = req.body;

    const recipientErr = validatePublicKey(recipient, "recipient");
    if (recipientErr) return res.status(400).json(recipientErr);
    const amountErr = validateAmount(amount);
    if (amountErr) return res.status(400).json(amountErr);

    const issuer = new PublicKey(wallet);
    const recipientPubkey = new PublicKey(recipient);
    const [configPDA] = deriveConfigPDA();
    const [mintPDA] = deriveMintPDA();
    const [issuerRolePDA] = deriveRolePDA(wallet);
    const [recipientWlPDA] = deriveWhitelistPDA(recipient);
    const [recipientFreezePDA] = deriveFreezePDA(recipient);

    const recipientATA = await getAssociatedTokenAddress(
      mintPDA,
      recipientPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Build instruction data: 8-byte discriminator + u64 amount
    const amountBuf = Buffer.alloc(8);
    new BN(amount).toBuffer("le", 8).copy(amountBuf);
    const data = Buffer.concat([DISCRIMINATORS.mint_stablecoin, amountBuf]);

    const keys = [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: mintPDA, isSigner: false, isWritable: true },
      { pubkey: issuerRolePDA, isSigner: false, isWritable: false },
      { pubkey: recipientWlPDA, isSigner: false, isWritable: false },
      { pubkey: recipientFreezePDA, isSigner: false, isWritable: false },
      { pubkey: recipientATA, isSigner: false, isWritable: true },
      { pubkey: recipientPubkey, isSigner: false, isWritable: false },
      { pubkey: issuer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const ix = new web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys,
      data,
    });

    const result = await buildSerializedTx([ix], wallet);
    res.json({ ...result, message: `Mint ${amount} tokens to ${recipient}` });
  } catch (err) {
    console.error("[tx/mint]", err.message);
    res.status(500).json({ error: "Failed to build mint transaction" });
  }
});

/**
 * POST /api/tx/burn
 * Body: { wallet, amount }
 */
app.post("/api/tx/burn", complianceCheck("Issuer"), async (req, res) => {
  try {
    const { wallet, amount } = req.body;

    const amountErr = validateAmount(amount);
    if (amountErr) return res.status(400).json(amountErr);

    const issuer = new PublicKey(wallet);
    const [configPDA] = deriveConfigPDA();
    const [mintPDA] = deriveMintPDA();
    const [issuerRolePDA] = deriveRolePDA(wallet);
    const [sourceWlPDA] = deriveWhitelistPDA(wallet);
    const [sourceFreezePDA] = deriveFreezePDA(wallet);
    const sourceATA = await getAssociatedTokenAddress(
      mintPDA,
      issuer,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const amountBuf = Buffer.alloc(8);
    new BN(amount).toBuffer("le", 8).copy(amountBuf);
    const data = Buffer.concat([DISCRIMINATORS.burn_stablecoin, amountBuf]);

    const keys = [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: mintPDA, isSigner: false, isWritable: true },
      { pubkey: issuerRolePDA, isSigner: false, isWritable: false },
      { pubkey: sourceWlPDA, isSigner: false, isWritable: false },
      { pubkey: sourceFreezePDA, isSigner: false, isWritable: false },
      { pubkey: sourceATA, isSigner: false, isWritable: true },
      { pubkey: issuer, isSigner: true, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const ix = new web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys,
      data,
    });

    const result = await buildSerializedTx([ix], wallet);
    res.json({ ...result, message: `Burn ${amount} tokens` });
  } catch (err) {
    console.error("[tx/burn]", err.message);
    res.status(500).json({ error: "Failed to build burn transaction" });
  }
});

/**
 * POST /api/tx/transfer
 * Body: { wallet, recipient, amount }
 */
app.post("/api/tx/transfer", complianceCheck(null), async (req, res) => {
  try {
    const { wallet, recipient, amount } = req.body;

    const recipientErr = validatePublicKey(recipient, "recipient");
    if (recipientErr) return res.status(400).json(recipientErr);
    const amountErr = validateAmount(amount);
    if (amountErr) return res.status(400).json(amountErr);

    const sender = new PublicKey(wallet);
    const recipientPubkey = new PublicKey(recipient);
    const [configPDA] = deriveConfigPDA();
    const [mintPDA] = deriveMintPDA();
    const [senderWlPDA] = deriveWhitelistPDA(wallet);
    const [recipientWlPDA] = deriveWhitelistPDA(recipient);
    const [senderFreezePDA] = deriveFreezePDA(wallet);
    const [recipientFreezePDA] = deriveFreezePDA(recipient);

    const senderATA = await getAssociatedTokenAddress(
      mintPDA,
      sender,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    const recipientATA = await getAssociatedTokenAddress(
      mintPDA,
      recipientPubkey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const amountBuf = Buffer.alloc(8);
    new BN(amount).toBuffer("le", 8).copy(amountBuf);
    const data = Buffer.concat([DISCRIMINATORS.compliant_transfer, amountBuf]);

    const keys = [
      { pubkey: configPDA, isSigner: false, isWritable: false },
      { pubkey: mintPDA, isSigner: false, isWritable: false },
      { pubkey: senderWlPDA, isSigner: false, isWritable: false },
      { pubkey: recipientWlPDA, isSigner: false, isWritable: false },
      { pubkey: senderFreezePDA, isSigner: false, isWritable: false },
      { pubkey: recipientFreezePDA, isSigner: false, isWritable: false },
      { pubkey: senderATA, isSigner: false, isWritable: true },
      { pubkey: recipientATA, isSigner: false, isWritable: true },
      { pubkey: recipientPubkey, isSigner: false, isWritable: false },
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const ix = new web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys,
      data,
    });

    const result = await buildSerializedTx([ix], wallet);
    res.json({ ...result, message: `Transfer ${amount} tokens to ${recipient}` });
  } catch (err) {
    console.error("[tx/transfer]", err.message);
    res.status(500).json({ error: "Failed to build transfer transaction" });
  }
});

/**
 * POST /api/tx/freeze
 * Body: { wallet, target }
 */
app.post(
  "/api/tx/freeze",
  complianceCheck(["Admin", "ComplianceOfficer"]),
  async (req, res) => {
    try {
      const { wallet, target } = req.body;

      const targetErr = validatePublicKey(target, "target");
      if (targetErr) return res.status(400).json(targetErr);

      const authority = new PublicKey(wallet);
      const [configPDA] = deriveConfigPDA();
      const [callerRolePDA] = deriveRolePDA(wallet);
      const [freezePDA] = deriveFreezePDA(target);

      const targetBuf = new PublicKey(target).toBuffer();
      const data = Buffer.concat([DISCRIMINATORS.freeze_account, targetBuf]);

      const keys = [
        { pubkey: configPDA, isSigner: false, isWritable: false },
        { pubkey: callerRolePDA, isSigner: false, isWritable: false },
        { pubkey: freezePDA, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];

      const ix = new web3.TransactionInstruction({
        programId: PROGRAM_ID,
        keys,
        data,
      });

      const result = await buildSerializedTx([ix], wallet);
      res.json({ ...result, message: `Freeze account ${target}` });
    } catch (err) {
      console.error("[tx/freeze]", err.message);
      res.status(500).json({ error: "Failed to build freeze transaction" });
    }
  }
);

/**
 * POST /api/tx/unfreeze
 * Body: { wallet, target }
 */
app.post(
  "/api/tx/unfreeze",
  complianceCheck(["Admin", "ComplianceOfficer"]),
  async (req, res) => {
    try {
      const { wallet, target } = req.body;

      const targetErr = validatePublicKey(target, "target");
      if (targetErr) return res.status(400).json(targetErr);

      const authority = new PublicKey(wallet);
      const [configPDA] = deriveConfigPDA();
      const [callerRolePDA] = deriveRolePDA(wallet);
      const [freezePDA] = deriveFreezePDA(target);

      const data = Buffer.from(DISCRIMINATORS.unfreeze_account);

      const keys = [
        { pubkey: configPDA, isSigner: false, isWritable: false },
        { pubkey: callerRolePDA, isSigner: false, isWritable: false },
        { pubkey: freezePDA, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
      ];

      const ix = new web3.TransactionInstruction({
        programId: PROGRAM_ID,
        keys,
        data,
      });

      const result = await buildSerializedTx([ix], wallet);
      res.json({ ...result, message: `Unfreeze account ${target}` });
    } catch (err) {
      console.error("[tx/unfreeze]", err.message);
      res.status(500).json({ error: "Failed to build unfreeze transaction" });
    }
  }
);

/**
 * POST /api/tx/submit
 * Submit a signed transaction to the network.
 * Body: { signedTransaction } — base64-encoded signed tx
 * Stricter rate limit applied.
 */
app.post("/api/tx/submit", submitLimiter, async (req, res) => {
  try {
    const { signedTransaction } = req.body;
    if (!signedTransaction || typeof signedTransaction !== "string") {
      return res.status(400).json({ error: "signedTransaction is required and must be a base64 string" });
    }

    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(signedTransaction)) {
      return res.status(400).json({ error: "signedTransaction must be valid base64" });
    }

    const txBuf = Buffer.from(signedTransaction, "base64");

    if (txBuf.length === 0 || txBuf.length > 1232) {
      return res.status(400).json({ error: "Invalid transaction size" });
    }

    const signature = await connection.sendRawTransaction(txBuf, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed"
    );

    res.json({ signature, status: "confirmed" });
  } catch (err) {
    console.error("[tx/submit]", err.message);
    res.status(500).json({
      error: "Transaction submission failed",
      details: err.message,
    });
  }
});

/**
 * GET /api/tx/:signature
 * Look up a transaction by signature.
 */
app.get("/api/tx/:signature", async (req, res) => {
  try {
    // Basic signature format validation (base58, 87-88 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{86,90}$/.test(req.params.signature)) {
      return res.status(400).json({ error: "Invalid transaction signature format" });
    }

    const txInfo = await connection.getTransaction(req.params.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!txInfo) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({
      signature: req.params.signature,
      slot: txInfo.slot,
      blockTime: txInfo.blockTime
        ? new Date(txInfo.blockTime * 1000).toISOString()
        : null,
      success: txInfo.meta?.err === null,
      fee: txInfo.meta?.fee,
    });
  } catch (err) {
    console.error("[tx/lookup]", err.message);
    res.status(500).json({ error: "Failed to look up transaction" });
  }
});

// ---------------------------------------------------------------------------
// PDA lookup helpers (useful for frontend integration)
// ---------------------------------------------------------------------------

app.get("/api/pda/config", (_req, res) => {
  const [pda, bump] = deriveConfigPDA();
  res.json({ pda: pda.toBase58(), bump });
});

app.get("/api/pda/mint", (_req, res) => {
  const [pda, bump] = deriveMintPDA();
  res.json({ pda: pda.toBase58(), bump });
});

app.get("/api/pda/role/:address", (req, res) => {
  try {
    const addrErr = validatePublicKey(req.params.address, "address");
    if (addrErr) return res.status(400).json(addrErr);
    const [pda, bump] = deriveRolePDA(req.params.address);
    res.json({ pda: pda.toBase58(), bump });
  } catch {
    res.status(400).json({ error: "Invalid address" });
  }
});

app.get("/api/pda/whitelist/:address", (req, res) => {
  try {
    const addrErr = validatePublicKey(req.params.address, "address");
    if (addrErr) return res.status(400).json(addrErr);
    const [pda, bump] = deriveWhitelistPDA(req.params.address);
    res.json({ pda: pda.toBase58(), bump });
  } catch {
    res.status(400).json({ error: "Invalid address" });
  }
});

app.get("/api/pda/freeze/:address", (req, res) => {
  try {
    const addrErr = validatePublicKey(req.params.address, "address");
    if (addrErr) return res.status(400).json(addrErr);
    const [pda, bump] = deriveFreezePDA(req.params.address);
    res.json({ pda: pda.toBase58(), bump });
  } catch {
    res.status(400).json({ error: "Invalid address" });
  }
});

// ---------------------------------------------------------------------------
// Demo seed data — institutional-grade sample state for hackathon demo
// Five named institutional wallets with realistic Solana-style addresses
// ---------------------------------------------------------------------------

const WALLETS = {
  AMINA_BANK:    { address: "AMiNABnk1x7rT5fVqPz8j2kLxUQ9dPRm4wE3HNcYvS7", label: "AMINA Bank",         role: "Issuer" },
  UBS_TREASURY:  { address: "UBSTrsy2y8sU6gWqR9k3mNxVB0eFQr5nxF4JMPdZwT8",  label: "UBS Treasury",       role: "Admin" },
  FIREBLOCKS:    { address: "FBLKCst3z9tW7hXsS0l4nOyWC1gGHs6pG5KRQeUiV9A",  label: "Fireblocks Custody", role: "ComplianceOfficer" },
  KEYROCK_MM:    { address: "KRKMmkr4A0uV8iYtT2m5oPxXD2rJHn7qN6SWeF1bY3C",  label: "Keyrock MM",         role: null },
  COMPLIANCE:    { address: "COMPLdpt5B1wX9jZrK3nQ7sYFG8hMv2pL0TiUeD4cR6",  label: "Compliance Dept",    role: "ComplianceOfficer" },
};

const NON_WHITELISTED = { address: "EXTRNwlt6C2xQ0kJ5rM8yH3nPvF7aTb9sW1dU4gI2oE", label: "External Wallet (not whitelisted)" };
const FROZEN_ACCT     = { address: "FRZNacct7D3yR1lK6sN9zI4oQwG8bUc0tX2eV5hJ3pF", label: "Frozen Account (suspicious)" };

const DEMO_WALLETS = [
  { ...WALLETS.AMINA_BANK,   isWhitelisted: true,  isFrozen: false, balance: "7,500,000 SUSD", kycStatus: "approved", kycDate: "2026-03-17" },
  { ...WALLETS.UBS_TREASURY, isWhitelisted: true,  isFrozen: false, balance: "15,000,000 SUSD", kycStatus: "approved", kycDate: "2026-03-16" },
  { ...WALLETS.FIREBLOCKS,   isWhitelisted: true,  isFrozen: false, balance: "500,000 SUSD", kycStatus: "approved", kycDate: "2026-03-17" },
  { ...WALLETS.KEYROCK_MM,   isWhitelisted: true,  isFrozen: false, balance: "2,000,000 SUSD", kycStatus: "approved", kycDate: "2026-03-18" },
  { ...WALLETS.COMPLIANCE,   isWhitelisted: true,  isFrozen: false, balance: "0 SUSD", kycStatus: "approved", kycDate: "2026-03-16" },
];

const DEMO_TRANSACTIONS = [
  { id: "tx-001", type: "system",     description: "Protocol initialized with 6-decimal SUSD mint", from: null, to: null, address: WALLETS.UBS_TREASURY.address, amount: null, status: "confirmed", signature: "5vGq8Rz...initTx", time: new Date(Date.now() - 7200000).toISOString() },
  { id: "tx-002", type: "compliance", description: "AMINA Bank added to whitelist (KYC approved)", from: WALLETS.FIREBLOCKS.address, to: WALLETS.AMINA_BANK.address, address: WALLETS.AMINA_BANK.address, amount: null, status: "confirmed", signature: "3jKm7Xt...wlAdd1", time: new Date(Date.now() - 6600000).toISOString() },
  { id: "tx-003", type: "compliance", description: "UBS Treasury added to whitelist (KYC approved)", from: WALLETS.FIREBLOCKS.address, to: WALLETS.UBS_TREASURY.address, address: WALLETS.UBS_TREASURY.address, amount: null, status: "confirmed", signature: "4pLn8Yu...wlAdd2", time: new Date(Date.now() - 6000000).toISOString() },
  { id: "tx-004", type: "mint",       description: "Mint 10,000,000 SUSD to AMINA Bank", from: null, to: WALLETS.AMINA_BANK.address, address: WALLETS.AMINA_BANK.address, amount: 10000000, status: "confirmed", signature: "2hJl6Ws...mint1", time: new Date(Date.now() - 5400000).toISOString() },
  { id: "tx-005", type: "mint",       description: "Mint 15,000,000 SUSD to UBS Treasury", from: null, to: WALLETS.UBS_TREASURY.address, address: WALLETS.UBS_TREASURY.address, amount: 15000000, status: "confirmed", signature: "6rNp0Av...mint2", time: new Date(Date.now() - 4800000).toISOString() },
  { id: "tx-006", type: "transfer",   description: "Compliant transfer: AMINA Bank -> Keyrock MM", from: WALLETS.AMINA_BANK.address, to: WALLETS.KEYROCK_MM.address, address: WALLETS.KEYROCK_MM.address, amount: 2000000, status: "confirmed", signature: "8tPr2Cx...xfer1", time: new Date(Date.now() - 3600000).toISOString() },
  { id: "tx-007", type: "burn",       description: "Burn 500,000 SUSD (redemption)", from: WALLETS.AMINA_BANK.address, to: null, address: WALLETS.AMINA_BANK.address, amount: 500000, status: "confirmed", signature: "1gIk5Vr...burn1", time: new Date(Date.now() - 2400000).toISOString() },
  { id: "tx-008", type: "transfer",   description: "REJECTED: Transfer to non-whitelisted wallet", from: WALLETS.UBS_TREASURY.address, to: NON_WHITELISTED.address, address: NON_WHITELISTED.address, amount: 1000000, status: "rejected", error: "NotWhitelisted: The target account is not on the whitelist", signature: null, time: new Date(Date.now() - 1800000).toISOString() },
  { id: "tx-009", type: "compliance", description: "Account frozen: suspicious activity flagged", from: WALLETS.COMPLIANCE.address, to: FROZEN_ACCT.address, address: FROZEN_ACCT.address, amount: null, status: "confirmed", signature: "9uQs3Dy...frz1", time: new Date(Date.now() - 1200000).toISOString() },
  { id: "tx-010", type: "mint",       description: "Mint 500,000 SUSD to Fireblocks Custody", from: null, to: WALLETS.FIREBLOCKS.address, address: WALLETS.FIREBLOCKS.address, amount: 500000, status: "confirmed", signature: "7sOq1Bw...mint3", time: new Date(Date.now() - 600000).toISOString() },
];

const DEMO_RESERVE = {
  hash: "a3f8c2d1e5b94a67f0123456789abcdef0123456789abcdef0123456789abcdef",
  ratio: 102,
  totalSupply: 25000000,
  backing: 25500000,
  composition: {
    tBills: { amount: 18000000, percentage: 70.6, description: "US Treasury Bills (< 90 day maturity)" },
    cash: { amount: 5500000, percentage: 21.6, description: "Cash and cash equivalents (JPMorgan, State Street)" },
    reverseRepo: { amount: 2000000, percentage: 7.8, description: "Overnight reverse repurchase agreements" },
  },
  attestor: "PricewaterhouseCoopers AG, Zurich",
  verifiedAt: new Date().toISOString(),
};

const DEMO_SEED = {
  wallets: DEMO_WALLETS,
  whitelisted: DEMO_WALLETS.map((w) => w.address),
  frozen: [FROZEN_ACCT.address],
  roles: [
    { address: WALLETS.UBS_TREASURY.address, role: "Admin", label: WALLETS.UBS_TREASURY.label },
    { address: WALLETS.AMINA_BANK.address, role: "Issuer", label: WALLETS.AMINA_BANK.label },
    { address: WALLETS.FIREBLOCKS.address, role: "ComplianceOfficer", label: WALLETS.FIREBLOCKS.label },
    { address: WALLETS.COMPLIANCE.address, role: "ComplianceOfficer", label: WALLETS.COMPLIANCE.label },
  ],
  kycEntries: [
    ...DEMO_WALLETS.map((w) => ({ address: w.address, label: w.label, status: "approved", date: w.kycDate })),
    { address: NON_WHITELISTED.address, label: NON_WHITELISTED.label, status: "pending", date: null },
    { address: FROZEN_ACCT.address, label: FROZEN_ACCT.label, status: "rejected", date: "2026-03-20" },
  ],
  reserve: DEMO_RESERVE,
  transactions: DEMO_TRANSACTIONS,
  auditLog: [
    { action: "Protocol Initialized", detail: `Admin: ${WALLETS.UBS_TREASURY.label} (${WALLETS.UBS_TREASURY.address.slice(0, 8)}...)`, severity: "info", time: new Date(Date.now() - 7200000).toISOString() },
    { action: "Whitelist Add", detail: `${WALLETS.AMINA_BANK.label} KYC approved and whitelisted`, severity: "info", time: new Date(Date.now() - 6600000).toISOString() },
    { action: "Whitelist Add", detail: `${WALLETS.UBS_TREASURY.label} KYC approved and whitelisted`, severity: "info", time: new Date(Date.now() - 6000000).toISOString() },
    { action: "Mint Executed", detail: "10,000,000 SUSD minted to AMINA Bank", severity: "info", time: new Date(Date.now() - 5400000).toISOString() },
    { action: "Mint Executed", detail: "15,000,000 SUSD minted to UBS Treasury", severity: "info", time: new Date(Date.now() - 4800000).toISOString() },
    { action: "Transfer Executed", detail: "2,000,000 SUSD: AMINA Bank -> Keyrock MM", severity: "info", time: new Date(Date.now() - 3600000).toISOString() },
    { action: "TRANSFER BLOCKED", detail: "Recipient not on whitelist. On-chain rejection: NotWhitelisted", severity: "critical", time: new Date(Date.now() - 1800000).toISOString() },
    { action: "Account Frozen", detail: `${FROZEN_ACCT.address.slice(0, 8)}... frozen by Compliance Dept`, severity: "warning", time: new Date(Date.now() - 1200000).toISOString() },
    { action: "Reserve Verified", detail: "Ratio: 102%, Attestor: PwC Zurich, Hash: a3f8c2...cdef", severity: "info", time: new Date(Date.now() - 600000).toISOString() },
  ],
  supplyHistory: [
    { label: "Mar 18", minted: 5000000, burned: 0 },
    { label: "Mar 19", minted: 8000000, burned: 200000 },
    { label: "Mar 20", minted: 10000000, burned: 500000 },
    { label: "Mar 21", minted: 12000000, burned: 1000000 },
    { label: "Mar 22", minted: 15000000, burned: 500000 },
    { label: "Mar 23", minted: 3000000, burned: 800000 },
    { label: "Mar 24", minted: 500000, burned: 0 },
  ],
  reserveHistory: [
    { label: "Mar 18", ratio: 105, hash: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2", verifier: WALLETS.UBS_TREASURY.label, time: new Date(Date.now() - 518400000).toISOString() },
    { label: "Mar 19", ratio: 104, hash: "c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3", verifier: WALLETS.UBS_TREASURY.label, time: new Date(Date.now() - 432000000).toISOString() },
    { label: "Mar 20", ratio: 103, hash: "d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4", verifier: WALLETS.UBS_TREASURY.label, time: new Date(Date.now() - 345600000).toISOString() },
    { label: "Mar 21", ratio: 101, hash: "e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5", verifier: WALLETS.UBS_TREASURY.label, time: new Date(Date.now() - 259200000).toISOString() },
    { label: "Mar 22", ratio: 102, hash: "f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6", verifier: WALLETS.UBS_TREASURY.label, time: new Date(Date.now() - 172800000).toISOString() },
    { label: "Mar 23", ratio: 103, hash: "a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7", verifier: WALLETS.UBS_TREASURY.label, time: new Date(Date.now() - 86400000).toISOString() },
    { label: "Mar 24", ratio: 102, hash: "a3f8c2d1e5b94a67f0123456789abcdef0123456789abcdef0123456789abcdef", verifier: WALLETS.UBS_TREASURY.label, time: new Date().toISOString() },
  ],
  pendingKyc: 1,
  volume24h: 4500000,
};

// ---------------------------------------------------------------------------
// Demo endpoints — serve seed data and verification for frontend
// ---------------------------------------------------------------------------

// Full demo state
app.get("/api/demo/state", (_req, res) => {
  res.json(DEMO_SEED);
});

// List institutional wallets
app.get("/api/demo/wallets", (_req, res) => {
  res.json({ wallets: DEMO_WALLETS, count: DEMO_WALLETS.length });
});

// List transactions
app.get("/api/demo/transactions", (_req, res) => {
  const { type, status } = _req.query;
  let txs = [...DEMO_TRANSACTIONS];
  if (type) txs = txs.filter((t) => t.type === type);
  if (status) txs = txs.filter((t) => t.status === status);
  res.json({ transactions: txs, count: txs.length });
});

// Reserve verification
app.get("/api/demo/verify-reserve", (_req, res) => {
  res.json({
    verified: true,
    ratio: DEMO_RESERVE.ratio,
    hash: DEMO_RESERVE.hash,
    totalSupply: DEMO_RESERVE.totalSupply,
    backing: DEMO_RESERVE.backing,
    composition: DEMO_RESERVE.composition,
    attestor: DEMO_RESERVE.attestor,
    verifiedAt: new Date().toISOString(),
  });
});

// Compliance check demo — the centerpiece: submit transfer to non-whitelisted
app.post("/api/demo/compliance-check", (req, res) => {
  const { sender, recipient, amount } = req.body;

  const senderAddr = sender || WALLETS.UBS_TREASURY.address;
  const recipientAddr = recipient || NON_WHITELISTED.address;
  const txAmount = amount || 1000000;

  const senderWhitelisted = DEMO_SEED.whitelisted.includes(senderAddr);
  const recipientWhitelisted = DEMO_SEED.whitelisted.includes(recipientAddr);
  const senderFrozen = DEMO_SEED.frozen.includes(senderAddr);
  const recipientFrozen = DEMO_SEED.frozen.includes(recipientAddr);

  const checks = {
    senderWhitelisted,
    recipientWhitelisted,
    senderNotFrozen: !senderFrozen,
    recipientNotFrozen: !recipientFrozen,
    protocolNotPaused: true,
  };

  const allPassed = Object.values(checks).every(Boolean);

  if (!allPassed) {
    let reason = "ComplianceCheckFailed";
    let detail = "";
    if (!recipientWhitelisted) {
      reason = "NotWhitelisted";
      detail = "The target account is not on the whitelist. Transfer rejected by the protocol on-chain.";
    } else if (!senderWhitelisted) {
      reason = "NotWhitelisted";
      detail = "The sender account is not on the whitelist.";
    } else if (senderFrozen) {
      reason = "AccountFrozen";
      detail = "The sender account is frozen by a Compliance Officer.";
    } else if (recipientFrozen) {
      reason = "AccountFrozen";
      detail = "The recipient account is frozen by a Compliance Officer.";
    }

    return res.status(403).json({
      status: "REJECTED",
      reason,
      detail,
      checks,
      transfer: { sender: senderAddr, recipient: recipientAddr, amount: txAmount },
      message: "Compliance is IN the token, not bolted on. This transfer was rejected at the protocol level.",
    });
  }

  res.json({
    status: "APPROVED",
    checks,
    transfer: { sender: senderAddr, recipient: recipientAddr, amount: txAmount },
    message: "All compliance checks passed. Transaction can be built and signed.",
  });
});

// Add wallet to demo state (for seed script)
app.post("/api/demo/wallet", (req, res) => {
  const { address, label, role, isWhitelisted, balance, kycStatus } = req.body;
  if (!address || !label) return res.status(400).json({ error: "address and label required" });

  const existing = DEMO_WALLETS.find((w) => w.address === address);
  if (existing) return res.json({ message: "Wallet already exists", wallet: existing });

  const wallet = {
    address,
    label,
    role: role || null,
    isWhitelisted: isWhitelisted !== false,
    isFrozen: false,
    balance: balance || "0 SUSD",
    kycStatus: kycStatus || "approved",
    kycDate: new Date().toISOString().split("T")[0],
  };
  DEMO_WALLETS.push(wallet);
  if (wallet.isWhitelisted && !DEMO_SEED.whitelisted.includes(address)) {
    DEMO_SEED.whitelisted.push(address);
  }
  res.status(201).json({ message: "Wallet added", wallet });
});

// Add transaction to demo state (for seed script)
app.post("/api/demo/transaction", (req, res) => {
  const { type, description, from, to, amount, status, error: txError } = req.body;
  if (!type || !description) return res.status(400).json({ error: "type and description required" });

  const tx = {
    id: `tx-${String(DEMO_TRANSACTIONS.length + 1).padStart(3, "0")}`,
    type,
    description,
    from: from || null,
    to: to || null,
    address: to || from || null,
    amount: amount || null,
    status: status || "confirmed",
    error: txError || null,
    signature: status === "rejected" ? null : `${uuidv4().slice(0, 8)}...demo`,
    time: new Date().toISOString(),
  };
  DEMO_TRANSACTIONS.push(tx);
  res.status(201).json({ message: "Transaction added", transaction: tx });
});

// ---------------------------------------------------------------------------
// 404 catch-all (must be before error handler)
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((err, req, res, _next) => {
  console.error("[unhandled]", err);
  res.status(500).json({
    error: "Internal server error",
    requestId: req?.requestId,
  });
});

// ---------------------------------------------------------------------------
// Start with graceful shutdown
// ---------------------------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log("");
  console.log("  =============================================");
  console.log("   SOLIDUS -- Institutional Stablecoin API");
  console.log("  =============================================");
  console.log("");
  console.log(`  Port:       ${PORT}`);
  console.log(`  RPC:        ${RPC_URL}`);
  console.log(`  Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`  CORS:       * (open for demo)`);
  console.log(`  Demo mode:  ON (seed data loaded)`);
  console.log("");
  console.log("  Demo endpoints:");
  console.log(`    GET  http://localhost:${PORT}/health`);
  console.log(`    GET  http://localhost:${PORT}/api/demo/state`);
  console.log(`    GET  http://localhost:${PORT}/api/demo/wallets`);
  console.log(`    GET  http://localhost:${PORT}/api/demo/transactions`);
  console.log(`    GET  http://localhost:${PORT}/api/demo/verify-reserve`);
  console.log(`    POST http://localhost:${PORT}/api/demo/compliance-check`);
  console.log("");
});

function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = app;
