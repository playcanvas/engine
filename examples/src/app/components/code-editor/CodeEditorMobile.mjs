import MonacoEditor from '@monaco-editor/react';

import { CodeEditorBase } from './CodeEditorBase.mjs';

import { jsx } from '../../jsx.mjs';

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {Record<string, any>} Props
 */

class CodeEditorMobile extends CodeEditorBase {
    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        if (props.files) {
            this.state.files = props.files;
        }
    }

    render() {
        const { files, selectedFile, showMinimap } = this.state;
        const options = {
            className: 'code-editor-mobile',
            value: files[selectedFile],
            language: 'javascript',
            beforeMount: this.beforeMount.bind(this),
            onMount: this.editorDidMount.bind(this),
            options: {
                theme: 'playcanvas',
                readOnly: true,
                minimap: {
                    enabled: showMinimap
                }
            }
        };

        return jsx(MonacoEditor, options);
    }
}

export { CodeEditorMobile };
