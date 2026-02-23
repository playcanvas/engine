/**
 * Build a regex that matches the start of a strip-target call.
 * Matches at line start with optional whitespace and optional label prefix (e.g. `default:`).
 * The actual parenthesis matching is done procedurally to avoid catastrophic backtracking.
 *
 * @param {string[]} functions - Function names to strip.
 * @returns {RegExp} Pattern that matches `FuncName(` in strippable positions.
 */
export function buildStripPattern(functions) {
    const escaped = functions.map(f => f.replace(/\./g, '\\.')).join('|');
    return new RegExp(`^([ \\t]*(?:\\w+:[ \\t]*)?)(${escaped})\\(`, 'gm');
}

/**
 * Strip specified function calls from source text.
 * Uses parenthesis counting to find the end of the call, avoiding regex backtracking.
 *
 * @param {string} source - Source code.
 * @param {RegExp} pattern - Compiled strip pattern from buildStripPattern.
 * @returns {string} Processed source.
 */
export function applyStrip(source, pattern) {
    pattern.lastIndex = 0;

    const removals = []; // [startIndex, endIndex] pairs to remove
    let match;

    while ((match = pattern.exec(source)) !== null) {
        const linePrefix = match[1]; // leading whitespace + optional label
        const funcNameStart = match.index + linePrefix.length;
        const parenStart = match.index + match[0].length - 1;
        let depth = 1;
        let i = parenStart + 1;
        let inString = false;
        let stringChar = '';
        let inTemplate = false;
        let templateDepth = 0;

        while (i < source.length && depth > 0) {
            const ch = source[i];

            // Skip single-line comments
            if (ch === '/' && i + 1 < source.length && source[i + 1] === '/') {
                while (i < source.length && source[i] !== '\n') i++;
                continue;
            }

            // Skip multi-line comments
            if (ch === '/' && i + 1 < source.length && source[i + 1] === '*') {
                i += 2;
                while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
                i += 2;
                continue;
            }

            if (inString) {
                if (ch === stringChar && source[i - 1] !== '\\') {
                    inString = false;
                }
                i++;
                continue;
            }

            if (inTemplate) {
                if (ch === '`' && source[i - 1] !== '\\') {
                    inTemplate = false;
                } else if (ch === '$' && i + 1 < source.length && source[i + 1] === '{') {
                    templateDepth++;
                    i += 2;
                    continue;
                } else if (ch === '}' && templateDepth > 0) {
                    templateDepth--;
                }
                i++;
                continue;
            }

            if (ch === '\'' || ch === '"') {
                inString = true;
                stringChar = ch;
            } else if (ch === '`') {
                inTemplate = true;
                templateDepth = 0;
            } else if (ch === '(') {
                depth++;
            } else if (ch === ')') {
                depth--;
            }

            i++;
        }

        if (depth === 0) {
            // i is now right after the closing paren
            let end = i;
            // Skip optional semicolon and trailing whitespace/newline
            while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end++;
            if (end < source.length && source[end] === ';') end++;
            while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end++;
            if (end < source.length && source[end] === '\n') end++;
            else if (end < source.length && source[end] === '\r') {
                end++;
                if (end < source.length && source[end] === '\n') end++;
            }

            // The match starts at the beginning of the line (anchored with ^).
            // If the prefix is only whitespace, remove the entire line.
            // If the prefix includes a label (e.g. "default: "), remove only the call.
            const start = match.index;
            if (/^[ \t]*$/.test(linePrefix)) {
                removals.push([start, end]);
            } else {
                removals.push([funcNameStart, end]);
            }
        }
    }

    if (removals.length === 0) return source;

    // Build result by skipping removed ranges, handling overlapping/nested ranges
    let result = '';
    let pos = 0;
    for (const [start, end] of removals) {
        if (start < pos) continue; // skip ranges nested inside an already-removed range
        result += source.slice(pos, start);
        pos = end;
    }
    result += source.slice(pos);
    return result;
}
