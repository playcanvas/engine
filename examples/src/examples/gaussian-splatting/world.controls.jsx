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
            <Panel headerText='Renderer'>
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
            <Panel headerText='Camera'>
                <LabelGroup text='Orbit'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'orbitCamera' }}
                        value={observer.get('orbitCamera') || false}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Settings'>
                <LabelGroup text='Debug'>
                    <SelectInput
                        type='number'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'debug' }}
                        value={observer.get('debug') ?? 0}
                        options={[
                            { v: 0, t: 'None' },
                            { v: 1, t: 'LOD' },
                            { v: 2, t: 'SH Update' },
                            { v: 4, t: 'AABBs' },
                            { v: 5, t: 'Node AABBs' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Splat Budget'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={0}
                        max={10}
                        precision={1}
                        step={0.1}
                    />
                </LabelGroup>
                <LabelGroup text='LOD Base Dist'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lodBaseDistance' }}
                        min={1}
                        max={50}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='LOD Multiplier'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lodMultiplier' }}
                        min={1.2}
                        max={10}
                        precision={1}
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
