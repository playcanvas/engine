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
            <Panel headerText='Scene'>
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
                <LabelGroup text='Edit mode'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'edit' }}
                    />
                </LabelGroup>
                <LabelGroup text='Splat budget (M)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={1}
                        max={8}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Wind'>
                <LabelGroup text='Strength'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'strength' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'speed' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Direction'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'direction' }}
                        min={0}
                        max={360}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Gustiness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'gustiness' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Flutter'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'flutter' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
