# Agent Guidelines for PlayCanvas Engine

This document contains rules, conventions, and best practices for AI agents and developers working on the PlayCanvas Engine codebase.

## Project Overview

PlayCanvas is an open-source WebGL/WebGPU game engine written in JavaScript. It's a performance-critical library used by thousands of developers worldwide.

- **Language**: JavaScript (ES2022) with JSDoc for TypeScript type definitions
- **Module System**: ES Modules
- **Node Version**: >=18.0.0
- **Build System**: Rollup
- **Testing**: Mocha + Chai + Sinon
- **Linting**: ESLint with @playcanvas/eslint-config
- **License**: MIT

## General Code Rules

### 1. Code Style and Formatting

- **Follow ESLint rules**: Always run `npm run lint` before committing
  - **Important**: Only fix lint issues in code you are actively modifying or creating
  - Do not fix pre-existing lint issues in unrelated code unless specifically asked
  - Focus on ensuring new and refactored code is lint-free
- **Use JSDoc comments**: All public APIs must have comprehensive JSDoc documentation
- **Module imports**: Use ES6 import/export syntax
- **Naming conventions**:
  - Classes: PascalCase (e.g., `GraphicsDevice`, `Entity`)
  - Functions/methods: camelCase (e.g., `createShader`, `setPosition`)
  - Constants: UPPER_SNAKE_CASE (e.g., `PIXELFORMAT_RGBA8`)

### 2. File Organization

- **Source files**: All engine source code goes in `src/`
- **Directory structure**:
  - `src/core/` - Core utilities and data structures
  - `src/platform/` - Platform-specific code (graphics, audio, input)
  - `src/scene/` - Scene graph, rendering, materials, shaders
  - `src/framework/` - High-level components and application framework
  - `src/extras/` - Optional extras and utilities
- **Build output**: Generated files go in `build/` (never edit these directly)
- **Examples**: Live in `examples/src/examples/`
- **Tests**: Unit tests go in `test/` with `.mjs` extension
- **File naming**: Module file names should match the main class they contain
  - Use kebab-case for file names (e.g., `graphics-device.js` for `GraphicsDevice` class)
  - If a class is renamed, the file should be renamed to match
  - Multiple related classes can share a file if they're tightly coupled

#### Module Dependency Hierarchy

The codebase follows a strict hierarchical structure to maintain clean architecture:

```
core → platform → scene → framework
```

**Rules**:
- Lower-level modules **cannot import** from higher-level modules
- Lower-level modules **cannot use instances** from higher-level modules
- Example: `core/` cannot import from `platform/`, `scene/`, or `framework/`
- Example: `scene/` cannot import from `framework/`

**Known Exception**:
- `CameraComponent` (from `framework/`) is currently used in multiple places at the `scene/` level
- **Do not introduce new exceptions** unless explicitly requested and confirmed
- When in doubt, ask before breaking the hierarchy

This hierarchy ensures:
- Clean separation of concerns
- Prevents circular dependencies
- Makes the codebase more maintainable and testable

### 3. Documentation Standards

- **JSDoc is mandatory** for all public APIs:
  ```javascript
  /**
   * Brief description of the function.
   *
   * @param {string} name - Parameter description.
   * @param {number} [optional=0] - Optional parameter with default.
   * @returns {boolean} Return value description.
   * @example
   * const result = myFunction('test', 5);
   */
  ```
- **Include examples** for complex APIs
- **Document side effects**: Mention if a function modifies state
- **Link related APIs**: Use `@see` tags to cross-reference
- **Mark deprecations**: Use `@deprecated` with migration instructions

### 4. TypeScript Definitions

- JSDoc comments are used to generate TypeScript definitions
- Run `npm run build:types` to generate `.d.ts` files
- Test types with `npm run test:types`
- Use proper JSDoc type annotations:
  - `@type {TypeName}` for variables
  - `@param {TypeName} paramName` for parameters
  - `@returns {TypeName}` for return values
  - Support for generics, unions, and complex types
