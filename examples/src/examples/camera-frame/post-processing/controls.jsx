import {
    BindingTwoWay,
    BooleanInput,
    ColorPicker,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';
import { useEffect, useState } from 'react';

import {
    SSAOTYPE_COMBINE,
    SSAOTYPE_LIGHTING,
    TONEMAP_ACES,
    TONEMAP_ACES2,
    TONEMAP_AGX,
    TONEMAP_AGX_PUNCHY,
    TONEMAP_FILMIC,
    TONEMAP_HEJL,
    TONEMAP_LINEAR,
    TONEMAP_NEUTRAL
} from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement, ReactNode } from 'react'
 */

/**
 * A panel of an effect, which shows the settings of the effect only while it is enabled.
 *
 * @param {{ observer: Observer, name: string, title: string, children: ReactNode }} props - The
 * panel props.
 * @returns {ReactElement} The panel.
 */
function EffectPanel({ observer, name, title, children }) {
    const path = `settings.${name}.enabled`;
    const [enabled, setEnabled] = useState(observer.get(path) ?? false);

    useEffect(() => {
        // observer.on returns an EventHandle to unbind with - the observer has no 'off' method
        const event = observer.on(`${path}:set`, () => setEnabled(observer.get(path)));
        return () => event?.unbind();
    }, [observer, path]);

    return (
        <Panel headerText={title}>
            <LabelGroup text='Enabled'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path }}
                />
            </LabelGroup>
            {enabled && children}
        </Panel>
    );
}

/**
 * The debug views, with the effects and the anti-aliasing methods they need: a view shows nothing
 * unless one of them is enabled. The depth is generated for the effects which use it.
 *
 * @type {{ v: string, t: string, effects?: string[], methods?: string[] }[]}
 */
const DEBUG_VIEWS = [
    { v: 'none', t: 'None' },
    { v: 'scene', t: 'Scene' },
    {
        v: 'depth',
        t: 'Depth',
        effects: ['ssao', 'dof', 'fog', 'lensFlare'],
        methods: ['taa', 'taaUpscale']
    },
    { v: 'bloom', t: 'Bloom', effects: ['bloom'] },
    { v: 'ssao', t: 'Ambient Occlusion', effects: ['ssao'] },
    { v: 'dofcoc', t: 'DOF Circle of Confusion', effects: ['dof'] },
    { v: 'dofblur', t: 'DOF Blur', effects: ['dof'] },
    { v: 'lensflare', t: 'Lens Flare', effects: ['lensFlare'] },
    { v: 'autoexposure', t: 'Auto Exposure', effects: ['autoExposure'] },
    { v: 'smaaedges', t: 'SMAA Edges', methods: ['smaa', 'msaaSmaa'] },
    { v: 'smaaweights', t: 'SMAA Weights', methods: ['smaa', 'msaaSmaa'] },
    { v: 'vignette', t: 'Vignette', effects: ['vignette'] }
];

/**
 * The debug view select, listing only the debug views which show something with the current
 * settings. When the selected view stops showing anything, the debug view is turned off.
 *
 * @param {{ observer: Observer }} props - The select props.
 * @returns {ReactElement} The select.
 */
