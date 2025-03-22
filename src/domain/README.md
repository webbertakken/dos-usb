# Domain-Driven Design Structure

This folder contains the domain-specific logic organized into bounded contexts.

## Bounded Contexts

1. **Game Management** - Core domain for managing installed games
2. **Game Store** - Domain for browsing and downloading games
3. **Game Playing** - Domain for launching and playing games
4. **Error Handling** - Cross-cutting concern for error management

Each bounded context contains:
- **Entities** - Core domain objects
- **Value Objects** - Immutable objects that represent domain concepts
- **Repositories** - Data access abstraction
- **Services** - Domain logic and business rules
- **Events** - Domain events for communication between bounded contexts 
