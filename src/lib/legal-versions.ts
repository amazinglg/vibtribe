/**
 * Versioned policy identifiers. Bump the value when material clauses change.
 * Stored against every consent_log row so we can prove which policy a user
 * actually agreed to at a given point in time (DPDP §6(6)).
 */
export const TERMS_VERSION = '2026-06-18';
export const PRIVACY_VERSION = '2026-06-18';