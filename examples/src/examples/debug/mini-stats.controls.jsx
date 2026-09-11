import { BindingTwoWay, BooleanInput, LabelGroup, Panel } from '@playcanvas/pcui/react';

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
                {[
                    ['enabled', 'Enable MiniStats'],
                    ['resourcesEnabled', 'Show resources']
                ].map(([property, label]) => (
                    <LabelGroup key={property} text={label}>
                        <BooleanInput
                            type='toggle'
                            binding={new BindingTwoWay()}
                            link={{ observer, path: `settings.${property}` }}
                            value={observer.get(`settings.${property}`)}
                        />
                    </LabelGroup>
                ))}
            </Panel>
            <Panel headerText='Collapsed sections'>
                {[
                    ['engineCollapsed', 'Engine'],
                    ['userCollapsed', 'User'],
                    ['cpuCollapsed', 'CPU'],
                    ['gpuCollapsed', 'GPU'],
                    ['vramCollapsed', 'VRAM'],
                    ['resourcesCollapsed', 'Resources']
                ].map(([property, label]) => (
                    <LabelGroup key={property} text={label}>
                        <BooleanInput
                            type='toggle'
                            binding={new BindingTwoWay()}
                            link={{ observer, path: `settings.${property}` }}
                            value={observer.get(`settings.${property}`)}
                        />
                    </LabelGroup>
                ))}
            </Panel>
        </>
    );
}
