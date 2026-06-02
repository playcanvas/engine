import { BindingTwoWay, LabelGroup, Panel, BooleanInput } from '@playcanvas/pcui/react';

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
            <Panel headerText='Texture Arrays'>
                <LabelGroup text='Show mipmaps'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'mipmaps' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
