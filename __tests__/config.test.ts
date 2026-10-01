import { describe, it, expect } from 'vitest';
import { checkProductionGuards } from '../src/app';

describe('Production config guards', () => {
    it('should not throw in development or test environments', () => {
        expect(() => checkProductionGuards({ NODE_ENV: 'development' })).not.toThrow();
        expect(() => checkProductionGuards({ NODE_ENV: 'test' })).not.toThrow();
        expect(() => checkProductionGuards({})).not.toThrow();
    });

    it('should throw if KYA_PRIVATE_KEY is missing in production', () => {
        expect(() => checkProductionGuards({ NODE_ENV: 'production', SUPABASE_URL: 'url', SUPABASE_SERVICE_ROLE_KEY: 'key' }))
            .toThrow(/KYA_PRIVATE_KEY/);
    });

    it('should throw if SUPABASE_URL is missing in production', () => {
        expect(() => checkProductionGuards({ NODE_ENV: 'production', KYA_PRIVATE_KEY: 'key', SUPABASE_SERVICE_ROLE_KEY: 'key' }))
            .toThrow(/SUPABASE_URL/);
    });

    it('should throw if SUPABASE_SERVICE_ROLE_KEY is missing in production', () => {
        expect(() => checkProductionGuards({ NODE_ENV: 'production', KYA_PRIVATE_KEY: 'key', SUPABASE_URL: 'url' }))
            .toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('should not throw if all required variables are present in production', () => {
        expect(() => checkProductionGuards({
            NODE_ENV: 'production',
            KYA_PRIVATE_KEY: 'key',
            SUPABASE_URL: 'url',
            SUPABASE_SERVICE_ROLE_KEY: 'key'
        })).not.toThrow();
    });
});
