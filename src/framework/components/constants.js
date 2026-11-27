// The update order of the component systems, see ComponentSystem.updateOrder.
//
// Each frame the application fires four phases, in this order. The systems handling a phase run
// in ascending update order, so a system ordered before UPDATEORDER_SCRIPT runs before the scripts
// in every phase it handles, and a system ordered after it runs after them:
//
//   update            joints -> SCRIPTS update -> sound, particles, UI, sprites
//   physicsUpdate     rigid body: physics simulated
//   animationUpdate   anim: animations evaluated, bones posed
//   postUpdate        joints -> SCRIPTS postUpdate (for example IK on the posed bones) -> layout
//
// The update order is also the order in which the components of a loaded entity are created.
// The values are spaced apart, so that a system can be placed between two others.

// --- before scripts ------------------------------------------------------------------------------

export const UPDATEORDER_RIGIDBODY = 100;        // physicsUpdate, after scripts' update
export const UPDATEORDER_COLLISION = 200;        // no phase
export const UPDATEORDER_JOINT = 300;            // update, postUpdate
export const UPDATEORDER_ANIM = 400;             // animationUpdate, after scripts' update
export const UPDATEORDER_MODEL = 500;            // no phase
export const UPDATEORDER_RENDER = 600;           // no phase
export const UPDATEORDER_CAMERA = 700;           // no phase
export const UPDATEORDER_LIGHT = 800;            // no phase

// --- scripts -------------------------------------------------------------------------------------

export const UPDATEORDER_SCRIPT = 900;           // update, postUpdate
export const UPDATEORDER_DEFAULT = 950;          // custom systems, unless they set their own

// --- after scripts -------------------------------------------------------------------------------

export const UPDATEORDER_SOUND = 1000;           // update: uses the transforms scripts set
export const UPDATEORDER_AUDIOLISTENER = 1100;   // update: uses the transforms scripts set
export const UPDATEORDER_PARTICLESYSTEM = 1200;  // update: emits from the transforms scripts set
export const UPDATEORDER_SCREEN = 1300;          // update
export const UPDATEORDER_ELEMENT = 1400;         // no phase
export const UPDATEORDER_BUTTON = 1500;          // update
export const UPDATEORDER_SCROLLVIEW = 1600;      // update
export const UPDATEORDER_SCROLLBAR = 1700;       // no phase
export const UPDATEORDER_SPRITE = 1800;          // update: advances clips from what scripts set
export const UPDATEORDER_LAYOUTGROUP = 1900;     // postUpdate: reflows after scripts' postUpdate
export const UPDATEORDER_LAYOUTCHILD = 2000;     // no phase
export const UPDATEORDER_ZONE = 2100;            // no phase
export const UPDATEORDER_GSPLAT = 2200;          // no phase
