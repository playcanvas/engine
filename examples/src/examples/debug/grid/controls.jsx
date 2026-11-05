import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput,
    VectorInput
} from '@playcanvas/pcui/react';
import { useEffect, useState } from 'react';

import { PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    // size only when not infinite
    const [infinite, setInfinite] = useState(observer.get('grid.infinite') ?? true);
    useEffect(() => {
        const event = observer.on('grid.infinite:set', setInfinite);
        return () => event?.unbind();
    }, [observer]);

    // axis thickness only when axes show
    const [showAxes, setShowAxes] = useState(observer.get('grid.showAxes') ?? true);
    useEffect(() => {
        const event = observer.on('grid.showAxes:set', setShowAxes);
        return () => event?.unbind();
    }, [observer]);

    /**
     * @param {string} text - The label.
     * @param {string} path - The observer path.
     * @param {number} min - The minimum.
     * @param {number} max - The maximum.
     * @param {number} [precision] - The precision.
     * @returns {ReactElement} The slider.
     */
    const slider = (text, path, min, max, precision = 2) => (
        <LabelGroup text={text}>
            <SliderInput
                binding={new BindingTwoWay()}
                link={{ observer, path }}
                min={min}
                max={max}
                precision={precision}
            />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The observer path.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (text, path) => (
        <LabelGroup text={text}>
            <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer, path }} />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The observer path.
     * @returns {ReactElement} The color picker.
     */
    const color = (text, path) => (
        <LabelGroup text={text}>
            <ColorPicker channels={4} binding={new BindingTwoWay()} link={{ observer, path }} />
        </LabelGroup>
    );

    return (
        <>
            <LabelGroup text='Preset'>
                <SelectInput
                    options={[
                        { v: 'default', t: 'Default' },
                        { v: 'editor', t: 'Editor' },
                        { v: 'supersplat', t: 'SuperSplat' }
                    ]}
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'preset' }}
                />
            </LabelGroup>
            <Panel headerText='Grid'>
                {toggle('Enabled', 'grid.enabled')}
                <LabelGroup text='Plane'>
                    <SelectInput
                        options={[
                            { v: 'xz', t: 'XZ' },
                            { v: 'xy', t: 'XY' },
                            { v: 'yz', t: 'YZ' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'grid.plane' }}
                    />
                </LabelGroup>
                {slider('Spacing', 'grid.spacing', 0.1, 50, 1)}
                {slider('Subdivisions', 'grid.subdivisions', 1, 10, 0)}
            </Panel>
            <Panel headerText='Extent'>
                {toggle('Infinite', 'grid.infinite')}
                {!infinite && (
                    <LabelGroup text='Size'>
                        <VectorInput
                            binding={new BindingTwoWay()}
                            link={{ observer, path: 'grid.size' }}
                            dimensions={2}
                            min={0}
                        />
                    </LabelGroup>
                )}
                {slider('Fade Start', 'grid.fadeStart', 0, 1000, 0)}
                {slider('Fade End', 'grid.fadeEnd', 0, 1000, 0)}
            </Panel>
            <Panel headerText='Theme'>
                {color('Color X', 'grid.colorX')}
                {color('Color Y', 'grid.colorY')}
                {color('Color Z', 'grid.colorZ')}
                {color('Major Line Color', 'grid.majorLineColor')}
                {color('Minor Line Color', 'grid.minorLineColor')}
            </Panel>
            <Panel headerText='Axes'>
                {toggle('Show Axes', 'grid.showAxes')}
                {showAxes && slider('Axis Line Thickness', 'grid.axisLineThickness', 0.5, 5, 1)}
            </Panel>
            <Panel headerText='Lines'>
                {slider('Major Line Thickness', 'grid.majorLineThickness', 0.5, 5, 1)}
                {slider('Minor Line Thickness', 'grid.minorLineThickness', 0.5, 5, 1)}
                {toggle('Contrast', 'grid.contrast')}
            </Panel>
            <Panel headerText='Depth'>
                {slider('Depth Offset', 'grid.depthOffset', 0, 0.01, 4)}
                {toggle('Depth Test', 'grid.depthTest')}
                {toggle('Depth Write', 'grid.depthWrite')}
                {toggle('Depth Dither', 'grid.depthDither')}
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Projection'>
                    <SelectInput
                        type='number'
                        options={[
                            { v: PROJECTION_PERSPECTIVE + 1, t: 'Perspective' },
                            { v: PROJECTION_ORTHOGRAPHIC + 1, t: 'Orthographic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'camera.proj' }}
                    />
                </LabelGroup>
                {slider('Far Clip', 'camera.farClip', 10, 2000, 0)}
            </Panel>
        </>
    );
}
