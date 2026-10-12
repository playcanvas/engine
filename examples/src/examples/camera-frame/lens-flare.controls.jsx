import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
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
    return (
        <>
            <Panel headerText='Lens Flare'>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.flare.intensity' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.flare.scale' }}
                        min={0.25}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Occlusion Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.flare.occlusionRadius' }}
                        min={0}
                        max={0.1}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Occlusion Fade'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.flare.occlusionFade' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Edge Fade'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.flare.edgeFade' }}
                        min={0}
                        max={0.6}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Allow Off Screen'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.flare.allowOffScreen' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Lights'>
                <LabelGroup text='Sun'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lights.sun' }}
                    />
                </LabelGroup>
                <LabelGroup text='Lamps'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lights.lamps' }}
                    />
                </LabelGroup>
                <LabelGroup text='Spots'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lights.spots' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Debug'>
                <LabelGroup text='View'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.debug' }}
                        type='string'
                        options={[
                            { v: 'none', t: 'NONE' },
                            { v: 'lensflare', t: 'LENS FLARE' },
                            { v: 'bloom', t: 'BLOOM' },
                            { v: 'scene', t: 'SCENE' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
