import React, { useEffect, useState } from 'react';
import MonacoEditor from "@monaco-editor/react";
// @ts-ignore: library file import
import { Panel, Container, Button } from '@playcanvas/pcui/pcui-react';
import { playcanvasTypeDefs } from './helpers/raw-file-loading';
import { File } from './helpers/types';

const FILE_TYPE_LANGUAGES: any = {
    'json': 'json',
    'shader': null
};


let monacoEditor: any;

interface CodeEditorProps {
    files: Array<File>,
    setFiles: (value: Array<File>) => void,
    setLintErrors: (value: boolean) => void,
}

const CodeEditor = (props: CodeEditorProps) => {
    const files: Array<File> = JSON.parse(JSON.stringify(props.files));
    const [selectedFile, setSelectedFile] = useState(0);

    const beforeMount = (monaco: any) => {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            playcanvasTypeDefs,
            '@playcanvas/playcanvas.d.ts'
        );
    };

    const editorDidMount = (editor: any) => {
        monacoEditor = editor;
    };

    const onChange = (value: string) => {
        files[selectedFile].text = value;
        if (selectedFile !== 0) {
            props.setFiles(files);
            props.setLintErrors(false);
        }
    };

    const onValidate = (markers: Array<any>) => {
        // filter out markers which are warnings
        if (markers.filter((m) => m.severity > 1).length === 0) {
            props.setFiles(files);
            props.setLintErrors(false);
        } else {
            props.setLintErrors(true);
        }
    };

    const selectFile = (selectedFileIndex: number) => {
        setSelectedFile(selectedFileIndex);
        monacoEditor?.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
        document.querySelectorAll('#codePane .tabs-container .pcui-button').forEach((node: HTMLElement, i: number) => {
            if (selectedFileIndex === i) {
                node.classList.add('selected');
            } else {
                node.classList.remove('selected');
            }
        });
    };

    useEffect(() => {
        const codePane = document.getElementById('codePane');
        if (files.length > 1) {
            codePane.classList.add('multiple-files');
        } else {
            codePane.classList.remove('multiple-files');
        }
        if (!files[selectedFile]) setSelectedFile(0);
        if ((window as any).toggleEvent) return;
        // set up the code panel toggle button
        const panelToggleDiv = codePane.querySelector('.panel-toggle');
        panelToggleDiv.addEventListener('click', function () {
            codePane.classList.toggle('collapsed');
            localStorage.setItem('codePaneCollapsed', codePane.classList.contains('collapsed') ? 'true' : 'false');
        });
        (window as any).toggleEvent = true;
    });

    return <Panel headerText='CODE' id='codePane' class={localStorage.getItem('codePaneCollapsed') !== 'false' ? 'collapsed' : null}>
        <div className='panel-toggle' id='codePane-panel-toggle'/>
        { props.files && props.files.length > 1 && <Container class='tabs-container'>
            {props.files.map((file: File, index: number) => {
                return <Button key={index} id={`code-editor-file-tab-${index}`} text={file.name.indexOf('.') === -1 ? `${file.name}.${file.type}` : file.name} class={index === selectedFile ? 'selected' : ''} onClick={() => selectFile(index)}/>;
            })}
        </Container>
        }
        <MonacoEditor
            language={selectedFile === 0 ? "typescript" : FILE_TYPE_LANGUAGES[files[selectedFile]?.type]}
            value={files[selectedFile]?.text}
            beforeMount={beforeMount}
            onMount={editorDidMount}
            onChange={onChange}
            onValidate={onValidate}
            options={{
                scrollbar: {
                    horizontal: 'visible'
                }
            }}
        />
    </Panel>;
};

export default CodeEditor;
