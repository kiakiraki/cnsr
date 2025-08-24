# Code Style & Conventions

## Formatting (Prettier Configuration)

- **Semicolons**: Disabled (`"semi": false`)
- **Quotes**: Single quotes (`"singleQuote": true`)
- **Tab Width**: 2 spaces (`"tabWidth": 2`)
- **Trailing Commas**: ES5 style (`"trailingComma": "es5"`)
- **Print Width**: 80 characters (`"printWidth": 80`)
- **Bracket Spacing**: Enabled (`"bracketSpacing": true`)
- **Arrow Function Parentheses**: Avoid when possible (`"arrowParens": "avoid"`)
- **Vue Files**: No indentation for script/style blocks (`"vueIndentScriptAndStyle": false`)

## ESLint Configuration

- **Base Config**: @nuxt/eslint-config with flat config format
- **Stylistic Rules**: Disabled (`features.stylistic: false`)
- **Vue Specific**: HTML self-closing tags disabled (`'vue/html-self-closing': 'off'`)

## Vue.js Conventions

- **Composition API**: Exclusively used throughout the codebase
- **TypeScript**: Full type annotations and interface definitions
- **Reactivity**: `ref()`, `computed()`, `reactive()` patterns
- **Lifecycle**: `onMounted()`, `onUnmounted()` hooks
- **Component Structure**: Single-file components (.vue) with clear separation

## Naming Conventions

- **Variables**: camelCase (e.g., `currentImage`, `processingMode`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_UNDO_LEVELS`, `THROTTLE_INTERVAL`)
- **Functions**: camelCase with descriptive names (e.g., `loadImageToCanvas`, `getEventPosition`)
- **Interfaces**: PascalCase (e.g., `SelectionArea`)

## File Organization

- **Components**: `/components/` directory
- **Tests**: `/test/` directory with descriptive names
- **Configuration**: Root-level config files
- **Public Assets**: `/public/` directory

## Testing Patterns

- **Test Files**: `.test.ts` extension
- **Test Structure**: `describe()` blocks with descriptive names
- **Mocking**: Comprehensive mocks for browser APIs
- **Test Cases**: Edge cases and error conditions covered
