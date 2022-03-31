import { Debug } from './debug.js';

// set to true to enable debug logging
const enableLogging = false;

const log = (...args) => {
    if (enableLogging) {
        Debug.log(...args);
    }
};

const logAssert = (condition, keyword, src, index) => {
    Debug.assert(condition, `Invalid [${keyword}]: ${src.substring(index, index + 100)}...`);
};

// accepted keywords
const KEYWORD = /([ ]*)+#(ifn?def|if|endif|else|elif|define|undef)/g;  // lgtm[js/inefficient-regular-expression]

// #define EXPRESSION
const DEFINE = /define[ ]+([^\n]+)\r?(?:\n|$)/g;

// #undef EXPRESSION
const UNDEF = /undef[ ]+([^\n]+)\r?(?:\n|$)/g;

// #ifdef/#ifndef SOMEDEFINE, #if EXPRESSION
const IF = /(ifdef|ifndef|if)[ ]*([^\r\n]+)\r?\n/g;

// #endif/#else or #elif EXPRESSION
const ENDIF = /(endif|else|elif)([ ]+[^\r\n]+)?\r?(?:\n|$)/g;

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
     * Run c-like proprocessor on the source code, and resolves the code based on the defines and ifdefs
     *
     * @param {string} source - The source code to work on.
     * @returns {string} Returns preprocessed source code.
     */
    static run(source) {

        // strips comments, handles // and many cases of /*
        source = source.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

        // right trim each line
        source = source.split(/\r?\n/)
            .map(line => line.trimEnd())
            .join('\n');

        // proprocess defines / ifdefs ..
        source = this._preprocess(source);

        // convert lines with only white space into empty string
        source = source.split(/\r?\n/)
            .map(line => (line.trim() === '' ? '' : line))
            .join('\n');

        // remove more than 1 consecutive empty lines
        source = source.replace(/(\n\n){3,}/gm, '\n\n');

        return source;
    }

    static _preprocess(source) {

        // stack, storing info about ifdef blocks
        const stack = [];

        // active defines, maps define name to its value
        /** @type {Map<string, string>} */
        const defines = new Map();

        let match;
        while ((match = KEYWORD.exec(source)) !== null) {

            const keyword = match[2];
            switch (keyword) {
                case 'define': {

                    // read the rest of the define line
                    DEFINE.lastIndex = match.index;
                    const define = DEFINE.exec(source);
                    logAssert(define, keyword, source, match.index);
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

                    log(`${keyword}: [${identifier}] ${value} ${keep ? "" : "IGNORED"}`);

                    // continue on the next line
                    KEYWORD.lastIndex = define.index + define[0].length;
                    break;
                }

                case 'undef': {

                    // read the rest of the define line
                    UNDEF.lastIndex = match.index;
                    const undef = UNDEF.exec(source);
                    const identifier = undef[1].trim();

                    // remove it from defines
                    defines.delete(identifier);
                    log(`${keyword}: [${identifier}]`);

                    // continue on the next line
                    KEYWORD.lastIndex = undef.index + undef[0].length;
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
                    let result = Preprocessor.evaluate(expression, defines);
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

                    log(`${keyword}: [${expression}] => ${result}`);

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
                    log(`${keyword}: [previous block] => ${blockCode !== ""}`);

                    // cut out the IF and ENDIF lines, leave block if required
                    source = source.substring(0, blockInfo.start) + blockCode + source.substring(ENDIF.lastIndex);
                    KEYWORD.lastIndex = blockInfo.start + blockCode.length;

                    // handle else if
                    const endifCommand = endif[1];
                    if (endifCommand === 'else' || endifCommand === 'elif') {

                        // if any branch was already accepted, all else branches need to fail regardless of the result
                        let result = false;
                        if (!blockInfo.anyKeep) {
                            result = endifCommand === 'else' ? !blockInfo.keep : Preprocessor.evaluate(endif[2], defines);
                        }

                        // add back to stack
                        stack.push({
                            anyKeep: blockInfo.anyKeep || result,
                            keep: result,
                            start: KEYWORD.lastIndex,
                            end: KEYWORD.lastIndex
                        });
                        log(`${keyword}: [${endif[2]}] => ${result}`);
                    }

                    break;
                }
            }
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

        Debug.assert(!INVALID.exec(expression), `Resolving expression like this is not supported: ${expression}`);

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

        return exists;
    }
}

export { Preprocessor };