- **Type-only imports**: Use `@import` for types referenced in JSDoc comments
  - These imports are only for type information, not runtime code
  - Place at the top of the file in a JSDoc comment block
  - Example:
    ```javascript
    /**
     * @import { Texture } from './texture.js'
     * @import { Shader } from './shader.js'
     */
    ```
  - These help TypeScript understand types without adding runtime dependencies

### 5. Testing

- **Write tests** for all new features and bug fixes if instructed
- **Test location**: `test/` directory, organized by module
- **Test naming**: Use descriptive names that explain what is being tested
- **Run tests**: `npm test` (or `npm run test:coverage` for coverage)
- **Test structure**:
  ```javascript
  describe('ClassName', function () {
      describe('#methodName', function () {
          it('should do something specific', function () {
              // Test implementation
          });
      });
  });
  ```

### 6. Performance Considerations

This is a **performance-critical** engine. Always consider:

- **Avoid allocations in hot paths**: Reuse objects, use object pools
- **Minimize function calls**: Inline critical code when necessary
- **Cache property access**: Store frequently accessed properties in local variables
- **Use typed arrays**: For numeric data (Float32Array, Uint8Array, etc.)

### 7. Graphics API Considerations

- **Multi-backend support**: Code must work with both WebGL2 and WebGPU
- **Use abstraction layers**: Don't call WebGL/WebGPU APIs directly in high-level code
- **Shader code**: Maintain both GLSL and WGSL versions
  - GLSL: `src/scene/shader-lib/glsl/`
  - WGSL: `src/scene/shader-lib/wgsl/`
- **NullGraphicsDevice**: A dummy graphics device for headless/testing scenarios
  - When adding public API methods to `GraphicsDevice`, add stub implementations to `NullGraphicsDevice`
  - Stub methods should be empty or return safe default values to avoid crashes
  - This ensures the engine can run without a real graphics backend for testing/server-side use

## Project-Specific Rules

### 8. API Stability and Deprecation

- **Backward compatibility matters**: Breaking changes require major version bump
- **Deprecation process**:
  1. Mark API as `@deprecated` with alternatives
  2. Add console warning in development builds
  3. Keep deprecated code for at least one major version
  4. Consider removing jsdocs completely
- **Never remove public APIs** without proper deprecation cycle

### 9. Build System

- **Source is in `src/`**: Never edit files in `build/` directory
- **Module exports**: Main exports defined in `src/index.js`

### 10. Dependencies

- **Minimal dependencies**: Avoid adding new dependencies unless absolutely necessary
- **Types only**: `@types/*` and `@webgpu/types` are the main dependencies

### 11. Error Handling

- **Debug class**: Use `Debug` class (`src/core/debug.js`) for logging and assertions
  - Methods include: `assert()`, `warn()`, `warnOnce()`, `error()`, `deprecated()`, `log()`, `trace()`
  - **Important**: All Debug methods are stripped out in production builds
  - Use `*Once()` variants to avoid spam in loops or frequent calls
  - Don't use Debug in hot paths - even in debug builds, excessive logging impacts performance
- **DebugHelper class**: Helper methods for debugging (also stripped in production)
  - `setName()`, `setLabel()`, `setDestroyed()` for marking objects

### 12. Code Comments

- **Explain "why" not "what"**: Code should be self-documenting, but comments help with quick understanding
- **Complex algorithms**: Explain the approach and any non-obvious optimizations
- **TODOs**: Include issue reference or context
  ```javascript
  // TODO: Optimize this when texture streaming is implemented (#1234)
  ```
- **Avoid very obvious comments**: Don't state what the code clearly does

### 13. Commit and PR Guidelines

- **Clear commit messages**: Use conventional commits format
  - `feat: Add feature description`
  - `fix: Bug fix description`
  - `perf: Performance improvement description`
  - `docs: Documentation update`
  - `refactor: Code refactoring`
  - `test: Test updates`
- **Reference issues**: Include issue number in commit message in format 'Fixed #1234'
- **Small, focused commits**: Each commit should be a logical unit
- **No generated files**: Don't commit files in `build/` directory

