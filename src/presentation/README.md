# Presentation Layer

The presentation layer is responsible for rendering the UI and handling user interactions. It
depends on the application layer to access domain functionality.

## Structure

- **Hooks**: React hooks that hold UI state: the library load, online status, the welcome
- **Format, grid, images**: Pure helpers that turn domain values into what the UI shows
- **Components**: Reusable UI components (located in src/components)
- **Pages**: Next.js pages that serve as entry points (located in src/app)

## Responsibilities

- Rendering UI components
- Handling user interactions
- Converting domain objects to view models
- Routing and navigation
- Form validation and user input handling

## Guidelines

1. Turn domain values into display values with pure helpers
2. Keep UI logic separate from business logic
3. Components should be as stateless and reusable as possible
4. Use hooks to encapsulate logic for accessing application state
