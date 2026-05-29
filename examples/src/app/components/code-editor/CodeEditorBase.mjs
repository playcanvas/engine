import { loader } from '@monaco-editor/react';
import { Component } from 'react';

import { jsx } from '../../jsx.mjs';
import * as languages from '../../monaco/languages/index.mjs';
import { playcanvasTheme } from '../../monaco/theme.mjs';
import { jsRules } from '../../monaco/tokenizer-rules.mjs';
import { pcTypes } from '../../paths.mjs';
import { getSelectedFile, patchState } from '../../url-state.mjs';

/**
 * @import { Monaco } from '@monaco-editor/react'
 * @import { editor } from 'monaco-editor'
 * @import { ReactElement } from 'react'
 * @import { StateEvent } from '../../events.js'
 */

loader.config({ paths: { vs: './modules/monaco-editor/min/vs' } });

const EDITOR_DIRTY_EVENT = 'editorDirty';

function getShowMinimap() {
    let showMinimap = true;
    if (localStorage.getItem('showMinimap')) {
        showMinimap = localStorage.getItem('showMinimap') === 'true';
    }
    return showMinimap;
}


/**
 * @typedef {Record<string, any>} Props
 */

/**
 * @typedef {object} State
 * @property {Record<string, string>} files - The example files.
 * @property {string} selectedFile - The selected file.
 * @property {boolean} showMinimap - The state of showing the Minimap
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class CodeEditorBase extends TypedComponent {
    /** @type {State} */
    state = {
        files: { 'example.mjs': '// init' },
        selectedFile: 'example.mjs',
        showMinimap: getShowMinimap()
    };

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._handleExampleLoad = this._handleExampleLoad.bind(this);
        this._handleExampleLoading = this._handleExampleLoading.bind(this);
    }

    /**
     * @param {StateEvent} event - The event.
     */
    _handleExampleLoad(event) {
        const { files } = event.detail;
        const selectedFile = getSelectedFile(files);
        this._setDirty(false);
        this.mergeState({ files, selectedFile });
        patchState({ ui: { selectedFile } });
    }

    _handleExampleLoading() {
        this._setDirty(false);
        this.mergeState({ files: { 'example.mjs': '// reloading' } });
    }

    /**
     * @param {boolean} dirty - The dirty state.
     */
    _setDirty(dirty) {
        window.dispatchEvent(new CustomEvent(EDITOR_DIRTY_EVENT, { detail: { dirty } }));
    }

    /**
     * @param {Partial<State>} state - New partial state.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    componentDidMount() {
        window.addEventListener('exampleLoad', this._handleExampleLoad);
        window.addEventListener('exampleLoading', this._handleExampleLoading);
    }

    componentWillUnmount() {
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
        window.removeEventListener('exampleLoading', this._handleExampleLoading);
    }

    /**
     * @param {Monaco} monaco - The monaco editor.
     */
    beforeMount(monaco) {
        // set languages
        for (const id in languages) {
            monaco.languages.register({ id });
            // @ts-ignore
            monaco.languages.setLanguageConfiguration(id, languages[id].conf); // eslint-disable-line import/namespace
            // @ts-ignore
            monaco.languages.setMonarchTokensProvider(id, languages[id].language); // eslint-disable-line import/namespace
        }

        // patches highlighter tokenizer for javascript to include jsdoc
        const allLangs = monaco.languages.getLanguages();
        const jsLang = /** @type {any[]} */ (allLangs).find(({ id }) => id === 'javascript');
        // @ts-ignore
        jsLang?.loader()?.then(({ language }) => {
            Object.assign(language.tokenizer, jsRules);
        });

        fetch(pcTypes)
        .then((r) => {
            return r.text();
        })
        .then((playcanvasDefs) => {
            const typescript = /** @type {any} */ (monaco.languages.typescript);
            // set types
            typescript.typescriptDefaults.addExtraLib(
                playcanvasDefs,
                '@playcanvas/playcanvas.d.ts'
            );
            typescript.javascriptDefaults.addExtraLib(
                playcanvasDefs,
                '@playcanvas/playcanvas.d.ts'
            );
        });
    }

    /**
     * @param {editor.IStandaloneCodeEditor} editor - The monaco editor.
     */
    editorDidMount(editor) {
        // @ts-ignore
        const monaco = window.monaco;

        // set theme
        monaco.editor.defineTheme('playcanvas', playcanvasTheme);
        monaco.editor.setTheme('playcanvas');
    }

    /**
     * @returns {ReactElement} - The rendered component.
     */
    render() {
        return jsx('pre', null, 'Not implemented');
    }
}

export { CodeEditorBase };
