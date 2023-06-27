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
    'typescript': 'typescript'
};

let monacoEditor;

/**
 * @typedef {object} CodeEditorProps
 * @property {File[]} files
 * @property {(value: Array<File>) => void} setFiles
 * @property {(value: boolean) => void} setLintErrors
 * @property {boolean} useTypeScript
 * @property {boolean} lintErrors
 * @property {LegacyRef<any>} languageButtonRef
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

        let exampleFunction;
        if (props.useTypeScript) {
            exampleFunction = files[1].text;
        } else {
            exampleFunction = files[0].text;
        }
        window.localStorage.setItem(window.location.hash.replace('#', ''), formatters.getInnerFunctionText(exampleFunction));
        if (files.length > 2) {
            (window).editedFiles = {};
            files.slice(2).forEach((f) => {
                (window).editedFiles[f.name] = f.text;
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
        if (!files[selectedFile]) setSelectedFile(props.useTypeScript ? 1 : 0);
        if (props.useTypeScript && selectedFile === 0) {
            selectFile(1);
        } else if (!props.useTypeScript && selectedFile === 1) {
            selectFile(0);
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
    /*
    return <Panel headerText='CODE' id='codePane' class={localStorage.getItem('codePaneCollapsed') === 'true' ? 'collapsed' : null} resizable='left' resizeMax={2000}>
        <div className='panel-toggle' id='codePane-panel-toggle'/>
        <Container class='tabs-wrapper'>
            <Container class='code-editor-menu-container'>
                <Button id='play-button' enabled={!props.lintErrors} icon='E304' text='' ref={props.playButtonRef} />
                <Button id='language-button' text={props.useTypeScript ? 'JS' : 'TS'} ref={props.languageButtonRef} />
                <Button icon='E259' text='' onClick={() => {
                    const examplePath = location.hash === '#/' ? 'misc/hello-world' : location.hash.replace('#/', '');
                    window.open(`https://github.com/playcanvas/engine/blob/dev/examples/src/examples/${examplePath}.tsx`);
                }}/>
            </Container>
            <Container class='tabs-container'>
                {props.files.map((file: File, index: number) => {
                    const hidden = (props.useTypeScript && index === 0 || !props.useTypeScript && index === 1);
                    return <Button key={index} id={`code-editor-file-tab-${index}`} hidden={hidden} text={file.name.indexOf('.') === -1 ? `${file.name}.${file.type}` : file.name} class={index === selectedFile ? 'selected' : null} onClick={() => selectFile(index)}/>;
                })}
            </Container>
        </Container>
        <MonacoEditor
            language={FILE_TYPE_LANGUAGES[files[selectedFile]?.type]}
            value={files[selectedFile]?.text}
            beforeMount={beforeMount}
            onMount={editorDidMount}
            onChange={onChange}
            onValidate={onValidate}
            options={{
                scrollbar: {
                    horizontal: 'visible'
                },
                readOnly: false
            }}
        />
    </Panel>;
    */
    return React.createElement(Panel, { headerText: 'CODE', id: 'codePane', class: localStorage.getItem('codePaneCollapsed') === 'true' ? 'collapsed' : null, resizable: 'left', resizeMax: 2000 },
    React.createElement("div", { className: 'panel-toggle', id: 'codePane-panel-toggle' }),
    React.createElement(Container, { class: 'tabs-wrapper' },
        React.createElement(Container, { class: 'code-editor-menu-container' },
            React.createElement(Button, { id: 'play-button', enabled: !props.lintErrors, icon: 'E304', text: '', ref: props.playButtonRef }),
            React.createElement(Button, { id: 'language-button', text: props.useTypeScript ? 'JS' : 'TS', ref: props.languageButtonRef }),
            React.createElement(Button, { icon: 'E259', text: '', onClick: () => {
                    const examplePath = location.hash === '#/' ? 'misc/hello-world' : location.hash.replace('#/', '');
                    window.open(`https://github.com/playcanvas/engine/blob/dev/examples/src/examples/${examplePath}.tsx`);
                } })),
        React.createElement(Container, { class: 'tabs-container' }, props.files.map((file, index) => {
            const hidden = (props.useTypeScript && index === 0 || !props.useTypeScript && index === 1);
            return React.createElement(Button, { key: index, id: `code-editor-file-tab-${index}`, hidden: hidden, text: file.name.indexOf('.') === -1 ? `${file.name}.${file.type}` : file.name, class: index === selectedFile ? 'selected' : null, onClick: () => selectFile(index) });
        }))),
    React.createElement(MonacoEditor, {
        //language: FILE_TYPE_LANGUAGES[files[selectedFile]?.type],
        language: "javascript",
        value: files[selectedFile]?.text,
        beforeMount: beforeMount,
        onMount: editorDidMount,
        onChange: onChange,
        onValidate: onValidate,
        options: {
            scrollbar: {
                horizontal: 'visible'
            },
            readOnly: false,
            theme: "vs-dark",
        } }));   
};

export {
    CodeEditor
};
export default CodeEditor;
