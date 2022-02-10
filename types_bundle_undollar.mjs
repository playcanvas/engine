// > node types_bundle_undollar.mjs
import {readFileSync, writeFileSync} from "fs";
var content = readFileSync("build/playcanvas.d.ts", "utf8");
/**
 * This will contain all matches found via `regexType`, as long the class names are equal.
 * 
 * Example keys: `['AssetRegistry', 'GraphicsDevice', 'ResourceHandler', ...]`
 * 
 * @type {Set<string>}
 */
const seenTypes = new Set;
const debug = false;
/**
 * This regular expression catches code like:
 * 
 * ```js
 *   type AssetRegistry$2 = AssetRegistry$c;
 *   type GraphicsDevice$3 = GraphicsDevice$l;
 *   type ResourceHandler$3 = ResourceHandler$h;
 * ```
 */
const regexType = /type ([a-zA-Z0-9]+)(\$[a-zA-Z0-9]*)? = ([a-zA-Z0-9]+)(\$[a-zA-Z0-9]*)?;/g;
content = content.replace(regexType, (all, first, firstDollar, second, secondDollar) => {
  if (first == second) {
    seenTypes.add(first);
    if (debug) {
      console.log('==', {first, second});
      return '// ' + all;
    } else {
      return '';
    }
  } else {
    if (debug) {
      console.log('!=', {first, second});
    }
    return all;
  }
});
const longestTypesFirst = [...seenTypes].sort((a,b) => b.length - a.length);
for (var seenType of longestTypesFirst) {
  var regex = new RegExp(`${seenType}\\$[a-zA-Z0-9]+`, 'g');
  content = content.replace(regex, (all) => {
    if (debug) {
      return '/*removed dollar*/ ' + seenType;
    } else {
      return seenType;
    }
  });
}
for (var seenType of longestTypesFirst) {
  var regex = new RegExp(`${seenType} as ${seenType}`, 'g');
  content = content.replace(regex, (all) => {
    if (debug) {
      return '/*removed as*/ ' + seenType;
    } else {
      return seenType;
    }
  });
}
if (debug) {
  longestTypesFirst.forEach((seenType, i) => {
    console.log(`longestTypesFirst[${i.toString().padStart(3)}] = ${seenType}`);
  });
}
writeFileSync("build/playcanvas_new.d.ts", content);
