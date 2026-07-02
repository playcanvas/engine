export default {
    printWidth: 120,
    tabWidth: 4,
    singleQuote: true,
    arrowParens: 'always',
    trailingComma: 'none',
    overrides: [
        {
            files: '*.jsx',
            options: {
                printWidth: 100,
                jsxSingleQuote: true
            }
        }
    ]
};
