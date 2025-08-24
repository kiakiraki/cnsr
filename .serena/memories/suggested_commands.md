# Essential Development Commands

## Development Server

```bash
npm run dev
# Starts development server on http://localhost:3000
```

## Testing

```bash
npm run test
# Runs tests in watch mode with Vitest

npm run test:run
# Runs tests once (for CI/production)
```

## Code Quality & Formatting

```bash
npm run lint
# Runs ESLint to check for code issues

npm run lint:fix
# Runs ESLint with automatic fixing

npm run format
# Formats code with Prettier

npm run format:check
# Checks if code is properly formatted (for CI)
```

## Build & Production

```bash
npm run build
# Creates production build for deployment

npm run preview
# Previews production build locally

npm run generate
# Generates static files (same as build for this project)
```

## Package Management

```bash
npm install
# Installs dependencies

npm run postinstall
# Prepares Nuxt (runs automatically after install)
```

## System Commands (Linux)

- **File Operations**: `ls`, `find`, `grep` (prefer rg/ripgrep), `cat`, `head`, `tail`
- **Git Operations**: `git status`, `git add`, `git commit`, `git push`, `git pull`
- **Process Management**: `ps`, `kill`, `killall`
- **Text Processing**: `sed`, `awk`, `cut`, `sort`, `uniq`
