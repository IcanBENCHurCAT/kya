/**
 * Verification Provider Registry
 *
 * Central registry for pluggable verification methods.
 * Allows registering, looking up, and managing verification providers.
 *
 * This enables adding new verification methods (phone OTP, OAuth, etc.)
 * without modifying the core service logic.
 */

import { VerificationProvider, VerificationMethod } from "../types.js";

export class ProviderRegistry {
  private providers = new Map<VerificationMethod, VerificationProvider>();
  private defaultProvider: VerificationProvider | null = null;

  /**
   * Register a verification provider.
   */
  register(provider: VerificationProvider): void {
    if (this.providers.has(provider.method)) {
      throw new Error(`Provider already registered for method: ${provider.method}`);
    }
    this.providers.set(provider.method, provider);
  }

  /**
   * Set the default provider (used when no method is specified).
   */
  setDefault(provider: VerificationProvider): void {
    this.defaultProvider = provider;
    this.register(provider);
  }

  /**
   * Get a provider by method.
   */
  get(method: VerificationMethod): VerificationProvider | undefined {
    return this.providers.get(method);
  }

  /**
   * Get the default provider.
   */
  getDefault(): VerificationProvider | null {
    return this.defaultProvider;
  }

  /**
   * List all registered provider methods.
   */
  listMethods(): VerificationMethod[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered for a method.
   */
  has(method: VerificationMethod): boolean {
    return this.providers.has(method);
  }

  /**
   * Resolve the provider for a given method.
   * Falls back to default provider if method is not found.
   */
  resolve(method?: VerificationMethod): VerificationProvider {
    if (!method) {
      if (!this.defaultProvider) {
        throw new Error("No default provider registered");
      }
      return this.defaultProvider;
    }
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`No provider registered for method: ${method}`);
    }
    return provider;
  }
}
