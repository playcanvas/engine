import MonacoEditor, { loader } from '@monaco-editor/react';
import { Button, Container, Panel } from '@playcanvas/pcui/react';

import { CodeEditorBase, getShowMinimap } from './CodeEditorBase.mjs';
import { getFirstExample } from '../../categories.mjs';
import { downloadExampleProject } from '../../download-project.mjs';
import { iframe } from '../../iframe.mjs';
import { jsx } from '../../jsx.mjs';
import { assetPath, scriptsPath } from '../../paths.mjs';
import { removeRedundantSpaces } from '../../strings.mjs';
import { getHashPath, getSelectedFile, patchState, readState } from '../../url-state.mjs';

/**
 * @import { EditorProps } from '@monaco-editor/react'
 * @import { editor } from 'monaco-editor'
 * @import { ReactElement } from 'react'
 * @import { ErrorEvent as ExampleErrorEvent, StateEvent } from '../../events.js'
 * @import { State } from './CodeEditorBase.mjs'
 */

loader.config({ paths: { vs: './modules/monaco-editor/min/vs' } });

/**
 * @param {() => Promise<any>} task - Async task.
 * @returns {Promise<[any, any]>} Error and result tuple.
 */
const tryCatchAsync = async (task) => {
    try {
        return [null, await task()];
    } catch (err) {
        return [err, null];
    }
};

/**
 * @type {Record<string, string>}
 */
const FILE_TYPE_LANGUAGES = {
    json: 'json',
    javascript: 'javascript',
    js: 'javascript',
    mjs: 'javascript',
    jsx: 'javascript',
    tsx: 'javascript',
    html: 'html',
    css: 'css',
    shader: 'glsl',
    vert: 'glsl',
    frag: 'glsl',
    wgsl: 'wgsl',
    txt: 'text'
};

// script files share one virtual dir so relative imports between them (`./gizmo-handler.mjs`)
// resolve to real models; assets go in a separate dir so `import './x.vert'` instead falls through
// to the *.vert ambient module rather than resolving to an unparseable glsl/wgsl model.
const EXAMPLE_MODEL_DIR = 'inmemory://example/';
const ASSET_MODEL_DIR = 'inmemory://asset/';
const SCRIPT_EXTENSIONS = new Set(['mjs', 'js', 'jsx', 'tsx']);
const MONACO_STACK = '/modules/monaco-editor/';

const isScript = (/** @type {string} */ name) => SCRIPT_EXTENSIONS.has(name.split('.').pop() ?? '');
const modelPath = (/** @type {string} */ name) => `${isScript(name) ? EXAMPLE_MODEL_DIR : ASSET_MODEL_DIR}${name}`;
const isMonacoCanceled = (/** @type {any} */ reason) => {
    return reason?.name === 'Canceled' &&
        reason?.message === 'Canceled' &&
        `${reason?.stack ?? ''}`.includes(MONACO_STACK);
};

// `import ... from` an engine script (`playcanvas/scripts/esm/foo.mjs`) or an examples helper
// module (`examples/assets/scripts/misc/foo.mjs`), and a script's own relative `./bar.mjs` deps
const SCRIPT_IMPORT = /from\s+['"]((?:playcanvas\/scripts\/|examples\/assets\/)[^'"]+\.mjs)['"]/g;
const RELATIVE_IMPORT = /from\s+['"](\.\/[^'"]+\.mjs)['"]/g;

// where each script specifier prefix is served from, and where it lives in the engine repo
const SCRIPT_ROOTS = [
    { prefix: 'playcanvas/scripts/', url: scriptsPath, repo: 'scripts/' },
    { prefix: 'examples/assets/', url: assetPath, repo: 'examples/assets/' }
];
const GITHUB_ROOT = 'https://github.com/playcanvas/engine';

/**
 * @param {string} spec - Script specifier, e.g. `playcanvas/scripts/esm/grid.mjs`.
 * @param {'url' | 'repo'} key - Served url or repo-relative path.
 * @returns {string} The specifier with its prefix replaced.
 */
