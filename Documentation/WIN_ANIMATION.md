# Win Animation System

## Overview

When a player hits a winning combination on the slot machine, the space background transforms into a celebration effect. Two distinct animation modes are available: **Magic Stars** and **Confetti**. Both are configured through the **Win Animation Controls** panel.

**Source file:** `app/src/client/blazing-background.ts`

---

## Animation Modes

### 1. Magic Stars

A colorful rainbow particle burst that fills the screen with shifting-hue stars.

| Setting | Value | Description |
|---------|-------|-------------|
| Particle Count | 1,000 | Number of celebration particles |
| Particle Size | 1.8px | Larger than background stars |
| Speed | 2.5 units/frame | Upward trajectory speed |
| Drift | 2.8 | Heavy random displacement |
| Turbulence | 1.5 | Chaotic motion noise |
| Gravity | 0.3 | Light center pull |
| Focal Length | 120 | Perspective depth |
| Hue Shift | 0.18/frame | Color rotation speed through rainbow |
| Duration | 20 seconds | Total animation length |

**Visual behavior:**
- Particles spawn across the canvas
- Each particle cycles through rainbow colors (hue rotation)
- Upward trajectory with heavy drift creates a "magical dust" effect
- Turbulence adds chaos so particles don't follow uniform paths
- Light gravity keeps particles loosely centered

### 2. Confetti

Dense, chunky particles that burst and fall with physics damping.

| Setting | Value | Description |
|---------|-------|-------------|
| Particle Count | 5,000 | 5x more than magic stars |
| Particle Size | 18px | Large solid chunks |
| Speed | 4.5 units/frame | Fast initial burst |
| Damping | 0.994 | Per-frame velocity decay |
| Drift | Minimal | Near-zero random displacement |
| Turbulence | Minimal | Near-zero noise |
| Duration | 20 seconds | Total animation length |

**Visual behavior:**
- Massive burst of large particles
- Particles have high initial velocity
- Damping decays velocity each frame (0.994 = 0.6% lost per frame)
- Creates realistic "confetti cannon" effect
- Particles gradually slow and settle

---

## Win Animation Controls

The controls panel allows customization of both animation modes. Settings persist to `localStorage`.

### Available Controls (15+ settings)

| Control | Range | Affects | Description |
|---------|-------|---------|-------------|
| Animation Mode | Magic Stars / Confetti | Both | Selects active mode |
| Duration | 1 – 60s | Both | How long the animation runs |
| Particle Count | 0 – 500,000 | Both | Number of particles |
| Particle Size | 0.0 – 50.0 | Both | Size per particle |
| Speed | 0.0 – 10.0 | Both | Movement velocity |
| Gravity | 0.0 – 5.0 | Both | Center attraction |
| Drift | 0.0 – 10.0 | Both | Random displacement |
| Turbulence | 0.0 – 5.0 | Both | Noise jitter |
| Hue Shift | 0.0 – 1.0 | Magic Stars | Color rotation speed |
| Focal Length | 0 – 260 | Magic Stars | 3D depth |
| Damping | 0.9 – 1.0 | Confetti | Velocity decay per frame |

---

## Trigger Flow

```
Player spins → Server evaluates paylines → Win detected
  │
  ├── Frontend receives win response
  ├── Win amount displayed in UI
  ├── Balance updated
  │
  └── Win animation triggered:
      ├── Background star field pauses (or blends)
      ├── Win particles spawn based on selected mode
      ├── Animation runs for configured duration (default 20s)
      └── Background returns to normal star field
```

---

## Ring Control System

A supplementary 3D visualization layer that can display during wins:

| Setting | Value | Description |
|---------|-------|-------------|
| Pattern | Diamond | Decorative cell arrangement |
| Swing Amplitude | 40px | Oscillation distance |
| Swing Speed | 0.3 | Oscillation frequency |
| Camera Zoom | Configurable | 3D view distance |
| Camera Pitch | Configurable | 3D view angle |
| Pulse Alpha | 22% max | Inner ring glow intensity |

The ring system renders a golden cell grid with color gradients for different cell types, creating a 3D casino-themed visual effect.

---

## Technical Details

### Particle Lifecycle

1. **Spawn** — Particles are created with random positions across the canvas
2. **Animate** — Each frame updates position based on speed, gravity, drift, turbulence
3. **Render** — Particles drawn as circles (magic stars) or rectangles (confetti)
4. **Expire** — After duration elapses, particles fade and the system resets

### Color System (Magic Stars)

```
hue = (baseHue + frameCount * hueShift) % 360
color = hsl(hue, 100%, 70%)
```

Each particle gets a slightly offset base hue, creating a rainbow wave effect across the particle field.

### Damping Physics (Confetti)

```
velocity.x *= damping    // 0.994
velocity.y *= damping    // 0.994
velocity.y += gravity    // particles fall
position += velocity
```

With damping at 0.994, particles lose ~50% of their speed over ~115 frames (~1.9 seconds at 60fps).

