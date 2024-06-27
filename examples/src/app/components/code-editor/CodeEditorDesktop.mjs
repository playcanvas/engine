import { Button, Container, Panel } from '@playcanvas/pcui/react';
import MonacoEditor, { loader } from '@monaco-editor/react';

import { CodeEditorBase } from './CodeEditorBase.mjs';

import { jsx } from '../../jsx.mjs';
import { iframe } from '../../iframe.mjs';
import { removeRedundantSpaces } from '../../strings.mjs';

/** @typedef {import('../../events.js').StateEvent} StateEvent */

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
    javascript: 'javascript',
    js: 'javascript',
    mjs: 'javascript',
    html: 'html',
    css: 'css',
    shader: 'glsl',
    vert: 'glsl',
    frag: 'glsl',
    wgsl: 'wgsl',
    txt: 'text'
};

/**
 * @type {import('monaco-editor').editor.IStandaloneCodeEditor}
 */
let monacoEditor;

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {Record<string, any>} Props
 */

class CodeEditorDesktop extends CodeEditorBase {
    /** @type {string[]} */
    _decorators = [];

    /** @type {Map<string, object[]>} */
    _decoratorMap = new Map();

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._handleExampleHotReload = this._handleExampleHotReload.bind(this);
        this._handleExampleError = this._handleExampleError.bind(this);
        this._handleRequestedFiles = this._handleRequestedFiles.bind(this);
    }

    /**
     * @param {ErrorEvent} event - The event.
     */
    _handleExampleError(event) {
        const editor = window.editor;
        if (!editor) {
            return;
        }
        const monaco = window.monaco;

        const { name, message, locations } = event.detail;
        const { line, column } = locations[0];

        const messageMarkdown = `**${name}: ${message}** [Ln ${line}, Col ${column}]`;
        const lineText = editor.getModel().getLineContent(line);
        const decorator = {
            range: new monaco.Range(line, 0, line, lineText.length),
            options: {
                className: 'squiggly-error',
                hoverMessage: {
                    value: messageMarkdown
                }
            }
        };
        this._decoratorMap.set(this.state.selectedFile, [decorator]);
        this._refreshDecorators();

    }

    _refreshDecorators() {
        if (!monacoEditor) {
            return;
        }
        this._decorators = monacoEditor.deltaDecorations(this._decorators, this._decoratorMap.get(this.state.selectedFile) ?? []);
    }

    /**
     * @param {StateEvent} event - The event.
     */
    _handleRequestedFiles(event) {
        const { files } = event.detail;
        this.mergeState({ files });
    }

    _handleExampleHotReload() {
        this._decoratorMap.delete(this.state.selectedFile);
        this._refreshDecorators();
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
        super.componentDidMount();
        window.addEventListener('exampleHotReload', this._handleExampleHotReload);
        window.addEventListener('exampleError', this._handleExampleError);
        window.addEventListener('requestedFiles', this._handleRequestedFiles);
        iframe.fire('requestFiles');
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        window.removeEventListener('exampleHotReload', this._handleExampleHotReload);
        window.removeEventListener('exampleError', this._handleExampleError);
        window.removeEventListener('requestedFiles', this._handleRequestedFiles);
    }


    /**
     * @param {import('monaco-editor').editor.IStandaloneCodeEditor} editor - The monaco editor.
     */
    editorDidMount(editor) {
        super.editorDidMount(editor);

        // @ts-ignore
        window.editor = editor;
        monacoEditor = editor;
        // @ts-ignore
        const monaco = window.monaco;

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
        monacoEditor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
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
        setTimeout(() => {
            iframe.fire('resize');
            this._refreshDecorators();
        }, 50);
        const { files, selectedFile, showMinimap } = this.state;
        const language = FILE_TYPE_LANGUAGES[selectedFile.split('.').pop() || 'text'];
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
            theme: 'playcanvas',
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

export { CodeEditorDesktop };
