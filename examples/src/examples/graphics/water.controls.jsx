import {
    BindingTwoWay,
    ColorPicker,
    LabelGroup,
    Panel,
    SliderInput,
    BooleanInput,
    SelectInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    /**
     * @param {string} path - The observer path suffix.
     * @param {number} min - Slider minimum.
     * @param {number} max - Slider maximum.
     * @param {number} precision - Slider precision.
     * @returns {ReactElement} The slider.
     */
    const slider = (path, min, max, precision) => (
        <SliderInput
            binding={new BindingTwoWay()}
            link={{ observer, path: `data.${path}` }}
            min={min}
            max={max}
            precision={precision}
        />
    );

    /**
     * @param {string} path - The observer path suffix.
     * @returns {ReactElement} The toggle.
     */
    const toggle = path => (
        <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer, path: `data.${path}` }} />
    );

    return (
        <>
            <Panel headerText='Scene' collapsible>
                <LabelGroup text='Time'>{slider('timeOfDay', 0, 24, 2)}</LabelGroup>
                <LabelGroup text='Spec Power'>{slider('specularPower', 8, 2048, 0)}</LabelGroup>
                <LabelGroup text='Spec Intensity'>{slider('specularIntensity', 0, 4, 2)}</LabelGroup>
                <LabelGroup text='Diffuse'>{slider('diffuseIntensity', 0, 1, 2)}</LabelGroup>
            </Panel>
            <Panel headerText='Reflection' collapsible>
                <LabelGroup text='Source'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.reflectionSource' }}
                        type='string'
                        options={[
                            { v: 'planar', t: 'Planar' },
                            { v: 'sky', t: 'Sky Dome' },
                            { v: 'none', t: 'None' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Strength'>{slider('reflectionStrength', 0, 2, 2)}</LabelGroup>
                <LabelGroup text='Sky Blur'>{slider('skyBlur', 0, 4, 1)}</LabelGroup>
                <LabelGroup text='Fresnel Power'>{slider('fresnelPower', 0.5, 16, 1)}</LabelGroup>
            </Panel>
            <Panel headerText='Refraction' collapsible>
                <LabelGroup text='Enabled'>{toggle('refraction')}</LabelGroup>
                <LabelGroup text='Distortion'>{slider('distortion', 0, 0.2, 3)}</LabelGroup>
                <LabelGroup text='Opacity'>{slider('opacity', 0, 1, 2)}</LabelGroup>
            </Panel>
            <Panel headerText='Rendering' collapsible collapsed>
                <LabelGroup text='Oblique Clip'>{toggle('obliqueClipping')}</LabelGroup>
                <LabelGroup text='Clip Bias'>{slider('clipBias', 0, 2, 2)}</LabelGroup>
                <LabelGroup text='Texture Scale'>{slider('textureScale', 0.1, 1, 2)}</LabelGroup>
            </Panel>
            <Panel headerText='Water' collapsible>
                <LabelGroup text='Preset'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.preset' }}
                        type='string'
                        options={[
                            { v: 'tropical', t: 'Tropical' },
                            { v: 'ocean', t: 'Ocean' },
                            { v: 'murky', t: 'Murky' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Depth Effects'>{toggle('depthEffects')}</LabelGroup>
                <LabelGroup text='Shore Soft'>{slider('shoreSoftness', 0.01, 3, 2)}</LabelGroup>
                <LabelGroup text='Bumpiness'>{slider('bumpiness', 0, 2, 2)}</LabelGroup>
                <LabelGroup text='Ripple Tiling'>{slider('rippleTiling', 0.01, 0.5, 3)}</LabelGroup>
                <LabelGroup text='Ripple Speed'>{slider('rippleSpeed', 0, 0.3, 3)}</LabelGroup>
                <LabelGroup text='Foam'>{toggle('foam')}</LabelGroup>
                <LabelGroup text='Foam Depth'>{slider('foamDepth', 0.01, 3, 2)}</LabelGroup>
            </Panel>
            <Panel headerText='Underwater' collapsible>
                <LabelGroup text='Caustics'>{toggle('caustics')}</LabelGroup>
                <LabelGroup text='Intensity'>{slider('causticsStrength', 0, 4, 2)}</LabelGroup>
                <LabelGroup text='UV Scale'>{slider('causticsTiling', 0.01, 0.5, 3)}</LabelGroup>
                <LabelGroup text='Speed'>{slider('causticsSpeed', 0, 0.2, 3)}</LabelGroup>
                <LabelGroup text='Depth Fade'>{slider('causticsDepth', 0.1, 10, 1)}</LabelGroup>
                <LabelGroup text='Snell Window'>{slider('snellWindow', 0.05, 0.95, 2)}</LabelGroup>
                <LabelGroup text='Fog Density'>{slider('fogDensity', 0, 0.2, 3)}</LabelGroup>
                <LabelGroup text='Fog Brightness'>{slider('fogBrightness', 0, 1, 2)}</LabelGroup>
                <LabelGroup text='Fog Color'>
                    <ColorPicker
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fogColor' }}
                        channels={3}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Waves' collapsible>
                <LabelGroup text='Enabled'>{toggle('waves')}</LabelGroup>
                <LabelGroup text='Steepness'>{slider('waveSteepness', 0, 1, 2)}</LabelGroup>
                <LabelGroup text='Amplitude'>{slider('waveAmplitude', 0, 1, 2)}</LabelGroup>
                <LabelGroup text='Length'>{slider('waveLength', 1, 40, 1)}</LabelGroup>
                <LabelGroup text='Speed'>{slider('waveSpeed', 0, 4, 2)}</LabelGroup>
                <LabelGroup text='Direction'>{slider('waveDirection', 0, 360, 0)}</LabelGroup>
                <LabelGroup text='Swell Amplitude'>{slider('swellAmplitude', 0, 2, 2)}</LabelGroup>
                <LabelGroup text='Swell Length'>{slider('swellLength', 1, 200, 1)}</LabelGroup>
                <LabelGroup text='Swell Speed'>{slider('swellSpeed', 0, 4, 2)}</LabelGroup>
                <LabelGroup text='Swell Direction'>{slider('swellDirection', 0, 360, 0)}</LabelGroup>
            </Panel>
        </>
    );
}
