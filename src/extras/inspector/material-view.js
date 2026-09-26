import { Material } from '../../scene/materials/material.js';

import { describeValue } from './describe.js';
import { collectMeshInstances } from './instance-survey.js';
import { nodeLabel } from './memory-view.js';
import { makeSection, push } from './model.js';
import { materialRows, materialTextures, meshInstanceRows } from './node-model.js';

/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { Asset } from '../../framework/asset/asset.js' */
/** @import { Shader } from '../../platform/graphics/shader.js' */
/** @import { Texture } from '../../platform/graphics/texture.js' */
/** @import { ListRow } from './list-view.js' */
/** @import { PropertySection } from './model.js' */

/**
 * Where a material was found besides its mesh instances, which the material lists itself.
 *
 * @typedef {object} MaterialSources
 * @property {Asset[]} assets - The material assets holding it.
 * @property {string[]} lines - The layers whose debug lines draw with it.
 * @ignore
 */

// most mesh instances a material lists in the property view; a shared material can have thousands
const MAX_INSTANCES = 100;

/**
 * Finds the materials of the app. Nothing keeps a list of them, so they are found through what
 * uses them: the mesh instances of the components and layers, see {@link collectMeshInstances},
 * which add the sky, sprite, text and particle materials and the default material; the batches of
 * debug lines, one per material; and the loaded material assets of the registry, which include
 * those a glb container creates and hold materials nothing may be drawing with. A material only the
 * app's own code holds, never given to a mesh instance, cannot be found.
 *
 * @param {AppBase} app - The app.
 * @returns {Map<Material, MaterialSources>} The materials, in the order found, with the assets and
 * debug lines using each.
 */
function surveyMaterials(app) {
    /** @type {Map<Material, MaterialSources>} */
    const materials = new Map();
    const sourcesOf = (material) => {
        if (!(material instanceof Material)) return null;
        let sources = materials.get(material);
        if (!sources) {
            sources = { assets: [], lines: [] };
            materials.set(material, sources);
        }
        return sources;
    };

    for (const { instance } of collectMeshInstances(app)) sourcesOf(instance.material);

    for (const [layer, batches] of app.scene?.immediate?.batchesMap ?? []) {
        for (const batch of batches.map?.values() ?? []) sourcesOf(batch.material)?.lines.push(layer.name);
    }

    for (const asset of app.assets?.list() ?? []) {
        if (asset.type === 'material' && asset.loaded) sourcesOf(asset.resource)?.assets.push(asset);
    }

    return materials;
}

/**
 * @param {Material} material - A material.
 * @returns {string} Its class name, such as 'StandardMaterial'.
 */
function typeOf(material) {
    return material.constructor?.name || 'Material';
}

/**
 * @param {Material} material - A material.
 * @returns {string} Its name, or a generated one when it has none.
 */
function materialName(material) {
    return material.name || `Material #${material.id}`;
}

/**
 * One row per material found, the most used first, dimmed when no mesh instance uses it.
 *
 * @param {Map<Material, MaterialSources>} survey - The materials found.
 * @returns {ListRow[]} The rows.
 */
function materialListRows(survey) {
    const materials = [...survey.keys()].sort((a, b) => b.meshInstances.size - a.meshInstances.size ||
        materialName(a).localeCompare(materialName(b)) || a.id - b.id);
    return materials.map((material) => {
        const name = materialName(material);
        const instances = material.meshInstances.size;
        const textures = materialTextures(material).size;
        const variants = material.variants.size;
        const assets = survey.get(material).assets;
        const cells = [{ text: name, cls: 'pci-cell-name' }];
        cells.push({ text: typeOf(material).replace(/Material$/, '') || 'Material', cls: 'pci-cell-tag pci-cell-tag-info' });
        if (material.transparent) cells.push({ text: 'transparent', cls: 'pci-cell-tag pci-cell-tag-info' });
        const counts = `${instances} instance${instances === 1 ? '' : 's'} · ${textures} texture${textures === 1 ? '' : 's'} · ` +
            `${variants} variant${variants === 1 ? '' : 's'}`;
        cells.push({ text: counts, cls: 'pci-cell-info' });
        cells.push({ text: `#${material.id}`, cls: 'pci-cell-info pci-cell-right' });
        const title = `${typeOf(material)} "${name}" #${material.id}\n` +
            `${instances} mesh instance${instances === 1 ? '' : 's'}, ${textures} texture${textures === 1 ? '' : 's'}, ` +
            `${variants} compiled variant${variants === 1 ? '' : 's'}` +
            `${assets.length ? `\nfrom asset "${assets[0].name}"` : ''}`;
        return { key: `material${material.id}`, item: material, name, dim: instances === 0, title, cells };
    });
}

