import { Component } from 'react';
import { Button, Container, Panel } from '@playcanvas/pcui/react';
import { pcTypes } from '../assetPath.mjs';
import { jsx } from './jsx.mjs';
import MonacoEditor from "@monaco-editor/react";

const FILE_TYPE_LANGUAGES = {
    'json': 'json',
    'shader': null,
    'javascript': 'javascript',
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
 */

/** @type {typeof Component<Props, State>} TypedComponent */
const TypedComponent = Component;

class CodeEditor extends TypedComponent {
    /** @type {State} */
    state = {
        files: {'example.mjs': '// init'},
        selectedFile: 'example.mjs',
    };

    /**
     * @param {Partial<State>} state - New partial state.
     */
    mergeState(state) {
        this.setState({ ...this.state, ...state });
    }

    componentDidMount() {
        window.addEventListener('exampleLoad', (event) => {
            // console.log("CodeEditor got files event", event);
            /** @type {Record<string, string>} */
            const files = event.files;
            this.mergeState({
                files: {...files}
            });
            document.querySelector(".spin").style.display = 'none';
        });
        window.addEventListener('exampleLoading', (e) => {
            this.mergeState({
                files: {'example.mjs': '// reloading'}
            });
            document.querySelector(".spin").style.display = '';
        });
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

    editorDidMount(editor) {
        window.editor = editor;
        monacoEditor = editor;
        // Hot reload code via Shift + Enter
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, this.onPlayButton.bind(this));
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
    }

    onPlayButton() {
        const { files } = this.state;
        // @ts-ignore
        const frameWindow = document.getElementById('exampleIframe').contentWindow;
        frameWindow.eval(`
            app.destroy();
            const editedFiles = ${JSON.stringify(files)};
            main(editedFiles);
        `);
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
        const { files, selectedFile } = this.state;
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
                            onClick: () => this.onPlayButton()
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
            jsx(
                MonacoEditor,
                {
                    language: FILE_TYPE_LANGUAGES[selectedFile.split('.').pop()],
                    //language: "javascript",
                    value: files[selectedFile],
                    beforeMount: this.beforeMount.bind(this),
                    onMount: this.editorDidMount.bind(this),
                    onChange: this.onChange.bind(this),
                    options: {
                        scrollbar: {
                            horizontal: 'visible'
                        },
                        readOnly: false,
                        theme: "vs-dark",
                    }
                }
            )
        );
    };
}

export { CodeEditor };
