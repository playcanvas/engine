import { Component } from '../../framework/components/component.js';
import { Entity } from '../../framework/entity.js';
import { ScriptType } from '../../framework/script/script-type.js';
import { Script } from '../../framework/script/script.js';

import { describeValue } from './describe.js';
import { makeSection, push, read, reflectRows } from './model.js';

/** @import { GraphNode } from '../../scene/graph-node.js' */
/** @import { PropertySection } from './model.js' */

// component properties that are plumbing rather than state, plus deprecated aliases whose getters
// would log a deprecation warning just by being read
const SKIP_COMPONENT = [
    'enabled', 'system', 'entity', 'data',
    'renderPasses', 'lodBaseDistance', 'lodMultiplier', 'lodDistances', 'splatBudget', 'noFog', 'bodyType'
];

// script properties that are plumbing rather than state
const SKIP_SCRIPT = ['enabled', 'app', 'entity'];

/**
 * @param {GraphNode} node - The node.
 * @returns {PropertySection} The general section.
 */
function nodeSection(node) {
    const isEntity = node instanceof Entity;
    const section = makeSection('node', isEntity ? 'Entity' : 'GraphNode');

    push(section, 'name', describeValue(node.name));
    if (isEntity) push(section, 'guid', describeValue(node.guid));
    push(section, 'enabled', describeValue(node._enabled));
    push(section, 'enabled in hierarchy', describeValue(node.enabled));
    push(section, 'tags', describeValue(node.tags.list()));
    push(section, 'path', describeValue(node.path));
    push(section, 'parent', describeValue(node.parent));
    push(section, 'children', describeValue(node.children.length));

    return section;
}

/**
 * @param {GraphNode} node - The node.
 * @returns {PropertySection} The transform section.
 */
function transformSection(node) {
    const section = makeSection('transform', 'Transform');

    push(section, 'local position', describeValue(node.getLocalPosition()));
    push(section, 'local rotation', describeValue(node.getLocalEulerAngles()));
    push(section, 'local scale', describeValue(node.getLocalScale()));
    push(section, 'world position', describeValue(node.getPosition()));
    push(section, 'world rotation', describeValue(node.getEulerAngles()));
    push(section, 'world scale', describeValue(node.getScale()));
    push(section, 'forward', describeValue(node.forward));

    return section;
}

/**
 * @param {string} name - The component name.
 * @param {Component} component - The component.
 * @returns {PropertySection} The component section.
 */
function componentSection(name, component) {
    const section = makeSection(`c:${name}`, name);
    push(section, 'enabled', read(component, 'enabled'));
    reflectRows(section, component, [Component.prototype], SKIP_COMPONENT);
    return section;
}

/**
 * @param {import('../../framework/components/script/component.js').ScriptComponent} scriptComponent - The script component.
 * @returns {PropertySection[]} One section per script instance.
 */
function scriptSections(scriptComponent) {
    const sections = [];
    const scripts = scriptComponent.scripts ?? [];

    scripts.forEach((script, index) => {
        const ctor = /** @type {any} */ (script.constructor);
        const name = ctor.scriptName ?? ctor.__name ?? ctor.name;
        const section = makeSection(`s:${index}:${name}`, `script › ${name}`);

        push(section, 'enabled', read(script, 'enabled'));

        if (script instanceof ScriptType) {
            // classic scripts declare their attributes up front
            for (const attribute in ctor.attributes?.index ?? {}) {
                push(section, attribute, read(script, attribute));
            }
        } else {
            reflectRows(section, script, [Script.prototype, ScriptType.prototype], SKIP_SCRIPT);
        }

        sections.push(section);
    });

    return sections;
}

/**
 * Everything the property view shows for a node: identity, transform, one section per component
 * and one per script instance.
 *
 * @param {GraphNode} node - The node.
 * @returns {PropertySection[]} The sections.
 */
function buildNodeModel(node) {
    const sections = [nodeSection(node), transformSection(node)];

    if (node instanceof Entity) {
        for (const name of Object.keys(node.c)) {
            const component = node.c[name];
            sections.push(componentSection(name, component));
            if (name === 'script') {
                sections.push(...scriptSections(/** @type {any} */ (component)));
            }
        }
    }

    return sections;
}

export { buildNodeModel };
