import { LegacyRef, createRef, useEffect, useState } from 'react';
import MonacoEditor from "@monaco-editor/react";
import { Button, Container, Panel } from '@playcanvas/pcui/react';
import { pcTypes } from '../assetPath.mjs';
import { fragment, jsx } from './jsx.mjs';

const FILE_TYPE_LANGUAGES = {
    'json': 'json',
    'shader': null,
    'javascript': 'javascript',
    'mjs': 'javascript',
};

let monacoEditor;

function ObjectMap(object, fn) {
    const ret = [];
    for (const key in object) {
        const value = object[key];
        ret.push(fn(key, value));
    }
    return ret;
}

/**
 * @typedef {object} CodeEditorProps
 * @property {(value: boolean) => void} setLintErrors
 * @property {boolean} lintErrors
 */

/**
 * @param {CodeEditorProps} props
 */
const CodeEditor = (props) => {
    const [files, setFiles] = useState({'example.mjs': '// init'});
    const [selectedFile, setSelectedFile] = useState('example.mjs');

    const stateRefFiles = useRef();
    // make stateRef always have the current files
    // your "fixed" callbacks can refer to this object whenever
    // they need the current value.  Note: the callbacks will not
    // be reactive - they will not re-run the instant state changes,
    // but they *will* see the current value whenever they do run
    stateRefFiles.current = files;

    window.addEventListener('exampleLoad', (event) => {
        // console.log("CodeEditor got files event", event);
        /** @type {Record<string, string>} */
        const files = event.files;
        setFiles({...files});
    });


    window.addEventListener('exampleLoading', (e) => {
        setFiles({'example.mjs': '// reloading'});
    });

    /**
     * @param {import('@monaco-editor/react').Monaco} monaco 
     */
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
        window.editor = editor;
        monacoEditor = editor;
    };

    const onPlayButton = () => {
        const files = stateRefFiles.current;
        // @ts-ignore
        const frameWindow = document.getElementById('exampleIframe').contentWindow;
        // console.log("got files", files);
        //frameWindow.location.reload();
        //frameWindow.app.destroy();
        //frameWindow.exampleString = files["example.mjs"];
        //frameWindow.eval("example = Function('return ' + exampleString)()");
        frameWindow.eval("app.destroy();");
        frameWindow.eval("editedFiles = " + JSON.stringify(files));
        frameWindow.eval("main(editedFiles)");
    }

    /**
     * @param {string} value 
     */
    const onChange = (value) => {
        files[selectedFile] = value;
        const event = new CustomEvent("updateFiles", {
            detail: {
                files
            }
        });
        window.dispatchEvent(event);
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
     * @param {string} name
     */
    const selectFile = (name) => {
        setSelectedFile(name);
        monacoEditor?.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
        //document.querySelectorAll('#codePane .tabs-container .pcui-button').forEach((node, i) => {
        //    if (selectedFileIndex === i) {
        //        node.classList.add('selected');
        //    } else {
        //        node.classList.remove('selected');
        //    }
        //});
    };

    useEffect(() => {
        const codePane = document.getElementById('codePane');
        codePane.classList.add('multiple-files');
        if (!files[selectedFile]) {
            setSelectedFile('example.mjs');
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
                        //enabled: !props.lintErrors,
                        icon: 'E304',
                        text: '',
                        onClick: () => onPlayButton()
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
                ObjectMap(files, (name, text) => {
                    const ext = name.split('.').pop();
                    const button = jsx(Button, {
                        key: name,
                        id: `code-editor-file-tab-${name}`,
                        text: name,
                        class: name === selectedFile ? 'selected' : null,
                        onClick: () => selectFile(name)
                    });
                    return button;
                })
            )
        ),
        jsx(
            MonacoEditor,
            {
                language: FILE_TYPE_LANGUAGES[selectedFile.split('.').pop()],
                //language: "javascript",
                value: files[selectedFile],
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
export { CodeEditor };
