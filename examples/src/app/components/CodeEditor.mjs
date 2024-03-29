import { Component } from 'react';
import { Button, Container, Panel } from '@playcanvas/pcui/react';
import MonacoEditor, { loader } from '@monaco-editor/react';

import { pcTypes } from '../paths.mjs';
import { jsx } from '../jsx.mjs';
import { iframe } from '../iframe.mjs';
import { removeRedundantSpaces } from '../strings.mjs';
import { playcanvasTheme } from '../monaco/theme.mjs';
import * as languages from '../monaco/languages/index.mjs';

import '../events.js';

loader.config({ paths: { vs: './modules/monaco-editor/min/vs' } });

function getShowMinimap() {
    let showMinimap = true;
    if (localStorage.getItem('showMinimap')) {
        showMinimap = localStorage.getItem('showMinimap') === 'true';
    }
    return showMinimap;
}

/**
 * @type {Record<string, string>}
 */
const FILE_TYPE_LANGUAGES = {
    json: 'json',
    shader: '',
    vert: 'glsl',
    frag: 'glsl',
    wgsl: 'wgsl',
    javascript: 'javascript',
    js: 'javascript',
    mjs: 'javascript'
};

/**
 * @type {import('monaco-editor').editor.IStandaloneCodeEditor}
 */
let monacoEditor;

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {object} Props
 */

