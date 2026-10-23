import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => cleanup());
