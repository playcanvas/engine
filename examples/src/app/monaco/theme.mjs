/** @import { editor } from 'monaco-editor' */

/** @type {editor.IStandaloneThemeData} */
export const playcanvasTheme = {
    base: 'vs-dark',
    inherit: true,
    rules: [
        {
            token: 'comment',
            foreground: '7F7F7F'
        }
    ],
    colors: {
        'editor.background': '#161c1e'
    }
};