/**
 * @typedef {object} State
 * @property {Record<string, string>} files - The example files.
 * @property {string} selectedFile - The selected file.
 * @property {boolean} showMinimap - The state of showing the Minimap
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class CodeEditor extends TypedComponent {
    /** @type {State} */
    state = {
        files: { 'example.mjs': '// init' },
        selectedFile: 'example.mjs',
        showMinimap: getShowMinimap()
    };

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._handleExampleLoad = this._handleExampleLoad.bind(this);
        this._handleExampleLoading = this._handleExampleLoading.bind(this);
        this._handleRequestedFiles = this._handleRequestedFiles.bind(this);
    }

    /**
     * @param {StateEvent} event - The event.
     */
    _handleExampleLoad(event) {
        const { files } = event.detail;
        this.mergeState({ files, selectedFile: 'example.mjs' });
    }

    _handleExampleLoading() {
        this.mergeState({ files: { 'example.mjs': '// reloading' } });
    }

    /**
     * @param {StateEvent} event - The event.
     */
    _handleRequestedFiles(event) {
        const { files } = event.detail;
        this.mergeState({ files });
    }

    /**
     * @param {Partial<State>} state - New partial state.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    componentDidMount() {
        window.addEventListener('exampleLoad', this._handleExampleLoad);
        window.addEventListener('exampleLoading', this._handleExampleLoading);
        window.addEventListener('requestedFiles', this._handleRequestedFiles);
        iframe.fire('requestFiles');
    }

    componentWillUnmount() {
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
        window.removeEventListener('exampleLoading', this._handleExampleLoading);
        window.removeEventListener('requestedFiles', this._handleRequestedFiles);
    }

    /**
     * @param {import('@monaco-editor/react').Monaco} monaco - The monaco editor.
     */
    beforeMount(monaco) {
        fetch(pcTypes)
            .then((r) => {
                return r.text();
            })
            .then((playcanvasDefs) => {
                // set types
                monaco.languages.typescript.typescriptDefaults.addExtraLib(
                    playcanvasDefs,
                    '@playcanvas/playcanvas.d.ts'
                );
                monaco.languages.typescript.javascriptDefaults.addExtraLib(
                    playcanvasDefs,
                    '@playcanvas/playcanvas.d.ts'
                );

                // set languages
                for (const id in languages) {
                    monaco.languages.register({ id });
                    // @ts-ignore
                    monaco.languages.setLanguageConfiguration(id, languages[id].conf);
                    // @ts-ignore
                    monaco.languages.setMonarchTokensProvider(id, languages[id].language);
                }
            });
    }

    /**
     * @param {import('monaco-editor').editor.IStandaloneCodeEditor} editor - The monaco editor.
     */
    editorDidMount(editor) {
        // @ts-ignore
        window.editor = editor;
        monacoEditor = editor;
        // @ts-ignore
        const monaco = window.monaco;

        // set theme
        monaco.editor.defineTheme('playcanvas', playcanvasTheme);
        monaco.editor.setTheme('playcanvas');

        // Hot reload code via Shift + Enter
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            iframe.fire('hotReload');
        });
        const codePane = document.getElementById('codePane');
        if (!codePane) {
            return;
        }
        codePane.classList.add('multiple-files');
        if (!this.state.files[this.state.selectedFile]) {
            this.mergeState({
                selectedFile: 'example.mjs'
            });
        }
        codePane.ui.on('resize', () => localStorage.setItem('codePaneStyle', codePane.getAttribute('style') ?? ''));
        const codePaneStyle = localStorage.getItem('codePaneStyle');
        if (codePaneStyle) {
            codePane.setAttribute('style', codePaneStyle);
        }
        // set up the code panel toggle button
        const panelToggleDiv = codePane.querySelector('.panel-toggle');
        if (!panelToggleDiv) {
            return;
        }
        panelToggleDiv.addEventListener('click', function () {
            codePane.classList.toggle('collapsed');
            localStorage.setItem('codePaneCollapsed', codePane.classList.contains('collapsed') ? 'true' : 'false');
        });
        // register Monaco commands (you can access them by pressing f1)
        // Toggling minimap is only six key strokes: F1 mini enter (even "F1 mi enter" works)
        editor.addAction({
            id: 'view-toggle-minimap',
            label: 'View: Toggle Minimap',
            contextMenuOrder: 1.5,
            run: () => {
                const showMinimap = !getShowMinimap();
                localStorage.setItem('showMinimap', `${showMinimap}`);
                this.mergeState({ showMinimap });
            }
        });
    }

    /**
     * @param {string} value - The on change state.
     */
    onChange(value) {
        const { files, selectedFile } = this.state;
        files[selectedFile] = value;
    }

    /**
     * @param {string} selectedFile - Newly selected filename.
     */
    selectFile(selectedFile) {
        this.mergeState({ selectedFile });
        monacoEditor?.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
    }

    renderTabs() {
        const { files, selectedFile } = this.state;
        /** @type {JSX.Element[]} */
        const tabs = [];
        for (const name in files) {
            const button = jsx(Button, {
                key: name,
                id: `code-editor-file-tab-${name}`,
                text: name,
                class: name === selectedFile ? 'selected' : null,
                onClick: () => this.selectFile(name)
            });
            tabs.push(button);
        }
        return tabs;
    }

    render() {
        setTimeout(() => iframe.fire('resize'), 50);
        const { files, selectedFile, showMinimap } = this.state;
        const language = FILE_TYPE_LANGUAGES[selectedFile.split('.').pop() || 'shader'];
        let value = files[selectedFile];
        if (value) {
            value = removeRedundantSpaces(value);
        } else {
            value = '// reloading, please wait';
        }
        /** @type {import('@monaco-editor/react').EditorProps} */
        const options = {
            value,
            language,
            theme: 'vs-dark',
            loading: null,
            beforeMount: this.beforeMount.bind(this),
            onMount: this.editorDidMount.bind(this),
            onChange: this.onChange.bind(this),
            options: {
                scrollbar: {
                    horizontal: 'visible'
                },
                readOnly: false,
                minimap: {
                    enabled: showMinimap
                }
            }
            /**
             * TODO: Without a key the syntax highlighting mode isn't updated.
             * But WITH a key the theme information isn't respected any longer... this
             * is probably a Monaco bug, which we need to file. Related:
             * https://github.com/microsoft/monaco-editor/issues/1713
             */
            // key: selectedFile,
        };
        return jsx(
            Panel,
            {
                headerText: 'CODE',
                id: 'codePane',
                class: localStorage.getItem('codePaneCollapsed') === 'true' ? 'collapsed' : null,
                resizable: 'left',
                resizeMax: 2000
            },
            jsx('div', {
                className: 'panel-toggle',
                id: 'codePane-panel-toggle'
            }),
            jsx(
                Container,
                {
                    class: 'tabs-wrapper'
                },
                jsx(
                    Container,
                    {
                        class: 'code-editor-menu-container'
                    },
                    jsx(Button, {
                        id: 'play-button',
                        icon: 'E304',
                        text: '',
                        onClick: () => iframe.fire('hotReload')
                    }),
                    jsx(Button, {
                        icon: 'E259',
                        text: '',
                        onClick: () => {
                            const examplePath =
                                location.hash === '#/' ? 'misc/hello-world' : location.hash.replace('#/', '');
                            window.open(
                                `https://github.com/playcanvas/engine/blob/main/examples/src/examples/${examplePath}.mjs`
                            );
                        }
                    })
                ),
                jsx(
                    Container,
                    {
                        class: 'tabs-container'
                    },
                    this.renderTabs()
                )
            ),
            jsx(MonacoEditor, options)
        );
    }
}

export { CodeEditor };