/**
 * Everything the property view shows for a material: its textures, its compiled variants and its
 * properties, and what uses it, with each mesh instance opening in place.
 *
 * @param {Material} material - The material.
 * @param {{ app: AppBase }} ctx - The app, to find the assets and debug lines using the material.
 * @returns {PropertySection[]} The sections.
 */
function buildMaterialModel(material, ctx) {
    const sources = surveyMaterials(ctx.app).get(material) ?? { assets: [], lines: [] };

    const general = makeSection('material', `${typeOf(material)} "${materialName(material)}"`);
    push(general, 'id', describeValue(material.id));
    const textures = [...materialTextures(material)];
    push(general, 'textures', {
        text: textures.length ? `${textures.length} texture${textures.length === 1 ? '' : 's'}` : 'none',
        cls: textures.length ? 'obj' : 'null',
        items: textures.map((texture, index) => ({ label: `[${index}]`, ...describeValue(texture) }))
    });
    general.rows.push(...materialRows(material));

    const usage = makeSection('users', 'Used by');
    const instances = [...material.meshInstances];
    push(usage, 'mesh instances', {
        text: instances.length ? `${instances.length} mesh instance${instances.length === 1 ? '' : 's'}` : 'none',
        cls: instances.length ? 'obj' : 'null',
        items: instances.slice(0, MAX_INSTANCES).map((instance, index) => ({
            label: `[${index}]`,
            ...describeValue(instance),
            text: nodeLabel(instance.node ?? null),
            expand: () => meshInstanceRows(instance)
        }))
    });
    if (instances.length > MAX_INSTANCES) {
        usage.rows.push({ key: 'more', label: '', value: { text: `… ${instances.length - MAX_INSTANCES} more`, cls: 'null' }, depth: 1 });
    }
    if (sources.assets.length) {
        push(usage, 'assets', {
            text: `${sources.assets.length} asset${sources.assets.length === 1 ? '' : 's'}`,
            cls: 'obj',
            items: sources.assets.map((asset, index) => ({ label: `[${index}]`, ...describeValue(asset) }))
        });
    }
    if (sources.lines.length) {
        push(usage, 'debug lines', { text: sources.lines.map(name => `"${name}"`).join(', '), cls: 'obj' });
    }

    return [general, usage];
}

/**
 * @param {AppBase} app - The app.
 * @param {Texture} texture - A texture.
 * @returns {Material[]} The materials found that sample it.
 */
function materialsUsingTexture(app, texture) {
    return [...surveyMaterials(app).keys()].filter(material => materialTextures(material).has(texture));
}

/**
 * @param {AppBase} app - The app.
 * @param {Shader} shader - A shader.
 * @returns {Material[]} The materials found that compiled it as one of their variants.
 */
function materialsUsingShader(app, shader) {
    return [...surveyMaterials(app).keys()].filter(material => [...material.variants.values()].includes(shader));
}

/**
 * @param {Material[]} materials - The materials using something.
 * @returns {PropertySection} A section listing them, each linking to the Materials tab.
 */
function usedByMaterialsSection(materials) {
    const section = makeSection('materials', 'Used by materials');
    push(section, 'materials', {
        text: materials.length ? `${materials.length} material${materials.length === 1 ? '' : 's'}` : 'none found',
        cls: materials.length ? 'obj' : 'null',
        items: materials.map((material, index) => ({ label: `[${index}]`, ...describeValue(material) }))
    });
    return section;
}

export {
    buildMaterialModel, materialListRows, materialsUsingShader, materialsUsingTexture, surveyMaterials,
    usedByMaterialsSection
};
