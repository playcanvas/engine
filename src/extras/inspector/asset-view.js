import { collectProperties, describeValue } from './describe.js';
import { formatBytes, makeSection, push, read, reflectRows } from './model.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { Asset } from '../../framework/asset/asset.js' */
/** @import { AssetRegistry } from '../../framework/asset/asset-registry.js' */
/** @import { Component } from '../../framework/components/component.js' */
/** @import { Entity } from '../../framework/entity.js' */
/** @import { Described } from './describe.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

// asset properties the model shows explicitly, or that are plumbing
const SKIP_ASSET = [
    'id', 'name', 'type', 'file', 'tags', 'preload', 'loaded', 'loading', 'resource', 'resources',
    'registry', 'urlObject', 'loadFaces'
];

/** The orders the list can be sorted in, as selector options. */
const ASSET_SORTS = [
    ['type', 'type'], ['size', 'file size'], ['name', 'name'], ['id', 'id']
];

/**
 * Cache of {@link assetPropertyNames}, keyed by the prototype the names were found on.
 *
 * @type {Map<object, string[]>}
 */
const assetProps = new Map();

/**
 * The asset-referencing property names of a component. Components expose these as either an id or
 * an {@link Asset}, and some as an array of either, so the names are what the panel needs to
 * resolve them. The result is cached per component class, since reflection is not free and finding
 * the users of an asset walks every component of the scene. An object whose properties are its own
 * fields rather than accessors of a class is not cached, as its shape says nothing about the next
 * one with the same prototype.
 *
 * @param {Component} component - The component.
 * @returns {string[]} Its asset-referencing property names.
 */
function assetPropertyNames(component) {
    const scan = () => collectProperties(component, [], []).filter(name => /asset/i.test(name));
    const proto = Object.getPrototypeOf(component);
    if (!proto || proto === Object.prototype) return scan();

    let names = assetProps.get(proto);
    if (!names) {
        names = scan();
        assetProps.set(proto, names);
    }
    return names;
}

/**
 * Describes the value of an asset-referencing property, resolving ids through the registry so the
 * row links to the asset rather than showing a bare number. Arrays are expanded entry by entry.
 *
 * @param {*} value - An asset, an id, an array of either, or nothing.
 * @param {AssetRegistry|null} registry - The registry to resolve ids in.
 * @returns {Described} The described value.
 */
function describeAssetValue(value, registry) {
    if (Array.isArray(value)) {
        const items = value.map((entry, i) => ({ label: `[${i}]`, ...describeAssetValue(entry, registry) }));
        return {
            text: value.length ? `Array(${value.length}) of asset` : '[]',
            cls: value.length ? 'obj' : 'null',
            items: value.length ? items : undefined
        };
    }
    if (typeof value === 'number') {
        const asset = registry?.get(value) ?? null;
        return asset ? describeValue(asset) : { text: `#${value} (not in the registry)`, cls: 'null' };
    }
    return describeValue(value);
}

/**
 * Appends one row per asset-referencing property of a component, with ids resolved to the assets
 * they name.
 *
 * @param {PropertySection} section - The section to append to.
 * @param {Component} component - The component.
 * @returns {string[]} The property names handled, to leave out of the reflected rows.
 */
function pushAssetRows(section, component) {
    const names = assetPropertyNames(component);
    const registry = /** @type {any} */ (component).system?.app?.assets ?? null;
    for (const name of names) {
        let value;
        try {
            value = /** @type {any} */ (component)[name];
        } catch (e) {
            push(section, name, { text: `<${e?.message ?? e}>`, cls: 'err' });
            continue;
        }
        push(section, name, describeAssetValue(value, registry));
    }
    return names;
}

/**
 * The size of an asset's file. Only a descriptor from a project manifest carries one, so an asset
 * loaded from a plain url, and every sub-asset of a container, has a file of unknown size. An
 * asset built in memory, such as a sprite of an atlas, has nothing to download at all.
 *
 * @param {Asset} asset - An asset.
 * @returns {string} The size, or why there is none.
 */
function sizeText(asset) {
    if (asset.file?.size) return formatBytes(asset.file.size);
    return asset.file?.url ? 'size unknown' : 'no file';
}

/**
 * @param {Asset} asset - An asset.
 * @returns {string} Its load state.
 */
function stateName(asset) {
    return asset.loaded ? 'loaded' : asset.loading ? 'loading' : 'not loaded';
}

/**
 * Every asset in the registry, in the requested order. Assets with no file sort last by size, and
 * ties fall back to the name so the list does not jitter between refreshes.
 *
 * @param {AssetRegistry|null} registry - The registry.
 * @param {string} [sort] - One of {@link ASSET_SORTS}.
 * @returns {Asset[]} The assets.
 */
function collectAssets(registry, sort = 'type') {
    const assets = registry ? [...registry.list()] : [];
    const byName = (a, b) => a.name.localeCompare(b.name) || a.id - b.id;
    if (sort === 'name') return assets.sort(byName);
    if (sort === 'id') return assets.sort((a, b) => a.id - b.id);
    if (sort === 'size') return assets.sort((a, b) => (b.file?.size ?? 0) - (a.file?.size ?? 0) || byName(a, b));
    return assets.sort((a, b) => a.type.localeCompare(b.type) || byName(a, b));
}

