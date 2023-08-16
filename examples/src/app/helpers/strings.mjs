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
 * console.log(toKebabCase("BlendTrees1D")); // blend-trees-1d
 * @param {string} str - The string.
 * @returns String in kebab-case-format
 */
function toKebabCase(str) {
    return str
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

export { capitalizeFirstLetter, toKebabCase, kebabCaseToPascalCase };
