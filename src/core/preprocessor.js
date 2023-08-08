import { Debug } from './debug.js';

// id for debug tracing
const TRACEID = 'Preprocessor';

// accepted keywords
const KEYWORD = /[ \t]*#(ifn?def|if|endif|else|elif|define|undef|extension)/g;

// #define EXPRESSION
const DEFINE = /define[ \t]+([^\n]+)\r?(?:\n|$)/g;

// #extension IDENTIFIER : enabled
const EXTENSION = /extension[ \t]+([\w-]+)[ \t]*:[ \t]*(enable|require)/g;

// #undef EXPRESSION
const UNDEF = /undef[ \t]+([^\n]+)\r?(?:\n|$)/g;

// #ifdef/#ifndef SOMEDEFINE, #if EXPRESSION
const IF = /(ifdef|ifndef|if)[ \t]*([^\r\n]+)\r?\n/g;

// #endif/#else or #elif EXPRESSION
const ENDIF = /(endif|else|elif)([ \t]+[^\r\n]+)?\r?(?:\n|$)/g;

// identifier
const IDENTIFIER = /([\w-]+)/;

// [!]defined(EXPRESSION)
const DEFINED = /(!|\s)?defined\(([\w-]+)\)/;

// currently unsupported characters in the expression: | & < > = + -
const INVALID = /[><=|&+-]/g;

/**
 * Pure static class implementing subset of C-style preprocessor.
 * inspired by: https://github.com/dcodeIO/Preprocessor.js
 *
 * @ignore
 */
class Preprocessor {
    /**
     * Run c-like preprocessor on the source code, and resolves the code based on the defines and ifdefs
     *
     * @param {string} source - The source code to work on.
     * @param {boolean} [stripUnusedColorAttachments] - If true, strips unused color attachments.
     * @returns {string|null} Returns preprocessed source code, or null in case of error.
     */
    static run(source, stripUnusedColorAttachments = false) {

        // strips comments, handles // and many cases of /*
        source = source.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

        // right trim each line
        source = source.split(/\r?\n/)
            .map(line => line.trimEnd())
            .join('\n');

        // generate defines to remove unused color attachments
        // Note: this is only needed for iOS 15 on WebGL2 where there seems to be a bug where color attachments that are not
        // written to generate metal linking errors. This is fixed on iOS 16, and iOS 14 does not support WebGL2.
        const defines = new Map();
        if (stripUnusedColorAttachments) {

            // find out how many times pcFragColorX is used (see gles3.js)
            const counts = new Map();
            const regex = /(pcFragColor[1-8])\b/g;
            const matches = source.match(regex);
            matches?.forEach((match) => {
                const index = parseInt(match.charAt(match.length - 1), 10);
                counts.set(index, (counts.get(index) ?? 0) + 1);
            });

            // if pcFragColorX is used only once, remove it
            counts.forEach((count, index) => {
                if (count === 1) {
                    defines.set(`REMOVE_COLOR_ATTACHMENT_${index}`, '');
                }
            });
        }

        // preprocess defines / ifdefs ..
        source = this._preprocess(source, defines);

        // extract defines that evaluate to an integer number
        const intDefines = new Map();
        defines.forEach((value, key) => {
            if (Number.isInteger(parseFloat(value)) && !value.includes('.')) {
                intDefines.set(key, value);
            }
        });

        // process individual lines
        if (source !== null) {
            source = source.split(/\r?\n/)

                // convert lines with only white space into empty string
                .map(line => (line.trim() === '' ? '' : line))

                // replace lines containing "[intDefine]" with their values, so that we know the array size for WebGPU uniform buffer
                // example: weight[SAMPLES] => float weight[11] in case there was a "define SAMPLES 11" in the source code
                .map((line) => {
                    intDefines.forEach((value, key) => {
                        line = line.replace(new RegExp(`\\[${key}\\]`, 'g'), `[${value}]`);
                    });
                    return line;
                })
                .join('\n');

            // remove more than 1 consecutive empty lines
            source = source.replace(/(\n\n){3,}/gm, '\n\n');
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
     * @returns {string} Returns preprocessed source code.
     */
    static _preprocess(source, defines = new Map()) {

        const originalSource = source;

        // stack, storing info about ifdef blocks
        const stack = [];

        // true if the function encounter a problem
        let error = false;

        let match;
        while ((match = KEYWORD.exec(source)) !== null) {

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
                    const identifier = identifierValue[1];
                    let value = expression.substring(identifier.length).trim();
                    if (value === "") value = "true";

                    // are we inside if-blocks that are accepted
                    const keep = Preprocessor._keep(stack);

                    if (keep) {
                        defines.set(identifier, value);
                    }

                    Debug.trace(TRACEID, `${keyword}: [${identifier}] ${value} ${keep ? "" : "IGNORED"}`);

                    // continue on the next line
                    KEYWORD.lastIndex = define.index + define[0].length;
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
                    }

                    Debug.trace(TRACEID, `${keyword}: [${identifier}] ${keep ? "" : "IGNORED"}`);

                    // continue on the next line
                    KEYWORD.lastIndex = undef.index + undef[0].length;
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
                            defines.set(identifier, "true");
                        }

                        Debug.trace(TRACEID, `${keyword}: [${identifier}] ${keep ? "" : "IGNORED"}`);
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

                    // code between if and endif
                    const blockCode = blockInfo.keep ? source.substring(blockInfo.end, match.index) : "";
                    Debug.trace(TRACEID, `${keyword}: [previous block] => ${blockCode !== ""}`);

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
            }
        }

        if (error) {
            console.warn("Failed to preprocess shader: ", { source: originalSource });
            return originalSource;
        }

        return source;
    }

    // function returns true if the evaluation is inside keep branches
    static _keep(stack) {
        for (let i = 0; i < stack.length; i++) {
            if (!stack[i].keep)
                return false;
        }

        return true;
    }

    /**
     * Very simple expression evaluation, handles cases:
     * expression
     * defined(expression)
     * !defined(expression)
     *
     * But does not handle more complex cases, which would require more complex system:
     * defined(A) || defined(B)
     */
    static evaluate(expression, defines) {

        const correct = INVALID.exec(expression) === null;
        Debug.assert(correct, `Resolving expression like this is not supported: ${expression}`);

        // if the format is defined(expression), extract expression
        let invert = false;
        const defined = DEFINED.exec(expression);
        if (defined) {
            invert = defined[1] === '!';
            expression = defined[2];
        }

        // test if expression define exists
        expression = expression.trim();
        let exists = defines.has(expression);

        // handle inversion
        if (invert) {
            exists = !exists;
        }

        return {
            result: exists,
            error: !correct
        };
    }
}

export { Preprocessor };
