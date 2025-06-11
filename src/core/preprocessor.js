import { Debug } from './debug.js';

// id for debug tracing
const TRACEID = 'Preprocessor';

// accepted keywords
const KEYWORD = /[ \t]*#(ifn?def|if|endif|else|elif|define|undef|extension|include)/g;

// #define EXPRESSION
// eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/optimal-quantifier-concatenation
const DEFINE = /define[ \t]+([^\n]+)\r?(?:\n|$)/g;

// #extension IDENTIFIER : enabled
const EXTENSION = /extension[ \t]+([\w-]+)[ \t]*:[ \t]*(enable|require)/g;

// #undef EXPRESSION
// eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/optimal-quantifier-concatenation
const UNDEF = /undef[ \t]+([^\n]+)\r?(?:\n|$)/g;

// #ifdef/#ifndef SOMEDEFINE, #if EXPRESSION
// eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-unused-capturing-group
const IF = /(ifdef|ifndef|if)[ \t]*([^\r\n]+)\r?\n/g;

// #endif/#else or #elif EXPRESSION
const ENDIF = /(endif|else|elif)(?:[ \t]+([^\r\n]*))?\r?\n?/g;

// identifier in form of IDENTIFIER or {IDENTIFIER}
const IDENTIFIER = /\{?[\w-]+\}?/;

// [!]defined(EXPRESSION)
const DEFINED = /(!|\s)?defined\(([\w-]+)\)/;

