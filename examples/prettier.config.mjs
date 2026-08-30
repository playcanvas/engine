import playcanvasPrettier from '@playcanvas/eslint-config/prettier';

// inherit the shared house style; only override what examples add on top
export default {
    ...playcanvasPrettier,
    arrowParens: 'always',
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
