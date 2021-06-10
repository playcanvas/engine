import React, { useState } from 'react';
// @ts-ignore: library file import
import { playcanvasTypeDefs } from './helpers/raw-file-loading';
import MonacoEditor from "@monaco-editor/react";
// @ts-ignore: library file import
import { Panel, Container, Button } from '@playcanvas/pcui/pcui-react';

const ControlPanel = (props: any) => {
    const [state, setState] = useState({
        showParameters: !!props.controls,
        showCode: !props.controls,
        collapsed: document.body.offsetWidth < 601
    });
    const beforeMount = (monaco: any) => {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            playcanvasTypeDefs,
            '@playcanvas/playcanvas.d.ts'
        );
    };
    const onClickParametersTab = () => {
        if (document.getElementById('paramButton').classList.contains('selected')) {
            return;
        }
        setState({
            showParameters: true,
            showCode: false,
            collapsed: false
        });
        document.getElementById('paramButton').classList.toggle('selected');
        document.getElementById('codeButton').classList.toggle('selected');
        const controls = document.getElementById('controlPanel-controls');
        // @ts-ignore
        controls.ui.hidden = !controls.ui.hidden;
    };
    const onClickCodeTab = () => {
        if (document.getElementById('codeButton').classList.contains('selected')) {
            return;
        }
        setState({
            showParameters: false,
            showCode: true,
            collapsed: false
        });
        document.getElementById('paramButton').classList.toggle('selected');
        document.getElementById('codeButton').classList.toggle('selected');
        const controls = document.getElementById('controlPanel-controls');
        // @ts-ignore
        controls.ui.hidden = !controls.ui.hidden;
    };

    return <Panel id='controlPanel' class={[!props.controls ? 'empty' : 'null', window.top.innerWidth < 601 ? 'mobile' : null]} resizable='top' headerText='CONTROLS' collapsible={true} collapsed={state.collapsed}>
        <Container id= 'controlPanel-tabs' class='tabs-container'>
            {props.controls && <Button text='PARAMETERS' class={state.showParameters ? 'selected' : null} id='paramButton' onClick={onClickParametersTab} /> }
            <Button text='CODE' id='codeButton' class={state.showCode ? 'selected' : null} onClick={onClickCodeTab}/>
        </Container>
        <Container id='controlPanel-controls'>
            { props.controls }
        </Container>
        { document.body.offsetWidth < 601 && state.showCode && <MonacoEditor
            options={{
                readOnly: true
            }}
            defaultLanguage="typescript"
            beforeMount={beforeMount}
            value={props.files ? props.files[0].text : ''}
        />
        }
    </Panel>;
};

export default ControlPanel;
