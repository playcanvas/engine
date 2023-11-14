/**
 * @example
 * capitalizeFirstLetter("test") // Outputs 'Test'
 * @param {string} string 
 * @returns {string}
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * @example
 * toKebabCase('BlendTrees1D'); // Outputs: 'blend-trees-1d'
 * toKebabCase('LightsBakedAO'); // Outputs 'lights-baked-a-o'
 * @param {string} str - The string.
 * @returns String in kebab-case-format
 */
function toKebabCase(str) {
    return str
      .replace(/([A-Z])([A-Z])/g, '$1-$2') // case for "...AO" -> '...-a-o'
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z])([a-z])/g, '$1-$2$3')
      .toLowerCase()
      .replaceAll("1d", "-1d")
      .replaceAll("2d", "-2d")
      .replaceAll("3d", "-3d")
}

/**
 * @example
 * kebabCaseToPascalCase("user-interface"); // Outputs 'UserInterface'
 * @param {string} str - The string.
 * @returns {string}
 */
function kebabCaseToPascalCase(str) {
    return str
        .split('-')
        .map(capitalizeFirstLetter)
        .join('')
        .replace('1d', '1D')
        .replace('2d', '2D')
        .replace('3d', '3D');
}

/**
 * @example
 * countLeadingSpaces('  Hello!'); // Result: 2
 * @param {string} str - String with leading spaces.
 * @returns {number} Number of spaces.
 */
function countLeadingSpaces(str) {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === " ") {
            count++;
        } else {
            break;
        }
    }
    return count;
}

/**
 * @param {string} code - Code with redundant spaces over many lines.
 * @returns {string} Same code, but removed reduddant spaces.
 */
function removeRedundantSpaces(code) {
    const lines = code
        .split('\n')
        .slice(0, -1) // ignore last line - it's just used for nice template-string indentation
        .filter(_ => Boolean(_.trim())) // ignore spaces-only lines
        .map(countLeadingSpaces);
    if (!lines.length) {
        return code;
    }
    const n = Math.min(...lines);
    const removeSpacesRegExp = new RegExp(' '.repeat(n), 'g');
    const prettyCode = code.replace(removeSpacesRegExp, '').trim() + '\n';
    return prettyCode;
}

export { capitalizeFirstLetter, toKebabCase, kebabCaseToPascalCase, removeRedundantSpaces };
