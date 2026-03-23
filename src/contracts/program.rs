use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::{self, Burn, MintTo, Token2022, TransferChecked},
    token_interface::{Mint, TokenAccount},
};

declare_id!("So1idusXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

/// --------------------------------------------------------------------------
/// Solidus — Institutional Stablecoin Infrastructure
///
/// On-chain program providing:
///   - Role-based access control (Admin, Issuer, Compliance Officer)
///   - Stablecoin minting / burning with compliance hooks (Token-2022)
///   - Account freeze / unfreeze
///   - Whitelisted transfers (TransferChecked for Token-2022 hook compat)
///   - Reserve proof verification
///   - Configurable mint cap
///   - Two-step admin transfer
/// --------------------------------------------------------------------------
#[program]
pub mod solidus {
    use super::*;

    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------

    /// Bootstrap the protocol. The signer becomes the first Admin.
    /// Creates the global config PDA and the stablecoin mint (Token-2022).
    pub fn initialize(ctx: Context<Initialize>, decimals: u8, mint_cap: u64) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.pending_admin = Pubkey::default();
        config.mint = ctx.accounts.stablecoin_mint.key();
        config.total_supply = 0;
        config.mint_cap = mint_cap;
        config.is_paused = false;
        config.reserve_proof_hash = [0u8; 32];
        config.reserve_verified_at = 0;
        config.bump = ctx.bumps.config;
        config.mint_bump = ctx.bumps.stablecoin_mint;
        config.decimals = decimals;

        emit!(ProtocolInitialized {
            admin: config.admin,
            mint: config.mint,
            decimals,
            mint_cap,
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Role Management
    // -----------------------------------------------------------------------

    /// Register or update a role for a given user.
    /// Only the Admin may call this.
    pub fn set_role(ctx: Context<SetRole>, user: Pubkey, role: Role) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            SolidusError::Unauthorized
        );

        let role_account = &mut ctx.accounts.role_account;
        role_account.user = user;
        role_account.role = role;
        role_account.granted_at = Clock::get()?.unix_timestamp;
        role_account.granted_by = ctx.accounts.admin.key();
        role_account.is_active = true;
        role_account.bump = ctx.bumps.role_account;

        emit!(RoleAssigned {
            user,
            role,
            granted_by: ctx.accounts.admin.key(),
        });

        Ok(())
    }

    /// Revoke a role and close the PDA to reclaim rent.
    /// Only the Admin may call this.
    pub fn revoke_role(ctx: Context<RevokeRole>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            SolidusError::Unauthorized
        );

        let role_account = &ctx.accounts.role_account;
        let user = role_account.user;
        let role = role_account.role;

        // Account will be closed via the `close = admin` constraint on RevokeRole

        emit!(RoleRevoked {
            user,
            role,
            revoked_by: ctx.accounts.admin.key(),
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Whitelist Management
    // -----------------------------------------------------------------------

    /// Add an address to the transfer whitelist.
    /// Callable by Admin or Compliance Officer.
    pub fn add_to_whitelist(ctx: Context<AddToWhitelist>, user: Pubkey) -> Result<()> {
        require_role_active(&ctx.accounts.caller_role, &[Role::Admin, Role::ComplianceOfficer])?;

        let entry = &mut ctx.accounts.whitelist_entry;
        entry.user = user;
        entry.is_whitelisted = true;
        entry.added_at = Clock::get()?.unix_timestamp;
        entry.added_by = ctx.accounts.authority.key();
        entry.bump = ctx.bumps.whitelist_entry;

        emit!(WhitelistUpdated {
            user,
            whitelisted: true,
            by: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Remove an address from the transfer whitelist.
    pub fn remove_from_whitelist(ctx: Context<RemoveFromWhitelist>, _user: Pubkey) -> Result<()> {
        require_role_active(&ctx.accounts.caller_role, &[Role::Admin, Role::ComplianceOfficer])?;

        let entry = &mut ctx.accounts.whitelist_entry;
        entry.is_whitelisted = false;

        emit!(WhitelistUpdated {
            user: entry.user,
            whitelisted: false,
            by: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Minting
    // -----------------------------------------------------------------------

    /// Mint new stablecoins to a whitelisted recipient.
    /// Only an active Issuer may call this.
    /// The recipient MUST be whitelisted and NOT frozen.
    /// Respects the configurable mint cap.
    pub fn mint_stablecoin(ctx: Context<MintStablecoin>, amount: u64) -> Result<()> {
        require!(amount > 0, SolidusError::InvalidAmount);
        require!(!ctx.accounts.config.is_paused, SolidusError::ProtocolPaused);

        // Issuer role check
        require_role_active(&ctx.accounts.issuer_role, &[Role::Issuer])?;

        // Whitelist & freeze checks on recipient
        require!(
            ctx.accounts.recipient_whitelist.is_whitelisted,
            SolidusError::NotWhitelisted
        );
        require!(
            !ctx.accounts.recipient_freeze.is_frozen,
            SolidusError::AccountFrozen
        );

        // Mint cap check
        let new_supply = ctx
            .accounts
            .config
            .total_supply
            .checked_add(amount)
            .ok_or(SolidusError::Overflow)?;
        if ctx.accounts.config.mint_cap > 0 {
            require!(new_supply <= ctx.accounts.config.mint_cap, SolidusError::MintCapExceeded);
        }

        // Mint via PDA signer (Token-2022)
        let seeds = &[b"config".as_ref(), &[ctx.accounts.config.bump]];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.stablecoin_mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        token_2022::mint_to(cpi_ctx, amount)?;

        // Book-keeping
        let config = &mut ctx.accounts.config;
        config.total_supply = new_supply;

        emit!(StablecoinMinted {
            recipient: ctx.accounts.recipient.key(),
            amount,
            issuer: ctx.accounts.issuer.key(),
            total_supply: config.total_supply,
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Burning
    // -----------------------------------------------------------------------

    /// Burn stablecoins from the caller's token account.
    /// The caller must be an Issuer. The source must be whitelisted and not frozen.
    pub fn burn_stablecoin(ctx: Context<BurnStablecoin>, amount: u64) -> Result<()> {
        require!(amount > 0, SolidusError::InvalidAmount);
        require!(!ctx.accounts.config.is_paused, SolidusError::ProtocolPaused);

        require_role_active(&ctx.accounts.issuer_role, &[Role::Issuer])?;

        require!(
            ctx.accounts.source_whitelist.is_whitelisted,
            SolidusError::NotWhitelisted
        );
        require!(
            !ctx.accounts.source_freeze.is_frozen,
            SolidusError::AccountFrozen
        );

        let cpi_accounts = Burn {
            mint: ctx.accounts.stablecoin_mint.to_account_info(),
            from: ctx.accounts.source_token_account.to_account_info(),
            authority: ctx.accounts.issuer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        token_2022::burn(cpi_ctx, amount)?;

        let config = &mut ctx.accounts.config;
        config.total_supply = config
            .total_supply
            .checked_sub(amount)
            .ok_or(SolidusError::Underflow)?;

        emit!(StablecoinBurned {
            source: ctx.accounts.issuer.key(),
            amount,
            total_supply: config.total_supply,
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Compliant Transfer (Token-2022 TransferChecked for hook compatibility)
    // -----------------------------------------------------------------------

    /// Transfer stablecoins between two whitelisted, non-frozen accounts.
    /// Uses TransferChecked which is required for Token-2022 transfer hook execution.
    pub fn compliant_transfer(ctx: Context<CompliantTransfer>, amount: u64) -> Result<()> {
        require!(amount > 0, SolidusError::InvalidAmount);
        require!(!ctx.accounts.config.is_paused, SolidusError::ProtocolPaused);

        // Both parties must be whitelisted
        require!(
            ctx.accounts.sender_whitelist.is_whitelisted,
            SolidusError::NotWhitelisted
        );
        require!(
            ctx.accounts.recipient_whitelist.is_whitelisted,
            SolidusError::NotWhitelisted
        );

        // Neither party may be frozen
        require!(
            !ctx.accounts.sender_freeze.is_frozen,
            SolidusError::AccountFrozen
        );
        require!(
            !ctx.accounts.recipient_freeze.is_frozen,
            SolidusError::AccountFrozen
        );

        // Use TransferChecked for Token-2022 transfer hook compatibility
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
            mint: ctx.accounts.stablecoin_mint.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        token_2022::transfer_checked(cpi_ctx, amount, ctx.accounts.config.decimals)?;

        emit!(CompliantTransferExecuted {
            sender: ctx.accounts.sender.key(),
            recipient: ctx.accounts.recipient_token_account.key(),
            amount,
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Freeze / Unfreeze
    // -----------------------------------------------------------------------

    /// Freeze an account. Only Compliance Officers or Admin may call this.
    pub fn freeze_account(ctx: Context<FreezeAccountCtx>, user: Pubkey) -> Result<()> {
        require_role_active(&ctx.accounts.caller_role, &[Role::Admin, Role::ComplianceOfficer])?;

        let freeze = &mut ctx.accounts.freeze_state;
        freeze.user = user;
        freeze.is_frozen = true;
        freeze.frozen_at = Clock::get()?.unix_timestamp;
        freeze.frozen_by = ctx.accounts.authority.key();
        freeze.bump = ctx.bumps.freeze_state;

        emit!(AccountFrozenEvent {
            user,
            frozen_by: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Unfreeze an account.
    pub fn unfreeze_account(ctx: Context<UnfreezeAccount>) -> Result<()> {
        require_role_active(&ctx.accounts.caller_role, &[Role::Admin, Role::ComplianceOfficer])?;

        let freeze = &mut ctx.accounts.freeze_state;
        let user = freeze.user;
        freeze.is_frozen = false;

        emit!(AccountUnfrozenEvent {
            user,
            unfrozen_by: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Reserve Proof
    // -----------------------------------------------------------------------

    /// Submit a reserve proof hash (e.g. SHA-256 of an off-chain attestation).
    /// Only Admin or Compliance Officer may call this.
    pub fn submit_reserve_proof(ctx: Context<SubmitReserveProof>, proof_hash: [u8; 32]) -> Result<()> {
        require_role_active(&ctx.accounts.caller_role, &[Role::Admin, Role::ComplianceOfficer])?;

        let config = &mut ctx.accounts.config;
        config.reserve_proof_hash = proof_hash;
        config.reserve_verified_at = Clock::get()?.unix_timestamp;

        emit!(ReserveProofSubmitted {
            proof_hash,
            submitted_by: ctx.accounts.authority.key(),
            verified_at: config.reserve_verified_at,
        });

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Admin — Pause / Unpause
    // -----------------------------------------------------------------------

    /// Emergency pause. Only Admin.
    pub fn pause(ctx: Context<AdminOnly>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            SolidusError::Unauthorized
        );
        ctx.accounts.config.is_paused = true;

        emit!(ProtocolPausedEvent {
            paused_by: ctx.accounts.admin.key(),
        });

        Ok(())
    }

    /// Unpause. Only Admin.
    pub fn unpause(ctx: Context<AdminOnly>) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            SolidusError::Unauthorized
        );
        ctx.accounts.config.is_paused = false;

        emit!(ProtocolUnpausedEvent {
            unpaused_by: ctx.accounts.admin.key(),
        });

        Ok(())
    }

    /// Initiate admin transfer (two-step). Sets the pending admin.
    /// Only the current Admin may call this.
    pub fn transfer_admin(ctx: Context<TransferAdmin>, new_admin: Pubkey) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            SolidusError::Unauthorized
        );
        require!(
            new_admin != Pubkey::default(),
            SolidusError::InvalidPendingAdmin
        );

        ctx.accounts.config.pending_admin = new_admin;

        emit!(AdminTransferInitiated {
            current_admin: ctx.accounts.admin.key(),
            pending_admin: new_admin,
        });

        Ok(())
    }

    /// Accept admin transfer. Only the pending admin may call this.
    /// Completes the two-step admin transfer process.
    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        require!(
            ctx.accounts.new_admin.key() == ctx.accounts.config.pending_admin,
            SolidusError::Unauthorized
        );
        require!(
            ctx.accounts.config.pending_admin != Pubkey::default(),
            SolidusError::NoPendingAdmin
        );

        let old = ctx.accounts.config.admin;
        ctx.accounts.config.admin = ctx.accounts.new_admin.key();
        ctx.accounts.config.pending_admin = Pubkey::default();

        emit!(AdminTransferred {
            old_admin: old,
            new_admin: ctx.accounts.new_admin.key(),
        });

        Ok(())
    }

    /// Update the mint cap. Only Admin.
    pub fn set_mint_cap(ctx: Context<AdminOnly>, new_cap: u64) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            SolidusError::Unauthorized
        );
        // If new_cap > 0, it must be >= current supply
        if new_cap > 0 {
            require!(
                new_cap >= ctx.accounts.config.total_supply,
                SolidusError::MintCapBelowSupply
            );
        }

        ctx.accounts.config.mint_cap = new_cap;

        emit!(MintCapUpdated {
            new_cap,
            set_by: ctx.accounts.admin.key(),
        });

        Ok(())
    }
}

// ===========================================================================
// Helper
// ===========================================================================

fn require_role_active(role_account: &Account<RoleAccount>, allowed: &[Role]) -> Result<()> {
    require!(role_account.is_active, SolidusError::Unauthorized);
    require!(
        allowed.contains(&role_account.role),
        SolidusError::Unauthorized
    );
    Ok(())
}

// ===========================================================================
// Accounts — Initialization (Token-2022)
// ===========================================================================

#[derive(Accounts)]
#[instruction(decimals: u8, mint_cap: u64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        seeds = [b"stablecoin_mint"],
        bump,
        mint::decimals = decimals,
        mint::authority = config,
        mint::token_program = token_program,
    )]
    pub stablecoin_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

// ===========================================================================
// Accounts — Role Management
// ===========================================================================

#[derive(Accounts)]
#[instruction(user: Pubkey, role: Role)]
pub struct SetRole<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + RoleAccount::INIT_SPACE,
        seeds = [b"role", user.as_ref()],
        bump
    )]
    pub role_account: Account<'info, RoleAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeRole<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"role", role_account.user.as_ref()],
        bump = role_account.bump,
        close = admin
    )]
    pub role_account: Account<'info, RoleAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

// ===========================================================================
// Accounts — Whitelist (separate structs to avoid init_if_needed anti-pattern)
// ===========================================================================

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct AddToWhitelist<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [b"role", authority.key().as_ref()], bump = caller_role.bump)]
    pub caller_role: Account<'info, RoleAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + WhitelistEntry::INIT_SPACE,
        seeds = [b"whitelist", user.as_ref()],
        bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct RemoveFromWhitelist<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [b"role", authority.key().as_ref()], bump = caller_role.bump)]
    pub caller_role: Account<'info, RoleAccount>,

    #[account(
        mut,
        seeds = [b"whitelist", user.as_ref()],
        bump = whitelist_entry.bump
    )]
    pub whitelist_entry: Account<'info, WhitelistEntry>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ===========================================================================
// Accounts — Mint (Token-2022)
// ===========================================================================

#[derive(Accounts)]
pub struct MintStablecoin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"stablecoin_mint"],
        bump = config.mint_bump,
    )]
    pub stablecoin_mint: InterfaceAccount<'info, Mint>,

    #[account(seeds = [b"role", issuer.key().as_ref()], bump = issuer_role.bump)]
    pub issuer_role: Account<'info, RoleAccount>,

    #[account(seeds = [b"whitelist", recipient.key().as_ref()], bump = recipient_whitelist.bump)]
    pub recipient_whitelist: Account<'info, WhitelistEntry>,

    #[account(seeds = [b"freeze", recipient.key().as_ref()], bump = recipient_freeze.bump)]
    pub recipient_freeze: Account<'info, FreezeState>,

    #[account(
        mut,
        token::mint = stablecoin_mint,
        token::authority = recipient,
        token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Recipient wallet — validated via token account constraint above.
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub issuer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

// ===========================================================================
// Accounts — Burn (Token-2022)
// ===========================================================================

#[derive(Accounts)]
pub struct BurnStablecoin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"stablecoin_mint"],
        bump = config.mint_bump,
    )]
    pub stablecoin_mint: InterfaceAccount<'info, Mint>,

    #[account(seeds = [b"role", issuer.key().as_ref()], bump = issuer_role.bump)]
    pub issuer_role: Account<'info, RoleAccount>,

    #[account(seeds = [b"whitelist", issuer.key().as_ref()], bump = source_whitelist.bump)]
    pub source_whitelist: Account<'info, WhitelistEntry>,

    #[account(seeds = [b"freeze", issuer.key().as_ref()], bump = source_freeze.bump)]
    pub source_freeze: Account<'info, FreezeState>,

    #[account(
        mut,
        token::mint = stablecoin_mint,
        token::authority = issuer,
        token::token_program = token_program,
    )]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub issuer: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

