import { ScriptType } from '../../framework/script/script-type.js';
import { Script, getScriptName } from '../../framework/script/script.js';

import { describeValue } from './describe.js';
import { nodeLabel } from './memory-view.js';
import { makeSection, push } from './model.js';
import { scriptInstanceRows } from './node-model.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { Asset } from '../../framework/asset/asset.js' */
/** @import { Entity } from '../../framework/entity.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

/**
 * A script class found, with where it was found and the instances of it.
 *
 * @typedef {object} ScriptEntry
 * @property {string} name - The name the script is known by.
 * @property {boolean} registered - Whether the app's script registry holds it.
 * @property {{ script: Script|ScriptType, entity: Entity }[]} instances - Its instances, with the
 * entities they are on.
 * @ignore
 */

// most instances a script lists in the property view
const MAX_INSTANCES = 100;

// the lifecycle methods a script can define, in the order the engine calls them
const LIFECYCLE = ['initialize', 'postInitialize', 'update', 'postUpdate', 'swap'];

/**
 * @param {Function} cls - A class.
 * @returns {boolean} Whether it is a script class, of either kind.
 */
function isScriptClass(cls) {
    return typeof cls === 'function' && cls.prototype instanceof Script;
}

/**
 * @param {Function} cls - A script class.
 * @returns {boolean} Whether it is a classic script, declared with `createScript` or extending
 * ScriptType, which itself extends Script.
 */
function isClassic(cls) {
    return cls.prototype instanceof ScriptType;
}

/**
 * @param {Function} cls - A script class.
 * @returns {string} The name it is known by: the name it was created or registered under, its
 * static `scriptName`, or its class name.
 */
function scriptName(cls) {
    const any = /** @type {any} */ (cls);
    return any.__name ?? getScriptName(cls) ?? '(unnamed)';
}

/**
 * Finds the script classes of the app: those the script registry holds, which are the ones loaded
 * from script assets or declared with `createScript`, and the classes of the script instances on
 * the entities of the hierarchy, which add the classes created on an entity straight from their
 * class and never registered.
 *
 * @param {AppBase} app - The app.
 * @returns {Map<Function, ScriptEntry>} The script classes, the registered ones first.
 */
function surveyScripts(app) {
    /** @type {Map<Function, ScriptEntry>} */
    const scripts = new Map();
    const entryOf = (cls, registered) => {
        let entry = scripts.get(cls);
        if (!entry) {
            entry = { name: scriptName(cls), registered, instances: [] };
            scripts.set(cls, entry);
        }
        return entry;
    };

    for (const cls of app.scripts?.list() ?? []) entryOf(cls, true);

    app.root?.forEach((node) => {
        const component = /** @type {any} */ (node).c?.script;
        for (const script of component?.scripts ?? []) {
            const cls = script.constructor;
            if (isScriptClass(cls)) entryOf(cls, false).instances.push({ script, entity: /** @type {Entity} */ (node) });
        }
    });

    return scripts;
}

/**
 * @param {Script|ScriptType} script - A script instance.
 * @param {Entity} entity - The entity it is on.
 * @returns {boolean} Whether it runs: enabled itself, on an enabled component of an entity enabled
 * in the hierarchy.
 */
function isRunning(script, entity) {
    const component = /** @type {any} */ (entity).c?.script;
    return !!(script.enabled && component?.enabled && entity.enabled);
}

/**
 * @param {Function} cls - A script class.
 * @returns {string[]} The lifecycle methods it defines, on itself or a base class of its own.
 */
function lifecycleMethods(cls) {
    const proto = cls.prototype;
    return LIFECYCLE.filter(name => typeof proto[name] === 'function' &&
        proto[name] !== /** @type {any} */ (Script.prototype)[name] && proto[name] !== /** @type {any} */ (ScriptType.prototype)[name]);
}

/**
 * The attributes a script declares, with their types: those of a `createScript` script, which it
 * declares in code, or those its script asset describes.
 *
 * @param {Function} cls - A script class.
 * @param {string} name - The name it is known by.
 * @param {AppBase} app - The app, whose registry keeps the attribute schemas of script assets.
 * @returns {[string, string][]} The attribute names and types.
 */
function declaredAttributes(cls, name, app) {
    const index = isClassic(cls) ? /** @type {any} */ (cls).attributes?.index : null;
    const attributes = index ?? app.scripts?.getSchema?.(name)?.attributes ?? {};
    return Object.entries(attributes).map(([attribute, info]) => [attribute, String(info?.type ?? '')]);
}

/**
 * @param {Function} cls - A script class.
 * @param {string} name - The name it is known by.
 * @param {AppBase} app - The app.
 * @returns {Asset|null} The script asset it was loaded from, if found: a classic asset holds its
 * classes, and a module asset describes its scripts by name.
 */
function scriptAsset(cls, name, app) {
    for (const asset of app.assets?.list() ?? []) {
        if (asset.type !== 'script') continue;
        const resource = asset.resource;
        if (resource && typeof resource === 'object' && Object.values(resource).includes(cls)) return asset;
        if (asset.data?.scripts?.[name]) return asset;
    }
    return null;
}

/**
 * The source of a script, as the browser keeps it for every function. A script written as a class
 * is its whole class. A `createScript` script is a function whose methods are set on its prototype
 * one by one, so its source is put back together from those methods. The text is what the browser
 * loaded: minified when the app ships minified.
 *
 * @param {Function} cls - A script class.
 * @param {string} name - The name it is known by.
 * @returns {string} The source.
 */
