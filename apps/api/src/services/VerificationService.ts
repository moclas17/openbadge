/**
 * Public credential verification (API.md §19).
 *
 * Runs a series of independent checks and reports the first failure reason.
 * Prefers canonical blockchain queries; falls back to indexed state when the
 * chain is unavailable. METADATA_UNAVAILABLE never invalidates an otherwise
 * valid on-chain credential.
 */
import {
  findEventForToken,
  isRecognizedContract,
  loadIndexedState,
  readCanonicalBalance,
  type CredentialLookup,
} from './CredentialService.js';
import { credentialId, iso, normalizeAddress } from '../lib/serialize.js';

export interface VerificationChecks {
  contractRecognized: boolean;
  eventResolved: boolean;
  balancePositive: boolean;
  mintEventFound: boolean;
  canonicalBlock: boolean;
  metadataResolved: boolean;
}

export const VerificationService = {
  async verify(lookup: CredentialLookup) {
    const checks: VerificationChecks = {
      contractRecognized: false,
      eventResolved: false,
      balancePositive: false,
      mintEventFound: false,
      canonicalBlock: false,
      metadataResolved: false,
    };

    const id = credentialId(
      lookup.chainNamespace,
      lookup.chainId,
      lookup.contractAddress,
      lookup.tokenId,
      lookup.walletAddress,
    );
    const verifiedAt = iso(new Date());

    const fail = (reason: string, status: string) => ({
      valid: false,
      reason,
      credential: { credentialId: id, status },
      checks,
      verifiedAt,
    });

    // 1. Contract recognized by this installation
    checks.contractRecognized = isRecognizedContract(lookup.contractAddress);
    if (!checks.contractRecognized) {
      return fail('CONTRACT_NOT_RECOGNIZED', 'unknown');
    }

    // 2. Event resolved for the token
    const event = await findEventForToken(lookup);
    checks.eventResolved = event !== null;
    if (!event) {
      return fail('EVENT_NOT_RESOLVED', 'not_found');
    }

    // 3. Indexed mint evidence
    const state = await loadIndexedState({
      ...lookup,
      contractAddress: normalizeAddress(lookup.contractAddress),
      walletAddress: normalizeAddress(lookup.walletAddress),
    });
    checks.mintEventFound = state.mintEvents.length > 0;

    // 4. Balance — prefer canonical chain, fall back to indexed
    const canonicalBalance = await readCanonicalBalance(lookup);
    const usedCanonical = canonicalBalance !== null;
    const balance = canonicalBalance ?? state.indexedBalance;
    checks.balancePositive = balance > 0n;
    // The mint block is considered canonical when the canonical chain read
    // agrees there is evidence of the credential (balance or indexed mint).
    checks.canonicalBlock = usedCanonical;

    // 5. Metadata
    checks.metadataResolved = event.metadata_uri !== null && event.metadata_uri !== '';

    if (!checks.balancePositive) {
      if (state.revokeEvents.length > 0) {
        return fail('CREDENTIAL_REVOKED', 'revoked');
      }
      if (state.mintEvents.length > 0) {
        return fail('CREDENTIAL_BURNED', 'burned');
      }
      return fail('WALLET_HAS_NO_BALANCE', 'not_found');
    }

    if (!checks.mintEventFound && !usedCanonical) {
      // Neither indexed evidence nor a canonical chain read is available.
      return fail('BLOCKCHAIN_UNAVAILABLE', 'unknown');
    }

    // Valid — METADATA_UNAVAILABLE is reported through checks only.
    return {
      valid: true,
      reason: checks.metadataResolved ? null : 'METADATA_UNAVAILABLE',
      credential: { credentialId: id, status: 'valid' },
      checks,
      verifiedAt,
    };
  },
};