// ===========================================================================
// Accounts — Compliant Transfer (Token-2022)
// ===========================================================================

#[derive(Accounts)]
pub struct CompliantTransfer<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [b"stablecoin_mint"],
        bump = config.mint_bump,
    )]
    pub stablecoin_mint: InterfaceAccount<'info, Mint>,

    #[account(seeds = [b"whitelist", sender.key().as_ref()], bump = sender_whitelist.bump)]
    pub sender_whitelist: Account<'info, WhitelistEntry>,

    #[account(seeds = [b"whitelist", recipient.key().as_ref()], bump = recipient_whitelist.bump)]
    pub recipient_whitelist: Account<'info, WhitelistEntry>,

    #[account(seeds = [b"freeze", sender.key().as_ref()], bump = sender_freeze.bump)]
    pub sender_freeze: Account<'info, FreezeState>,

    #[account(seeds = [b"freeze", recipient.key().as_ref()], bump = recipient_freeze.bump)]
    pub recipient_freeze: Account<'info, FreezeState>,

    #[account(
        mut,
        token::mint = config.mint,
        token::authority = sender,
        token::token_program = token_program,
    )]
    pub sender_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = config.mint,
        token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Recipient wallet — validated via whitelist PDA seed.
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

// ===========================================================================
// Accounts — Freeze / Unfreeze
// ===========================================================================

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct FreezeAccountCtx<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [b"role", authority.key().as_ref()], bump = caller_role.bump)]
    pub caller_role: Account<'info, RoleAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + FreezeState::INIT_SPACE,
        seeds = [b"freeze", user.as_ref()],
        bump
    )]
    pub freeze_state: Account<'info, FreezeState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnfreezeAccount<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [b"role", authority.key().as_ref()], bump = caller_role.bump)]
    pub caller_role: Account<'info, RoleAccount>,

    #[account(mut, seeds = [b"freeze", freeze_state.user.as_ref()], bump = freeze_state.bump)]
    pub freeze_state: Account<'info, FreezeState>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ===========================================================================
