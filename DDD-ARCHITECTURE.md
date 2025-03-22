# Domain-Driven Design Architecture

This application follows Domain-Driven Design (DDD) principles to create a maintainable, scalable, and expressive codebase.

## Architecture Layers

### Domain Layer (`src/domain/`)

The core of the application, containing business logic and rules. This layer is independent of any frameworks or external concerns.

#### Bounded Contexts

1. **Game Management** (`src/domain/gameManagement/`)
   - Core domain for managing installed games
   - Contains game entities, metadata, and repository interfaces

2. **Game Store** (`src/domain/gameStore/`)
   - Domain for browsing and downloading games
   - Handles game store listings and download operations

3. **Game Playing** (`src/domain/gamePlaying/`)
   - Domain for launching and playing games
   - Contains services to launch games with DOSBox

4. **Error Handling** (`src/domain/errorHandling/`)
   - Cross-cutting concern for error management
   - Provides error reporting and tracking

### Application Layer (`src/application/`)

Orchestrates the flow of data between the domain and presentation layers. Contains use cases that depend on domain objects.

#### Stores

- **Game Management Store** - State management for game management features
- **Game Store Store** - State management for game store and download features
- **Error Handling Store** - Centralized error handling and reporting

### Presentation Layer (`src/app/` and `src/components/`)

The user interface components and pages. This layer depends on the application layer to access domain functionality.

- **Pages** - Next.js pages that represent different sections of the application
- **Components** - Reusable UI components

### Infrastructure Layer (`electron/`)

Provides implementations of domain interfaces for external services like file system operations, external APIs, etc.

## Benefits of This Structure

1. **Separation of Concerns**: Clear boundaries between business logic, application logic, and presentation
2. **Maintainability**: Changes in one bounded context don't affect others
3. **Testability**: Domain logic can be tested independently of UI
4. **Flexibility**: Easy to swap implementations (e.g., for testing or to adapt to different platforms)
5. **Ubiquitous Language**: Consistent terminology throughout the codebase

## Usage Guidelines

1. Domain objects should never depend on application or presentation concerns
2. Application services coordinate domain objects but shouldn't contain domain logic
3. Presentation components should only interact with the domain through application services/stores
4. Infrastructure implementations should be hidden behind domain interfaces 
