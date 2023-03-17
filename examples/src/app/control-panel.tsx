import React, { useEffect, useState } from 'react';
import MonacoEditor from "@monaco-editor/react";
import { Button, Container } from '@playcanvas/pcui/react';
import { MIN_DESKTOP_WIDTH } from './constants';

const ControlPanel = (props: any) => {
    const [state, setState] = useState({
        showParameters: false,
        showCode: true,
        collapsed: window.top.innerWidth < MIN_DESKTOP_WIDTH
    });
    const onClickParametersTab = () => {
        if (document.getElementById('paramButton').classList.contains('selected')) {
            return;
        }
        setState({
            showParameters: true,
            showCode: false,
            collapsed: false
        });
        document.getElementById('paramButton').classList.add('selected');
        document.getElementById('codeButton').classList.remove('selected');
        const controls = document.getElementById('controlPanel-controls');
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
        document.getElementById('paramButton').classList.remove('selected');
        document.getElementById('codeButton').classList.add('selected');
        const controls = document.getElementById('controlPanel-controls');
        controls.classList.add('pcui-hidden');
    };

    useEffect(() => {
        if (window.top.innerWidth < MIN_DESKTOP_WIDTH) {
            // @ts-ignore
            document.getElementById('controlPanel-controls').ui.hidden = true;
        }
        if (window.top.location.hash.indexOf('#/iframe') === 0) {
            // @ts-ignore
            document.getElementById('controlPanel').ui.hidden = true;
        }
    });

    return <Container id='controls-wrapper' class={props.controls ? 'has-controls' : null}>
        { window.top.innerWidth < MIN_DESKTOP_WIDTH && props.controls && <Container id= 'controlPanel-tabs' class='tabs-container'>
            <Button text='CODE' id='codeButton' class={state.showCode ? 'selected' : null} onClick={onClickCodeTab}/>
            <Button text='PARAMETERS' class={state.showParameters ? 'selected' : null} id='paramButton' onClick={onClickParametersTab} />
        </Container>
        }
        <Container id='controlPanel-controls'>
            { props.controls }
        </Container>
        { window.top.innerWidth < MIN_DESKTOP_WIDTH && state.showCode && <MonacoEditor
            options={{
                readOnly: true
            }}
            defaultLanguage="typescript"
            value={props.files ? props.files[0].text : ''}
        />
        }
    </Container>;
};

export default ControlPanel;
