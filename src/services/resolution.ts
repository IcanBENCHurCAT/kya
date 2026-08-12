/**
 * Beneficial Owner Resolution Service
 *
 * Resolves wallet addresses to beneficial owners using identity attestation/verification data.
 * If a human is verified, use that identity; otherwise fall back to address associations.
 *
 * In production, this would connect to:
 * - Supabase (identity attestation/verification database)
 * - Algorand blockchain (wallet ownership, on-chain identity)
 * - External identity attestation providers
 *
 * This implementation provides the interface with in-memory/fallback data for dev/testing.
 */

import { randomUUID } from 'node:crypto';

export interface WalletIdentity {
  walletAddress: string;
  verifiedOwner?: {
    name: string;
    nationality?: string;
    dateOfBirth?: string;
    verifiedAt: string;
    verificationMethod: string; // 'email', 'document', 'biometric', 'blockchain', 'third-party'
    verificationId: string;
  };
  altAddresses?: string[]; // sibling/associated wallets
  lastSeen?: string;
}

export interface ResolutionResult {
  walletAddress: string;
  resolved: boolean;
  beneficialOwner?: {
    name: string;
    nationality?: string;
    dateOfBirth?: string;
    verified: boolean;
    verificationMethod?: string;
  };
  associatedWallets: string[];
  confidence: number; // 0.0-1.0
  notes: string;
  timestamp: string;
}

/**
 * In-memory wallet identity store (dev/testing only).
 * In production: Supabase, Algorand indexer, identity attestation provider APIs.
 */
const walletIdentities: Map<string, WalletIdentity> = new Map();

/**
 * Register a wallet-to-owner mapping.
 * Used for seeding test data and simulating identity registration.
 */
export function registerWalletIdentity(
  walletAddress: string,
  ownerName: string,
  options: {
    nationality?: string;
    dateOfBirth?: string;
    verificationMethod?: string;
    altAddresses?: string[];
  } = {},
): WalletIdentity {
  const identity: WalletIdentity = {
    walletAddress,
    verifiedOwner: {
      name: ownerName,
      nationality: options.nationality,
      dateOfBirth: options.dateOfBirth,
      verifiedAt: new Date().toISOString(),
      verificationMethod: options.verificationMethod || 'email',
      verificationId: randomUUID(),
    },
    altAddresses: options.altAddresses,
    lastSeen: new Date().toISOString(),
  };

  walletIdentities.set(walletAddress, identity);
  return identity;
}

/**
 * Query wallet identity by address.
 */
export function resolveWalletIdentity(walletAddress: string): WalletIdentity | null {
  return walletIdentities.get(walletAddress) || null;
}

/**
 * Check if a wallet has a verified beneficial owner.
 */
export function hasVerifiedOwner(walletAddress: string): boolean {
  const identity = walletIdentities.get(walletAddress);
  return !!identity?.verifiedOwner;
}

/**
 * Full resolution: wallet → beneficial owner for screening.
 *
 * Priority:
 * 1. If identity-verified identity exists → use that
 * 2. If known address associations exist → check those too
 * 3. Fall back to address itself
 *
 * Returns a ResolutionResult suitable for screening.
 */
export function resolveForScreening(walletAddress: string): ResolutionResult {
  const identity = walletIdentities.get(walletAddress);

  if (!identity) {
    return {
      walletAddress,
      resolved: false,
      associatedWallets: [],
      confidence: 0.0,
      notes: 'No identity data found for this wallet. Screening will use address-only matching.',
      timestamp: new Date().toISOString(),
    };
  }

  const beneficiaries: string[] = [];
  const associatedWallets: string[] = [];
  let maxConfidence = 0;

  // Primary: verified owner
  if (identity.verifiedOwner) {
    beneficiaries.push(identity.verifiedOwner.name);
    maxConfidence = Math.max(maxConfidence, 1.0);
  }

  // Secondary: known associated wallets (sibling wallets)
  if (identity.altAddresses) {
    for (const altAddr of identity.altAddresses) {
      associatedWallets.push(altAddr);
      const altIdentity = walletIdentities.get(altAddr);
      if (altIdentity?.verifiedOwner) {
        beneficiaries.push(altIdentity.verifiedOwner.name);
      }
    }
  }

  return {
    walletAddress,
    resolved: true,
    beneficialOwner: identity.verifiedOwner
      ? {
          name: identity.verifiedOwner.name,
          nationality: identity.verifiedOwner.nationality,
          dateOfBirth: identity.verifiedOwner.dateOfBirth,
          verified: true,
          verificationMethod: identity.verifiedOwner.verificationMethod,
        }
      : undefined,
    associatedWallets,
    confidence: maxConfidence,
    notes: identity.verifiedOwner
      ? `Verified owner: ${identity.verifiedOwner.name} (${identity.verifiedOwner.verificationMethod})`
      : 'Wallet exists but has no verified owner. Use address-based screening.',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Seed development/test data.
 * Includes some known sanctioned patterns for testing.
 */
export function seedTestData(): void {
  registerWalletIdentity(
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'John Doe',
    {
      nationality: 'US',
      dateOfBirth: '1990-01-01',
      verificationMethod: 'email',
    },
  );

  // Wallet that maps to a "sanctioned" identity for testing
  registerWalletIdentity(
    'SANCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'SANC-WALLET-01 (Test Entry)',
    {
      nationality: 'IR',
      dateOfBirth: '1970-03-15',
      verificationMethod: 'document',
    },
  );

  // Wallet with no verification
  registerWalletIdentity(
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'Unknown Owner',
    { verificationMethod: 'none' },
  );

  console.log('[Resolution] Test data seeded.');
}
