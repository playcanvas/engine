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
            <Panel headerText='Debug'>
                <LabelGroup text='View'>
                    <SelectInput
                        type='string'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.debug' }}
                        value={observer.get('settings.debug') || 'none'}
                        options={[
                            { v: 'none', t: 'Composed frame' },
                            { v: 'depth', t: 'Scene depth' },
                            { v: 'scene', t: 'Scene color' },
                            { v: 'dofcoc', t: 'DOF circle of confusion' },
                            { v: 'dofblur', t: 'DOF blur' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Fog'>
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
                        max={0.1}
                        precision={3}
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
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.intensity' }}
                        min={0}
                        max={5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Max distance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.maxDistance' }}
                        min={10}
                        max={100}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Steps'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fog.steps' }}
                        min={8}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Depth of field'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.dof.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Focus size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.dof.focusSize' }}
                        min={0.5}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Focus range'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.dof.focusRange' }}
                        min={0.5}
                        max={5}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Blur radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.dof.blurRadius' }}
                        min={1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Sky'>
                <LabelGroup text='Time'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.sky.time' }}
                        min={0}
                        max={24}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Rotation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.sky.rotation' }}
                        min={0}
                        max={360}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Exposure'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.sky.exposure' }}
                        min={0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