// Matches comparison operators like ==, !=, <, <=, >, >=
const COMPARISON = /([a-z_]\w*)\s*(==|!=|<|<=|>|>=)\s*([\w"']+)/i;

// currently unsupported characters in the expression: + -
const INVALID = /[+\-]/g;

// #include "identifier" or optional second identifier #include "identifier1, identifier2"
// Matches only up to the closing quote of the include directive
const INCLUDE = /include[ \t]+"([\w-]+)(?:\s*,\s*([\w-]+))?"/g;

// loop index to replace, in the format {i}
const LOOP_INDEX = /\{i\}/g;

// matches color attachments, for example: pcFragColor1
const FRAGCOLOR = /(pcFragColor[1-8])\b/g;

/**
 * Pure static class implementing subset of C-style preprocessor.
 * inspired by: https://github.com/dcodeIO/Preprocessor.js
 */
class Preprocessor {
    static sourceName;

    /**
     * Run c-like preprocessor on the source code, and resolves the code based on the defines and ifdefs
     *
     * @param {string} source - The source code to work on.
     * @param {Map<string, string>} [includes] - A map containing key-value pairs of include names
     * and their content. These are used for resolving #include directives in the source.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.stripUnusedColorAttachments] - If true, strips unused color attachments.
     * @param {boolean} [options.stripDefines] - If true, strips all defines from the source.
     * @param {string} [options.sourceName] - The name of the source file.
     * @returns {string|null} Returns preprocessed source code, or null in case of error.
     */
    static run(source, includes = new Map(), options = {}) {

        Preprocessor.sourceName = options.sourceName;

        // strips comments, handles // and many cases of /*
        source = this.stripComments(source);

        // right trim each line
        source = source.split(/\r?\n/)
        .map(line => line.trimEnd())
        .join('\n');

        // extracted defines
        const defines = new Map();

        // extracted defines with name in {} which are to be replaced with their values
        const injectDefines = new Map();

        // preprocess defines / ifdefs ..
        source = this._preprocess(source, defines, injectDefines, includes, options.stripDefines);
        if (source === null) return null;

        // extract defines that evaluate to an integer number
        const intDefines = new Map();
        defines.forEach((value, key) => {
            if (Number.isInteger(parseFloat(value)) && !value.includes('.')) {
                intDefines.set(key, value);
            }
        });

        // strip comments again after the includes have been resolved
        source = this.stripComments(source);

        source = this.stripUnusedColorAttachments(source, options);

        // remove empty lines
        source = this.RemoveEmptyLines(source);

        // process array sizes
        source = this.processArraySize(source, intDefines);

        // inject defines
        source = this.injectDefines(source, injectDefines);

        return source;
    }

    static stripUnusedColorAttachments(source, options) {

        if (options.stripUnusedColorAttachments) {

            // find out how many times pcFragColorX is used (see gles3.js)
            const counts = new Map();
            const matches = source.match(FRAGCOLOR);
            matches?.forEach((match) => {
                const index = parseInt(match.charAt(match.length - 1), 10);
                counts.set(index, (counts.get(index) ?? 0) + 1);
            });

            // if there's any attachment used only one time (only as a declaration, without actual use)
            const anySingleUse = Array.from(counts.values()).some(count => count === 1);
            if (anySingleUse) {

                // remove all lines that contains pcFragColorX with single usage
                const lines = source.split('\n');
                const keepLines = [];
                for (let i = 0; i < lines.length; i++) {
                    const match = lines[i].match(FRAGCOLOR);
                    if (match) {
                        const index = parseInt(match[0].charAt(match[0].length - 1), 10);
                        if (index > 0 && counts.get(index) === 1) {
                            continue;
                        }
                    }
                    keepLines.push(lines[i]);
                }

                source = keepLines.join('\n');
            }
        }

        return source;
    }

    static stripComments(source) {
        return source.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    }

    static processArraySize(source, intDefines) {

        if (source !== null) {
            // replace lines containing "[intDefine]" with their values, so that we know the array size for WebGPU uniform buffer
            // example: weight[SAMPLES] => float weight[11] in case there was a "define SAMPLES 11" in the source code
            intDefines.forEach((value, key) => {
                source = source.replace(new RegExp(`\\[${key}\\]`, 'g'), `[${value}]`);
            });
        }

        return source;
    }

    static injectDefines(source, injectDefines) {

        if (source !== null && injectDefines.size > 0) {

            // replace all instances of the injected defines with the value itself
            const lines = source.split('\n');
            injectDefines.forEach((value, key) => {
                const regex = new RegExp(key, 'g');
                for (let i = 0; i < lines.length; i++) {

                    // replace them on lines that do not contain a preprocessor directive (the define itself for example)
                    if (!lines[i].includes('#')) {
                        lines[i] = lines[i].replace(regex, value);
                    }
                }
            });
            source = lines.join('\n');
        }

        return source;
    }

    static RemoveEmptyLines(source) {

        if (source !== null) {
            source = source.split(/\r?\n/)

            // convert lines with only white space into empty string
            .map(line => (line.trim() === '' ? '' : line))
            .join('\n');

            // remove more than 1 consecutive empty lines
            source = source.replace(/(\n\n){3,}/g, '\n\n');
        }

        return source;
    }

    /**
     * Process source code, and resolves the code based on the defines and ifdefs.
     *
     * @param {string} source - The source code to work on.
     * @param {Map<string, string>} defines - Supplied defines which are used in addition to those
     * defined in the source code. Maps a define name to its value. Note that the map is modified
     * by the function.
     * @param {Map<string, string>} injectDefines - An object to collect defines that are to be
     * replaced with their values.
     * @param {Map<string, string>} [includes] - An object containing key-value pairs of include names and their
     * content.
     * @param {boolean} [stripDefines] - If true, strips all defines from the source.
     * @returns {string|null} Returns preprocessed source code, or null if failed.
     */
    static _preprocess(source, defines = new Map(), injectDefines, includes, stripDefines) {

        const originalSource = source;

        // stack, storing info about ifdef blocks
        const stack = [];

        // true if the function encounter a problem
        let error = false;

        let match;
        while ((match = KEYWORD.exec(source)) !== null && !error) {

            const keyword = match[1];
            switch (keyword) {
                case 'define': {

                    // read the rest of the define line
                    DEFINE.lastIndex = match.index;
                    const define = DEFINE.exec(source);
                    Debug.assert(define, `Invalid [${keyword}]: ${source.substring(match.index, match.index + 100)}...`);
                    error ||= define === null;
                    const expression = define[1];

                    // split it to identifier name and a value
                    IDENTIFIER.lastIndex = define.index;
                    const identifierValue = IDENTIFIER.exec(expression);
                    const identifier = identifierValue[0];
                    let value = expression.substring(identifier.length).trim();
                    if (value === '') value = 'true';

                    // are we inside if-blocks that are accepted
                    const keep = Preprocessor._keep(stack);
                    let stripThisDefine = stripDefines;

                    if (keep) {

                        // replacement identifier (inside {}) - always remove it from code
                        const replacementDefine = identifier.startsWith('{') && identifier.endsWith('}');
                        if (replacementDefine) {
                            stripThisDefine = true;
                        }

                        if (replacementDefine) {
                            injectDefines.set(identifier, value);
                        } else {
                            defines.set(identifier, value);
                        }

                        if (stripThisDefine) {
                            // cut out the define line
                            source = source.substring(0, define.index - 1) + source.substring(DEFINE.lastIndex);

                            // continue processing on the next symbol
                            KEYWORD.lastIndex = define.index - 1;
                        }
                    }

                    Debug.trace(TRACEID, `${keyword}: [${identifier}] ${value} ${keep ? '' : 'IGNORED'}`);

                    // continue on the next line
                    if (!stripThisDefine) {
                        KEYWORD.lastIndex = define.index + define[0].length;
                    }
                    break;
                }

                case 'undef': {

                    // read the rest of the define line
                    UNDEF.lastIndex = match.index;
                    const undef = UNDEF.exec(source);
                    const identifier = undef[1].trim();

                    // are we inside if-blocks that are accepted
                    const keep = Preprocessor._keep(stack);

                    // remove it from defines
                    if (keep) {
                        defines.delete(identifier);

                        if (stripDefines) {
                            // cut out the undef line
                            source = source.substring(0, undef.index - 1) + source.substring(UNDEF.lastIndex);

                            // continue processing on the next symbol
                            KEYWORD.lastIndex = undef.index - 1;
                        }
                    }

                    Debug.trace(TRACEID, `${keyword}: [${identifier}] ${keep ? '' : 'IGNORED'}`);

                    // continue on the next line
                    if (!stripDefines) {
                        KEYWORD.lastIndex = undef.index + undef[0].length;
                    }
                    break;
                }

                case 'extension': {
                    EXTENSION.lastIndex = match.index;
                    const extension = EXTENSION.exec(source);
                    Debug.assert(extension, `Invalid [${keyword}]: ${source.substring(match.index, match.index + 100)}...`);
                    error ||= extension === null;
                    if (extension) {
                        const identifier = extension[1];

                        // are we inside if-blocks that are accepted
                        const keep = Preprocessor._keep(stack);

                        if (keep) {
                            defines.set(identifier, 'true');
                        }

                        Debug.trace(TRACEID, `${keyword}: [${identifier}] ${keep ? '' : 'IGNORED'}`);
                    }

                    // continue on the next line
                    KEYWORD.lastIndex = extension.index + extension[0].length;
                    break;
                }

                case 'ifdef':
                case 'ifndef':
                case 'if': {

                    // read the if line
                    IF.lastIndex = match.index;
                    const iff = IF.exec(source);
                    const expression = iff[2];

                    // evaluate expression
                    const evaluated = Preprocessor.evaluate(expression, defines);
                    error ||= evaluated.error;
                    let result = evaluated.result;
                    if (keyword === 'ifndef') {
                        result = !result;
                    }

                    // add info to the stack (to be handled later)
                    stack.push({
                        anyKeep: result,        // true if any branch was already accepted
                        keep: result,           // true if this branch is being taken
                        start: match.index,     // start index if IF line
                        end: IF.lastIndex       // end index of IF line
                    });

                    Debug.trace(TRACEID, `${keyword}: [${expression}] => ${result}`);

                    // continue on the next line
                    KEYWORD.lastIndex = iff.index + iff[0].length;
                    break;
                }

                case 'endif':
                case 'else':
                case 'elif': {

                    // match the endif
                    ENDIF.lastIndex = match.index;
                    const endif = ENDIF.exec(source);

                    const blockInfo = stack.pop();
                    if (!blockInfo) {
                        console.error(`Shader preprocessing encountered "#${endif[1]}" without a preceding #if #ifdef #ifndef while preprocessing ${Preprocessor.sourceName} on line:\n ${source.substring(match.index, match.index + 100)}...`, { source: originalSource });
                        error = true;
                        continue;
                    }

                    // code between if and endif
                    const blockCode = blockInfo.keep ? source.substring(blockInfo.end, match.index) : '';
                    Debug.trace(TRACEID, `${keyword}: [previous block] => ${blockCode !== ''}`);

                    // cut out the IF and ENDIF lines, leave block if required
                    source = source.substring(0, blockInfo.start) + blockCode + source.substring(ENDIF.lastIndex);
                    KEYWORD.lastIndex = blockInfo.start + blockCode.length;

                    // handle else if
                    const endifCommand = endif[1];
                    if (endifCommand === 'else' || endifCommand === 'elif') {

                        // if any branch was already accepted, all else branches need to fail regardless of the result
                        let result = false;
                        if (!blockInfo.anyKeep) {
                            if (endifCommand === 'else') {
                                result = !blockInfo.keep;
                            } else {
                                const evaluated = Preprocessor.evaluate(endif[2], defines);
                                result = evaluated.result;
                                error ||= evaluated.error;
                            }
                        }

                        // add back to stack
                        stack.push({
                            anyKeep: blockInfo.anyKeep || result,
                            keep: result,
                            start: KEYWORD.lastIndex,
                            end: KEYWORD.lastIndex
                        });
                        Debug.trace(TRACEID, `${keyword}: [${endif[2]}] => ${result}`);
                    }

                    break;
                }

                case 'include': {
                    // match the include
                    INCLUDE.lastIndex = match.index;
                    const include = INCLUDE.exec(source);
                    error ||= include === null;
                    if (!include) {
                        Debug.assert(include, `Invalid [${keyword}] while preprocessing ${Preprocessor.sourceName}:\n${source.substring(match.index, match.index + 100)}...`);
                        error = true;
                        continue;
                    }
                    const identifier = include[1].trim();
                    const countIdentifier = include[2]?.trim();

                    // are we inside if-blocks that are accepted
                    const keep = Preprocessor._keep(stack);

                    if (keep) {

                        // cut out the include line and replace it with the included string
                        let includeSource = includes?.get(identifier);
                        if (includeSource !== undefined) {

                            includeSource = this.stripComments(includeSource);

                            // handle second identifier specifying loop count
                            if (countIdentifier) {
                                const countString = defines.get(countIdentifier);
                                const count = parseFloat(countString);
                                if (Number.isInteger(count)) {

                                    // add the include count times
                                    let result = '';
                                    for (let i = 0; i < count; i++) {
                                        result += includeSource.replace(LOOP_INDEX, String(i));
                                    }
                                    includeSource = result;

                                } else {
                                    console.error(`Include Count identifier "${countIdentifier}" not resolved while preprocessing ${Preprocessor.sourceName} on line:\n ${source.substring(match.index, match.index + 100)}...`, { originalSource: originalSource, source: source });
                                    error = true;
                                }
                            }

                            // replace the include by the included string
                            source = source.substring(0, include.index - 1) + includeSource + source.substring(INCLUDE.lastIndex);

                            // process the just included test
                            KEYWORD.lastIndex = include.index - 1;
                        } else {
                            console.error(`Include "${identifier}" not resolved while preprocessing ${Preprocessor.sourceName}`, { originalSource: originalSource, source: source });
                            error = true;
                            continue;
                        }
                    }

                    Debug.trace(TRACEID, `${keyword}: [${identifier}] ${keep ? '' : 'IGNORED'}`);
                    break;
                }
            }
        }

        if (stack.length > 0) {
            console.error(`Shader preprocessing reached the end of the file without encountering the necessary #endif to close a preceding #if, #ifdef, or #ifndef block. ${Preprocessor.sourceName}`);
            error = true;
        }

        if (error) {
            console.error('Failed to preprocess shader: ', { source: originalSource });
            return null;
        }

        return source;
    }

    // function returns true if the evaluation is inside keep branches
    static _keep(stack) {
        for (let i = 0; i < stack.length; i++) {
            if (!stack[i].keep) {
                return false;
            }
        }

        return true;
    }

    /**
     * Evaluates a single atomic expression, which can be:
     * - `defined(EXPRESSION)` or `!defined(EXPRESSION)`
     * - Comparisons such as `A == B`, `A != B`, `A > B`, etc.
     * - Simple checks for the existence of a define.
     *
     * @param {string} expr - The atomic expression to evaluate.
     * @param {Map<string, string>} defines - A map containing key-value pairs of defines.
     * @returns {object} Returns an object containing the result of the evaluation and an error flag.
     */
    static evaluateAtomicExpression(expr, defines) {
        let error = false;
        expr = expr.trim();
        let invert = false;

        // Handle defined(expr) and !defined(expr)
        const definedMatch = DEFINED.exec(expr);
        if (definedMatch) {
            invert = definedMatch[1] === '!';
            expr = definedMatch[2].trim();
            const exists = defines.has(expr);
            return { result: invert ? !exists : exists, error };
        }

        // Handle comparisons
        const comparisonMatch = COMPARISON.exec(expr);
        if (comparisonMatch) {
            const left = defines.get(comparisonMatch[1].trim()) ?? comparisonMatch[1].trim();
            const right = defines.get(comparisonMatch[3].trim()) ?? comparisonMatch[3].trim();
            const operator = comparisonMatch[2].trim();

            let result = false;
            switch (operator) {
                case '==': result = left === right; break;
                case '!=': result = left !== right; break;
                case '<': result = left < right; break;
                case '<=': result = left <= right; break;
                case '>': result = left > right; break;
                case '>=': result = left >= right; break;
                default: error = true;
            }

            return { result, error };
        }

        // Default case: check if expression is defined
        const result = defines.has(expr);
        return { result, error };
    }

    /**
     * Evaluates a complex expression with support for `defined`, `!defined`, comparisons, `&&`,
     * and `||`. It does not currently handle ( and ).
     *
     * @param {string} expression - The expression to evaluate.
     * @param {Map<string, string>} defines - A map containing key-value pairs of defines.
     * @returns {object} Returns an object containing the result of the evaluation and an error flag.
     */
    static evaluate(expression, defines) {
        const correct = INVALID.exec(expression) === null;
        Debug.assert(correct, `Resolving expression like this is not supported: ${expression}`);

        // Step 1: Split by "||" to handle OR conditions
        const orSegments = expression.split('||');
        for (const orSegment of orSegments) {

            // Step 2: Split each OR segment by "&&" to handle AND conditions
            const andSegments = orSegment.split('&&');

            // Step 3: Evaluate each AND segment
            let andResult = true;
            for (const andSegment of andSegments) {
                const { result, error } = Preprocessor.evaluateAtomicExpression(andSegment.trim(), defines);
                if (!result || error) {
                    andResult = false;
                    break; // Short-circuit AND evaluation
                }
            }

            // Step 4: If any OR segment evaluates to true, short-circuit and return true
            if (andResult) {
                return { result: true, error: !correct };
            }
        }

        // If no OR segment is true, the whole expression is false
        return { result: false, error: !correct };
    }
}

export { Preprocessor };
