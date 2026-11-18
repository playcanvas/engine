import {
    BindingTwoWay,
    BooleanInput,
    Button,
    Label,
    LabelGroup,
    Panel,
    Progress,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

const presetOptions = [
    { v: 0, t: 'Midday' },
    { v: 1, t: 'Sunset' },
    { v: 2, t: 'Night' }
];

const formatOptions = [
    { v: 'rgba16f', t: 'RGBA16F' },
    { v: 'rgba8', t: 'RGBA8' }
];

const faceSizeOptions = [
    { v: 4, t: '4' },
    { v: 5, t: '5' },
    { v: 8, t: '8' },
    { v: 16, t: '16' },
    { v: 32, t: '32' }
];

const sourceOptions = [
    { v: 'gbuffer', t: 'G-buffer' },
    { v: 'scene', t: 'Scene' }
];

// the values of the observer the buttons follow
const editVolumePaths = ['settings.editVolume', 'bake.capturing'];
const relightPaths = ['settings.autoRelight', 'bake.relight', 'bake.baking'];
const bakingPaths = ['bake.baking'];
const progressPaths = ['bake.capturing', 'bake.progress'];

/**
 * Renders an element from values of the observer, and renders it again when they change, without
 * rendering the panels holding it again.
 *
 * @param {object} props - The props.
 * @param {Observer} props.observer - The observer.
 * @param {string[]} props.paths - The paths of the values.
 * @param {(values: any[], props: object) => ReactElement} props.render - Renders the element from
 * the values, with the props the panel passes to its children.
 * @returns {ReactElement} The element.
 */
const Observed = ({ observer, paths, render, ...props }) => {
    const [values, setValues] = useState(() => paths.map((path) => observer.get(path)));
    useEffect(() => {
        const update = () => setValues(paths.map((path) => observer.get(path)));
        // observer.on returns an EventHandle to unbind with - the observer has no 'off' method
        const events = paths.map((path) => observer.on(`${path}:set`, update));
        return () => events.forEach((event) => event?.unbind());
    }, [observer, paths]);
    return render(values, props);
};

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    // releasing the pointer ends the preview of the probes at a new spacing. The slider stops the
    // event from bubbling, so it is caught on the way down
    useEffect(() => {
        const onPointerUp = () => observer.emit('pointerup');
        window.addEventListener('pointerup', onPointerUp, true);
        return () => window.removeEventListener('pointerup', onPointerUp, true);
    }, [observer]);

    // the Baking panel starts collapsed, and expanding it starts the capture of the geometry of the
    // probes. The settings of the probe volume can be changed while editing it, and none can while
    // capturing, except the status and progress
    const bakingPanel = useRef(null);
    const volumePanel = useRef(null);
    const lightingPanel = useRef(null);
    useLayoutEffect(() => {
        const panel = bakingPanel.current?.element;
        if (!panel) {
            return;
        }

        // collapsed here rather than with the collapsed prop, which the PCUI React components apply
        // again whenever the controls render, such as when the window is resized, collapsing the
        // panel the user expanded. This runs before the panel is first shown
        panel.collapsed = true;
        // PCUI elements, like the observer, return an EventHandle to unbind with, and have no 'off'
        const expand = panel.on('expand', () => observer.emit('expand'));

        // the rows are enabled one by one, as the React components don't make them children of the
        // panels in PCUI. The buttons render their own state
        const setRowsEnabled = (/** @type {any} */ section, /** @type {boolean} */ enabled) => {
            section.current?.element.dom.querySelectorAll('.pcui-label-group').forEach((node) => {
                node.ui.enabled = enabled;
            });
        };
        const updateEnabled = () => {
            const capturing = observer.get('bake.capturing');
            setRowsEnabled(volumePanel, observer.get('settings.editVolume') && !capturing);
            setRowsEnabled(lightingPanel, !capturing);
        };
        updateEnabled();
        const events = ['bake.capturing:set', 'settings.editVolume:set'].map((event) =>
            observer.on(event, updateEnabled)
        );
        return () => {
            expand.unbind();
            events.forEach((event) => event?.unbind());
        };
    }, [observer]);

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
    const info = (path) => (
        <Label binding={new BindingTwoWay()} link={{ observer, path }} value={observer.get(path)} />
    );
    const select = (path, options, type) => (
        <SelectInput
            type={type}
            options={options}
            binding={new BindingTwoWay()}
            link={{ observer, path }}
        />
    );
    return (
        <>
            <Panel headerText='Lighting'>
                <LabelGroup text='Preset'>
                    {select('settings.preset', presetOptions, 'number')}
                </LabelGroup>
                <LabelGroup text='Probes lighting'>{toggle('settings.probes')}</LabelGroup>
                <LabelGroup text='Probe intensity'>
                    {slider('settings.intensity', 0, 3, 2)}
                </LabelGroup>
                <LabelGroup text='Sharper SH'>{toggle('settings.shSharpening')}</LabelGroup>
                <LabelGroup text='Leak reduction'>{toggle('settings.leakReduction')}</LabelGroup>
                <LabelGroup text='Visibility'>{toggle('settings.visibility')}</LabelGroup>
                <LabelGroup text='Reflection occlusion'>
                    {toggle('settings.reflectionOcclusion')}
                </LabelGroup>
                <LabelGroup text='Normal bias'>{slider('settings.normalBias', 0, 1, 2)}</LabelGroup>
                <LabelGroup text='Format'>{select('settings.format', formatOptions)}</LabelGroup>
                <LabelGroup text='Show probes'>{toggle('settings.showProbes')}</LabelGroup>
                <LabelGroup text='Characters'>{toggle('settings.characters')}</LabelGroup>
            </Panel>
            <Panel ref={bakingPanel} headerText='Baking' collapsible>
                <LabelGroup text='Status'>{info('bake.status')}</LabelGroup>
                <Observed
                    observer={observer}
                    paths={progressPaths}
                    render={([capturing, progress], props) => (
                        <Progress
                            {...props}
                            ignoreParent
                            hidden={!capturing}
                            value={progress * 100}
                        />
                    )}
                />
                <LabelGroup text='Probes'>{info('bake.probes')}</LabelGroup>
                <LabelGroup text='Geometry'>{info('bake.geometry')}</LabelGroup>
                <LabelGroup text='Lighting'>{info('bake.lighting')}</LabelGroup>
                <Panel ref={volumePanel} headerText='Probe volume'>
                    <Observed
                        observer={observer}
                        paths={editVolumePaths}
                        render={([editVolume, capturing], props) => (
                            <Button
                                {...props}
                                text={editVolume ? 'Done editing' : 'Edit probes'}
                                enabled={!capturing}
                                onClick={() =>
                                    observer.set(
                                        'settings.editVolume',
                                        !observer.get('settings.editVolume')
                                    )
                                }
                            />
                        )}
                    />
                    <LabelGroup text='Spacing'>{slider('settings.spacing', 0.2, 8, 1)}</LabelGroup>
                    <LabelGroup text='Face size'>
                        {select('settings.faceSize', faceSizeOptions, 'number')}
                    </LabelGroup>
                    <LabelGroup text='Capture emissive'>{toggle('settings.emissive')}</LabelGroup>
                    <LabelGroup text='Validity'>{toggle('settings.validity')}</LabelGroup>
                    <LabelGroup text='Virtual offset'>
                        {toggle('settings.virtualOffset')}
                    </LabelGroup>
                </Panel>
                <Panel ref={lightingPanel} headerText='Lighting of the preset'>
                    <LabelGroup text='Sun elevation'>
                        {slider('settings.elevation', -30, 90, 0)}
                    </LabelGroup>
                    <LabelGroup text='Sky rotation'>
                        {slider('settings.rotation', 0, 360, 0)}
                    </LabelGroup>
                    <LabelGroup text='Sun intensity'>
                        {slider('settings.sunIntensity', 0, 8, 2)}
                    </LabelGroup>
                    <LabelGroup text='Sky brightness'>
                        {slider('settings.luminance', 0, 4, 2)}
                    </LabelGroup>
                    <LabelGroup text='Bounces'>{slider('settings.bounces', 0, 4, 0)}</LabelGroup>
                    <LabelGroup text='Source'>
                        {select('settings.source', sourceOptions)}
                    </LabelGroup>
                    <LabelGroup text='Dilation'>{toggle('settings.dilation')}</LabelGroup>
                    <LabelGroup text='Auto bake'>{toggle('settings.autoRelight')}</LabelGroup>
                    <Observed
                        observer={observer}
                        paths={relightPaths}
                        render={([autoRelight, relight, baking], props) => (
                            <Button
                                {...props}
                                text='Bake preset'
                                hidden={autoRelight}
                                enabled={relight && !baking}
                                onClick={() => observer.emit('relight')}
                            />
                        )}
                    />
                </Panel>
                <Observed
                    observer={observer}
                    paths={bakingPaths}
                    render={([baking], props) => (
                        <Button
                            {...props}
                            text='Download probes'
                            enabled={!baking}
                            onClick={() => observer.emit('download')}
                        />
                    )}
                />
            </Panel>
        </>
    );
}