const scriptLocation = (spec, key) => {
    const root = SCRIPT_ROOTS.find(r => spec.startsWith(r.prefix));
    return root ? `${root[key]}${spec.slice(root.prefix.length)}` : spec;
};
const scriptModelPath = (/** @type {string} */ spec) => `${EXAMPLE_MODEL_DIR}${spec}`;
const scriptTabName = (/** @type {string} */ spec) => spec.slice(spec.lastIndexOf('/') + 1);

/**
 * @type {editor.IStandaloneCodeEditor}
 */
let monacoEditor;


/**
 * @typedef {Record<string, any>} Props
 */

class CodeEditorDesktop extends CodeEditorBase {
    _codePaneCollapsed = (() => {
        const value = readState().ui?.codePaneCollapsed;
        return typeof value === 'boolean' ? value : localStorage.getItem('codePaneCollapsed') === 'true';
    })();

    /** @type {string[]} */
    _decorators = [];

    /** @type {Map<string, editor.IModelDeltaDecoration[]>} */
    _decoratorMap = new Map();

    /** @type {{ uri: string, target: any } | null} - definition to reveal after a cross-file jump. */
    _pendingReveal = null;

    /** @type {import('monaco-editor').IDisposable[]} */
    _navDisposables = [];

    /** @type {Map<string, Promise<string | null>>} - source of each script specifier, fetched once. */
    _scriptSources = new Map();

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._handleExampleHotReload = this._handleExampleHotReload.bind(this);
        this._handleExampleError = this._handleExampleError.bind(this);
        this._handleRequestedFiles = this._handleRequestedFiles.bind(this);
        this._handleUnhandledRejection = this._handleUnhandledRejection.bind(this);
        this._onDownload = this._onDownload.bind(this);
    }

    async _onDownload() {
        if (this.state.downloading) {
            return;
        }
        this.setState({ downloading: true });
        const [err] = await tryCatchAsync(downloadExampleProject);
        if (err) {
            console.error('Failed to download Vite project', err);
        }
        this.setState({ downloading: false });
    }

    /**
     * @param {ExampleErrorEvent} event - The event.
     */
    _handleExampleError(event) {
        const editor = window.editor;
        if (!editor) {
            return;
        }
        const monaco = window.monaco;

        // the error belongs to the selected example file, which a script tab may be covering, so
        // measure that file's model rather than whichever one the editor is showing
        const model = monaco.editor.getModel(monaco.Uri.parse(modelPath(this.state.selectedFile)));
        if (!model) {
            return;
        }

        const { name, message, locations } = event.detail;
        if (!locations.length) {
            const editorLines = model.getValue().split('\n');
            const line = editorLines.length - 1;
            const messageMarkdown = `**${name}: ${message}**`;
            const decorator = {
                range: new monaco.Range(0, 0, line + 1, editorLines[line].length),
                options: {
                    className: 'squiggly-error',
                    hoverMessage: {
                        value: messageMarkdown
                    }
                }
            };
            this._decoratorMap.set(this.state.selectedFile, [decorator]);
            this._refreshDecorators();
            return;
        }

        const { line, column } = locations[0];

        const messageMarkdown = `**${name}: ${message}** [Ln ${line}, Col ${column}]`;
        const lineText = model.getLineContent(line);
        const decorator = {
            range: new monaco.Range(line, 0, line, lineText.length),
            options: {
                className: 'squiggly-error',
                hoverMessage: {
                    value: messageMarkdown
                }
            }
        };
        this._decoratorMap.set(this.state.selectedFile, [decorator]);
        this._refreshDecorators();

    }

    _refreshDecorators() {
        if (!monacoEditor) {
            return;
        }
        const decorators = this.state.selectedScript ? [] : this._decoratorMap.get(this.state.selectedFile);
        this._decorators = monacoEditor.deltaDecorations(this._decorators, decorators ?? []);
    }

    /**
     * @param {StateEvent} event - The event.
     */
    _handleRequestedFiles(event) {
        const { files } = event.detail;
        const selectedFile = getSelectedFile(files, this.state.selectedFile);
        this._setDirty(false);
        this.mergeState({ files, selectedFile });
        patchState({ ui: { selectedFile } });
    }

    _handleExampleHotReload() {
        this._decoratorMap.delete(this.state.selectedFile);
        this._refreshDecorators();
        // edits made in place to the example's files may have added or removed script imports
        this._loadScripts();
    }

    /**
     * @param {PromiseRejectionEvent} event - The event.
     */
    _handleUnhandledRejection(event) {
        if (isMonacoCanceled(event.reason)) {
            event.preventDefault();
        }
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
        super.componentDidMount();
        window.addEventListener('exampleHotReload', this._handleExampleHotReload);
        window.addEventListener('exampleError', this._handleExampleError);
        window.addEventListener('requestedFiles', this._handleRequestedFiles);
        window.addEventListener('unhandledrejection', this._handleUnhandledRejection);
        iframe.fire('requestFiles');
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        window.removeEventListener('exampleHotReload', this._handleExampleHotReload);
        window.removeEventListener('exampleError', this._handleExampleError);
        window.removeEventListener('requestedFiles', this._handleRequestedFiles);
        window.removeEventListener('unhandledrejection', this._handleUnhandledRejection);
        this._navDisposables.forEach(d => d.dispose());
        this._navDisposables = [];
        this._disposeModels();
    }

    /**
     * @param {Props} prevProps - Previous props.
     * @param {State} prevState - Previous state.
     */
    componentDidUpdate(prevProps, prevState) {
        if (prevState.files !== this.state.files) {
            this._syncModels();
            this._loadScripts();
            // a new example was loaded, so open on its own files rather than a script tab
            if (this.state.selectedScript) {
                this.mergeState({ selectedScript: null });
            }
        }
    }

    // give every inactive script file its own model so sibling imports resolve before its tab is
    // opened; the selected file's model is owned by the editor itself. also drop models left over
    // from a previously-loaded example.
    _syncModels() {
        const monaco = window.monaco;
        if (!monaco) {
            return;
        }
        const { files, selectedFile } = this.state;
        for (const name in files) {
            if (name === selectedFile || !isScript(name)) {
                continue;
            }
            const uri = monaco.Uri.parse(modelPath(name));
            const model = monaco.editor.getModel(uri);
            if (model) {
                if (model.getValue() !== files[name]) {
                    model.setValue(files[name]);
                }
            } else {
                monaco.editor.createModel(files[name], 'javascript', uri);
            }
        }
        for (const model of monaco.editor.getModels()) {
            // never dispose the model the editor holds: mid-switch the path prop hasn't changed
            // yet, so the wrapper would call getFullModelRange() on a null model and crash. the
            // stale model is picked up by the next sync once the editor has moved off it.
            if (model === monacoEditor?.getModel()) {
                continue;
            }
            const uri = model.uri.toString();
            const dir = uri.startsWith(EXAMPLE_MODEL_DIR) ? EXAMPLE_MODEL_DIR :
                uri.startsWith(ASSET_MODEL_DIR) ? ASSET_MODEL_DIR : null;
            if (!dir) {
                continue;
            }
            // only example/asset files are direct children; script models live in a nested
            // playcanvas/scripts/ or examples/assets/ subtree and are cached separately, so leave
            // those alone
            const rest = uri.slice(dir.length);
            if (!rest.includes('/') && !files[rest]) {
                model.dispose();
            }
        }
    }

    /**
     * Fetches a script's source once and models it. Concurrent and later requests for the same
     * specifier share the first fetch.
     *
     * @param {string} spec - Script specifier, e.g. `playcanvas/scripts/esm/grid.mjs`.
     * @returns {Promise<string | null>} The source, or null if it could not be loaded.
     */
    _fetchScript(spec) {
        let task = this._scriptSources.get(spec);
        if (!task) {
            task = fetch(scriptLocation(spec, 'url'))
            .then(r => (r.ok ? r.text() : null), () => null)
            .then((src) => {
                const monaco = window.monaco;
                const uri = monaco.Uri.parse(scriptModelPath(spec));
                if (src !== null && !monaco.editor.getModel(uri)) {
                    monaco.editor.createModel(src, 'javascript', uri);
                }
                return src;
            });
            this._scriptSources.set(spec, task);
        }
        return task;
    }

    // fetch the real source of every script the example imports (plus their own relative deps) and
    // model it, so those imports resolve to real types instead of the `any` wildcard fallback, and
    // list them as read-only tabs after the example's own files
    async _loadScripts() {
        const monaco = window.monaco;
        if (!monaco) {
            return;
        }
        const { files } = this.state;
        /** @type {string[]} */
        const queue = [];
        for (const name in files) {
            for (const match of files[name].matchAll(SCRIPT_IMPORT)) {
                queue.push(match[1]);
            }
        }
        /** @type {string[]} */
        const scripts = [];
        while (queue.length) {
            const spec = queue.shift();
            if (!spec || scripts.includes(spec)) {
                continue;
            }
            // eslint-disable-next-line no-await-in-loop
            const src = await this._fetchScript(spec);
            if (src === null) {
                continue;
            }
            scripts.push(spec);
            const dir = spec.slice(0, spec.lastIndexOf('/') + 1);
            for (const match of src.matchAll(RELATIVE_IMPORT)) {
                queue.push(`${dir}${match[1].slice(2)}`);
            }
        }
        // drop the result if another example was loaded meanwhile
        if (this.state.files === files) {
            this.mergeState({ scripts });
        }
    }

    // move the caret to a definition (a range or a position) in the now-active model and scroll to it
    _revealTarget(/** @type {any} */ target) {
        if (!target || !monacoEditor) {
            return;
        }
        const range = target.startLineNumber !== undefined ? target : {
            startLineNumber: target.lineNumber,
            startColumn: target.column,
            endLineNumber: target.lineNumber,
            endColumn: target.column
        };
        monacoEditor.setSelection(range);
        monacoEditor.revealRangeInCenterIfOutsideViewport(range);
        monacoEditor.focus();
    }

    _disposeModels() {
        const monaco = window.monaco;
        if (!monaco) {
            return;
        }
        for (const model of monaco.editor.getModels()) {
            const uri = model.uri.toString();
            if (uri.startsWith(EXAMPLE_MODEL_DIR) || uri.startsWith(ASSET_MODEL_DIR)) {
                model.dispose();
            }
        }
    }

    /**
     * @param {editor.IStandaloneCodeEditor} editor - The monaco editor.
     */
    editorDidMount(editor) {
        super.editorDidMount(editor);

        // @ts-ignore
        window.editor = editor;
        monacoEditor = editor;
        // @ts-ignore
        const monaco = window.monaco;

        // model the example's other files so cross-file imports resolve from the start
        this._syncModels();
        this._loadScripts();

        // make "go to definition" across the example's files and scripts switch tabs and reveal the
        // target; the model swap is async (driven by selectFile -> render), so defer the reveal until
        // it lands
        this._navDisposables.push(
            monaco.editor.registerEditorOpener({
                openCodeEditor: (source, resource, selectionOrPosition) => {
                    const uri = resource.toString();
                    const name = uri.slice(uri.lastIndexOf('/') + 1);
                    const spec = uri.slice(EXAMPLE_MODEL_DIR.length);
                    /** @type {(() => void) | null} */
                    let open = null;
                    if (uri === modelPath(name) && this.state.files[name]) {
                        // an editable example file
                        open = () => this.selectFile(name);
                    } else if (uri === scriptModelPath(spec) && this.state.scripts?.includes(spec)) {
                        // a script the example imports, shown as a read-only tab
                        open = () => this.selectScript(spec);
                    }
                    if (!open) {
                        // the playcanvas typings -> preview inline with a peek widget
                        source.trigger('preview', 'editor.action.peekDefinition', {});
                    } else if (uri === editor.getModel()?.uri.toString()) {
                        this._revealTarget(selectionOrPosition);
                    } else {
                        this._pendingReveal = { uri, target: selectionOrPosition };
                        open();
                    }
                    return true;
                }
            }),
            editor.onDidChangeModel(() => {
                const model = editor.getModel();
                if (!this._pendingReveal || !model) {
                    return;
                }
                if (model.uri.toString() === this._pendingReveal.uri) {
                    this._revealTarget(this._pendingReveal.target);
                    this._pendingReveal = null;
                }
            })
        );

        // Hot reload code via Shift + Enter
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            iframe.fire('hotReload');
        });
        const codePane = document.getElementById('codePane');
        if (!codePane) {
            return;
        }
        codePane.classList.add('multiple-files');
        if (!this.state.files[this.state.selectedFile]) {
            this.mergeState({
                selectedFile: 'example.mjs'
            });
            patchState({ ui: { selectedFile: 'example.mjs' } });
        }
        /** @type {any} */ (codePane).ui.on('resize', () => localStorage.setItem('codePaneStyle', codePane.getAttribute('style') ?? ''));
        const codePaneStyle = localStorage.getItem('codePaneStyle');
        if (codePaneStyle) {
            codePane.setAttribute('style', codePaneStyle);
        }
        // set up the code panel toggle button
        const panelToggleDiv = codePane.querySelector('.panel-toggle');
        if (!panelToggleDiv) {
            return;
        }
        panelToggleDiv.addEventListener('click', () => {
            codePane.classList.toggle('collapsed');
            const collapsed = codePane.classList.contains('collapsed');
            this._codePaneCollapsed = collapsed;
            localStorage.setItem('codePaneCollapsed', collapsed ? 'true' : 'false');
            patchState({ ui: { codePaneCollapsed: collapsed } });
        });
        // register Monaco commands (you can access them by pressing f1)
        // Toggling minimap is only six key strokes: F1 mini enter (even "F1 mi enter" works)
        editor.addAction({
            id: 'view-toggle-minimap',
            label: 'View: Toggle Minimap',
            contextMenuOrder: 1.5,
            run: () => {
                const showMinimap = !getShowMinimap();
                localStorage.setItem('showMinimap', `${showMinimap}`);
                this.mergeState({ showMinimap });
            }
        });
    }

    /**
     * @param {string} value - The on change state.
     */
    onChange(value) {
        const { files, selectedFile, selectedScript } = this.state;
        if (selectedScript || files[selectedFile] === value) {
            return;
        }
        files[selectedFile] = value;
        this._setDirty(true);
    }

    /**
     * @param {string} selectedFile - Newly selected filename.
     */
    selectFile(selectedFile) {
        this.mergeState({ selectedFile, selectedScript: null });
        patchState({ ui: { selectedFile } });
        monacoEditor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
    }

    /**
     * @param {string} selectedScript - Specifier of the script to show read-only.
     */
    selectScript(selectedScript) {
        this.mergeState({ selectedScript });
        monacoEditor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
    }

    renderTabs() {
        const { files, selectedFile, selectedScript, scripts = [] } = this.state;
        /** @type {ReactElement[]} */
        const tabs = [];
        for (const name in files) {
            const selected = name === selectedFile && !selectedScript;
            tabs.push(jsx(Button, {
                key: name,
                id: `code-editor-file-tab-${name}`,
                text: name,
                class: selected ? ['selected', 'code-editor-tab-with-link'] : undefined,
                onClick: () => this.selectFile(name)
            }));
            if (selected) {
                tabs.push(this._renderGitHubLink(name));
            }
        }
        if (scripts.length) {
            tabs.push(jsx('div', { key: 'script-tabs-divider', className: 'code-editor-tabs-divider' }));
        }
        // a plain button rather than the pcui one, which takes no tooltip for the full specifier
        for (const spec of scripts) {
            const selected = spec === selectedScript;
            tabs.push(jsx('button', {
                key: spec,
                type: 'button',
                className: `pcui-button code-editor-script-tab${selected ? ' selected code-editor-tab-with-link' : ''}`,
                'data-tip': `${spec} (read-only)`,
                onClick: () => this.selectScript(spec)
            }, scriptTabName(spec)));
            if (selected) {
                tabs.push(this._renderGitHubLink(scriptTabName(spec)));
            }
        }
        return tabs;
    }

    /**
     * Renders the GitHub link attached to the selected tab. It is a sibling of the tab rather than
     * a child, as a button cannot contain another interactive element.
     *
     * @param {string} name - The selected tab's file name.
     * @returns {ReactElement} The link.
     */
    _renderGitHubLink(name) {
        const { selectedFile, selectedScript } = this.state;
        let path;
        if (selectedScript) {
            path = scriptLocation(selectedScript, 'repo');
        } else {
            const [, category, example] = getHashPath().split('/');
            path = `examples/src/examples/${category}/${example || getFirstExample(category)}/${selectedFile}`;
        }
        const label = `View ${name} on GitHub`;
        return jsx('a', {
            key: 'github-link',
            className: 'pcui-button code-editor-tab-github',
            href: `${GITHUB_ROOT}/blob/main/${path}`,
            target: '_blank',
            rel: 'noopener noreferrer',
            'data-tip': label,
            'aria-label': label
        }, jsx('svg', {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            width: 13,
            height: 13
        },
        jsx('path', { d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4' }),
        jsx('path', { d: 'M9 18c-4.51 2-5-2-5-2' })
        ));
    }

    render() {
        setTimeout(() => {
            iframe.fire('resize');
            this._refreshDecorators();
        }, 50);
        const { files, selectedFile, selectedScript, showMinimap } = this.state;
        const language = FILE_TYPE_LANGUAGES[(selectedScript ?? selectedFile).split('.').pop() || 'text'];
        // a script tab shows its fetched model as is: with no value the wrapper keeps the model's
        // content instead of overwriting it
        let value;
        if (!selectedScript) {
            value = files[selectedFile] ? removeRedundantSpaces(files[selectedFile]) : '// reloading, please wait';
        }

        /** @type {EditorProps} */
        const options = {
            value,
            language,
            path: selectedScript ? scriptModelPath(selectedScript) : modelPath(selectedFile),
            keepCurrentModel: true,
            saveViewState: false,
            theme: 'playcanvas',
            loading: null,
            beforeMount: this.beforeMount.bind(this),
            onMount: this.editorDidMount.bind(this),
            onChange: this.onChange.bind(this),
            options: {
                scrollbar: {
                    horizontal: 'visible'
                },
                readOnly: !!selectedScript,
                readOnlyMessage: {
                    value: 'Scripts used by the example are read-only.'
                },
                minimap: {
                    enabled: showMinimap
                }
            }
            /**
             * TODO: Without a key the syntax highlighting mode isn't updated.
             * But WITH a key the theme information isn't respected any longer... this
             * is probably a Monaco bug, which we need to file. Related:
             * https://github.com/microsoft/monaco-editor/issues/1713
             */
            // key: selectedFile,
        };
        return jsx(
            Panel,
            {
                headerText: 'Code',
                headerSize: 44,
                id: 'codePane',
                class: this._codePaneCollapsed ? 'collapsed' : undefined,
                resizable: 'left',
                resizeMax: 2000
            },
            jsx('div', {
                className: 'panel-toggle',
                id: 'codePane-panel-toggle'
            }),
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
                    jsx('button', {
                        type: 'button',
                        id: 'play-button',
                        className: 'pcui-button',
                        'data-tip': 'Reload example',
                        'aria-label': 'Reload example',
                        onClick: () => iframe.fire('hotReload')
                    }, jsx('svg', {
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: 2,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        width: 15,
                        height: 15
                    },
                    jsx('path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }),
                    jsx('path', { d: 'M21 3v5h-5' })
                    )),
                    jsx('button', {
                        type: 'button',
                        className: 'pcui-button',
                        'data-tip': this.state.downloading ? 'Preparing download…' : 'Download as a Vite project (.zip)',
                        'aria-label': 'Download as a Vite project (.zip)',
                        disabled: this.state.downloading,
                        onClick: this._onDownload
                    }, jsx('svg', {
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: 2,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        width: 15,
                        height: 15
                    },
                    jsx('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
                    jsx('polyline', { points: '7 10 12 15 17 10' }),
                    jsx('line', { x1: 12, y1: 15, x2: 12, y2: 3 })
                    ))
                ),
                jsx(
                    Container,
                    {
                        class: 'tabs-container'
                    },
                    this.renderTabs()
                )
            ),
            jsx(MonacoEditor, options)
        );
    }
}

export { CodeEditorDesktop };
