/**
 * Shared spec for the markdown-lite syntax used in example `@config`
 * descriptions. Imported by the renderer (`Example.mjs`) and the
 * `@config` lint rule (`eslint.config.mjs`) so they cannot drift.
 *
 * Supported tokens (in regex group order):
 *   1) `**bold**`
 *   2) `*italic*`
 *   3) `` `code` ``
 *   4-5) `[text](url)`
 *   6-7) `{name:text}`
 */
export const INLINE_MD_PATTERN = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\n]+)\)|\{([a-z]+):([^}\n]+)\}/g;

export const SAFE_URL_PATTERN = /^(?:https?:|mailto:)/i;

export const COLOR_NAMES = new Set(['accent', 'warn', 'success', 'info', 'muted']);
