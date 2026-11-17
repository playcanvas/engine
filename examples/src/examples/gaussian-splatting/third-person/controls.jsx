import {
    BindingTwoWay,
    LabelGroup,
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
                <LabelGroup text='Splat Budget (M)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={0}
                        max={10}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Distance'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraDistance' }}
                        min={1}
                        max={15}
                        precision={2}
                        step={0.1}
                    />
                </LabelGroup>
                <LabelGroup text='Height'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraHeight' }}
                        min={0}
                        max={4}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
                <LabelGroup text='Smoothing'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'cameraSmoothing' }}
                        min={0}
                        max={0.01}
                        precision={5}
                        step={0.0001}
                    />
                </LabelGroup>
                <LabelGroup text='Look Sens'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lookSens' }}
                        min={0.01}
                        max={0.5}
                        precision={3}
                        step={0.005}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Resolution'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.resolution' }}
                        value={observer.get('data.stats.resolution')}
                    />
                </LabelGroup>
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
