import { useEffect, useState } from 'react';
import MonacoEditor from "@monaco-editor/react";
import { Container } from '@playcanvas/pcui/react';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { jsx, jsxButton } from './jsx.mjs';

/**
 * @typedef {import('react').FunctionComponent<{observer: import('@playcanvas/observer').Observer}>} ExampleControls
 */

/**
 * @typedef {object} ControlPanelProps
 * @property {ExampleControls} controls
 * @property {import('./code-editor.mjs').File[]} files
 */

/**
 * @param {ControlPanelProps} props - todo
 * @returns {JSX.Element} todo
 */
const ControlPanel = (props) => {
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
    return jsx(
        Container,
        {
            id: 'controls-wrapper',
            class: props.controls ? 'has-controls' : null
        },
        window.top.innerWidth < MIN_DESKTOP_WIDTH && props.controls && jsx(
            Container,
            {
                id: 'controlPanel-tabs',
                class: 'tabs-container'
            },
            jsxButton({
                text: 'CODE',
                id: 'codeButton',
                class: state.showCode ? 'selected' : null,
                onClick: onClickCodeTab
            }),
            jsxButton({
                text: 'PARAMETERS',
                class: state.showParameters ? 'selected' : null,
                id: 'paramButton',
                onClick: onClickParametersTab
            }),
        ),
        jsx(
            Container,
            {
                id: 'controlPanel-controls'
            },
            jsx(
                props.controls || null,
                {
                    observer: window.observerData
                }
            )
        ),
        window.top.innerWidth < MIN_DESKTOP_WIDTH && state.showCode && jsx(
            MonacoEditor,
            {
                options: {
                    readOnly: true
                },
                defaultLanguage: "typescript",
                value: props.files ? props.files[0].text : ''
            }
        )
    );
};

export default ControlPanel;
