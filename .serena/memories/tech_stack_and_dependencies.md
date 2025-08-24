# Technology Stack & Dependencies

## Core Framework & Runtime

- **Nuxt.js**: 4.0.3 (SSR disabled for client-side processing)
- **Vue.js**: 3.5.17 with Composition API
- **Vue Router**: 4.5.1
- **TypeScript**: Full TypeScript support with strict typing

## Development & Build Tools

- **Vite**: Build tool and dev server (via Nuxt)
- **Vitest**: 3.2.4 for unit testing with jsdom environment
- **Vue Test Utils**: 2.4.6 for component testing
- **ESLint**: 9.33.0 with @nuxt/eslint-config 1.9.0
- **Prettier**: 3.6.2 for code formatting
- **TypeScript ESLint**: 8.40.0 for TS-specific linting

## Testing & Quality Assurance

- **Test Environment**: jsdom for DOM simulation
- **Test Setup**: Comprehensive mocks for Canvas API, FileReader, Image, TouchEvent
- **Coverage Areas**: Coordinate calculations, state management, undo functionality, download features
- **CI/CD**: GitHub Actions for automated linting, formatting checks, testing, and builds

## Deployment & Hosting

- **Target Platform**: Cloudflare Pages
- **Build Mode**: Static generation (`target: 'static'`)
- **Nitro Preset**: `cloudflare-pages`
- **Node.js Version**: 20 (as specified in CI)

## Browser APIs Used

- **Canvas API**: Core image processing operations
- **File API**: Image upload and processing
- **Touch API**: Mobile device support
- **URL API**: Object URL creation for downloads
