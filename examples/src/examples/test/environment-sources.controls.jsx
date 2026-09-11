import {
    BindingTwoWay,
    BooleanInput,
    Button,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

// Short option texts: the select is narrow. The overlay explains what each choice feeds.
// Scene atlas and cubemap combine (atlas = rough reflections + ambient, cubemap = mirror term).
const sceneEnvOptions = [
    { v: 'none', t: 'none' },
    { v: 'atlas', t: 'atlas' },
    { v: 'cubemap', t: 'cubemap' },
    { v: 'atlas+cubemap', t: 'atlas+cubemap' }
];

// A material environment texture replaces the scene environment for every role, priority
// atlas+cubemap > atlas > cubemap > sphere map. 'none' uses the scene environment when useSkybox
// is set.
const materialEnvOptions = [
    { v: 'none', t: 'none' },
    { v: 'atlas', t: 'atlas' },
    { v: 'atlas+cubemap', t: 'atlas+cubemap' },
    { v: 'cubemap', t: 'cubemap' },
    { v: 'spheremap', t: 'sphere map' }
];

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const toggle = (path) => (
        <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer, path }} />
    );
    const slider = (path, min, max, precision) => (
        <SliderInput
            binding={new BindingTwoWay()}
            link={{ observer, path }}
            min={min}
            max={max}
            precision={precision}
        />
    );
    const select = (path, options) => (
        <SelectInput options={options} binding={new BindingTwoWay()} link={{ observer, path }} />
    );
    return (
        <>
            <Panel headerText='Scene environment (wide street)'>
                <LabelGroup text='Environment'>
                    {select('data.scene.env', sceneEnvOptions)}
                </LabelGroup>
                <LabelGroup text='Skybox mip (background only)'>
                    {slider('data.scene.mip', 0, 6, 0)}
                </LabelGroup>
                <LabelGroup text='Skybox intensity (scene env only)'>
                    {slider('data.scene.intensity', 0, 3, 2)}
                </LabelGroup>
                <LabelGroup text='Skybox rotation (scene env only)'>
                    {slider('data.scene.rotation', 0, 360, 0)}
                </LabelGroup>
                <LabelGroup text='Ambient light (constant)'>
                    {slider('data.scene.ambient', 0, 1, 2)}
                </LabelGroup>
            </Panel>
            <Panel headerText='Test material environment (empty room)'>
                <LabelGroup text='Environment'>
                    {select('data.material.env', materialEnvOptions)}
                </LabelGroup>
                <LabelGroup text='Use scene env (useSkybox)'>
                    {toggle('data.material.useSkybox')}
                </LabelGroup>
                <LabelGroup text='Ambient SH (overrides atlas)'>
                    {toggle('data.material.ambientSH')}
                </LabelGroup>
                <LabelGroup text='Box projection (all lookups)'>
                    {toggle('data.material.boxProjection')}
                </LabelGroup>
                <LabelGroup text='Refraction (uses reflections)'>
                    {toggle('data.material.refraction')}
                </LabelGroup>
                <LabelGroup text='Roughness'>
                    {slider('data.material.roughness', 0, 1, 2)}
                </LabelGroup>
                <LabelGroup text='Metalness (1 hides ambient)'>
                    {slider('data.material.metalness', 0, 1, 2)}
                </LabelGroup>
            </Panel>
            <Panel headerText='Diagnostics'>
                <LabelGroup text='Neighbour probe (green)'>
                    {toggle('data.probe.enabled')}
                </LabelGroup>
                <LabelGroup text='Trace shader alloc'>{toggle('data.traceShaderAlloc')}</LabelGroup>
                <Button text='Rebuild test shaders' onClick={() => observer.emit('rebuild')} />
            </Panel>
        </>
    );
}
