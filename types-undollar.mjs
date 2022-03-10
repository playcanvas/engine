import fs from 'fs';

let content = fs.readFileSync('build/playcanvas.d.ts', 'utf8');

/**
 * This will contain all matches found via `regexType`, as long the class names are equal.
 *
 * Example keys: `['AssetRegistry', 'GraphicsDevice', 'ResourceHandler', ...]`
 *
 * @type {Set<string>}
 */
const seenTypes = new Set();

const debug = false;

/**
 * This regular expression matches code like:
 *
 * ```js
 *   type AssetRegistry$2 = AssetRegistry$c;
 *   type GraphicsDevice$3 = GraphicsDevice$l;
 *   type ResourceHandler$3 = ResourceHandler$h;
 * ```
 */
const regexType = /type ([a-zA-Z0-9]+)(\$[a-zA-Z0-9]*)? = ([a-zA-Z0-9]+)(\$[a-zA-Z0-9]*)?;/g;

// STEP 1: Delete all lines of the form: type <TYPE-ALIAS> = <TYPE-ALIAS>;
content = content.replace(regexType, (all, first, firstDollar, second, secondDollar) => {
    if (first == second) {
        seenTypes.add(first);
        if (debug) {
            console.log('==', { first, second });
            return '// ' + all;
        }
        return '';

    }
    if (debug) {
        console.log('!=', { first, second });
    }
    return all;

});

// STEP 2: Replace all aliased type names with the original type name.
const longestTypesFirst = [...seenTypes].sort((a, b) => b.length - a.length);
for (const seenType of longestTypesFirst) {
    const regex = new RegExp(`${seenType}\\$[a-zA-Z0-9]+`, 'g');
    content = content.replace(regex, (all) => {
        if (debug) {
            return '/*removed dollar*/ ' + seenType;
        }
        return seenType;

    });
}

// STEP 3: Replace 'SomeType as SomeType' with 'SomeType'. This fixes the final export in the types
// that export the alias type names as public API type names.
for (const seenType of longestTypesFirst) {
    const regex = new RegExp(`${seenType} as ${seenType}`, 'g');
    content = content.replace(regex, (all) => {
        if (debug) {
            return '/*removed as*/ ' + seenType;
        }
        return seenType;

    });
}

if (debug) {
    longestTypesFirst.forEach((seenType, i) => {
        console.log(`longestTypesFirst[${i.toString().padStart(3)}] = ${seenType}`);
    });
}

// Export all callbacks
const regexCallback = /type [a-zA-Z]+Callback/g;
content = content.replace(regexCallback, 'export $&');

fs.writeFileSync('build/playcanvas.d.ts', content);