function scriptSource(cls, name) {
    const text = Function.prototype.toString.call(cls);
    if (/^class\b/.test(text)) return text;

    const variable = /^[a-z_$][\w$]*$/i.test(cls.name) && cls.name !== 'scriptType' ? cls.name : 'script';
    const lines = [`const ${variable} = pc.createScript('${name}');`];
    for (const key of Object.getOwnPropertyNames(cls.prototype)) {
        if (key === 'constructor') continue;
        const descriptor = Object.getOwnPropertyDescriptor(cls.prototype, key);
        if (typeof descriptor?.value === 'function') {
            lines.push('', `${variable}.prototype.${key} = ${Function.prototype.toString.call(descriptor.value)};`);
        }
    }
    return lines.join('\n');
}

/** @type {WeakMap<Function, number>} */
const ids = new WeakMap();
let nextId = 1;

/**
 * @param {Function} cls - A script class.
 * @returns {string} A row key that stays the same for the lifetime of the class, as two classes can
 * share a name when only one of them is registered.
 */
function keyOf(cls) {
    let id = ids.get(cls);
    if (id === undefined) {
        id = nextId++;
        ids.set(cls, id);
    }
    return `script${id}`;
}

/**
 * One row per script class, by name, dimmed when no entity uses it.
 *
 * @param {Map<Function, ScriptEntry>} survey - The script classes found.
 * @returns {ListRow[]} The rows.
 */
function scriptListRows(survey) {
    const classes = [...survey.keys()].sort((a, b) => survey.get(a).name.localeCompare(survey.get(b).name));
    return classes.map((cls) => {
        const { name, registered, instances } = survey.get(cls);
        const running = instances.filter(({ script, entity }) => isRunning(script, entity)).length;
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        cells.push({ text: isClassic(cls) ? 'classic' : 'esm', cls: 'pci-cell-tag pci-cell-tag-info' });
        cells.push({
            text: `${instances.length} instance${instances.length === 1 ? '' : 's'}${instances.length ? ` · ${running} running` : ''}`,
            cls: 'pci-cell-info'
        });
        const title = `${name} (${isClassic(cls) ? 'ScriptType' : 'ESM Script'})\n` +
            `${instances.length} instance${instances.length === 1 ? '' : 's'}, ${running} running` +
            `${registered ? '' : '\nnot in the script registry: created on its entities from its class'}`;
        return {
            key: keyOf(cls),
            item: cls,
            name,
            // found by the entities using it too
            matches: filter => name.toLowerCase().includes(filter) ||
                instances.some(({ entity }) => entity.name.toLowerCase().includes(filter)),
            dim: instances.length === 0,
            title,
            cells
        };
    });
}

/**
 * Everything the property view shows for a script class: what it is and declares, the entities
 * using it, each instance opening in place into its attributes, and its source.
 *
 * @param {Function} cls - The script class.
 * @param {{ app: AppBase }} ctx - The app.
 * @returns {PropertySection[]} The sections.
 */
function buildScriptModel(cls, ctx) {
    const { app } = ctx;
    const entry = surveyScripts(app).get(cls) ?? { name: scriptName(cls), registered: false, instances: [] };
    const { name, registered, instances } = entry;
    const sections = [];

    const general = makeSection('script', `Script "${name}"`);
    push(general, 'name', describeValue(name));
    // createScript names every class it makes the same, so only a class written by hand says anything
    if (cls.name && cls.name !== 'scriptType') push(general, 'class', describeValue(cls.name));
    push(general, 'kind', { text: isClassic(cls) ? 'ScriptType (classic)' : 'Script (ESM)', cls: 'obj' });
    push(general, 'registered', registered ? describeValue(true) :
        { text: 'false, created on its entities from its class', cls: 'bool' });
    const asset = scriptAsset(cls, name, app);
    if (asset) push(general, 'from asset', describeValue(asset));
    const methods = lifecycleMethods(cls);
    push(general, 'methods', { text: methods.length ? methods.join(', ') : 'none', cls: methods.length ? 'obj' : 'null' });
    const attributes = declaredAttributes(cls, name, app);
    if (attributes.length) {
        push(general, 'attributes', {
            text: `${attributes.length} attribute${attributes.length === 1 ? '' : 's'}`,
            cls: 'obj',
            items: attributes.map(([attribute, type]) => ({ label: attribute, text: type || '-', cls: 'obj' }))
        });
    }
    sections.push(general);

    const usage = makeSection('instances', 'Used by');
    const running = instances.filter(({ script, entity }) => isRunning(script, entity)).length;
    push(usage, 'instances', {
        text: instances.length ? `${instances.length} instance${instances.length === 1 ? '' : 's'}, ${running} running` : 'none',
        cls: instances.length ? 'obj' : 'null',
        items: instances.slice(0, MAX_INSTANCES).map(({ script, entity }, index) => ({
            label: `[${index}]`,
            text: `${nodeLabel(entity)}${isRunning(script, entity) ? '' : ' (not running)'}`,
            cls: 'ref',
            target: entity,
            expand: () => scriptInstanceRows(script)
        }))
    });
    if (instances.length > MAX_INSTANCES) {
        usage.rows.push({ key: 'more', label: '', value: { text: `… ${instances.length - MAX_INSTANCES} more`, cls: 'null' }, depth: 1 });
    }
    sections.push(usage);

    const source = scriptSource(cls, name);
    const code = makeSection('source', 'Source');
    const lines = source.split('\n').length;
    push(code, 'source', { text: `${lines} line${lines === 1 ? '' : 's'}`, cls: 'num', code: source });
    sections.push(code);

    return sections;
}

export { buildScriptModel, isScriptClass, scriptListRows, surveyScripts };
