import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElectronErrorHandlingService } from "./service";
import { ErrorSeverity } from "./types";

describe("ElectronErrorHandlingService (browser fallback)", () => {
  let service: ElectronErrorHandlingService;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new ElectronErrorHandlingService();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Ensure window.electron is undefined so the fallback branch runs.
    delete (window as unknown as { electron?: unknown }).electron;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getLastError returns null on a fresh service", () => {
    expect(service.getLastError()).toBeNull();
  });

  it("logError stores the error so it can be read back", async () => {
    const err = { message: "boom", source: "test" };
    await service.logError(err);
    expect(service.getLastError()).toEqual(err);
  });

  it("logError logs to console.error with the severity prefix", async () => {
    await service.logError({ message: "oops" }, ErrorSeverity.HIGH);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[HIGH]",
      expect.objectContaining({ message: "oops", severity: "high" }),
    );
  });

  it("logError defaults severity to MEDIUM when not provided", async () => {
    await service.logError({ message: "default-severity" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[MEDIUM]",
      expect.objectContaining({ severity: "medium" }),
    );
  });

  it("clearErrors resets the last error to null", async () => {
    await service.logError({ message: "ephemeral" });
    expect(service.getLastError()).not.toBeNull();
    service.clearErrors();
    expect(service.getLastError()).toBeNull();
  });

  it("logError forwards to window.electron.logError when available", async () => {
    const electronLogError = vi.fn().mockResolvedValue(undefined);
    (window as unknown as { electron: unknown }).electron = {
      logError: electronLogError,
    };

    await service.logError({ message: "via-bridge", stack: "trace-line" }, ErrorSeverity.CRITICAL);

    expect(electronLogError).toHaveBeenCalledTimes(1);
    expect(electronLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "via-bridge",
        stack: "trace-line",
        severityLevel: "critical",
      }),
    );
  });

  it("does not throw when the electron bridge rejects", async () => {
    const electronLogError = vi.fn().mockRejectedValue(new Error("bridge offline"));
    (window as unknown as { electron: unknown }).electron = {
      logError: electronLogError,
    };

    await expect(service.logError({ message: "still-stored" })).resolves.toBeUndefined();
    expect(service.getLastError()).toEqual({ message: "still-stored" });
  });
});
