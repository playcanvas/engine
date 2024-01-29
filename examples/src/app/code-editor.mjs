import { Component } from 'react';
import { Button, Container, Panel } from '@playcanvas/pcui/react';
import { pcTypes } from '../assetPath.mjs';
import { jsx } from './jsx.mjs';
import MonacoEditor, { loader } from "@monaco-editor/react";
import { iframeHotReload, iframeRequestFiles, iframeResize } from './iframeUtils.mjs';
import { removeRedundantSpaces } from './helpers/strings.mjs';

loader.config({ paths: { vs: './modules/monaco-editor/min/vs' } });

function getShowMinimap() {
    let showMinimap = true;
    if (localStorage.getItem("showMinimap")) {
        showMinimap = localStorage.getItem("showMinimap") === 'true' ? true : false;
    }
    return showMinimap;
}

const FILE_TYPE_LANGUAGES = {
    'json': 'json',
    'shader': null,
    'vert': null,
    'frag': null,
    'javascript': 'javascript',
    'js': 'javascript',
    'mjs': 'javascript',
};

let monacoEditor;

/**
 * @typedef {object} Props
 */

/**
 * @typedef {object} State
 * @property {Record<string, string>} files
 * @property {string} selectedFile
 * @property {boolean} showMinimap
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class CodeEditor extends TypedComponent {
    /** @type {State} */
    state = {
        files: {'example.mjs': '// init'},
        selectedFile: 'example.mjs',
        showMinimap: getShowMinimap()
    };

    /**
     * @param {Partial<State>} state - New partial state.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    componentDidMount() {
        this.handleExampleLoad = this.handleExampleLoad.bind(this);
        this.handleExampleLoading = this.handleExampleLoading.bind(this);
        this.handleRequestedFiles = this.handleRequestedFiles.bind(this);
        window.addEventListener('exampleLoad', this.handleExampleLoad);
        window.addEventListener('exampleLoading', this.handleExampleLoading);
        window.addEventListener("requestedFiles", this.handleRequestedFiles);
        iframeRequestFiles();
    }

    componentWillUnmount() {
        window.removeEventListener("exampleLoad", this.handleExampleLoad);
        window.removeEventListener("exampleLoading", this.handleExampleLoading);
        window.removeEventListener("requestedFiles", this.handleRequestedFiles);
    }

    handleExampleLoad(event) {
        // console.log("CodeEditor got files event", event);
        /** @type {Record<string, string>} */
        const files = event.files;
        this.mergeState({ files, selectedFile: 'example.mjs' });
    }

    handleExampleLoading(event) {
        this.mergeState({
            files: {'example.mjs': '// reloading'}
        });
    }

    handleRequestedFiles(event) {
        const files = event.detail;
        this.mergeState({ files });
    }

    /**
     * @param {import('@monaco-editor/react').Monaco} monaco 
     */
    beforeMount(monaco) {
        fetch(pcTypes).then((r) => {
            return r.text();
        }).then((playcanvasDefs) => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
                playcanvasDefs,
                '@playcanvas/playcanvas.d.ts'
            );
            monaco.languages.typescript.javascriptDefaults.addExtraLib(
                playcanvasDefs,
                '@playcanvas/playcanvas.d.ts'
            );
        });
    }

    /**
     * @param {import('monaco-editor').editor.IStandaloneCodeEditor} editor
     */
    editorDidMount(editor) {
        window.editor = editor;
        monacoEditor = editor;
        // Hot reload code via Shift + Enter
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, iframeHotReload);
        const codePane = document.getElementById('codePane');
        codePane.classList.add('multiple-files');
        if (!this.state.files[this.state.selectedFile]) {
            this.mergeState({
                selectedFile: 'example.mjs',
            });
        }
        // @ts-ignore
        codePane.ui.on('resize', () => {
            localStorage.setItem('codePaneStyle', codePane.getAttribute('style'));
        });
        const codePaneStyle = localStorage.getItem('codePaneStyle');
        if (codePaneStyle) {
            codePane.setAttribute('style', codePaneStyle);
        }
        // set up the code panel toggle button
        const panelToggleDiv = codePane.querySelector('.panel-toggle');
        panelToggleDiv.addEventListener('click', function () {
            codePane.classList.toggle('collapsed');
            localStorage.setItem('codePaneCollapsed', codePane.classList.contains('collapsed') ? 'true' : 'false');
        });
        // register Monaco commands (you can access them by pressing f1)
        // Toggling minimap is only six key strokes: F1 mini enter (even "F1 mi enter" works)
        editor.addAction({
            id: 'view-toggle-minimap',
            label: 'View: Toggle Minimap',
            // keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            // contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            run: (editor) => {
                const showMinimap = !getShowMinimap();
                localStorage.setItem("showMinimap", `${showMinimap}`);
                this.mergeState({ showMinimap });
            }
        });
    }

    /**
     * @param {string} value 
     */
    onChange(value) {
        const { files, selectedFile } = this.state;
        files[selectedFile] = value;
        const event = new CustomEvent("updateFiles", {
            detail: {
                files
            }
        });
        window.dispatchEvent(event);
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
                onClick: () => this.selectFile(name),
            });
            tabs.push(button);
        }
        return tabs;
    }

    render() {
        setTimeout(iframeResize, 50);
        const { files, selectedFile, showMinimap } = this.state;
        const language = FILE_TYPE_LANGUAGES[selectedFile.split('.').pop()];
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
            beforeMount: this.beforeMount.bind(this),
            onMount: this.editorDidMount.bind(this),
            onChange: this.onChange.bind(this),
            options: {
                scrollbar: {
                    horizontal: 'visible'
                },
                readOnly: false,
                theme: 'vs-dark',
                minimap: {
                    enabled: showMinimap
                }
            },
            /**
             * @todo Without a key the syntax highlighting mode isn't updated.
             * But WITH a key the theme information isn't respected any longer... this
             * is probably a Monaco bug, which we need to file. Related:
             * https://github.com/microsoft/monaco-editor/issues/1713
            */
            //key: selectedFile,
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
            jsx(
                "div",
                {
                    className: 'panel-toggle',
                    id: 'codePane-panel-toggle'
                }
            ),
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
                    jsx(
                        Button,
                        {
                            id: 'play-button',
                            icon: 'E304',
                            text: '',
                            onClick: iframeHotReload
                        }
                    ),
                    jsx(
                        Button, {
                            icon: 'E259',
                            text: '',
                            onClick: () => {
                                const examplePath = location.hash === '#/' ? 'misc/hello-world' : location.hash.replace('#/', '');
                                window.open(`https://github.com/playcanvas/engine/blob/dev/examples/src/examples/${examplePath}.mjs`);
                            }
                        }
                    )
                ),
                jsx(
                    Container,
                    {
                        class: 'tabs-container'
                    },
                    this.renderTabs(),
                )
            ),
            jsx(MonacoEditor, options)
        );
    };
}

export { CodeEditor };