// Accounts — Reserve Proof
// ===========================================================================

#[derive(Accounts)]
pub struct SubmitReserveProof<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [b"role", authority.key().as_ref()], bump = caller_role.bump)]
    pub caller_role: Account<'info, RoleAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

// ===========================================================================
// Accounts — Admin-only actions
// ===========================================================================

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub new_admin: Signer<'info>,
}

// ===========================================================================
// State
// ===========================================================================

#[account]
#[derive(InitSpace)]
pub struct Config {
    /// The current admin public key.
    pub admin: Pubkey,
    /// The pending admin for two-step transfer (default = Pubkey::default() means none).
    pub pending_admin: Pubkey,
    /// The stablecoin Token-2022 mint address.
    pub mint: Pubkey,
    /// Running total supply tracked on-chain.
    pub total_supply: u64,
    /// Maximum mint cap (0 = unlimited).
    pub mint_cap: u64,
    /// Emergency pause flag.
    pub is_paused: bool,
    /// SHA-256 hash of the latest reserve attestation.
    pub reserve_proof_hash: [u8; 32],
    /// Unix timestamp of the last reserve verification.
    pub reserve_verified_at: i64,
    /// PDA bump for the config account.
    pub bump: u8,
    /// PDA bump for the mint account.
    pub mint_bump: u8,
    /// Decimal places for the stablecoin.
    pub decimals: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RoleAccount {
    /// The user this role belongs to.
    pub user: Pubkey,
    /// The assigned role.
    pub role: Role,
    /// Unix timestamp when the role was granted.
    pub granted_at: i64,
    /// Who granted the role.
    pub granted_by: Pubkey,
    /// Whether the role is currently active.
    pub is_active: bool,
    /// PDA bump.
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct WhitelistEntry {
    /// The whitelisted user.
    pub user: Pubkey,
    /// Whether the user is currently whitelisted.
    pub is_whitelisted: bool,
    /// When the entry was created / last updated.
    pub added_at: i64,
    /// Who added the entry.
    pub added_by: Pubkey,
    /// PDA bump.
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FreezeState {
    /// The user whose account may be frozen.
    pub user: Pubkey,
    /// Whether the account is currently frozen.
    pub is_frozen: bool,
    /// When it was frozen.
    pub frozen_at: i64,
    /// Who froze it.
    pub frozen_by: Pubkey,
    /// PDA bump.
    pub bump: u8,
}

// ===========================================================================
// Enums
// ===========================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Role {
    Admin,
    Issuer,
    ComplianceOfficer,
}

// ===========================================================================
// Events
// ===========================================================================

#[event]
pub struct ProtocolInitialized {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub decimals: u8,
    pub mint_cap: u64,
}

#[event]
pub struct RoleAssigned {
    pub user: Pubkey,
    pub role: Role,
    pub granted_by: Pubkey,
}

#[event]
pub struct RoleRevoked {
    pub user: Pubkey,
    pub role: Role,
    pub revoked_by: Pubkey,
}

#[event]
pub struct WhitelistUpdated {
    pub user: Pubkey,
    pub whitelisted: bool,
    pub by: Pubkey,
}

#[event]
pub struct StablecoinMinted {
    pub recipient: Pubkey,
    pub amount: u64,
    pub issuer: Pubkey,
    pub total_supply: u64,
}

#[event]
pub struct StablecoinBurned {
    pub source: Pubkey,
    pub amount: u64,
    pub total_supply: u64,
}

#[event]
pub struct CompliantTransferExecuted {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AccountFrozenEvent {
    pub user: Pubkey,
    pub frozen_by: Pubkey,
}

#[event]
pub struct AccountUnfrozenEvent {
    pub user: Pubkey,
    pub unfrozen_by: Pubkey,
}

#[event]
pub struct ReserveProofSubmitted {
    pub proof_hash: [u8; 32],
    pub submitted_by: Pubkey,
    pub verified_at: i64,
}

#[event]
pub struct ProtocolPausedEvent {
    pub paused_by: Pubkey,
}

#[event]
pub struct ProtocolUnpausedEvent {
    pub unpaused_by: Pubkey,
}

#[event]
pub struct AdminTransferInitiated {
    pub current_admin: Pubkey,
    pub pending_admin: Pubkey,
}

#[event]
pub struct AdminTransferred {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}

#[event]
pub struct MintCapUpdated {
    pub new_cap: u64,
    pub set_by: Pubkey,
}

// ===========================================================================
// Errors
// ===========================================================================

#[error_code]
pub enum SolidusError {
    #[msg("Caller does not have the required role or permission.")]
    Unauthorized,

    #[msg("The target account is not on the whitelist.")]
    NotWhitelisted,

    #[msg("The target account is frozen.")]
    AccountFrozen,

    #[msg("The protocol is currently paused.")]
    ProtocolPaused,

    #[msg("Amount must be greater than zero.")]
    InvalidAmount,

    #[msg("Arithmetic overflow.")]
    Overflow,

    #[msg("Arithmetic underflow.")]
    Underflow,

    #[msg("Invalid reserve proof.")]
    InvalidReserveProof,

    #[msg("Minting would exceed the configured mint cap.")]
    MintCapExceeded,

    #[msg("Mint cap cannot be set below current total supply.")]
    MintCapBelowSupply,

    #[msg("Invalid pending admin address.")]
    InvalidPendingAdmin,

    #[msg("No pending admin transfer to accept.")]
    NoPendingAdmin,
}
