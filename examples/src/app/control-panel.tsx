import React, { useEffect, useState } from 'react';
// @ts-ignore: library file import
import { playcanvasTypeDefs } from './helpers/raw-file-loading';
import MonacoEditor from "@monaco-editor/react";
// @ts-ignore: library file import
import Panel from '@playcanvas/pcui/Panel/component';
// @ts-ignore: library file import
import Container from '@playcanvas/pcui/Container/component';
// @ts-ignore: library file import
import Button from '@playcanvas/pcui/Button/component';

const ControlPanel = (props: any) => {
    const [state, setState] = useState({
        showParameters: false,
        showCode: true,
        collapsed: window.top.innerWidth < 601
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
        controls.classList.remove('pcui-hidden');
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
        controls.classList.add('pcui-hidden');
    };

    useEffect(() => {
        if (window.top.innerWidth < 601) {
            // @ts-ignore
            document.getElementById('controlPanel-controls').ui.hidden = true;
        }
        if (window.top.location.hash.indexOf('#/iframe') === 0) {
            // @ts-ignore
            document.getElementById('controlPanel').ui.hidden = true;
        }
    });

    return <Panel id='controlPanel' class={[window.top.innerWidth > 600 && !props.controls ? 'empty' : 'null', window.top.innerWidth < 601 ? 'mobile' : null]} resizable='top' headerText={window.top.innerWidth < 601 ? (props.controls ? 'CODE & CONTROLS' : 'CODE') : 'CONTROLS'} collapsible={true} collapsed={state.collapsed}>
        { window.top.innerWidth < 601 && props.controls && <Container id= 'controlPanel-tabs' class='tabs-container'>
            <Button text='CODE' id='codeButton' class={state.showCode ? 'selected' : null} onClick={onClickCodeTab}/>
            <Button text='PARAMETERS' class={state.showParameters ? 'selected' : null} id='paramButton' onClick={onClickParametersTab} />
        </Container>
        }
        <Container id='controlPanel-controls'>
            { props.controls }
        </Container>
        { window.top.innerWidth < 601 && state.showCode && <MonacoEditor
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
