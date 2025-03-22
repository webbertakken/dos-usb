# Presentation Layer

The presentation layer is responsible for rendering the UI and handling user interactions. It depends on the application layer to access domain functionality.

## Structure

- **Adapters**: Transform domain and application objects into view models for the UI
- **Hooks**: React hooks for accessing application state and functionality
- **Components**: Reusable UI components (located in src/components)
- **Pages**: Next.js pages that serve as entry points (located in src/app)

## Responsibilities

- Rendering UI components
- Handling user interactions
- Converting domain objects to view models
- Routing and navigation
- Form validation and user input handling

## Guidelines

1. Use adapters to transform domain objects into view models
2. Keep UI logic separate from business logic
3. Components should be as stateless and reusable as possible
4. Use hooks to encapsulate logic for accessing application state 
