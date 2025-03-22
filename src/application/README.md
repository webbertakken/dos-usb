# Application Layer

The application layer sits between the domain layer and the presentation (UI) layer. It orchestrates the flow of data to and from the domain layer and implements use cases that depend on domain objects.

## Structure

- **Stores**: Contains Zustand stores that provide state management and connect the UI to domain services
- **Use Cases**: Implements specific application features that coordinate multiple domain services

## Responsibilities

- Handling application state
- Coordinating between multiple bounded contexts
- Managing application-specific logic that doesn't belong in the domain layer
- Providing a clean API for the UI layer to interact with the domain 
