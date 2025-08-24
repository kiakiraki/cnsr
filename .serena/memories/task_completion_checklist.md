# Task Completion Checklist

## Code Quality Requirements

When completing any development task, ensure the following steps are executed:

### 1. Linting & Formatting

```bash
npm run lint
# Must pass without errors

npm run format:check
# Must pass formatting validation
```

### 2. Testing

```bash
npm run test:run
# All tests must pass
# Add new tests for new functionality
```

### 3. Build Verification

```bash
npm run build
# Must complete successfully without errors
# Verifies TypeScript compilation and bundling
```

## Pre-Commit Requirements

- **ESLint**: No linting errors allowed
- **Prettier**: Code must be properly formatted
- **TypeScript**: No type errors
- **Tests**: All existing tests must pass
- **Build**: Production build must succeed

## CI/CD Pipeline

The GitHub Actions workflow automatically runs:

1. ESLint checking (`npm run lint`)
2. Prettier format checking (`npm run format:check`)
3. Test execution (`npm run test:run`)
4. Build verification (`npm run build`)

## Testing Guidelines

- **Unit Tests**: Required for new functions and components
- **Edge Cases**: Test boundary conditions and error scenarios
- **Canvas Operations**: Mock Canvas API interactions properly
- **Touch Events**: Ensure mobile compatibility testing

## Documentation Updates

- Update CLAUDE.md if architectural changes are made
- Maintain README.md for user-facing changes
- Update component documentation for significant modifications
