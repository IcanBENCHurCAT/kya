/**
 * Verification Provider Registry
 *
 * Central registry for pluggable verification methods.
 * Allows registering, looking up, and managing verification providers.
 *
 * This enables adding new verification methods (phone OTP, OAuth, etc.)
 * without modifying the core service logic.
 */
export class ProviderRegistry {
    providers = new Map();
    defaultProvider = null;
    /**
     * Register a verification provider.
     */
    register(provider) {
        if (this.providers.has(provider.method)) {
            throw new Error(`Provider already registered for method: ${provider.method}`);
        }
        this.providers.set(provider.method, provider);
    }
    /**
     * Set the default provider (used when no method is specified).
     */
    setDefault(provider) {
        this.defaultProvider = provider;
        this.register(provider);
    }
    /**
     * Get a provider by method.
     */
    get(method) {
        return this.providers.get(method);
    }
    /**
     * Get the default provider.
     */
    getDefault() {
        return this.defaultProvider;
    }
    /**
     * List all registered provider methods.
     */
    listMethods() {
        return Array.from(this.providers.keys());
    }
    /**
     * Check if a provider is registered for a method.
     */
    has(method) {
        return this.providers.has(method);
    }
    /**
     * Resolve the provider for a given method.
     * Falls back to default provider if method is not found.
     */
    resolve(method) {
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
