import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput,
    VectorInput
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
            <Panel headerText='Shape'>
                <LabelGroup text='Shape'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'shape' }}
                        value={observer.get('shape') ?? 'cube'}
                        options={[
                            { v: 'cube', t: 'Cube' },
                            { v: 'gem', t: 'Gem' },
                            { v: 'prism', t: 'Hex Prism' },
                            { v: 'sphere', t: 'Sphere' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Size'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'size' }}
                        min={0.6}
                        max={2.5}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Splat'>
                <LabelGroup text='Offset'>
                    <VectorInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatOffset' }}
                        dimensions={3}
                    />
                </LabelGroup>
                <LabelGroup text='Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatScale' }}
                        min={0.01}
                        max={0.3}
                        precision={3}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Visuals'>
                <LabelGroup text='Exposure'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'exposure' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Background'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'background' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Refraction Index'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'ior' }}
                        min={1.0}
                        max={2.4}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Dispersion'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'dispersion' }}
                        min={0}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Thickness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'thickness' }}
                        min={0}
                        max={1.5}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Reflection'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'reflection' }}
                        min={0}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Frost'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'frost' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
