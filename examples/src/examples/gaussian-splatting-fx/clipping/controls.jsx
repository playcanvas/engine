import {
    BindingTwoWay,
    LabelGroup,
    BooleanInput,
    Panel,
    SelectInput,
    SliderInput,
    Label
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
            <Panel headerText='Settings'>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'animate' }}
                        value={observer.get('animate') ?? true}
                    />
                </LabelGroup>
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
                <LabelGroup text='Splat Budget'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={0.2}
                        max={6}
                        precision={1}
                        step={0.1}
                    />
                </LabelGroup>
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
