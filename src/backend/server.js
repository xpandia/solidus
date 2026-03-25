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
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
// ---------------------------------------------------------------------------

const DEMO_SEED = {
  whitelisted: [
    "AMiNA1111111111111111111111111111111111111",
    "UBSBank22222222222222222222222222222222222",
    "Fireblocks333333333333333333333333333333333",
    "Treasury44444444444444444444444444444444444",
    "Custodian5555555555555555555555555555555555",
  ],
  frozen: [
    "Suspicious77777777777777777777777777777777",
  ],
  roles: [
    { address: "AdminMaster1111111111111111111111111111111", role: "Admin" },
    { address: "AMiNA1111111111111111111111111111111111111", role: "Issuer" },
    { address: "Fireblocks333333333333333333333333333333333", role: "ComplianceOfficer" },
  ],
  kycEntries: [
    { address: "AMiNA1111111111111111111111111111111111111", status: "approved" },
    { address: "UBSBank22222222222222222222222222222222222", status: "approved" },
    { address: "Fireblocks333333333333333333333333333333333", status: "approved" },
    { address: "Treasury44444444444444444444444444444444444", status: "approved" },
    { address: "Custodian5555555555555555555555555555555555", status: "approved" },
    { address: "NewClient66666666666666666666666666666666", status: "pending" },
    { address: "Suspicious77777777777777777777777777777777", status: "rejected" },
  ],
  reserve: {
    hash: "a3f8c2d1e5b94a67f0123456789abcdef0123456789abcdef0123456789abcdef",
    ratio: 102,
    totalSupply: 25000000,
    backing: 25500000,
    tBills: 18000000,
    cash: 7500000,
    verifiedAt: new Date().toISOString(),
  },
  transactions: [
    { type: "system", description: "Protocol initialized", address: "AdminMaster1111111111111111111111111111111", status: "confirmed", time: new Date(Date.now() - 7200000).toISOString() },
    { type: "compliance", description: "AMINA Bank whitelisted", address: "AMiNA1111111111111111111111111111111111111", status: "confirmed", time: new Date(Date.now() - 6600000).toISOString() },
    { type: "compliance", description: "UBS whitelisted", address: "UBSBank22222222222222222222222222222222222", status: "confirmed", time: new Date(Date.now() - 6000000).toISOString() },
    { type: "mint", description: "Mint 10,000,000 SUSD", amount: 10000000, address: "AMiNA1111111111111111111111111111111111111", status: "confirmed", time: new Date(Date.now() - 5400000).toISOString() },
    { type: "mint", description: "Mint 15,000,000 SUSD", amount: 15000000, address: "UBSBank22222222222222222222222222222222222", status: "confirmed", time: new Date(Date.now() - 4800000).toISOString() },
    { type: "transfer", description: "Transfer 2,000,000 SUSD", amount: 2000000, from: "AMiNA1111111111111111111111111111111111111", to: "Treasury44444444444444444444444444444444444", address: "Treasury44444444444444444444444444444444444", status: "confirmed", time: new Date(Date.now() - 3600000).toISOString() },
    { type: "burn", description: "Burn 500,000 SUSD", amount: 500000, address: "AMiNA1111111111111111111111111111111111111", status: "confirmed", time: new Date(Date.now() - 2400000).toISOString() },
    { type: "transfer", description: "Transfer REJECTED (not whitelisted)", amount: 1000000, from: "UBSBank22222222222222222222222222222222222", to: "UnknownAddr999999999999999999999999999999", address: "UnknownAddr999999999999999999999999999999", status: "rejected", time: new Date(Date.now() - 1800000).toISOString() },
    { type: "compliance", description: "Account frozen: suspicious activity", address: "Suspicious77777777777777777777777777777777", status: "confirmed", time: new Date(Date.now() - 1200000).toISOString() },
    { type: "mint", description: "Mint 500,000 SUSD", amount: 500000, address: "Fireblocks333333333333333333333333333333333", status: "confirmed", time: new Date(Date.now() - 600000).toISOString() },
  ],
  auditLog: [
    { action: "Protocol Initialized", detail: "Admin: AdminM...1111", time: new Date(Date.now() - 7200000).toISOString() },
    { action: "Whitelist Add", detail: "AMiNA...1111 added", time: new Date(Date.now() - 6600000).toISOString() },
    { action: "Whitelist Add", detail: "UBSBa...2222 added", time: new Date(Date.now() - 6000000).toISOString() },
    { action: "Mint Executed", detail: "10,000,000 SUSD to AMINA", time: new Date(Date.now() - 5400000).toISOString() },
    { action: "Mint Executed", detail: "15,000,000 SUSD to UBS", time: new Date(Date.now() - 4800000).toISOString() },
    { action: "Transfer Executed", detail: "2M SUSD AMINA -> Treasury", time: new Date(Date.now() - 3600000).toISOString() },
    { action: "Transfer Blocked", detail: "Recipient not whitelisted", time: new Date(Date.now() - 1800000).toISOString() },
    { action: "Account Frozen", detail: "Suspicious activity flagged", time: new Date(Date.now() - 1200000).toISOString() },
    { action: "Reserve Verified", detail: "Ratio: 102%, Hash: a3f8c2...cdef", time: new Date(Date.now() - 600000).toISOString() },
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
    { label: "Mar 18", ratio: 105, hash: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2", verifier: "AdminMaster1111111111111111111111111111111", time: new Date(Date.now() - 518400000).toISOString() },
    { label: "Mar 19", ratio: 104, hash: "c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3", verifier: "AdminMaster1111111111111111111111111111111", time: new Date(Date.now() - 432000000).toISOString() },
    { label: "Mar 20", ratio: 103, hash: "d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4", verifier: "AdminMaster1111111111111111111111111111111", time: new Date(Date.now() - 345600000).toISOString() },
    { label: "Mar 21", ratio: 101, hash: "e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5", verifier: "AdminMaster1111111111111111111111111111111", time: new Date(Date.now() - 259200000).toISOString() },
    { label: "Mar 22", ratio: 102, hash: "f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6", verifier: "AdminMaster1111111111111111111111111111111", time: new Date(Date.now() - 172800000).toISOString() },
    { label: "Mar 23", ratio: 103, hash: "a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7", verifier: "AdminMaster1111111111111111111111111111111", time: new Date(Date.now() - 86400000).toISOString() },
    { label: "Mar 24", ratio: 102, hash: "a3f8c2d1e5b94a67f0123456789abcdef0123456789abcdef0123456789abcdef", verifier: "AdminMaster1111111111111111111111111111111", time: new Date().toISOString() },
  ],
  pendingKyc: 1,
  volume24h: 4500000,
};

// ---------------------------------------------------------------------------
// Demo endpoints — serve seed data and verification for frontend
// ---------------------------------------------------------------------------

app.get("/api/demo/state", (_req, res) => {
  res.json(DEMO_SEED);
});

app.get("/api/demo/verify-reserve", (_req, res) => {
  const reserve = DEMO_SEED.reserve;
  res.json({
    verified: true,
    ratio: reserve.ratio,
    hash: reserve.hash,
    totalSupply: reserve.totalSupply,
    backing: reserve.backing,
    verifiedAt: new Date().toISOString(),
  });
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
  console.log(`Solidus API running on port ${PORT}`);
  console.log(`  RPC:        ${RPC_URL}`);
  console.log(`  Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`  CORS:       ${CORS_ORIGINS.join(", ")}`);
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