### 14. Browser Compatibility

- **Modern browsers only**: ES6+ features are allowed
- **No polyfills in engine**: Users can add their own if needed (except `src/polyfill/`)
- **WebGL 2.0 minimum**: WebGL 1.0 is not supported
- **WebGPU support**: Must maintain compatibility with WebGPU API

## Common Patterns

### 15. Object Creation

```javascript
// Prefer class syntax with TypeScript-like property declarations
class MyClass {
    /**
     * @type {GraphicsDevice}
     */
    device;

    /**
     * @type {string}
     */
    name;

    constructor(device, options = {}) {
        this.device = device;
        this.name = options.name ?? 'default';
    }

    destroy() {
        // Clean up resources
        this.device = null;
    }
}
```

### 16. Resource Management

```javascript
// Always provide destroy() method for objects holding resources
class Resource {
    constructor() {
        this._resource = createResource();
    }

    destroy() {
        this._resource?.destroy();
        this._resource = null;
    }
}
```

## Things to Avoid

### 18. Anti-Patterns

- **Don't use `var`**: Use `const` or `let` (except in legacy `scripts/` directory)
- **Avoid `any` types**: Be specific in JSDoc type annotations
- **No global state**: Everything should be instance-based
  - Exception: Module-scope variables for local optimization are allowed (e.g., reusable Mat4 instances)
  - These must never be exported and should only be used within the module
- **Don't bypass abstractions**: Use the platform API, not direct WebGL/WebGPU calls
- **Don't suppress linter warnings**: Fix the underlying issue

### 19. Performance Anti-Patterns

- **No allocations in render loop**: Pre-allocate and reuse if feasible
- **Don't use `try/catch` in hot paths**: It prevents optimizations
- **No string concatenation in loops**: Build arrays and join
- **Don't create functions in loops**: Define functions outside

## AI Agent-Specific Guidelines

### 20. When Making Changes

- **Read existing code first**: Understand the context and patterns
- **Follow existing style**: Match the style of surrounding code
- **Lint your changes**: Run `npm run lint`
- **Update documentation**: Modify JSDoc comments when changing APIs
- **Consider performance**: This is a real-time engine, every microsecond counts
- **Check both WebGL and WebGPU**: Changes may affect both backends

### 21. When Creating Examples

- Examples go in `examples/src/examples/`
- Follow existing example structure (see other `.example.mjs` files)
- Include descriptive comments
- Keep examples simple and focused on one feature

### 22. When Writing PR Descriptions

- **Format as a single code block**: Always deliver PR descriptions wrapped in triple backticks for easy copy/paste
- **Structure**:
  - Brief title and overview
  - Bullet points for functionality changes
  - Technical details section (if relevant)
  - **Clearly list all public API changes** with before/after code examples
  - List updated examples (if applicable)
  - Performance considerations (if relevant)
- **Focus on user-facing changes**: What developers using the engine will see/use
- **Be concise but complete**: Include all breaking changes and new APIs
- **Avoid excessive detail**: Group related changes together, don't list every tiny implementation detail or internal refactoring

## Resources

- **API Reference**: https://api.playcanvas.com/engine/
- **User Manual**: https://developer.playcanvas.com/user-manual/engine/
- **Developer Site**: https://github.com/playcanvas/developer-site
  - For large features, ask to add documentation to the User Manual
  - Manual pages are Markdown files in the `docs/` directory
- **Examples**: https://playcanvas.github.io
- **Forum**: https://forum.playcanvas.com
- **Discord**: https://discord.gg/RSaMRzg
- **GitHub Issues**: https://github.com/playcanvas/engine/issues

## Questions?

When in doubt:
1. Look at similar existing code in the codebase
2. Check the ESLint configuration
3. Review recent commits for patterns
4. If unclear or multiple valid approaches exist, ask instead of picking a possibly incorrect solution

---

**Remember**: This is a library used by thousands of developers. Quality, performance, and stability are paramount. When in doubt, prefer conservative, well-tested changes over clever optimizations.

