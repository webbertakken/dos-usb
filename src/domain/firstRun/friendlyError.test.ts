import { describe, it, expect } from "vitest";
import { friendlyError } from "./friendlyError";

describe("friendlyError", () => {
  it.each([
    "getaddrinfo ENOTFOUND archive.org",
    "connect ECONNREFUSED 1.2.3.4:443",
    "read ECONNRESET",
    "connect ETIMEDOUT 1.2.3.4:443",
    "getaddrinfo EAI_AGAIN dosgames.com",
    "connect ENETUNREACH 1.2.3.4:443",
    "socket hang up",
    "net::ERR_INTERNET_DISCONNECTED",
  ])("explains %s as needing the internet", (raw) => {
    expect(friendlyError(raw).message).toMatch(/needs an internet connection/);
  });

  it("explains a missing DOSBox without jargon about package managers", () => {
    const error = friendlyError(
      "DOSBox was not found. Install it with your package manager, e.g. sudo apt install dosbox-staging (or dosbox).",
    );

    expect(error.message).toMatch(/game player/);
    expect(error.message).not.toMatch(/sudo|apt|PATH/);
  });

  it("explains a game that cannot be started", () => {
    expect(friendlyError("No suitable executable found").message).toMatch(/could not start/);
  });

  it("explains a full stick", () => {
    expect(friendlyError("ENOSPC: no space left on device").message).toMatch(/full/);
  });

  it.each(["EACCES: permission denied", "EROFS: read-only file system", "EPERM: not permitted"])(
    "explains %s as a locked stick",
    (raw) => {
      expect(friendlyError(raw).message).toMatch(/locked or read-only/);
    },
  );

  it.each(["HTTP 404 Not Found", "Request failed with status code 403"])(
    "explains %s as an unavailable download",
    (raw) => {
      expect(friendlyError(raw).message).toMatch(/not available right now/);
    },
  );

  it("explains running outside the app", () => {
    expect(friendlyError("Game launching requires Electron").message).toMatch(/DOS USB app/);
  });

  it("falls back to a calm general message", () => {
    expect(friendlyError("Something odd: 0xDEADBEEF").message).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("keeps the original text as the technical detail", () => {
    expect(friendlyError("read ECONNRESET").detail).toBe("read ECONNRESET");
  });

  it("accepts an Error as well as text", () => {
    expect(friendlyError(new Error("socket hang up")).detail).toBe("socket hang up");
  });

  it("has no detail for a missing error", () => {
    expect(friendlyError(undefined).detail).toBe("");
  });

  it("has no detail for an empty error", () => {
    expect(friendlyError("")).toEqual({
      message: "Something went wrong. Please try again.",
      detail: "",
    });
  });
});
