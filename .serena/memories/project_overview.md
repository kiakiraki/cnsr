# CNSR - Image Mosaic Processing Application

## Project Purpose

CNSR is a privacy protection web application built with Nuxt.js/Vue.js that allows users to upload images and apply mosaic, black fill, or white fill processing to selected regions. It's designed as a client-side tool for protecting sensitive information in images.

## Key Features

- **Image Upload**: Drag & drop, click, and Ctrl+V (paste) support
- **Processing Modes**: Mosaic (pixelization), black fill, white fill
- **Region Selection**: Mouse/touch-based area selection
- **Undo Functionality**: Up to 64 levels of undo
- **Image Download**: PNG format export
- **Responsive Design**: Mobile and desktop support
- **Dark Mode**: Automatic system preference detection

## Technical Architecture

- **Framework**: Nuxt.js 4.0.3 with SSR disabled (`ssr: false`)
- **Language**: TypeScript with Vue 3 Composition API
- **Canvas API**: Heavy use of HTML5 Canvas for image processing
- **Client-Side Only**: No server-side processing for privacy
- **Deployment**: Cloudflare Pages with static generation
- **State Management**: Vue 3 reactive refs and computed properties

## Core Components

- `app.vue`: Root application component
- `components/ImageMosaic.vue`: Main image processing component with Canvas operations
- Comprehensive test suite covering coordinate calculations, state management, and undo functionality
