/**
 * DOSBox config files as layers. The app generates a config for each launch;
 * an optional per-game override (games/<id>/dosbox.conf on the stick) is laid
 * on top of it: section by section, key by key, the override winning. An
 * override's [autoexec] replaces the generated one wholesale, since autoexec
 * is a script, not a set of keys.
 */

const AUTOEXEC = "autoexec";
const SECTION_HEADER = /^\[([^\]]+)\]$/;
const COMMENT = /^[#;]/;

/**
 * @typedef {{ name: string, entries: Map<string, string> }} KeySection
 * @typedef {{ sections: Map<string, KeySection>, autoexec: string[] | null, ignored: string[] }} ParsedConf
 */

/** @returns {ParsedConf} */
function parse(text) {
  const sections = new Map();
  const ignored = [];
  let autoexec = null;
  let current = null;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    const header = line.match(SECTION_HEADER);
    if (header) {
      current = header[1].trim().toLowerCase();
      if (current === AUTOEXEC) {
        autoexec = [];
      } else if (!sections.has(current)) {
        sections.set(current, { name: current, entries: new Map() });
      }
      return;
    }

    if (current === AUTOEXEC) {
      autoexec.push(rawLine);
      return;
    }

    if (line === "" || COMMENT.test(line)) return;

    const separator = line.indexOf("=");
    if (current === null || separator <= 0) {
      const where = current === null ? "outside any section" : `[${current}]`;
      ignored.push(`line ${index + 1} (${where}): ${line}`);
      return;
    }

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    sections.get(current).entries.set(key, value);
  });

  return { sections, autoexec: autoexec && trimTrailingBlankLines(autoexec), ignored };
}

function trimTrailingBlankLines(lines) {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed.at(-1).trim() === "") trimmed.pop();
  return trimmed;
}

function serialise({ sections, autoexec }) {
  const blocks = [...sections.values()].map(({ name, entries }) =>
    [`[${name}]`, ...[...entries].map(([key, value]) => `${key}=${value}`)].join("\n"),
  );
  if (autoexec !== null) blocks.push([`[${AUTOEXEC}]`, ...autoexec].join("\n"));
  return `${blocks.join("\n\n")}\n`;
}

/**
 * Lay an override config on top of a generated one.
 * @param {string} generatedText the config the app built for this launch
 * @param {string} overrideText the per-game override ("" when there is none)
 * @returns {{ text: string, applied: string[], ignored: string[] }}
 *   `applied` names each override as `section.key` (or `autoexec`);
 *   `ignored` describes override lines that are not settings.
 */
export function mergeDosboxConf(generatedText, overrideText) {
  const generated = parse(generatedText);
  const override = parse(overrideText);
  const applied = [];

  for (const [name, section] of override.sections) {
    if (!generated.sections.has(name)) {
      generated.sections.set(name, { name, entries: new Map() });
    }
    const target = generated.sections.get(name).entries;
    for (const [key, value] of section.entries) {
      target.set(key, value);
      applied.push(`${name}.${key}`);
    }
  }

  if (override.autoexec !== null) {
    generated.autoexec = override.autoexec;
    applied.push(AUTOEXEC);
  }

  return { text: serialise(generated), applied, ignored: override.ignored };
}

/** The settings every game starts from, before display tuning and overrides. */
export const DEFAULT_DOSBOX_CONF = `[sdl]
fullscreen=false
fulldouble=false
fullresolution=original
windowresolution=1280x960
output=opengl
autolock=true
sensitivity=100
waitonerror=true
priority=higher,normal
usescancodes=true

[dosbox]
language=
machine=svga_s3
captures=capture
memsize=16

[render]
frameskip=0
aspect=true
scaler=normal3x

[cpu]
core=auto
cputype=auto
cycles=auto
cycleup=500
cycledown=20

[mixer]
nosound=false
rate=22050
blocksize=2048
prebuffer=10

[midi]
mpu401=intelligent
mididevice=default
midiconfig=

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
sbmixer=true
oplmode=auto
oplemu=default
oplrate=22050

[gus]
gus=false
gusrate=22050
gusbase=240
gusirq=5
gusdma=3
ultradir=C:\\ULTRASND

[speaker]
pcspeaker=true
pcrate=22050
tandy=auto
tandyrate=22050
disney=true

[joystick]
joysticktype=auto
timed=true
autofire=false
swap34=false
buttonwrap=true

[serial]
serial1=dummy
serial2=dummy
serial3=disabled
serial4=disabled

[dos]
xms=true
ems=true
umb=true
keyboardlayout=auto

[ipx]
ipx=false
`;

/**
 * Display tuning for the window the game opens in: larger windows get a
 * smoother scaler, more memory and maximum cycles.
 * @param {{ width: number, height: number }} window
 */
export function displaySettingsFor({ width, height }) {
  const tier =
    width >= 2048
      ? { scaler: "hq3x", memsize: 64, cycles: "max" }
      : width >= 1600
        ? { scaler: "advmame3x", memsize: 32, cycles: "max" }
        : { scaler: "normal3x", memsize: 16, cycles: "auto" };
  return { windowresolution: `${width}x${height}`, ...tier };
}

/**
 * The config the app generates for one launch: defaults, then display
 * tuning, then the autoexec that runs the game. Built from constants only,
 * so no host-side file can change it.
 * @param {{ window: { width: number, height: number }, autoexec: string }} options
 */
export function generateDosboxConf({ window, autoexec }) {
  const { windowresolution, scaler, memsize, cycles } = displaySettingsFor(window);
  const display = [
    "[sdl]",
    `windowresolution=${windowresolution}`,
    "[dosbox]",
    `memsize=${memsize}`,
    "[render]",
    `scaler=${scaler}`,
    "[cpu]",
    `cycles=${cycles}`,
    "[autoexec]",
    autoexec,
  ].join("\n");
  return mergeDosboxConf(DEFAULT_DOSBOX_CONF, display).text;
}
