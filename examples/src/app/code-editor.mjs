import * as React from 'react';
import { LegacyRef, useEffect, useState } from 'react';
import MonacoEditor from "@monaco-editor/react";
import { Button, Container, Panel } from '@playcanvas/pcui/react';
//import { File } from './helpers/types';
import formatters from './helpers/formatters.mjs';
import { pcTypes } from '../assetPath.mjs';

const FILE_TYPE_LANGUAGES = {
    'json': 'json',
    'shader': null,
    'javascript': 'javascript',
};

let monacoEditor;

/**
 * @typedef {object} CodeEditorProps
 * @property {File[]} files
 * @property {(value: Array<File>) => void} setFiles
 * @property {(value: boolean) => void} setLintErrors
 * @property {boolean} lintErrors
 * @property {LegacyRef<any>} playButtonRef
 */

/**
 * @param {CodeEditorProps} props
 */
const CodeEditor = (props) => {
    /** @type {File[]} */
    const files = JSON.parse(JSON.stringify(props.files));
    const [selectedFile, setSelectedFile] = useState(0);

    const beforeMount = (monaco) => {
        // todo: props
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
    };

    const editorDidMount = (editor) => {
        monacoEditor = editor;
    };

    /**
     * @param {string} value 
     */
    const onChange = (value) => {
        files[selectedFile].text = value;
        props.setFiles(files);
        const exampleFunction = files[0].text;
        const val = exampleFunction;
        //console.log("onChange val", val);
        window.localStorage.setItem(
            window.location.hash.replace('#', ''),
            exampleFunction
        );
        if (files.length > 1) {
            window.editedFiles = {};
            files.slice(1).forEach((f) => {
                window.editedFiles[f.name] = f.text;
            });
        }
    };

    /**
     * @param {any[]} markers 
     */
    const onValidate = (markers) => {
        // filter out markers which are warnings
        if (markers.filter(m => m.severity > 1).length === 0) {
            props.setLintErrors(false);
        } else {
            props.setLintErrors(true);
        }
    };

    /**
     * @param {number} selectedFileIndex 
     */
    const selectFile = (selectedFileIndex) => {
        setSelectedFile(selectedFileIndex);
        monacoEditor?.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
        document.querySelectorAll('#codePane .tabs-container .pcui-button').forEach((node, i) => {
            if (selectedFileIndex === i) {
                node.classList.add('selected');
            } else {
                node.classList.remove('selected');
            }
        });
    };

    useEffect(() => {
        const codePane = document.getElementById('codePane');
        codePane.classList.add('multiple-files');
        if (!files[selectedFile]) {
            setSelectedFile(0);
        }
        // @ts-ignore
        codePane.ui.on('resize', () => {
            localStorage.setItem('codePaneStyle', codePane.getAttribute('style'));
        });
        const codePaneStyle = localStorage.getItem('codePaneStyle');
        if (codePaneStyle) {
            codePane.setAttribute('style', codePaneStyle);
        }
        if (window.toggleEvent) {
            return;
        }
        // set up the code panel toggle button
        const panelToggleDiv = codePane.querySelector('.panel-toggle');
        panelToggleDiv.addEventListener('click', function () {
            codePane.classList.toggle('collapsed');
            localStorage.setItem('codePaneCollapsed', codePane.classList.contains('collapsed') ? 'true' : 'false');
        });
        window.toggleEvent = true;
    });
    return React.createElement(
        Panel,
        {
            headerText: 'CODE',
            id: 'codePane',
            class: localStorage.getItem('codePaneCollapsed') === 'true' ? 'collapsed' : null,
            resizable: 'left',
            resizeMax: 2000
        },
        React.createElement(
            "div",
            {
                className: 'panel-toggle',
                id: 'codePane-panel-toggle'
            }
        ),
        React.createElement(
            Container,
            {
                class: 'tabs-wrapper'
            },
            React.createElement(
                Container,
                {
                    class: 'code-editor-menu-container'
                },
                React.createElement(
                    Button,
                    {
                        id: 'play-button',
                        //enabled: !props.lintErrors,
                        icon: 'E304',
                        text: '',
                        ref: props.playButtonRef
                    }
                ),
                React.createElement(
                    Button, {
                        icon: 'E259',
                        text: '',
                        onClick: () => {
                            const examplePath = location.hash === '#/' ? 'misc/hello-world' : location.hash.replace('#/', '');
                            window.open(`https://github.com/playcanvas/engine/blob/dev/examples/src/examples/${examplePath}.tsx`);
                        }
                    }
                )
            ),
            React.createElement(
                Container,
                {
                    class: 'tabs-container'
                },
                props.files.map((file, index) => {
                    return React.createElement(Button, {
                        key: index,
                        id: `code-editor-file-tab-${index}`,
                        text: file.name.indexOf('.') === -1 ? `${file.name}.${file.type}` : file.name,
                        class: index === selectedFile ? 'selected' : null,
                        onClick: () => selectFile(index)
                    });
                })
            )
        ),
        React.createElement(
            MonacoEditor,
            {
                language: FILE_TYPE_LANGUAGES[files[selectedFile]?.type],
                //language: "javascript",
                value: files[selectedFile]?.text,
                beforeMount,
                onMount: editorDidMount,
                onChange,
                onValidate,
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
export {
    CodeEditor
};
