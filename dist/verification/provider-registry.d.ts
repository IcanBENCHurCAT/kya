/**
 * Verification Provider Registry
 *
 * Central registry for pluggable verification methods.
 * Allows registering, looking up, and managing verification providers.
 *
 * This enables adding new verification methods (phone OTP, OAuth, etc.)
 * without modifying the core service logic.
 */
import { VerificationProvider, VerificationMethod } from "./types.js";
export declare class ProviderRegistry {
    private providers;
    private defaultProvider;
    /**
     * Register a verification provider.
     */
    register(provider: VerificationProvider): void;
    /**
     * Set the default provider (used when no method is specified).
     */
    setDefault(provider: VerificationProvider): void;
    /**
     * Get a provider by method.
     */
    get(method: VerificationMethod): VerificationProvider | undefined;
    /**
     * Get the default provider.
     */
    getDefault(): VerificationProvider | null;
    /**
     * List all registered provider methods.
     */
    listMethods(): VerificationMethod[];
    /**
     * Check if a provider is registered for a method.
     */
    has(method: VerificationMethod): boolean;
    /**
     * Resolve the provider for a given method.
     * Falls back to default provider if method is not found.
     */
    resolve(method?: VerificationMethod): VerificationProvider;
}