/**
 * The asset each loaded resource came from, so a panel showing a resource can name its source.
 * An asset can produce several resources, such as the faces of a cubemap.
 *
 * @param {AssetRegistry|null} registry - The registry.
 * @returns {Map<object, Asset>} The asset by resource.
 */
function resourceAssets(registry) {
    /** @type {Map<object, Asset>} */
    const assets = new Map();
    for (const asset of registry?.list() ?? []) {
        for (const resource of asset.resources ?? []) {
            if (resource && typeof resource === 'object' && !assets.has(resource)) assets.set(resource, asset);
        }
    }
    return assets;
}

/**
 * The components referencing an asset, found by walking the scene: neither the asset nor the
 * registry tracks who uses it.
 *
 * @param {AppBase} app - The app.
 * @param {Asset} asset - The asset.
 * @returns {{ entity: Entity, name: string, property: string }[]} One entry per referencing property.
 */
function assetUsers(app, asset) {
    const users = [];
    const uses = (value) => {
        if (Array.isArray(value)) return value.some(uses);
        return value === asset || value === asset.id;
    };

    /** @param {Entity} entity - The entity to test, with its descendants. */
    const walk = (entity) => {
        const components = /** @type {any} */ (entity).c;
        for (const name in components) {
            const component = components[name];
            for (const property of assetPropertyNames(component)) {
                try {
                    if (uses(component[property])) users.push({ entity, name, property });
                } catch (e) {
                    // a property that throws cannot be telling us about this asset
                }
            }
        }
        for (const child of entity.children) walk(/** @type {any} */ (child));
    };

    if (app.root) walk(/** @type {any} */ (app.root));
    return users;
}

/**
 * One row per asset in the registry, dimmed while it is not loaded.
 *
 * @param {AssetRegistry|null} registry - The registry.
 * @param {string} sort - The order to list them in.
 * @returns {ListRow[]} The rows.
 */
function assetRows(registry, sort) {
    return collectAssets(registry, sort).map((asset) => {
        const name = asset.name || '(unnamed)';
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        cells.push({ text: asset.type, cls: 'pci-cell-tag pci-cell-tag-info' });
        if (!asset.loaded) cells.push({ text: stateName(asset), cls: 'pci-cell-tag' });
        cells.push({ text: sizeText(asset), cls: 'pci-cell-info' });
        cells.push({ text: `#${asset.id}`, cls: 'pci-cell-info pci-cell-right' });
        const title = `${name}\n${asset.type}, ${stateName(asset)}, ${sizeText(asset)}` +
            `${asset.file?.url ? `\n${asset.file.url}` : ''}`;
        return { key: `asset${asset.id}`, item: asset, name, dim: !asset.loaded, title, cells };
    });
}

/**
 * Everything the property view shows for an asset: where it came from, the resources it loaded
 * into (linked), the components using it (linked), and every other public property.
 *
 * @param {Asset} asset - The asset.
 * @param {{ app: AppBase }} ctx - The app, to find the asset's users.
 * @returns {PropertySection[]} The sections.
 */
function buildAssetModel(asset, ctx) {
    const sections = [];
    const file = asset.file;

    const general = makeSection('asset', 'Asset');
    push(general, 'name', describeValue(asset.name));
    push(general, 'id', describeValue(asset.id));
    push(general, 'type', { text: asset.type, cls: 'obj' });
    push(general, 'state', { text: stateName(asset), cls: asset.loaded ? 'bool' : 'null' });
    push(general, 'preload', read(asset, 'preload'));
    push(general, 'url', file?.url ? describeValue(file.url) : { text: 'no file', cls: 'null' });
    push(general, 'file size', { text: sizeText(asset), cls: file?.size ? 'num' : 'null' });
    if (asset.type === 'cubemap') push(general, 'load faces', read(asset, 'loadFaces'));
    if (file?.hash) push(general, 'hash', describeValue(file.hash));
    push(general, 'tags', describeValue(asset.tags));
    sections.push(general);

    const resources = makeSection('resources', 'Resources');
    if (!asset.loaded) {
        push(resources, 'resource', { text: `${stateName(asset)}, nothing to show yet`, cls: 'null' });
    } else if ((asset.resources?.length ?? 0) > 1) {
        push(resources, 'resources', describeValue(asset.resources));
    } else {
        push(resources, 'resource', describeValue(asset.resource));
    }
    sections.push(resources);

    const users = assetUsers(ctx.app, asset);
    const usage = makeSection('users', 'Used by');
    push(usage, 'components', {
        text: users.length ? `${users.length} component${users.length === 1 ? '' : 's'}` : 'no component in the scene',
        cls: users.length ? 'obj' : 'null',
        items: users.map(user => ({
            label: `${user.name}.${user.property}`,
            text: `Entity "${user.entity.name}"`,
            cls: 'ref',
            target: user.entity
        }))
    });
    sections.push(usage);

    const rest = makeSection('props', 'Properties');
    reflectRows(rest, asset, [], SKIP_ASSET);
    if (rest.rows.length) sections.push(rest);

    return sections;
}

export {
    ASSET_SORTS, assetRows, assetUsers, buildAssetModel, collectAssets, describeAssetValue, pushAssetRows,
    resourceAssets, stateName
};
