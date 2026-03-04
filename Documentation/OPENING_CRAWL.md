# Opening Crawl Animation

## Overview

A Star Wars-inspired opening crawl that plays on the home page. The animation consists of three sequential phases: intro text, logo shrink, and the perspective text crawl.

**Source file:** `app/src/client/opening-crawl.ts`
**View:** `app/src/views/home.hbs`

---

## Three-Phase Sequence

### Phase 1: Intro Text (3 seconds)

- Rendered on HTML5 canvas
- Centered text fades in
- Static display for the configured intro duration
- Dark background matches the space star field

### Phase 2: Logo Shrink (6 seconds)

- "Blazing Sun" logo rendered on canvas
- Gradient fill cycles through gold tones:
  - Yellow → Orange → Dark Gold
- Logo scales down from full size toward the center
- Opacity decreases as the logo shrinks
- Transitions into the crawl phase

### Phase 3: Perspective Crawl (starts after 10-second delay)

- HTML overlay positioned above the canvas
- CSS 3D transforms create the receding-text effect:
  - `perspective` on parent container
  - `rotateX()` tilt on the text wrapper
- Text scrolls upward at configurable speed
- Upper portion of text fades via gradient (fade zone)
- Continues until all text has scrolled off screen

---

## Crawl Content

```
Episode IV
THE CODE AWAKENS

[Narrative about Blazing Sun founder and the platform's story]
```

The crawl tells the origin story of the Blazing Sun platform in a cinematic style.

---

## Configuration Settings

All settings are adjustable through the crawl controls panel. Values persist to `localStorage`.

### Timing

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Intro Duration | 3.0s | 0.5 – 10.0s | Phase 1 display time |
| Logo Duration | 6.0s | 1.0 – 15.0s | Phase 2 shrink time |
| Crawl Delay | 10.0s | 1.0 – 30.0s | Delay before Phase 3 starts |

### Visual

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Scroll Speed | 104 px/frame | 10 – 500 | Upward crawl velocity |
| Font Size | 49px | 12 – 120 | Crawl text size |
| Text Width | 1.0x | 0.3 – 2.0 | Horizontal text scaling |

### 3D Perspective

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Perspective | 1.05 | 0.5 – 3.0 | CSS perspective depth ratio |
| Vanish Point | 0.4 | 0.0 – 1.0 | Horizon distance (0=top, 1=bottom) |
| Tilt Angle | 33° | 0 – 70° | X-axis rotation for receding effect |
| Fade Zone | 0.36 | 0.0 – 1.0 | Fraction of height where text fades to transparent |

---

## CSS 3D Transform Stack

The crawl effect is built with pure CSS transforms:

```css
.crawl-container {
    perspective: 1.05em;       /* depth perception */
    overflow: hidden;
}

.crawl-text {
    transform: rotateX(33deg); /* tilt text away */
    transform-origin: 50% 100%;
    animation: crawl-scroll linear;
}
```

The `perspective` value controls how extreme the 3D effect appears. Lower values create a more dramatic vanishing point. The `rotateX` tilt angles the text backward so it appears to recede into the distance.

### Fade Zone

A CSS gradient mask creates the top fade:

```css
.crawl-text {
    mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 36%    /* fade zone setting */
    );
}
```

Text entering the top 36% of the container gradually becomes transparent, simulating text disappearing into the distance.

---

## Implementation Flow

```
Page load
  │
  ├── Initialize canvas (full viewport)
  ├── Start space star field background
  │
  ├── Phase 1: Intro
  │   ├── Render intro text on canvas
  │   ├── Fade in
  │   └── Hold for introDelay (3s)
  │
  ├── Phase 2: Logo
  │   ├── Draw gradient-filled logo text
  │   ├── Scale down over logoDelay (6s)
  │   └── Fade out
  │
  └── Phase 3: Crawl
      ├── Wait crawlDelay (10s)
      ├── Create HTML overlay with 3D transforms
      ├── Inject crawl text content
      ├── Begin upward scroll animation
      ├── Apply fade zone mask
      └── Remove overlay when text fully scrolled
```

---

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `crawl_scrollSpeed` | number | Pixels per frame |
| `crawl_fontSize` | number | Font size in px |
| `crawl_perspective` | number | CSS perspective ratio |
| `crawl_vanishPoint` | number | Horizon position |
| `crawl_textWidth` | number | Horizontal scale |
| `crawl_fadeZone` | number | Fade fraction |
| `crawl_tiltAngle` | number | X-rotation degrees |
| `crawl_introDelay` | number | Phase 1 seconds |
| `crawl_logoDelay` | number | Phase 2 seconds |
| `crawl_crawlDelay` | number | Phase 3 start offset |

---

## Integration with Space Background

The opening crawl runs on top of the space star field. The canvas renders both the star particles and the intro/logo phases. When Phase 3 starts, an HTML overlay is positioned above the canvas so the crawl text appears to float over the moving stars — creating the classic Star Wars depth effect.