---

## Win Animation Configurator

The win animation system includes a **real-time configurator panel** accessible from the game page. It allows players and developers to tune all particle parameters live, with instant visual feedback.

**Source:** `app/src/client/blazing-background.ts`

### Configurator UI

The configurator is toggled via a button (`#winControll`) in the game page. When opened, it displays a dropdown panel (`#winDropdown`) with all controls for both animation modes.

```
┌──────────────────────────────────────┐
│  Win Animation Settings              │
│──────────────────────────────────────│
│  Mode: [Magic Stars ▼]              │
│                                      │
│  ── Magic Stars Settings ──          │
│  Particle Count  [====●====] 1000   │
│  Speed           [====●====] 2.5    │
│  Drift           [====●====] 2.8    │
│  Turbulence      [====●====] 1.5    │
│  Particle Size   [====●====] 1.8    │
│  Brightness      [====●====] 1.6    │
│  Duration        [====●====] 20s    │
│  Hue Speed       [====●====] 0.18   │
│  Focal Length    [====●====] 120    │
│  Gravity         [====●====] 0.3    │
│                                      │
│  ── Confetti Settings ──             │
│  Particle Count  [====●====] 5000   │
│  Speed           [====●====] 4.5    │
│  Drift           [====●====] 0.35   │
│  Turbulence      [====●====] 0.015  │
│  Particle Size   [====●====] 18     │
│  Brightness      [====●====] 1.0    │
│  Duration        [====●====] 20s    │
│  Damping         [====●====] 0.994  │
└──────────────────────────────────────┘
```

### Control Bindings (18 controls)

Each control is bound to an HTML range input with a specific ID pattern `sv-win-{key}`:

#### Magic Stars Controls

| Control ID | Setting | Type | Range | Default |
|-----------|---------|------|-------|---------|
| `sv-win-msCount` | Particle Count | int | 0 – 500,000 | 1,000 |
| `sv-win-msSpeed` | Speed | float | 0.0 – 10.0 | 2.5 |
| `sv-win-msDrift` | Drift | float | 0.0 – 10.0 | 2.8 |
| `sv-win-msTurbulence` | Turbulence | float | 0.0 – 5.0 | 1.5 |
| `sv-win-msSize` | Particle Size | float | 0.0 – 50.0 | 1.8 |
| `sv-win-msBrightness` | Brightness | float | 0.0 – 3.0 | 1.6 |
| `sv-win-msDuration` | Duration (seconds) | int | 1 – 60 | 20 |
| `sv-win-msHueSpeed` | Hue Rotation Speed | float | 0.0 – 1.0 | 0.18 |
| `sv-win-msFocalLength` | Focal Length | int | 0 – 260 | 120 |
| `sv-win-msGravity` | Gravity | float | 0.0 – 5.0 | 0.3 |

#### Confetti Controls

| Control ID | Setting | Type | Range | Default |
|-----------|---------|------|-------|---------|
| `sv-win-mcCount` | Particle Count | int | 0 – 500,000 | 5,000 |
| `sv-win-mcSpeed` | Speed | float | 0.0 – 10.0 | 4.5 |
| `sv-win-mcDrift` | Drift | float | 0.0 – 10.0 | 0.35 |
| `sv-win-mcTurbulence` | Turbulence | float | 0.0 – 5.0 | 0.015 |
| `sv-win-mcSize` | Particle Size | float | 0.0 – 50.0 | 18 |
| `sv-win-mcBrightness` | Brightness | float | 0.0 – 3.0 | 1.0 |
| `sv-win-mcDuration` | Duration (seconds) | int | 1 – 60 | 20 |
| `sv-win-mcDamping` | Damping | float | 0.9 – 1.0 | 0.994 |

### Persistence

All settings are persisted to `localStorage` under a single versioned key:

```
Key:   slotm.win.settings.v1
Value: JSON object with all 18+ settings
```

**Default settings object:**

```javascript
{
  mode: "magic_stars",
  msCount: 1000,
  msSpeed: 2.5,
  msDrift: 2.8,
  msTurbulence: 1.5,
  msSize: 1.8,
  msBrightness: 1.6,
  msDuration: 20,
  msHueSpeed: 0.18,
  msFocalLength: 120,
  msGravity: 0.3,
  mcCount: 5000,
  mcSpeed: 4.5,
  mcDrift: 0.35,
  mcTurbulence: 0.015,
  mcSize: 18,
  mcBrightness: 1.0,
  mcDuration: 20,
  mcDamping: 0.994
}
```

On page load, settings are read from localStorage and applied to the controls. Any change to a control immediately updates the stored settings and applies to the next animation.

### How to Reset

To reset all win animation settings to defaults, clear the localStorage key:

```javascript
localStorage.removeItem("slotm.win.settings.v1");
location.reload();
```

---

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `slotm.win.settings.v1` | JSON | All win animation settings (versioned) |
