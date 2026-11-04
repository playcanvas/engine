import {
    BindingTwoWay,
    LabelGroup,
    Label,
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
            </Panel>
            <Panel headerText='LOD'>
                <LabelGroup text='LOD Preset'>
                    <SelectInput
                        type='string'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lodPreset' }}
                        value={observer.get('lodPreset') || 'desktop-max'}
                        options={[
                            { v: 'desktop-max', t: 'Desktop Max (0-20)' },
                            { v: 'desktop', t: 'Desktop (1-20)' },
                            { v: 'mobile-max', t: 'Mobile Max (2-20)' },
                            { v: 'mobile', t: 'Mobile (3-20)' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Splat Budget'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={0}
                        max={40}
                        precision={1}
                        step={0.1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Debug'>
                <LabelGroup text='Debug Render'>
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
