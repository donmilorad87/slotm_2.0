# Space Controls & Star Animation System

## Overview

The space background is a real-time canvas-based particle system rendering a deep-space star field. It powers the visual atmosphere across the entire application — slot machine, games page, home page, and more.

**Source file:** `app/src/client/blazing-background.ts`

---

## Architecture

The system uses a dual-layer star field rendered on an HTML5 `<canvas>` element (`#space`):

1. **Moving Stars** — Depth-based particles that fly toward the viewer with parallax
2. **Static Stars** — Background pinpoints that drift subtly with mouse movement

Both layers combine to create a convincing 3D space effect.

### Render Pipeline

```
requestAnimationFrame loop
  ├── Clear canvas (dark background)
  ├── Sort stars by Z-depth (back to front)
  ├── Calculate mouse-based parallax offset
  ├── For each star:
  │   ├── Apply gravity (pull toward center)
  │   ├── Apply drift (random X/Y jitter)
  │   ├── Apply turbulence (Perlin-noise-like)
  │   ├── Project 3D → 2D using focal length
  │   ├── Calculate brightness from depth
  │   └── Draw circle with computed opacity
  └── Update positions for next frame
```

---

## Configuration Settings

All settings are adjustable via the **Space Controls** dropdown panel on the slot machine page. Values persist to `localStorage`.

### Star Count & Size

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Moving Stars | 0 – 500,000 | 1,400 | Depth-based particles that fly toward the viewer |
| Static Stars | 0 – 500,000 | 700 | Background pinpoints, subtle glow |
| Star Radius | 0.0 – 3.6 | 1.25 | Particle size in pixels |
| Static Illumination | On / Off | ON | Glow halo around static stars |

### Movement & Physics

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Speed | 0.0 – 4.0 | 0.05 | Forward velocity of moving stars (units/frame) |
| Gravity | 0.0 – 2.5 | 0.6 | Pull force toward canvas center |
| Drift | 0.0 – 3.5 | 0.8 | Random per-frame X/Y displacement |
| Turbulence | 0.0 – 3.5 | 0.15 | Noise-based jitter intensity |

### Perspective & Depth

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Focal Length | 0 – 260 | 120 | 3D perspective projection depth |
| Farness | 0.0 – 3.5 | 1.0 | Z-depth multiplier — higher pushes stars deeper |
| Brightness | 0.0 – 2.4 | 1.0 | Global luminosity multiplier |

### Parallax

| Factor | Value | Applies To |
|--------|-------|------------|
| Static parallax | 0.08 | Background stars shift slightly with mouse |
| Moving parallax | 0.20 | Foreground stars shift more with mouse |

---

## How It Works

### Star Initialization

Each star is created with random 3D coordinates:

```
x: random(-canvas.width/2, canvas.width/2)
y: random(-canvas.height/2, canvas.height/2)
z: random(0.1, maxDepth)
```

When a moving star's Z-coordinate passes 0 (reaches the viewer), it resets to the far plane.

### Perspective Projection

Stars are projected from 3D to 2D screen coordinates using:

```
screenX = (star.x * focalLength) / star.z + canvas.width/2
screenY = (star.y * focalLength) / star.z + canvas.height/2
```

Stars closer to the camera (lower Z) appear larger and brighter.

### Gravity Effect

Each frame, star positions are nudged toward the center:

```
dx = centerX - star.x
dy = centerY - star.y
star.x += dx * gravity * 0.001
star.y += dy * gravity * 0.001
```

### Mouse Parallax

Mouse position offsets star rendering positions:

```
offsetX = (mouseX - centerX) * parallaxFactor
offsetY = (mouseY - centerY) * parallaxFactor
renderX = screenX + offsetX
renderY = screenY + offsetY
```

---

## UI Controls

The space controls appear as a collapsible dropdown panel on the slot machine page. Each control is a range slider with a numeric readout.

**Location in markup:** `app/src/views/slot-machine.hbs` — look for the `space-controls` section.

### Control Panel Structure

```html
<div class="space-controls-dropdown">
  <button>Space Controls ▼</button>
  <div class="controls-panel">
    <!-- 12 range sliders -->
    <label>Moving Stars: <input type="range" min="0" max="500000" value="1400"></label>
    <label>Static Stars: <input type="range" min="0" max="500000" value="700"></label>
    <!-- ... remaining controls ... -->
  </div>
</div>
```

---

## Performance Notes

- At default settings (2,100 total stars), the system runs at 60fps on modern hardware
- Increasing star count above ~50,000 may cause frame drops on lower-end devices
- The canvas automatically resizes on window resize events
- Stars are sorted by Z-depth each frame for correct occlusion (back-to-front)
- Static illumination adds a second draw call per static star (glow halo)

---

## Full Screen Mode

When the slot machine enters full screen mode, the canvas expands to fill the viewport. The star field automatically recalculates bounds and redistributes stars across the larger area. This is where the full space animation becomes most immersive — combined with the slot reels spinning, win animations, and the deep star field.

---

## localStorage Keys

Settings are saved under these keys:

| Key | Type | Description |
|-----|------|-------------|
| `space_movingStars` | number | Moving star count |
| `space_staticStars` | number | Static star count |
| `space_starRadius` | number | Star size |
| `space_staticIllumination` | boolean | Glow toggle |
| `space_brightness` | number | Luminosity |
| `space_speed` | number | Movement speed |
| `space_focalLength` | number | Perspective depth |
| `space_farness` | number | Z-depth multiplier |
| `space_gravity` | number | Center pull |
| `space_drift` | number | Random jitter |
| `space_turbulence` | number | Noise intensity |
