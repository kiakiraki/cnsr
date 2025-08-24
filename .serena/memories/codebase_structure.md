# Codebase Structure & Architecture

## Directory Layout

```
├── components/
│   └── ImageMosaic.vue          # Main image processing component
├── test/                        # Test suite
│   ├── coordinate-calculation.test.ts
│   ├── state-management.test.ts
│   ├── undo-functionality.test.ts
│   ├── download-functionality.test.ts
│   └── setup.ts                 # Test configuration & mocks
├── public/                      # Static assets
│   ├── favicon.ico
│   ├── favicon.png
│   └── robots.txt
├── server/                      # Server-side code (minimal)
│   └── tsconfig.json
├── .github/                     # GitHub Actions & Dependabot
│   ├── workflows/lint.yml
│   └── dependabot.yml
├── app.vue                      # Root component
├── nuxt.config.ts              # Nuxt configuration
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── vitest.config.ts            # Test runner configuration
├── eslint.config.js            # Linting rules
├── .prettierrc                 # Code formatting rules
├── wrangler.toml               # Cloudflare deployment config
├── CLAUDE.md                   # Development instructions
└── README.md                   # Project documentation
```

## Core Component Architecture

### ImageMosaic.vue

The main component contains extensive functionality:

- **File Handling**: Upload, drag-drop, paste operations
- **Canvas Management**: Image rendering, scaling, coordinate calculations
- **Processing Operations**: Mosaic, black/white fill implementations
- **Selection System**: Mouse/touch-based area selection
- **State Management**: Undo stack (64 levels), processing modes
- **Download System**: PNG export functionality

### Key Functions & Properties

- `uploadedImage`: Current loaded image state
- `processingMode`: Current operation mode (mosaic/black/white)
- `undoStack`: Array maintaining processing history
- `selection`: Current selection coordinates
- `getEventPosition()`: Coordinate transformation function
- `applyMosaic()`: Core processing function
- `downloadImage()`: Export functionality

## Configuration Files

### Nuxt Configuration

- **SSR Disabled**: `ssr: false` for client-side only operation
- **Cloudflare Pages**: Optimized for edge deployment
- **TypeScript**: Full TypeScript integration

### Test Configuration

- **Vitest**: Modern test runner with jsdom
- **Comprehensive Mocks**: Canvas, FileReader, Image, Touch APIs
- **Global Setup**: Browser API simulation for testing
