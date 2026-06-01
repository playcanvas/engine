import { Button, Container } from '@playcanvas/pcui/react';

import { CodeEditorBase } from './CodeEditorBase.mjs';
import { jsx } from '../../jsx.mjs';

/**
 * @typedef {object} Props
 * @property {Record<string, string>} files - Files of example.
 * @property {string} category - Example category.
 * @property {string} example - Example name.
 */

const GITHUB_ROOT = 'https://github.com/playcanvas/engine/blob/main';

/**
 * @param {string} example - Example name.
 * @param {string} file - File suffix.
 * @returns {string} Source file name.
 */
const sourceName = (example, file) => `${example}.${file}`;

/**
 * @param {string} category - Example category.
 * @param {string} example - Example name.
 * @param {string} file - File suffix.
 * @returns {string} Source URL.
 */
const sourceUrl = (category, example, file) => `${GITHUB_ROOT}/examples/src/examples/${category}/${sourceName(example, file)}`;

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
        const { category, example } = this.props;
        const files = this.props.files ?? this.state.files;
        const names = Object.keys(files);

        return jsx(
            Container,
            {
                class: 'code-editor-mobile'
            },
            jsx(
                Container,
                {
                    class: 'code-editor-mobile-files'
                },
                names.map(name => jsx(Button, {
                    key: name,
                    text: name,
                    onClick: () => window.open(sourceUrl(category, example, name))
                }))
            )
        );
    }
}

export { CodeEditorMobile };
