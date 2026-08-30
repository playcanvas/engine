import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
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
            <Panel headerText='Volumetric Fog'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Density'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.density' }}
                        min={0}
                        max={0.04}
                        precision={4}
                    />
                </LabelGroup>
                <LabelGroup text='Anisotropy'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.anisotropy' }}
                        min={0}
                        max={0.95}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Sun Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.intensity' }}
                        min={0}
                        max={5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Steps'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.steps' }}
                        min={4}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Resolution Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.scale' }}
                        min={0.25}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='TAA'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.taa' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Local Lights'>
                <LabelGroup text='Omni Lights'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.local.omni' }}
                    />
                </LabelGroup>
                <LabelGroup text='Spot Lights'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.local.spot' }}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.local.intensity' }}
                        min={0}
                        max={40}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Steps'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.local.steps' }}
                        min={2}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.local.shadows' }}
                    />
                </LabelGroup>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.local.animate' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
