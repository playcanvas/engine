import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    Label,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

// in the order of the presets in the example
const PRESET_NAMES = [
    'None',
    'Neon Cyan',
    'Ghost Room',
    'Snowfall',
    'Deep Sea',
    'Hologram',
    'Uplink'
];

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    /**
     * @param {string} text - The label.
     * @param {string} path - The observer path.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @param {number} precision - The number of decimals.
     * @returns {ReactElement} The labelled slider.
     */
    const slider = (text, path, min, max, precision) => (
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
     * @returns {ReactElement} The labelled toggle.
     */
    const toggle = (text, path) => (
        <LabelGroup text={text}>
            <BooleanInput
                type='toggle'
                binding={new BindingTwoWay()}
                link={{ observer, path }}
                value={observer.get(path)}
            />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The observer path.
     * @returns {ReactElement} The labelled color picker.
     */
    const color = (text, path) => (
        <LabelGroup text={text}>
            <ColorPicker binding={new BindingTwoWay()} link={{ observer, path }} />
        </LabelGroup>
    );

    return (
        <>
            <Panel headerText='Presets'>
                <LabelGroup text='Preset'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'preset' }}
                        value={observer.get('preset') ?? 0}
                        options={PRESET_NAMES.map((t, v) => ({ v, t }))}
                    />
                </LabelGroup>
                {slider('Fade (s)', 'fadeDuration', 0, 10, 1)}
                {toggle('Auto Play', 'autoPlay')}
                {slider('Hold (s)', 'holdDuration', 1, 30, 0)}
            </Panel>
            <Panel headerText='Settings'>
                {toggle('Animate', 'animate')}
                <LabelGroup text='Renderer'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'renderer' }}
                        value={observer.get('renderer') ?? 0}
                        options={[
                            { v: 0, t: 'Auto' },
                            { v: 1, t: 'Raster (CPU Sort)' },
                            { v: 2, t: 'Raster (GPU Sort)' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Glyphs'>
                {slider('Glyphs %', 'glyph.percent', 0, 50, 1)}
                {slider('Size', 'glyph.size', 0.002, 0.1, 3)}
                {toggle('Snap to Grid', 'glyph.snap')}
                {slider('Swaps / Sec', 'glyph.swaps', 0, 10, 1)}
                {slider('Brightness', 'glyph.brightness', 0, 5, 2)}
                {slider('Resting Glow', 'glyph.glow', 0, 1, 2)}
                {slider('Scene Shading', 'glyph.shading', 0, 1, 2)}
                {slider('Opacity', 'glyph.opacity', 0, 1, 2)}
                {color('Color', 'glyph.color')}
                {color('Head Color', 'glyph.head')}
            </Panel>
            <Panel headerText='Rain'>
                {slider('Speed (rows/s)', 'rain.speed', 0, 60, 1)}
                {slider('Trail (rows)', 'rain.trail', 1, 80, 0)}
                {slider('Spacing (rows)', 'rain.spacing', 5, 300, 0)}
                {slider('Head', 'rain.head', 0, 1, 2)}
            </Panel>
            <Panel headerText='Falling Glyphs'>
                {slider('Distance', 'fall.distance', 0, 3, 2)}
                {slider('Speed', 'fall.speed', -3, 3, 2)}
            </Panel>
            <Panel headerText='Other Splats'>
                {slider('Density', 'others.density', 0, 1, 2)}
                {slider('Max Size', 'others.maxSize', 0.001, 1, 3)}
                {slider('Opacity', 'others.opacity', 0, 1, 2)}
                {slider('Brightness', 'others.brightness', 0, 2, 2)}
                {slider('Tint', 'others.tint', 0, 1, 2)}
                {slider('Rain Response', 'others.rain', 0, 2, 2)}
            </Panel>
            <Panel headerText='Turbulence'>
                {slider('Amount', 'turb.amount', 0, 0.5, 3)}
                {slider('Scale', 'turb.scale', 0.05, 3, 2)}
                {slider('Speed', 'turb.speed', 0, 3, 2)}
                {slider('Room', 'turb.room', 0, 1, 2)}
            </Panel>
            <Panel headerText='Post'>
                {slider('Bloom', 'post.bloom', 0, 0.2, 3)}
                {slider('Bloom Blur', 'post.blurLevel', 1, 16, 0)}
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='GSplat Count'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.gsplats' }}
                        value={observer.get('data.stats.gsplats')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
