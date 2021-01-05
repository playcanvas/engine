// MATH
export {Mat3} from "./math/mat3";
export {Mat4} from "./math/mat4";
export {Quat} from "./math/quat";
export {Vec2} from "./math/vec2";
export {Vec3} from "./math/vec3";
export {Vec4} from "./math/vec4";

// SCENE
export {GraphNode} from "./scene/graph-node";

// Example
import {insertAfter} from "./insertAfter";
export function example(): string[] {
    var fruits = ["Banana", "Orange", "Apple", "Mango"];
    fruits = insertAfter(fruits, 2, "Lemon");
    fruits = insertAfter(fruits, 3, "Kiwi");
    return fruits;
}

// --runtime none, but still having alloc/realloc/retain:
export { __alloc, __realloc, __retain };
