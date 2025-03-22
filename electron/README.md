# Infrastructure Layer

The infrastructure layer provides concrete implementations of domain interfaces. It handles external concerns like file system access, network communication, and hardware interaction.

## Structure

- **main.mjs**: Electron main process that handles OS-level operations
- **preload.mjs**: Preload script that exposes Electron APIs to the renderer process

## Responsibilities

- Implementing domain repository interfaces
- Handling file system operations
- Managing DOSBox integration
- Handling network requests
- Implementing IPC communication between main and renderer processes

## Design Guidelines

1. All domain interface implementations should be kept in this layer
2. Avoid adding domain logic to infrastructure code
3. Use dependency injection to inject infrastructure implementations into domain services
4. Infrastructure code should be testable and replaceable 