function DebugSelect({ observer }) {
    const getViews = () => {
        // a disabled camera frame shows no debug views
        if (!observer.get('settings.frame.enabled')) {
            return DEBUG_VIEWS.slice(0, 1);
        }
        const method = observer.get('settings.antialiasing.method');
        return DEBUG_VIEWS.filter(
            ({ effects, methods }) =>
                (!effects && !methods) ||
                effects?.some((name) => observer.get(`settings.${name}.enabled`)) ||
                methods?.includes(method)
        );
    };
    const [views, setViews] = useState(getViews);

    useEffect(() => {
        const event = observer.on('*:set', () => {
            const available = getViews();
            const ids = available.map((view) => view.v).join();
            setViews((previous) =>
                ids === previous.map((view) => view.v).join() ? previous : available
            );
            if (!available.some((view) => view.v === observer.get('settings.frame.debug'))) {
                observer.set('settings.frame.debug', 'none');
            }
        });
        return () => event?.unbind();
    }, [observer]);

    // the select does not update its options once created, so it is recreated when they change
    return (
        <LabelGroup key={views.map((view) => view.v).join()} text='Debug'>
            <SelectInput
                binding={new BindingTwoWay()}
                link={{ observer, path: 'settings.frame.debug' }}
                type='string'
                options={views.map(({ v, t }) => ({ v, t }))}
            />
        </LabelGroup>
    );
}

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    /**
     * @param {string} text - The label.
     * @param {string} path - The path of the setting.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @param {number} [precision] - The number of decimals.
     * @returns {ReactElement} The slider.
     */
    const slider = (text, path, min, max, precision = 2) => (
        <LabelGroup text={text}>
            <SliderInput
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
                min={min}
                max={max}
                precision={precision}
            />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (text, path) => (
        <LabelGroup text={text}>
            <BooleanInput
                type='toggle'
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
            />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The path of the setting.
     * @param {{ v: string | number, t: string }[]} options - The options.
     * @param {'string' | 'number'} [type] - The type of the values.
     * @returns {ReactElement} The select.
     */
    const select = (text, path, options, type = 'string') => (
        <LabelGroup text={text}>
            <SelectInput
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
                type={type}
                options={options}
            />
        </LabelGroup>
    );

    /**
     * @param {string} text - The label.
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The color picker.
     */
    const color = (text, path) => (
        <LabelGroup text={text}>
            <ColorPicker
                binding={new BindingTwoWay()}
                link={{ observer, path: `settings.${path}` }}
            />
        </LabelGroup>
    );

    return (
        <>
            <Panel headerText='Camera Frame'>
                {toggle('Enabled', 'frame.enabled')}
                {slider('Resolution', 'frame.scale', 0.2, 1, 1)}
                {select(
                    'Tone Mapping',
                    'frame.toneMapping',
                    [
                        { v: TONEMAP_LINEAR, t: 'Linear' },
                        { v: TONEMAP_FILMIC, t: 'Filmic' },
                        { v: TONEMAP_HEJL, t: 'Hejl' },
                        { v: TONEMAP_ACES, t: 'ACES' },
                        { v: TONEMAP_ACES2, t: 'ACES2' },
                        { v: TONEMAP_NEUTRAL, t: 'Neutral' },
                        { v: TONEMAP_AGX, t: 'AgX' },
                        { v: TONEMAP_AGX_PUNCHY, t: 'AgX Punchy' }
                    ],
                    'number'
                )}
                <DebugSelect observer={observer} />
            </Panel>
            <Panel headerText='Anti-aliasing'>
                {select('Method', 'antialiasing.method', [
                    { v: 'none', t: 'None' },
                    { v: 'msaa', t: 'MSAA' },
                    { v: 'smaa', t: 'SMAA' },
                    { v: 'msaaSmaa', t: 'MSAA + SMAA' },
                    { v: 'taa', t: 'TAA' },
                    { v: 'taaUpscale', t: 'TAA Upscale' }
                ])}
                {slider('Sharpness', 'antialiasing.sharpness', 0, 1)}
            </Panel>
            <EffectPanel observer={observer} name='bloom' title='Bloom'>
                {slider('Intensity', 'bloom.intensity', 0, 100, 0)}
                {slider('Blur Level', 'bloom.blurLevel', 1, 16, 0)}
                {slider('Threshold', 'bloom.threshold', 0, 10, 1)}
                {toggle('High Quality', 'bloom.highQuality')}
            </EffectPanel>
            <EffectPanel observer={observer} name='ssao' title='Ambient Occlusion'>
                {select('Type', 'ssao.type', [
                    { v: SSAOTYPE_LIGHTING, t: 'Lighting' },
                    { v: SSAOTYPE_COMBINE, t: 'Combine' }
                ])}
                {slider('Intensity', 'ssao.intensity', 0, 1)}
                {slider('Radius', 'ssao.radius', 0.1, 3)}
                {slider('Samples', 'ssao.samples', 1, 64, 0)}
                {toggle('Blur', 'ssao.blur')}
            </EffectPanel>
            <EffectPanel observer={observer} name='dof' title='Depth of Field'>
                {slider('Focus Distance', 'dof.focusDistance', 1, 20, 1)}
                {slider('Focus Range', 'dof.focusRange', 0.1, 10, 1)}
                {slider('Blur Radius', 'dof.blurRadius', 1, 10, 1)}
                {toggle('Near Blur', 'dof.nearBlur')}
                {toggle('High Quality', 'dof.highQuality')}
            </EffectPanel>
            <EffectPanel observer={observer} name='fog' title='Volumetric Fog'>
                {slider('Density', 'fog.density', 0, 0.3, 3)}
                {slider('Intensity', 'fog.intensity', 0, 5)}
                {slider('Anisotropy', 'fog.anisotropy', -0.9, 0.9)}
                {toggle('Spot Lights', 'fog.spotLights')}
                {toggle('Omni Lights', 'fog.omniLights')}
            </EffectPanel>
            <EffectPanel observer={observer} name='lensFlare' title='Lens Flare'>
                {slider('Intensity', 'lensFlare.intensity', 0, 3)}
                {slider('Scale', 'lensFlare.scale', 0.1, 2)}
            </EffectPanel>
            <EffectPanel observer={observer} name='autoExposure' title='Auto Exposure'>
                {slider('Compensation', 'autoExposure.compensation', -5, 3, 1)}
                {slider('Dark To Light', 'autoExposure.speedDarkToLight', 0.1, 10, 1)}
                {slider('Light To Dark', 'autoExposure.speedLightToDark', 0.1, 10, 1)}
            </EffectPanel>
            <EffectPanel observer={observer} name='grading' title='Grading'>
                {slider('Saturation', 'grading.saturation', 0, 2)}
                {slider('Brightness', 'grading.brightness', 0, 3)}
                {slider('Contrast', 'grading.contrast', 0.5, 1.5)}
                {color('Tint', 'grading.tint')}
            </EffectPanel>
            <EffectPanel observer={observer} name='colorEnhance' title='Color Enhance'>
                {slider('Shadows', 'colorEnhance.shadows', -3, 3)}
                {slider('Highlights', 'colorEnhance.highlights', -3, 3)}
                {slider('Midtones', 'colorEnhance.midtones', -1, 1)}
                {slider('Vibrance', 'colorEnhance.vibrance', -1, 1)}
                {slider('Dehaze', 'colorEnhance.dehaze', -1, 1)}
            </EffectPanel>
            <EffectPanel observer={observer} name='colorLut' title='Color LUT'>
                {select('Table', 'colorLut.lut', [
                    { v: 'lut-teal-orange', t: 'Teal Orange' },
                    { v: 'lut-late-sunset', t: 'Late Sunset' },
                    { v: 'lut-moonlight', t: 'Moonlight' },
                    { v: 'lut-sofia', t: 'Sofia' },
                    { v: 'lut-bw', t: 'Black and White' }
                ])}
                {slider('Intensity', 'colorLut.intensity', 0, 1)}
            </EffectPanel>
            <EffectPanel observer={observer} name='vignette' title='Vignette'>
                {slider('Inner', 'vignette.inner', 0, 3)}
                {slider('Outer', 'vignette.outer', 0, 3)}
                {slider('Curvature', 'vignette.curvature', 0.01, 10)}
                {slider('Intensity', 'vignette.intensity', 0, 1)}
                {color('Color', 'vignette.color')}
            </EffectPanel>
            <EffectPanel observer={observer} name='fringing' title='Fringing'>
                {slider('Intensity', 'fringing.intensity', 0, 100, 0)}
            </EffectPanel>
            <Panel headerText='Scene'>
                {slider('Sky Brightness', 'scene.sky', 0, 30, 1)}
                {slider('Emissive', 'scene.emissive', 0, 5)}
                {toggle('Animate', 'scene.animate')}
                {toggle('Text', 'scene.text')}
            </Panel>
        </>
    );
}
