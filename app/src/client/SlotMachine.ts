// @ts-nocheck
/**
 * SlotMachine Web Component
 *
 * A self-contained slot machine game component. Fits within its container
 * without affecting the parent page layout.
 *
 * Usage:
 * <slot-machine
 *   data-balance="1000"
 *   data-user-id="1"
 *   data-jwt-token="..."
 * ></slot-machine>
 */

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: "Lucida Sans Unicode", "Lucida Grande", sans-serif;
      /* Blazing Sun Theme Colors */
      --primary-color: var(--color-accent, #667eea);
      --primary-light: var(--color-accent-light, #818cf8);
      --primary-dark: var(--color-accent-dark, #4f46e5);
      --success-color: var(--color-success, #10b981);
      --danger-color: var(--color-error, #ef4444);
      --warning-color: var(--color-warning, #f59e0b);
      --info-color: var(--color-info, #3b82f6);
      /* Text Colors */
      --slot-text-primary: var(--text-primary, #333333);
      --slot-text-secondary: var(--text-secondary, #555555);
      --slot-text-muted: var(--text-muted, #666666);
      /* Background Colors */
      --slot-card-bg: var(--card-bg, #ffffff);
      --slot-input-bg: var(--input-bg, #ffffff);
      --slot-border-color: var(--input-border, #e0e0e0);
      --bg-gradient: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
      /* Carousel Cell Colors (theme-aware) */
      --slot-cell-border: var(--card-bg, #ffffff);
      --slot-cell-shadow-light: var(--cell-shadow-light, rgba(255, 255, 255, 0.5));
      --slot-cell-shadow-dark: var(--cell-shadow-dark, rgba(0, 0, 0, 1));
      --slot-cell-shadow-gray: var(--cell-shadow-gray, gray);
      --slot-cell-inset-border: var(--card-bg, #ffffff);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .slot-game {
      background: var(--bg-gradient);
      background-attachment: fixed;
      border-radius: 1rem;
      padding: 1.5rem;
      user-select: none;
      -webkit-user-select: none;
    }

    /* Top Controls Row */
    .slot-top-controls {
      display: grid;
      grid-template-columns: 180px 1fr 180px;
      gap: 1rem;
      margin-bottom: 3rem;
      align-items: center;
    }

    .slot-top-controls-center {
      display: flex;
      justify-content: center;
      align-items: stretch;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .slot-controls-wrapper {
      display: flex;
      align-items: stretch;
      gap: 0.5rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .slot-right-column {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      color: var(--slot-text-primary);
    }

    .spins-counter {
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      font-size: 0.875rem;
      text-align: center;
      color: var(--slot-text-primary);
    }

    /* Buttons */
    button {
      display: inline-block;
      padding: 8px 20px;
      cursor: pointer;
      border: 1px solid #bbb;
      overflow: visible;
      font: bold 13px arial, helvetica, sans-serif;
      text-decoration: none;
      color: #555;
      background-color: #ddd;
      background-image: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));
      background-clip: padding-box;
      border-radius: 3px;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3), 0 2px 2px -1px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.3) inset;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
    }

    button:hover { background-color: #eee; }
    button:active {
      background: #e9e9e9;
      position: relative;
      top: 1px;
      text-shadow: none;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.3) inset;
    }

    button[disabled] {
      border-color: #eaeaea;
      background: #fafafa;
      cursor: default;
      position: static;
      color: #999;
      box-shadow: none !important;
      text-shadow: none !important;
    }

    .disabled {
      pointer-events: none;
      opacity: 0.5;
      cursor: default;
    }

    /* Blazing Sun Theme Buttons (same style as control-group) */
    .btn-primary,
    .btn-secondary {
      padding: 0.625rem 1.25rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      color: var(--slot-text-primary);
      cursor: pointer;
      min-width: 100px;
      height: 96px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
    }

    .btn-primary:hover,
    .btn-secondary:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .btn-primary:active,
    .btn-secondary:active {
      box-shadow: 0 2px rgba(0,0,0,0.3);
      transform: translateY(2px);
    }

    .btn-primary.active,
    .btn-secondary.active {
      background: color-mix(in srgb, var(--success-color) 60%, transparent);
      color: white;
    }

    /* Progress Bar Container */
    .progress-container {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-direction: column;
      gap: 4px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 6px 20px 1rem 20px;
      width: 200px;
      height: 96px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .progress-label {
      font-size: 0.75rem;
      color: var(--slot-text-secondary);
      font-weight: bold;
      display: none;
    }

    progress {
      display: block;
      width: 160px;
      height: 25px;
      padding: 4px;
      border: 0 none;
      background: #444;
      border-radius: 14px;
      box-shadow: inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.2);
    }

    progress::-webkit-progress-bar {
      background: transparent;
    }
    progress::-webkit-progress-value {
      border-radius: 12px;
      background: #fff;
      box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 2px 5px rgba(0,0,0,0.3);
    }
    progress::-moz-progress-bar {
      border-radius: 12px;
      background: #fff;
    }

    /* Main Game Layout */
    .slot-layout {
      display: grid;
      grid-template-columns: 180px 1fr 180px;
      gap: 1rem;
      align-items: start;
    }

    @media (max-width: 900px) {
      .slot-layout {
        grid-template-columns: 1fr;
      }
      .slot-sidebar { order: 2; }
      .slot-center { order: 1; }
      .slot-options { order: 3; }
    }

    /* Center Column */
    .slot-center {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* Sidebars */
    .slot-sidebar,
    .slot-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .slot-options,
    .slot-sidebar {
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
      align-self: start;
    }

    .nav-div {
      background: color-mix(in srgb, var(--slot-input-bg) 60%, transparent);
      padding: 8px;
      border-radius: 6px;
      border: 2px solid var(--slot-border-color);
      box-shadow: 0 4px rgba(0,0,0,0.3);
    }

    .nav-div button {
      width: 100%;
      margin-bottom: 8px;
      min-height: 80px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      color: var(--slot-text-primary);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 500;
    }

    .nav-div button:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .slot-options button,
    .slot-sidebar button {
      width: 100%;
      width: -webkit-fill-available;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      margin: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      padding: 1%;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      color: var(--slot-text-primary);
      cursor: pointer;
    }

    .slot-options button:hover,
    .slot-sidebar button:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .slot-options .control-group,
    .slot-sidebar .control-group {
      width: 100%;
      width: -webkit-fill-available;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      margin: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      padding: 1%;
      text-align: center;
    }

    /* Stronger borders for all clickable elements */
    .slot-controls-wrapper button,
    .slot-controls-wrapper .btn-primary,
    .slot-controls-wrapper .btn-secondary,
    .slot-sidebar button,
    .slot-sidebar .control-group,
    .slot-options button,
    .slot-options .control-group {
      border-width: 2px;
    }

    .control-group {
      width: 100%;
      border: 2px solid var(--slot-border-color);
      margin-bottom: 4px;
      padding: 4px 8px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      cursor: pointer;
      color: var(--slot-text-secondary);

    }

    .control-group:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .control-group label,
    .control-group input {
      pointer-events: none;
      cursor: pointer;
    }

    .control-group.active {
      background: color-mix(in srgb, var(--success-color) 60%, transparent);
      color: white;
    }

    .control-group.active:hover {
      background: color-mix(in srgb, var(--success-color) 80%, transparent);
    }

    /* Joker Container & Lines Container */
    .joker-container,
    .lines-container {
      display: none;
      flex-direction: column;
      gap: 0.5rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      margin: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .joker-hint {
      font-size: 9px;
      padding: 5px 0;
      margin: 4px 0 0;
    }

    /* Lines Container */
    .lines-container > div {
      display: flex;
      justify-content: center;
      align-items: center;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      width: 100%;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      box-shadow: 0 4px rgba(0,0,0,0.3);
      cursor: pointer;
      color: var(--slot-text-secondary);
      transition: all 0.2s;
    }

    .lines-container > div:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .lines-container > div.active {
      background: color-mix(in srgb, var(--success-color) 60%, transparent);
      color: white;
    }

    .lines-container > div.active:hover {
      background: color-mix(in srgb, var(--success-color) 80%, transparent);
    }

    .lines-container > div.disabled {
      pointer-events: none;
      opacity: 0.6;
    }

    .lines-container label {
      cursor: pointer;
    }

    /* Reels/Spinners */
    .spinners {
      display: flex;
      overflow: visible;
      padding: 10px;
      position: relative;
      border-radius: 8px;
      transform: translateY(20px);
    }

    .scene {
      transition: 0.3s;
      margin: 100px 0;
      position: relative;
      width: 100%;
      height: 120px;
    }

    .carousel {
      transform: translateZ(-220px);
      height: 100%;
      transform-style: preserve-3d;
      transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .carousel__cell {
      position: absolute;
      width: 100%;
      height: 120px;
    }

    .carousel__cell p {
      color: white;
      will-change: auto;
      height: 100%;
      font-size: 4rem;
      font-weight: bold;
      height: -webkit-fill-available;
      width: 100%;
      width: -webkit-fill-available;
      margin: 0;
      box-shadow:
        0px -1px 2px var(--slot-cell-shadow-gray) inset,
        0px 0px 0px 3px var(--slot-cell-inset-border) inset,
        0px 1px 5px 2px var(--slot-cell-shadow-dark) inset,
        0px 15px 0px 3px var(--slot-cell-shadow-light) inset,
        0px -8px 15px 0px var(--slot-cell-shadow-dark) inset;
      border: 10px solid var(--slot-cell-border);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .carousel__cell:nth-child(1) p { background: hsla(0, 100%, 50%, 1); }
    .carousel__cell:nth-child(2) p { background: hsla(40, 100%, 50%, 1); }
    .carousel__cell:nth-child(3) p { background: hsla(80, 100%, 50%, 1); }
    .carousel__cell:nth-child(4) p { background: hsla(120, 100%, 50%, 1); }
    .carousel__cell:nth-child(5) p { background: hsla(160, 100%, 50%, 1); }
    .carousel__cell:nth-child(6) p { background: hsla(200, 100%, 50%, 1); }
    .carousel__cell:nth-child(7) p { background: hsla(0, 100%, 50%, 1); }
    .carousel__cell:nth-child(8) p { background: hsla(40, 100%, 50%, 1); }
    .carousel__cell:nth-child(9) p { background: hsla(80, 100%, 50%, 1); }
    .carousel__cell:nth-child(10) p { background: hsla(120, 100%, 50%, 1); }
    .carousel__cell:nth-child(11) p { background: hsla(160, 100%, 50%, 1); }
    .carousel__cell:nth-child(12) p { background: hsla(200, 100%, 50%, 1); }

    .canvas-overlay {
      border: solid var(--primary-color);
      width: 100%;
      position: absolute;
      top: 0;
      height: 100%;
      border-width: 8px;
      left: 0;
      z-index: 9;
      border-radius: 8px;
      pointer-events: none;
    }

    .canvas-overlay.joker-active {
      pointer-events: auto;
      cursor: pointer;
    }

    .canvas-overlay.single-line-mode {
      border-color: #5B2D8F;
      top: 33.33%;
      height: 33.33%;
    }

    /* Info Panel */
    .info-panel {
      width: 100%;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      display: flex;
      overflow: hidden;
      padding: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
      margin-top: 3rem;
    }

    .info-panel > div {
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 4px 8px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      font-size: 0.875rem;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    /* Odds Tables */
    .odds-container {
      width: 100%;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.75rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .odds-table {
      flex: 1;
      min-width: 150px;
      border-collapse: separate;
      border-spacing: 2px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 4px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
    }

    .odds-table caption {
      font-size: 14px;
      margin-bottom: 4px;
      font-weight: bold;
      color: var(--slot-text-primary);
    }

    .odds-table td {
      font-size: 10px;
      height: 16px;
      background-color: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      text-align: center;
      vertical-align: middle;
      padding: 4px 6px;
      color: var(--slot-text-primary);
      border-radius: 4px;
      border: 1px solid var(--slot-border-color);
      box-shadow: 0 2px rgba(0,0,0,0.2);
    }

    .odds-table td:empty,
    .odds-table .empty-cell {
      background-color: transparent;
      border-color: transparent;
      box-shadow: none;
    }

    .odds-value {
      background-color: color-mix(in srgb, var(--success-color) 60%, transparent) !important;
      color: white !important;
      font-weight: bold;
    }

    .line-label {
      background-color: color-mix(in srgb, var(--slot-input-bg) 60%, transparent) !important;
      font-weight: bold;
      font-size: 9px;
      white-space: nowrap;
    }

    /* Win Overlay */
    .win-overlay {
      padding: 20px;
      background: rgba(255,255,255,0.95);
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 100001;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      min-width: 300px;
    }

    .win-overlay h1 {
      margin: 10px 0;
      color: var(--success-color);
    }

    .win-overlay h2 {
      margin: 10px 0;
      color: #333;
    }

    .win-overlay button {
      margin: 10px 5px;
      padding: 10px 30px;
    }

    /* Bingo Mini Game Overlay */
    .minigame-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 100002;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-sizing: border-box;
    }

    .minigame-container {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      padding: 20px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 2px solid var(--slot-border-color);
    }

    .minigame-header {
      text-align: center;
      margin-bottom: 20px;
      color: #fff;
    }

    .minigame-header h2 {
      margin: 0 0 10px 0;
      font-size: 1.5rem;
      color: var(--primary-color);
    }

    .minigame-header p {
      margin: 5px 0;
      font-size: 0.9rem;
      color: #aaa;
    }

    .minigame-prize {
      font-size: 1.2rem;
      color: var(--success-color);
      font-weight: bold;
    }

    .minigame-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    @media (max-width: 600px) {
      .minigame-layout {
        grid-template-columns: 1fr;
      }
    }

    .minigame-numbers {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 15px;
      border: 2px solid var(--slot-border-color);
    }

    .minigame-numbers h3 {
      margin: 0 0 15px 0;
      color: #fff;
      font-size: 1rem;
      text-align: center;
    }

    .number-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
    }

    .number-btn {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2px solid var(--slot-border-color);
      background: linear-gradient(145deg, #2a2a4a, #1a1a3a);
      color: #fff;
      font-weight: bold;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .number-btn:hover:not(.selected):not(.disabled) {
      background: linear-gradient(145deg, var(--primary-color), #3a3a6a);
      transform: scale(1.1);
    }

    .number-btn.selected {
      background: linear-gradient(145deg, var(--success-color), #1a8a3a);
      border-color: var(--success-color);
      transform: scale(1.05);
    }

    .number-btn.disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .number-btn.drawn {
      background: linear-gradient(145deg, #ff6b6b, #c92a2a);
      border-color: #ff6b6b;
      animation: pulse 0.5s ease-out;
    }

    .number-btn.matched {
      background: linear-gradient(145deg, #ffd700, #ffa500);
      border-color: #ffd700;
      animation: glow 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }

    @keyframes glow {
      0%, 100% { box-shadow: 0 0 5px #ffd700; }
      50% { box-shadow: 0 0 20px #ffd700; }
    }

    .minigame-tickets {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 15px;
      border: 2px solid var(--slot-border-color);
    }

    .minigame-tickets h3 {
      margin: 0 0 15px 0;
      color: #fff;
      font-size: 1rem;
      text-align: center;
    }

    .tickets-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ticket {
      background: rgba(255,255,255,0.05);
      border: 2px solid var(--slot-border-color);
      border-radius: 8px;
      padding: 10px;
      min-height: 50px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ticket.active {
      border-color: var(--primary-color);
      background: rgba(var(--primary-color-rgb), 0.1);
    }

    .ticket-label {
      font-size: 0.8rem;
      color: #888;
      min-width: 60px;
    }

    .ticket-numbers {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      flex: 1;
    }

    .ticket-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(145deg, var(--primary-color), #3a3a6a);
      color: #fff;
      font-size: 0.8rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ticket-number:hover {
      transform: scale(1.1);
      background: #c92a2a;
    }

    .ticket-number.matched {
      background: linear-gradient(145deg, #ffd700, #ffa500);
    }

    .ticket-result {
      font-size: 0.75rem;
      color: #aaa;
      margin-left: auto;
      text-align: right;
    }

    .ticket-result.win {
      color: var(--success-color);
      font-weight: bold;
    }

    .minigame-controls {
      margin-top: 20px;
      display: flex;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
    }

    .minigame-btn {
      padding: 12px 30px;
      border-radius: 8px;
      border: 2px solid var(--slot-border-color);
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    }

    .minigame-btn-primary {
      background: linear-gradient(145deg, var(--primary-color), #3a3a6a);
      color: #fff;
    }

    .minigame-btn-primary:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(var(--primary-color-rgb), 0.4);
    }

    .minigame-btn-secondary {
      background: linear-gradient(145deg, #444, #333);
      color: #fff;
    }

    .minigame-btn-secondary:hover:not(:disabled) {
      background: linear-gradient(145deg, #555, #444);
    }

    .minigame-btn-success {
      background: linear-gradient(145deg, var(--success-color), #1a8a3a);
      color: #fff;
    }

    .minigame-btn-success:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(40, 167, 69, 0.4);
    }

    .minigame-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .minigame-drawn {
      margin-top: 20px;
      text-align: center;
    }

    .minigame-drawn h3 {
      color: #fff;
      margin: 0 0 15px 0;
    }

    .drawn-numbers {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .drawn-number {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(145deg, #ff6b6b, #c92a2a);
      color: #fff;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: popIn 0.3s ease-out;
    }

    @keyframes popIn {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }

    .minigame-result {
      margin-top: 20px;
      text-align: center;
      padding: 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      border: 2px solid var(--slot-border-color);
    }

    .minigame-result h2 {
      color: var(--success-color);
      margin: 0 0 10px 0;
    }

    .minigame-result p {
      color: #fff;
      margin: 5px 0;
    }

    .minigame-result .total-win {
      font-size: 1.5rem;
      color: #ffd700;
      font-weight: bold;
    }

    .minigame-info {
      margin-top: 15px;
      padding: 10px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      font-size: 0.8rem;
      color: #888;
      text-align: center;
    }

    /* Odds Table Section */
    .minigame-odds {
      margin-top: 20px;
      padding: 15px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
    }

    .minigame-odds h3 {
      color: #ffd700;
      margin-bottom: 10px;
      font-size: 0.9rem;
      text-align: center;
    }

    .odds-table-container {
      max-height: 200px;
      overflow-y: auto;
    }

    .odds-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.75rem;
    }

    .odds-table th, .odds-table td {
      padding: 6px 8px;
      text-align: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .odds-table th {
      background: rgba(255,215,0,0.2);
      color: #ffd700;
      font-weight: bold;
    }

    .odds-table td {
      color: #ddd;
    }

    .odds-table tr:hover {
      background: rgba(255,255,255,0.05);
    }

    /* Number button states */
    .number-btn.used-other {
      background: linear-gradient(145deg, #3a3a6a, #2a2a4a);
      border-color: #666;
      color: #aaa;
    }

    .number-btn.used-other::after {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 6px;
      height: 6px;
      background: #ffd700;
      border-radius: 50%;
    }

    /* Removable ticket numbers */
    .ticket-number.removable {
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .ticket-number.removable:hover {
      background: #ff4444;
      border-color: #ff6666;
      transform: scale(1.1);
    }

    .ticket-number.removable:hover::after {
      content: '×';
      position: absolute;
      top: -5px;
      right: -5px;
      width: 14px;
      height: 14px;
      background: #ff0000;
      color: white;
      font-size: 10px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Stake display in header */
    .minigame-stake {
      color: #4CAF50;
      font-weight: bold;
    }

    /* Toast Notification System */
    .minigame-toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 100003;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 320px;
    }

    .minigame-toast {
      background: rgba(30, 30, 46, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0.5rem;
      padding: 0.875rem 1rem;
      color: #fff;
      font-size: 0.875rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: toastSlideIn 0.3s ease-out;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .minigame-toast--error {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.15);
    }

    .minigame-toast--warning {
      border-color: #f59e0b;
      background: rgba(245, 158, 11, 0.15);
    }

    .minigame-toast--success {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.15);
    }

    .minigame-toast--info {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.15);
    }

    @keyframes toastSlideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes toastSlideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    /* Coin Selector */
    .coin-selector {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 15px 0;
      padding: 15px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .coin-selector-label {
      color: #ffd700;
      font-size: 0.9rem;
      font-weight: bold;
      text-align: center;
    }

    .coin-selector-buttons {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }

    .coin-btn {
      padding: 8px 16px;
      border-radius: 20px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      background: linear-gradient(145deg, #2a2a4a, #1a1a3a);
      color: #fff;
      font-size: 0.85rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    }

    .coin-btn:hover {
      background: linear-gradient(145deg, #3a3a6a, #2a2a5a);
      transform: scale(1.05);
    }

    .coin-btn.selected {
      background: linear-gradient(145deg, #ffd700, #ffa500);
      color: #000;
      border-color: #ffd700;
      box-shadow: 0 0 10px rgba(255, 215, 0, 0.4);
    }

    /* Total Bet Display */
    .total-bet-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px;
      margin: 10px 0;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .total-bet-label {
      color: #aaa;
      font-size: 0.9rem;
    }

    .total-bet-value {
      color: #ffd700;
      font-size: 1.1rem;
      font-weight: bold;
    }

    .total-bet-value.insufficient {
      color: #ef4444;
    }

    /* Balance Display */
    .balance-display-mini {
      color: #10b981;
      font-size: 0.85rem;
    }

    .balance-display-mini.low {
      color: #f59e0b;
    }

    .balance-display-mini.insufficient {
      color: #ef4444;
    }

    /* Globally Used Numbers - Cannot be selected in other tickets */
    .number-btn.globally-used {
      opacity: 0.3;
      cursor: not-allowed;
      background: linear-gradient(145deg, #1a1a2a, #0a0a1a);
      border-color: #333;
    }

    .number-btn.globally-used:hover {
      transform: none;
      background: linear-gradient(145deg, #1a1a2a, #0a0a1a);
    }

  </style>

  <div class="slot-game">
    <!-- Top Controls -->
    <div class="slot-top-controls">
      <div></div>
      <div class="slot-top-controls-center">
        <div class="slot-controls-wrapper">
          <button class="btn-primary" id="startBtn">Start Game</button>
          <div class="progress-container" id="progressContainer">
            <span class="progress-label" id="progressLabel">5 sec</span>
            <progress value="0" max="5" id="progressBar"></progress>
          </div>
          <button class="btn-secondary" id="stopBtn">Stop</button>
        </div>
      </div>
      <div class="spins-counter">Spins played: <span id="spinsCount">0</span></div>
    </div>

    <!-- Main Layout -->
    <div class="slot-layout">
      <!-- Left Sidebar: Bet & Lines -->
      <div class="slot-sidebar">
        <div class="nav-div">
          <button id="betBtn">Bet</button>
          <div id="betOptions"></div>
          <div class="joker-container" id="jokerContainer">
            <input type="checkbox" id="jokerCheckbox" name="joker">
            <label for="jokerCheckbox">Buy Joker</label>
            <p class="joker-hint">Joker costs 5x bet.</p>
            <button id="confirmJokerBtn" style="display: none; margin-top: 8px; width: 100%;">Confirm Joker</button>
            <button id="removeJokerBtn" style="display: none; margin-top: 8px; width: 100%;">Remove Joker</button>
          </div>
          <div class="lines-container" id="linesContainer"></div>
        </div>
      </div>

      <!-- Center: Reels -->
      <div class="slot-center">
        <div class="spinners" id="spinners"></div>

        <!-- Info Panel -->
        <div class="info-panel">
          <div>Bet: <span id="currentBet">2</span> $</div>
          <div>Type: <span id="gameType">Numbers</span></div>
          <div>Joker: <span id="jokerStatus">NO (0 $)</span></div>
          <div>Lines: <span id="lineCount">1</span></div>
          <div>Total: <span id="totalBet">2</span> $</div>
          <div>Krediti: <span id="credits">0</span> $</div>
        </div>

        <!-- Odds Tables -->
        <div class="odds-container" id="oddsContainer"></div>
      </div>

      <!-- Right Sidebar: Game Options -->
      <div class="slot-right-column">
        <div class="slot-options">
          <div class="nav-div">
            <button id="gameTypeBtn">Game Type</button>
            <div id="gameTypeOptions"></div>
            <button id="rewardModeBtn">Reward Mode</button>
            <div id="rewardModeOptions"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

/**
 * BingoMiniGame - Bonus game after winning on slot machine
 * Based on BingoTicketSystem from legacy code
 *
 * Rules:
 * - Numbers must be UNIQUE across ALL tickets (not just within one ticket)
 * - User selects a coin value (10, 20, 50, 100, 200, 500, 1000)
 * - Bet per ticket = betMultiplier[numbers] × coinValue
 * - Total bet must not exceed user balance
 * - Click ticket numbers to remove them
 */
class BingoMiniGame {
  constructor(winAmount, shadowRoot, onComplete, userBalance) {
    this.winAmount = winAmount;
    this.shadowRoot = shadowRoot;
    this.onComplete = onComplete;
    this.userBalance = userBalance || 0;

    // Game state
    this.currentTicket = 0;
    this.tickets = [[], [], [], [], []]; // 5 tickets, each can have up to 5 numbers
    this.maxNumbersPerTicket = 5;
    this.maxTickets = 5;
    this.totalNumbers = 30;
    this.drawnNumbers = [];
    this.drawCount = 12;
    this.isPlaying = false;
    this.gameFinished = false;

    // Coin value selection
    this.coinValues = [10, 20, 50, 100, 200, 500, 1000];
    this.selectedCoinValue = 10; // Default to lowest

    // Payout odds table (matches, odds, probability%)
    // Formula: P(k of n) = C(12,k) × C(18, n-k) / C(30,n)
    // 30 total numbers, 12 drawn, 18 not drawn
    this.oddsTable = [
      { played: 1, matches: 1, odds: 2.5, prob: 40.00 },   // 12/30 = 40%
      { played: 2, matches: 1, odds: 0.62, prob: 49.66 },
      { played: 2, matches: 2, odds: 6.59, prob: 15.17 },
      { played: 3, matches: 1, odds: 0.27, prob: 45.22 },
      { played: 3, matches: 2, odds: 2.89, prob: 29.26 },
      { played: 3, matches: 3, odds: 18.45, prob: 5.42 },
      { played: 4, matches: 1, odds: 0.15, prob: 35.73 },
      { played: 4, matches: 2, odds: 1.64, prob: 36.85 },
      { played: 4, matches: 3, odds: 10.64, prob: 14.45 },
      { played: 4, matches: 4, odds: 55.36, prob: 1.81 },
      { played: 5, matches: 1, odds: 0.10, prob: 25.77 },
      { played: 5, matches: 2, odds: 1.05, prob: 37.79 },
      { played: 5, matches: 3, odds: 7.33, prob: 23.62 },
      { played: 5, matches: 4, odds: 35.43, prob: 6.25 },
      { played: 5, matches: 5, odds: 179.94, prob: 0.56 },
    ];

    // Bet multipliers per ticket size (1 number = 1x coin value)
    this.betMultipliers = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };

    this.render();
  }

  /**
   * Show toast notification (replaces JS alerts)
   */
  showToast(message, type = 'error') {
    const container = this.overlay.querySelector('#toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `minigame-toast minigame-toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Select coin value for betting
   */
  selectCoinValue(value) {
    if (this.isPlaying || this.gameFinished) return;
    this.selectedCoinValue = value;
    this.updateUI();
  }

  /**
   * Calculate total bet across all tickets
   */
  calculateTotalBet() {
    return this.tickets
      .filter(t => t.length > 0)
      .reduce((sum, t) => sum + (this.betMultipliers[t.length] * this.selectedCoinValue), 0);
  }

  /**
   * Check if user has sufficient balance
   */
  hasSufficientBalance() {
    return this.calculateTotalBet() <= this.userBalance;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'minigame-overlay';
    overlay.id = 'minigameOverlay';

    overlay.innerHTML = `
      <div class="minigame-toast-container" id="toastContainer"></div>
      <div class="minigame-container">
        <div class="minigame-header">
          <h2>BINGO BONUS GAME</h2>
          <p>You won: <span class="minigame-prize">${this.winAmount} coins</span></p>
          <p>Your balance: <span class="balance-display-mini" id="balanceDisplay">${this.userBalance} coins</span></p>
          <p>Each number can only be used ONCE across all tickets!</p>
        </div>

        <!-- Coin Selector -->
        <div class="coin-selector">
          <div class="coin-selector-label">Select Coin Value</div>
          <div class="coin-selector-buttons" id="coinSelector">
            ${this.coinValues.map(v => `
              <button class="coin-btn ${v === this.selectedCoinValue ? 'selected' : ''}" data-value="${v}">${v}</button>
            `).join('')}
          </div>
        </div>

        <!-- Total Bet Display -->
        <div class="total-bet-display">
          <span class="total-bet-label">Total Bet:</span>
          <span class="total-bet-value" id="totalBetDisplay">0 coins</span>
        </div>

        <div class="minigame-layout">
          <div class="minigame-numbers">
            <h3>Select numbers (1-30)</h3>
            <div class="number-grid" id="numberGrid">
              ${this.renderNumberGrid()}
            </div>
          </div>

          <div class="minigame-tickets">
            <h3>Your tickets (click number to remove)</h3>
            <div class="tickets-container" id="ticketsContainer">
              ${this.renderTickets()}
            </div>
          </div>
        </div>

        <div class="minigame-odds">
          <h3>Odds Table</h3>
          <div class="odds-table-container">
            ${this.renderOddsTable()}
          </div>
        </div>

        <div class="minigame-drawn" id="drawnSection" style="display: none;">
          <h3>Drawn numbers (12)</h3>
          <div class="drawn-numbers" id="drawnNumbers"></div>
        </div>

        <div class="minigame-result" id="resultSection" style="display: none;">
          <h2>Result</h2>
          <p id="resultText"></p>
          <p class="total-win" id="totalWin"></p>
        </div>

        <div class="minigame-controls">
          <button class="minigame-btn minigame-btn-secondary" id="nextTicketBtn">Next ticket</button>
          <button class="minigame-btn minigame-btn-primary" id="playBtn" disabled>Start drawing</button>
          <button class="minigame-btn minigame-btn-success" id="collectBtn" style="display: none;">Collect winnings</button>
          <button class="minigame-btn minigame-btn-secondary" id="skipBtn">Skip</button>
        </div>

        <div class="minigame-info">
          Click a number (1-30) to add to active ticket. Click a number in ticket to remove.
          <br>Each number can only be used ONCE across all tickets! 12 of 30 numbers are drawn.
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(overlay);
    this.overlay = overlay;
    this.bindEvents();
    this.updateUI();
  }

  renderOddsTable() {
    let html = '<table class="odds-table"><thead><tr><th>Numbers</th><th>Matches</th><th>Odds</th><th>Probability</th></tr></thead><tbody>';
    for (const row of this.oddsTable) {
      html += `<tr><td>${row.played}</td><td>${row.matches}</td><td>${row.odds}x</td><td>${row.prob}%</td></tr>`;
    }
    html += '</tbody></table>';
    return html;
  }

  renderNumberGrid() {
    let html = '';
    for (let i = 1; i <= this.totalNumbers; i++) {
      html += `<button class="number-btn" data-number="${i}">${i}</button>`;
    }
    return html;
  }

  renderTickets() {
    let html = '';
    for (let i = 0; i < this.maxTickets; i++) {
      const isActive = i === this.currentTicket;
      html += `
        <div class="ticket ${isActive ? 'active' : ''}" data-ticket="${i}">
          <span class="ticket-label">Ticket ${i + 1}:</span>
          <div class="ticket-numbers" id="ticketNumbers${i}"></div>
          <span class="ticket-result" id="ticketResult${i}"></span>
        </div>
      `;
    }
    return html;
  }

  bindEvents() {
    // Coin selector buttons
    this.overlay.querySelectorAll('.coin-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isPlaying || this.gameFinished) return;
        const value = parseInt(btn.dataset.value);
        this.selectCoinValue(value);
      });
    });

    // Number selection
    this.overlay.querySelectorAll('.number-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isPlaying || this.gameFinished) return;
        const num = parseInt(btn.dataset.number);
        this.selectNumber(num, btn);
      });
    });

    // Ticket selection
    this.overlay.querySelectorAll('.ticket').forEach(ticket => {
      ticket.addEventListener('click', () => {
        if (this.isPlaying || this.gameFinished) return;
        const ticketIdx = parseInt(ticket.dataset.ticket);
        this.switchTicket(ticketIdx);
      });
    });

    // Next ticket button
    this.overlay.querySelector('#nextTicketBtn').addEventListener('click', () => {
      if (this.isPlaying || this.gameFinished) return;
      this.nextTicket();
    });

    // Play button
    this.overlay.querySelector('#playBtn').addEventListener('click', () => {
      if (!this.isPlaying && !this.gameFinished) {
        this.play();
      }
    });

    // Collect button
    this.overlay.querySelector('#collectBtn').addEventListener('click', () => {
      this.collect();
    });

    // Skip button
    this.overlay.querySelector('#skipBtn').addEventListener('click', () => {
      this.skip();
    });
  }

  selectNumber(num, btn) {
    const ticket = this.tickets[this.currentTicket];

    // Check if number is already in CURRENT ticket
    const indexInCurrentTicket = ticket.indexOf(num);

    if (indexInCurrentTicket !== -1) {
      // Remove from current ticket
      ticket.splice(indexInCurrentTicket, 1);
    } else {
      // Check if number is used in ANY other ticket (globally unique enforcement)
      const usedInOtherTicket = this.tickets.some((t, idx) =>
        idx !== this.currentTicket && t.includes(num)
      );

      if (usedInOtherTicket) {
        this.showToast(`Number ${num} is already used in another ticket`, 'warning');
        return;
      }

      // Add to current ticket if not full
      if (ticket.length < this.maxNumbersPerTicket) {
        ticket.push(num);
        ticket.sort((a, b) => a - b);
      } else {
        this.showToast(`Ticket ${this.currentTicket + 1} is full (max 5 numbers)`, 'info');
        return;
      }
    }

    this.updateUI();
  }

  /**
   * Remove a number from a specific ticket
   */
  removeNumberFromTicket(ticketIdx, num) {
    if (this.isPlaying || this.gameFinished) return;

    const ticket = this.tickets[ticketIdx];
    const idx = ticket.indexOf(num);
    if (idx !== -1) {
      ticket.splice(idx, 1);
      this.updateUI();
    }
  }

  switchTicket(ticketIdx) {
    this.currentTicket = ticketIdx;
    this.updateUI();
  }

  nextTicket() {
    // Find next ticket with space or empty
    for (let i = 0; i < this.maxTickets; i++) {
      const nextIdx = (this.currentTicket + 1 + i) % this.maxTickets;
      if (this.tickets[nextIdx].length < this.maxNumbersPerTicket) {
        this.currentTicket = nextIdx;
        break;
      }
    }
    this.updateUI();
  }

  updateUI() {
    // Update coin selector buttons
    this.overlay.querySelectorAll('.coin-btn').forEach(btn => {
      const value = parseInt(btn.dataset.value);
      btn.classList.toggle('selected', value === this.selectedCoinValue);
    });

    // Calculate total bet and update display
    const totalBet = this.calculateTotalBet();
    const totalBetDisplay = this.overlay.querySelector('#totalBetDisplay');
    if (totalBetDisplay) {
      totalBetDisplay.textContent = `${totalBet} coins`;
      totalBetDisplay.classList.toggle('insufficient', totalBet > this.userBalance);
    }

    // Update balance display
    const balanceDisplay = this.overlay.querySelector('#balanceDisplay');
    if (balanceDisplay) {
      balanceDisplay.textContent = `${this.userBalance} coins`;
      balanceDisplay.classList.toggle('low', this.userBalance < 500);
      balanceDisplay.classList.toggle('insufficient', totalBet > this.userBalance);
    }

    // Update ticket active states and styling
    this.overlay.querySelectorAll('.ticket').forEach((ticket, idx) => {
      ticket.classList.toggle('active', idx === this.currentTicket);
    });

    // Update ticket contents with removable numbers
    for (let i = 0; i < this.maxTickets; i++) {
      const container = this.overlay.querySelector(`#ticketNumbers${i}`);
      const betAmount = this.tickets[i].length > 0
        ? this.betMultipliers[this.tickets[i].length] * this.selectedCoinValue
        : 0;

      container.innerHTML = this.tickets[i].map(num =>
        `<span class="ticket-number removable" data-ticket="${i}" data-num="${num}" title="Click to remove">${num}</span>`
      ).join('');

      // Show bet for this ticket
      const resultEl = this.overlay.querySelector(`#ticketResult${i}`);
      if (resultEl && !this.gameFinished) {
        resultEl.textContent = betAmount > 0 ? `Bet: ${betAmount} coins` : '';
      }

      // Bind click to remove number from ticket
      container.querySelectorAll('.ticket-number').forEach(numEl => {
        numEl.addEventListener('click', (e) => {
          if (this.isPlaying || this.gameFinished) return;
          e.stopPropagation();
          const ticketIdx = parseInt(numEl.dataset.ticket);
          const num = parseInt(numEl.dataset.num);
          this.removeNumberFromTicket(ticketIdx, num);
        });
      });
    }

    // Update number grid selection state
    // Numbers used in OTHER tickets are completely disabled (globally-used)
    const currentTicketNums = this.tickets[this.currentTicket];
    this.overlay.querySelectorAll('.number-btn').forEach(btn => {
      const num = parseInt(btn.dataset.number);
      const isInCurrentTicket = currentTicketNums.includes(num);
      const isInOtherTicket = this.tickets.some((t, idx) => idx !== this.currentTicket && t.includes(num));

      // 'selected' = in current ticket (green)
      btn.classList.toggle('selected', isInCurrentTicket);
      // 'globally-used' = in other tickets (disabled, cannot be selected)
      btn.classList.toggle('globally-used', isInOtherTicket);
      // Remove old 'used-other' class if present
      btn.classList.remove('used-other');
    });

    // Update play button state - disabled if no numbers OR insufficient balance
    const hasNumbers = this.tickets.some(t => t.length > 0);
    const hasSufficientBalance = this.hasSufficientBalance();
    const playBtn = this.overlay.querySelector('#playBtn');
    playBtn.disabled = !hasNumbers || !hasSufficientBalance || this.isPlaying;

    // Update play button text based on balance
    if (!this.isPlaying && !this.gameFinished) {
      if (!hasNumbers) {
        playBtn.textContent = 'Select numbers';
      } else if (!hasSufficientBalance) {
        playBtn.textContent = 'Insufficient balance';
      } else {
        playBtn.textContent = 'Start drawing';
      }
    }

    // Update next ticket button state
    const currentFull = this.tickets[this.currentTicket].length >= this.maxNumbersPerTicket;
    this.overlay.querySelector('#nextTicketBtn').disabled = currentFull && this.tickets.every(t => t.length >= this.maxNumbersPerTicket) || this.isPlaying;
  }

  async play() {
    // Validate balance before playing
    const totalBet = this.calculateTotalBet();
    if (totalBet > this.userBalance) {
      this.showToast('Insufficient balance! Please select a lower coin value or fewer numbers.', 'error');
      return;
    }

    if (totalBet === 0) {
      this.showToast('Please select at least one number on a ticket.', 'warning');
      return;
    }

    this.isPlaying = true;

    // Disable controls
    this.overlay.querySelector('#playBtn').disabled = true;
    this.overlay.querySelector('#playBtn').textContent = 'Drawing...';
    this.overlay.querySelector('#nextTicketBtn').disabled = true;
    this.overlay.querySelector('#skipBtn').style.display = 'none';
    this.overlay.querySelectorAll('.number-btn').forEach(btn => btn.classList.add('disabled'));
    this.overlay.querySelectorAll('.coin-btn').forEach(btn => btn.classList.add('disabled'));

    // Show drawn section
    this.overlay.querySelector('#drawnSection').style.display = 'block';

    try {
      // Call backend API with new ticket-based format
      const response = await fetch('/api/games/slot-machine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'slot_minigame',
          tickets: this.tickets,
          coin_value: this.selectedCoinValue
        })
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Use server's drawn numbers and results
        this.drawnNumbers = result.data.drawn_numbers;
        this.serverResults = result.data;

        // Update user balance from server response
        if (result.data.new_balance !== undefined) {
          this.userBalance = result.data.new_balance;
        }

        // Animate drawing with server numbers
        this.animateDraw(0);
      } else {
        throw new Error(result.message || 'Mini-game request failed');
      }
    } catch (error) {
      console.error('[BingoMiniGame] API Error:', error);
      this.showToast('Error: ' + error.message, 'error');

      // Re-enable controls on error
      this.isPlaying = false;
      this.overlay.querySelector('#playBtn').disabled = false;
      this.overlay.querySelector('#playBtn').textContent = 'Start drawing';
      this.overlay.querySelector('#nextTicketBtn').disabled = false;
      this.overlay.querySelector('#skipBtn').style.display = 'inline-block';
      this.overlay.querySelectorAll('.number-btn').forEach(btn => btn.classList.remove('disabled'));
      this.overlay.querySelectorAll('.coin-btn').forEach(btn => btn.classList.remove('disabled'));
      this.overlay.querySelector('#drawnSection').style.display = 'none';
    }
  }

  animateDraw(index) {
    if (index >= this.drawnNumbers.length) {
      this.showResults();
      return;
    }

    const num = this.drawnNumbers[index];
    const container = this.overlay.querySelector('#drawnNumbers');

    // Add drawn number to display
    const numEl = document.createElement('span');
    numEl.className = 'drawn-number';
    numEl.textContent = num;
    container.appendChild(numEl);

    // Mark in grid
    const gridBtn = this.overlay.querySelector(`.number-btn[data-number="${num}"]`);
    if (gridBtn) {
      gridBtn.classList.add('drawn');
      if (gridBtn.classList.contains('selected')) {
        gridBtn.classList.add('matched');
      }
    }

    // Mark matched numbers in tickets
    this.tickets.forEach((ticket, ticketIdx) => {
      if (ticket.includes(num)) {
        const ticketNumEls = this.overlay.querySelectorAll(`#ticketNumbers${ticketIdx} .ticket-number`);
        ticketNumEls.forEach(el => {
          if (parseInt(el.dataset.num) === num) {
            el.classList.add('matched');
          }
        });
      }
    });

    // Continue animation
    setTimeout(() => this.animateDraw(index + 1), 500);
  }

  showResults() {
    this.gameFinished = true;
    let totalWin = 0;

    // Use server results if available (authoritative), fallback to client calculation
    if (this.serverResults && this.serverResults.ticket_results) {
      // Server-provided results (authoritative)
      this.serverResults.ticket_results.forEach((result, i) => {
        if (result.numbers_played === 0) return;

        const ticketWin = result.payout || 0;
        totalWin += ticketWin;

        // Show result on ticket
        const resultEl = this.overlay.querySelector(`#ticketResult${i}`);
        resultEl.textContent = `${result.matches}/${result.numbers_played} = ${ticketWin.toFixed(2)} coins`;
        if (ticketWin > 0) resultEl.classList.add('win');
      });

      // Use server's total payout
      totalWin = this.serverResults.total_payout || totalWin;
    } else {
      // Fallback: Calculate results locally (should not happen with working backend)
      for (let i = 0; i < this.maxTickets; i++) {
        const ticket = this.tickets[i];
        if (ticket.length === 0) continue;

        const played = ticket.length;
        const matched = ticket.filter(n => this.drawnNumbers.includes(n)).length;
        const multiplier = this.payoutTable[played]?.[matched] || 0;
        const betMultiplier = this.betMultipliers[played];
        const ticketWin = multiplier * betMultiplier;

        totalWin += ticketWin;

        // Show result on ticket
        const resultEl = this.overlay.querySelector(`#ticketResult${i}`);
        resultEl.textContent = `${matched}/${played} = ${ticketWin.toFixed(2)} coins`;
        if (ticketWin > 0) resultEl.classList.add('win');
      }
    }

    // Calculate net result
    const totalBet = this.serverResults?.total_bet || this.calculateTotalBet();
    const netResult = totalWin - totalBet;

    // Show result section
    const resultSection = this.overlay.querySelector('#resultSection');
    resultSection.style.display = 'block';

    this.overlay.querySelector('#resultText').innerHTML = `
      Total bet: ${totalBet} coins<br>
      Total payout: ${totalWin} coins<br>
      Net result: <span style="color: ${netResult >= 0 ? '#10b981' : '#ef4444'}">${netResult >= 0 ? '+' : ''}${netResult} coins</span>
    `;
    this.overlay.querySelector('#totalWin').textContent = netResult >= 0 ? `Won: ${netResult} coins` : `Lost: ${Math.abs(netResult)} coins`;

    // Update balance display in mini-game
    const balanceDisplay = this.overlay.querySelector('#balanceDisplay');
    if (balanceDisplay && this.serverResults?.new_balance !== undefined) {
      this.userBalance = this.serverResults.new_balance;
      balanceDisplay.textContent = `${this.userBalance} coins`;
    }

    // Update main slot machine balance display
    if (this.serverResults && this.serverResults.new_balance !== undefined) {
      const balanceEl = document.querySelector('#kreditOkvir') ||
        document.querySelector('.balance-display');
      if (balanceEl) {
        balanceEl.textContent = this.serverResults.new_balance;
      }
    }

    // Set total win for onComplete callback (payout, not net)
    this.totalWin = totalWin;

    // Show collect button, hide play button
    this.overlay.querySelector('#playBtn').style.display = 'none';
    this.overlay.querySelector('#collectBtn').style.display = 'inline-block';

  }

  collect() {
    this.overlay.remove();
    if (this.onComplete) {
      this.onComplete(this.totalWin || this.winAmount);
    }
  }

  skip() {
    this.overlay.remove();
    if (this.onComplete) {
      this.onComplete(this.winAmount);
    }
  }
}

/**
 * SlotMachine Custom Element
 */
export class SlotMachine extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // State
    this.credits = 0;
    this.bet = 2;
    this.kvote = [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3];
    this.spinsCount = 0;
    this.stopArray = [];
    this.selectedPaylines = [1, 0, 0, 0, 0, 0, 0];
    this.jokerAdded = false;
    this.jokerPosition = 0;
    this.jokerCost = 0;
    this.rewardMode = 2;
    this.gameTypeValue = 1;
    this.progressInterval = null;
    this.isSpinning = false;

    this.jwtToken = '';
    this.carousels = [];
    this.scenes = [];
    this.spinDirections = [-1, -1, -1, -1, -1];
    this.currentRotations = [0, 0, 0, 0, 0];
    this.canvas = null;
    this.ctx = null;
    this.canvasWidth = 0;
    this.cellHalfHeight = 0;
    this.middleRowCenterY = 0;
    this.bottomRowCenterY = 0;
  }

  connectedCallback() {
    this.credits = parseInt(this.getAttribute('data-balance')) || 0;
    this.jwtToken = this.getAttribute('data-jwt-token') || '';

    // Additional state for joker/lines
    this.validJokerPositions = new Array(15).fill(0);
    this.jokerAffectedLines = [];
    this.jokerCanvasX = 0;
    this.jokerCanvasY = 0;
    this.jokerImageLoaded = false;
    this.img = new Image();
    // Preload joker image so it's ready when user clicks
    this.img.onload = () => { this.jokerImageLoaded = true; };
    this.img.src = "data:image/png;base64,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";
    this.cellHalfWidth = 0;
    this.spinnerPaddingLeft = 0;
    this.spinnerPaddingTop = 0;
    this.lineColor = 'rgba(60, 0, 129, 0.4)';

    // Bind event handlers
    this.boundCanvasClick = this.handleCanvasClick.bind(this);

    this.initializeUI();
    this.bindEvents();
    this.updateDisplay();
  }

  initializeUI() {
    // Bet options - initialized based on game type
    this.updateBetOptions();

    // Lines
    const linesContainer = this.shadowRoot.getElementById('linesContainer');
    for (let i = 0; i < 7; i++) {
      const div = document.createElement('div');
      div.className = i === 0 ? 'active' : '';
      div.dataset.line = i;
      div.innerHTML = `<label>Line ${i + 1}</label>`;
      div.addEventListener('click', () => this.toggleLine(i, div));
      linesContainer.appendChild(div);
    }

    // Game types
    const gameTypeOptions = this.shadowRoot.getElementById('gameTypeOptions');
    ['Numbers', 'Roman', 'Fruits', 'Animals', 'Emoji'].forEach((type, idx) => {
      const div = document.createElement('div');
      div.className = 'control-group' + (idx === 0 ? ' active' : '');
      div.dataset.value = idx + 1;
      div.innerHTML = `<label>${type}</label>`;
      div.addEventListener('click', () => this.selectGameType(idx + 1, type, div));
      gameTypeOptions.appendChild(div);
    });

    // Reward modes
    const rewardModeOptions = this.shadowRoot.getElementById('rewardModeOptions');
    [{ value: 2, label: '1x5 Middle' }, { value: 1, label: '3x5 Multi-line' }].forEach((mode, idx) => {
      const div = document.createElement('div');
      div.className = 'control-group' + (idx === 0 ? ' active' : '');
      div.dataset.value = mode.value;
      div.innerHTML = `<label>${mode.label}</label>`;
      div.addEventListener('click', () => this.selectRewardMode(mode.value, div));
      rewardModeOptions.appendChild(div);
    });

    // Reels
    const spinnersContainer = this.shadowRoot.getElementById('spinners');
    const symbols = [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 5; i++) {
      const scene = document.createElement('div');
      scene.className = 'scene';
      scene.style.perspective = '1000px';

      const carousel = document.createElement('div');
      carousel.className = 'carousel';

      symbols.forEach((sym, idx) => {
        const cell = document.createElement('div');
        cell.className = 'carousel__cell';
        cell.style.transform = `rotateX(${idx * 30}deg) translateZ(220px)`;
        cell.innerHTML = `<p>${sym}</p>`;
        carousel.appendChild(cell);
      });

      scene.appendChild(carousel);
      spinnersContainer.appendChild(scene);
      this.scenes.push(scene);
      this.carousels.push(carousel);
    }

    // Canvas - default to single-line mode since rewardMode defaults to 2
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'canvas-overlay single-line-mode';
    spinnersContainer.appendChild(this.canvas);

    setTimeout(() => {
      this.initCanvas();
      this.createOddsTables();
      // Set initial canvas state based on default rewardMode (2 = single line)
      if (this.rewardMode === 2) {
        this.setCanvasMiddleRow();
      }
    }, 100);
  }

  initCanvas() {
    this.ctx = this.canvas.getContext('2d');
    const spinners = this.shadowRoot.getElementById('spinners');

    // Get computed padding (spinners has padding: 10px)
    const computedStyle = getComputedStyle(spinners);
    this.spinnerPaddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    this.spinnerPaddingTop = parseFloat(computedStyle.paddingTop) || 0;

    // Canvas dimensions (full size including padding area)
    this.canvasWidth = spinners.offsetWidth;
    this.canvas.width = this.canvasWidth;
    this.canvas.height = spinners.offsetHeight;

    // Content area dimensions (where the reels actually are)
    const contentWidth = spinners.clientWidth - this.spinnerPaddingLeft * 2;
    const contentHeight = spinners.clientHeight - this.spinnerPaddingTop * 2;

    // Calculate cell sizes based on content area, not full canvas
    this.cellHalfHeight = (contentHeight / 3) / 2;
    this.cellHalfWidth = (contentWidth / 5) / 2;
    this.middleRowCenterY = this.spinnerPaddingTop + 3 * this.cellHalfHeight;
    this.bottomRowCenterY = this.spinnerPaddingTop + 5 * this.cellHalfHeight;
    this.ctx.lineWidth = 10;
    this.ctx.font = '20px Arial';
    this.ctx.strokeStyle = this.lineColor;

    console.log('[SLOT_MACHINE] initCanvas:', {
      offsetWidth: spinners.offsetWidth,
      offsetHeight: spinners.offsetHeight,
      clientWidth: spinners.clientWidth,
      clientHeight: spinners.clientHeight,
      paddingLeft: this.spinnerPaddingLeft,
      paddingTop: this.spinnerPaddingTop,
      contentWidth,
      contentHeight,
      cellHalfHeight: this.cellHalfHeight,
      cellHalfWidth: this.cellHalfWidth,
      middleRowCenterY: this.middleRowCenterY,
      bottomRowCenterY: this.bottomRowCenterY
    });

    // Draw initial lines
    this.lineCheck();
  }

  createOddsTables() {
    // Use default symbols and odds for initial game type (1 = Numbers)
    const symbols = [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6];
    const odds = [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3];
    this.updateOddsTables(symbols, odds);
  }

  bindEvents() {
    this.shadowRoot.getElementById('startBtn').addEventListener('click', () => this.startSpin());
    this.shadowRoot.getElementById('stopBtn').addEventListener('click', () => this.stopSpin());
    this.shadowRoot.getElementById('jokerCheckbox').addEventListener('change', (e) => this.toggleJoker(e.target.checked));
    this.shadowRoot.getElementById('confirmJokerBtn').addEventListener('click', () => this.confirmJoker());
    this.shadowRoot.getElementById('removeJokerBtn').addEventListener('click', () => this.removeJoker());
    this.shadowRoot.getElementById('gameTypeBtn').addEventListener('click', () => this.cycleGameType());
    this.shadowRoot.getElementById('rewardModeBtn').addEventListener('click', () => this.cycleRewardMode());
    this.shadowRoot.getElementById('betBtn').addEventListener('click', () => this.cycleBet());
  }

  cycleGameType() {
    const gameTypeOptions = this.shadowRoot.getElementById('gameTypeOptions');
    const controlGroups = gameTypeOptions.querySelectorAll('.control-group');
    const activeIndex = Array.from(controlGroups).findIndex(el => el.classList.contains('active'));
    const nextIndex = (activeIndex + 1) % controlGroups.length;
    const nextElement = controlGroups[nextIndex];
    const value = parseInt(nextElement.dataset.value);
    const name = nextElement.querySelector('label').textContent;
    this.selectGameType(value, name, nextElement);
  }

  cycleRewardMode() {
    const rewardModeOptions = this.shadowRoot.getElementById('rewardModeOptions');
    const controlGroups = rewardModeOptions.querySelectorAll('.control-group');
    const activeIndex = Array.from(controlGroups).findIndex(el => el.classList.contains('active'));
    const nextIndex = (activeIndex + 1) % controlGroups.length;
    const nextElement = controlGroups[nextIndex];
    const value = parseInt(nextElement.dataset.value);
    this.selectRewardMode(value, nextElement);
  }

  cycleBet() {
    const betOptions = this.shadowRoot.getElementById('betOptions');
    const controlGroups = betOptions.querySelectorAll('.control-group');
    const activeIndex = Array.from(controlGroups).findIndex(el => el.classList.contains('active'));
    const nextIndex = (activeIndex + 1) % controlGroups.length;
    const nextElement = controlGroups[nextIndex];
    const bet = parseInt(nextElement.dataset.value);
    this.selectBet(bet, nextElement);
  }

  updateBetOptions() {
    // Bet arrays per game type (matching reference implementation)
    const betArrays = {
      1: [2, 3, 4, 5, 6],  // Numbers (Brojevi)
      2: [1, 2, 3, 4, 5],  // Roman (Rimski)
      3: [5, 6, 7, 8, 9],  // Fruits (Vockice)
      4: [4, 5, 6, 7, 8],  // Animals (Zivotinje)
      5: [3, 4, 5, 6, 7]   // Emoji (Smajlici)
    };

    const bets = betArrays[this.gameTypeValue] || betArrays[1];
    const betOptions = this.shadowRoot.getElementById('betOptions');

    // Clear existing options
    betOptions.innerHTML = '';

    // Create new bet options
    bets.forEach((bet, idx) => {
      const div = document.createElement('div');
      div.className = 'control-group' + (idx === 0 ? ' active' : '');
      div.dataset.value = bet;
      div.innerHTML = `<label>${bet} $</label>`;
      div.addEventListener('click', () => this.selectBet(bet, div));
      betOptions.appendChild(div);
    });

    // Set the first bet as active
    this.bet = bets[0];
    this.updateDisplay();
  }

  selectBet(bet, element) {
    this.bet = bet;
    element.parentElement.querySelectorAll('.control-group').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    this.updateDisplay();
  }

  selectGameType(value, name, element) {
    this.gameTypeValue = value;
    element.parentElement.querySelectorAll('.control-group').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    this.shadowRoot.getElementById('gameType').textContent = name;
    this.updateSymbols();
  }

  selectRewardMode(value, element) {
    this.rewardMode = value;
    element.parentElement.querySelectorAll('.control-group').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    const spinnersEl = this.shadowRoot.getElementById('spinners');
    const infoPanelEl = this.shadowRoot.querySelector('.info-panel');

    if (value === 1) {
      // Multi-line mode: show 3D perspective and line selection
      this.scenes.forEach(scene => scene.style.perspective = 'initial');
      this.shadowRoot.getElementById('linesContainer').style.display = 'flex';
      this.shadowRoot.getElementById('jokerContainer').style.display = 'block';
      spinnersEl.style.overflow = 'hidden';
      spinnersEl.style.transform = 'translateY(0)';
      infoPanelEl.style.marginTop = '0.5rem';
      this.setCanvasFullHeight();
    } else {
      // Single line mode (value === 2): show 3D effect and canvas shrinks to middle row
      this.scenes.forEach(scene => scene.style.perspective = '1000px');
      this.shadowRoot.getElementById('linesContainer').style.display = 'none';
      this.shadowRoot.getElementById('jokerContainer').style.display = 'none';
      spinnersEl.style.overflow = 'visible';
      spinnersEl.style.transform = 'translateY(20px)';
      infoPanelEl.style.marginTop = '3rem';
      this.setCanvasMiddleRow();
    }
    this.drawLines();
    this.updateDisplay();
  }

  setCanvasFullHeight() {
    if (!this.canvas) return;
    this.canvas.classList.remove('single-line-mode');
    this.canvas.style.top = '0';
    this.canvas.style.height = '100%';
  }

  setCanvasMiddleRow() {
    if (!this.canvas || !this.cellHalfHeight) return;
    this.canvas.classList.add('single-line-mode');
    // Middle row starts at padding + 2*halfStep, height is 2*halfStep
    const topPosition = this.spinnerPaddingTop + (this.cellHalfHeight * 2);
    const rowHeight = this.cellHalfHeight * 2;
    this.canvas.style.top = `${topPosition}px`;
    this.canvas.style.height = `${rowHeight}px`;
  }

  toggleLine(index, element) {
    const linesContainer = this.shadowRoot.getElementById('linesContainer');
    const currentlyActive = element.classList.contains('active');

    // If trying to turn off a line, check if it's the last one
    if (currentlyActive) {
      const activeCount = this.selectedPaylines.filter(l => l === 1).length;
      if (activeCount <= 1) {
        // Can't turn off the last line - do nothing
        return;
      }
    }

    const isActive = element.classList.toggle('active');
    this.selectedPaylines[index] = isActive ? 1 : 0;

    // Update disabled state for last remaining line
    const activeCount = this.selectedPaylines.filter(l => l === 1).length;

    if (activeCount === 1) {
      // Mark the last remaining active line as disabled (can't be turned off)
      linesContainer.querySelectorAll('div.active').forEach(div => {
        div.classList.add('last-active');
      });
    } else {
      // Remove last-active marker from all lines
      linesContainer.querySelectorAll('div.last-active').forEach(div => {
        div.classList.remove('last-active');
      });
    }

    // Redraw canvas
    this.clearCanvas();
    if (isActive) {
      this.drawPayline(index);
    }
    this.lineCheck();

    // Handle joker if active
    if (this.jokerAdded && this.jokerPosition > 0) {
      // Check if joker is still valid on selected lines
      const jokerLines = this.getLinesForJokerPosition(this.jokerPosition - 1);
      const validLines = jokerLines.filter(line => this.selectedPaylines[line - 1] === 1);
      if (validLines.length === 0) {
        this.removeJoker();
      } else {
        this.drawJokerAtPosition(this.jokerCanvasX, this.jokerCanvasY);
      }
    }

    this.updateDisplay();
  }

  toggleJoker(checked) {
    if (checked) {
      // Calculate which grid positions are active based on selected lines
      this.calculateValidJokerPositions();
      this.countActivePaylines();
      this.drawJokerSelectionGrid();
      this.shadowRoot.getElementById('linesContainer').style.display = 'none';
    } else {
      this.jokerPosition = 0;
      this.jokerCost = 0;
      this.jokerAdded = false;
      this.removeCanvasClickListener();
      this.clearCanvas();
      this.lineCheck();
      this.shadowRoot.getElementById('linesContainer').style.display = 'flex';
      this.shadowRoot.getElementById('jokerStatus').textContent = 'NO (0 $)';

      // Hide joker buttons
      this.shadowRoot.getElementById('confirmJokerBtn').style.display = 'none';
      this.shadowRoot.getElementById('removeJokerBtn').style.display = 'none';
    }
    this.updateDisplay();
  }

  calculateValidJokerPositions() {
    this.validJokerPositions = new Array(15).fill(0);

    // Grid position mapping for each payline
    const paylineGridPositions = [
      [5, 6, 7, 8, 9],      // Line 0: Middle row
      [0, 1, 2, 3, 4],      // Line 1: Top row
      [10, 11, 12, 13, 14], // Line 2: Bottom row
      [3, 5, 7, 9, 11],     // Line 3: Diagonal
      [1, 5, 7, 9, 13],     // Line 4: Diagonal
      [0, 4, 6, 8, 12],     // Line 5: Zigzag
      [2, 6, 8, 10, 14]     // Line 6: Zigzag
    ];

    for (let i = 0; i < 7; i++) {
      if (this.selectedPaylines[i] === 1) {
        for (let j = 0; j < 5; j++) {
          this.validJokerPositions[paylineGridPositions[i][j]] = 1;
        }
      }
    }
  }

  countActivePaylines() {
    let count = 0;
    this.selectedPaylines.forEach(item => { if (item === 1) count++; });
    this.shadowRoot.getElementById('lineCount').textContent = count;
    return count;
  }

  drawJokerSelectionGrid() {
    // Ensure canvas is initialized
    if (!this.ctx || !this.cellHalfHeight || !this.cellHalfWidth) {
      this.initCanvas();
    }

    this.clearCanvas();
    this.ctx.strokeStyle = '#3c0081';
    this.ctx.shadowColor = 'black';
    this.ctx.shadowBlur = 18;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // Draw selection boxes for each valid joker position
    // Add padding offset so boxes align with the actual reel positions
    const padX = this.spinnerPaddingLeft || 0;
    const padY = this.spinnerPaddingTop || 0;

    console.log('[SLOT_MACHINE] drawJokerSelectionGrid:', { padX, padY, cellHalfWidth: this.cellHalfWidth, cellHalfHeight: this.cellHalfHeight, validJokerPositions: this.validJokerPositions });

    for (let i = 0; i < 15; i++) {
      if (this.validJokerPositions[i] === 1) {
        let x, y;
        if (i < 5) {
          // Top row
          x = padX + this.cellHalfWidth * 2 * i;
          y = padY;
        } else if (i < 10) {
          // Middle row
          x = padX + this.cellHalfWidth * 2 * (i - 5);
          y = padY + this.cellHalfHeight * 2;
        } else {
          // Bottom row
          x = padX + this.cellHalfWidth * 2 * (i - 10);
          y = padY + this.cellHalfHeight * 4;
        }

        this.ctx.beginPath();
        this.ctx.rect(x, y, this.cellHalfWidth * 2, this.cellHalfHeight * 2);
        this.ctx.stroke();
      }
    }

    this.ctx.shadowBlur = 0;
    this.addCanvasClickListener();
    this.ctx.strokeStyle = this.lineColor;
  }

  addCanvasClickListener() {
    this.canvas.classList.add('joker-active');
    this.canvas.addEventListener('click', this.boundCanvasClick);
  }

  removeCanvasClickListener() {
    this.canvas.classList.remove('joker-active');
    this.canvas.removeEventListener('click', this.boundCanvasClick);
  }

  handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Account for 8px border
    const borderWidth = 8;
    const rawMouseX = e.clientX - rect.left - borderWidth;
    const rawMouseY = e.clientY - rect.top - borderWidth;

    // Account for spinner padding - convert to content area coordinates
    const contentMouseX = rawMouseX - this.spinnerPaddingLeft;
    const contentMouseY = rawMouseY - this.spinnerPaddingTop;

    // Determine which grid position was clicked (based on content area)
    const row = Math.floor(contentMouseY / (2 * this.cellHalfHeight));
    const col = Math.floor(contentMouseX / (this.cellHalfWidth * 2));

    if (row < 0 || row > 2 || col < 0 || col > 4) return;

    const gridPos = row * 5 + col;

    // Check if this position is valid (has a line through it)
    if (this.validJokerPositions[gridPos] === 1) {
      const jokerNum = gridPos + 1;
      if (this.jokerPosition !== jokerNum) {
        this.jokerPosition = jokerNum;
        this.jokerAffectedLines = [];

        // Calculate x, y for joker image (add padding offset for canvas coordinates)
        const x = this.spinnerPaddingLeft + this.cellHalfWidth * 2 * col;
        const y = this.spinnerPaddingTop + row * this.cellHalfHeight * 2;
        this.jokerCanvasX = x;
        this.jokerCanvasY = y;

        // Redraw boxes then joker on top
        this.redrawWithJoker(x, y);

        // Get which lines this position affects
        this.jokerAffectedLines = this.getLinesForJokerPosition(gridPos);
      }
    }
  }

  redrawWithJoker(x, y) {
    // Clear and redraw boxes
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw selection boxes with padding offset
    const padX = this.spinnerPaddingLeft || 0;
    const padY = this.spinnerPaddingTop || 0;

    this.ctx.strokeStyle = '#3c0081';
    this.ctx.shadowColor = 'black';
    this.ctx.shadowBlur = 18;

    for (let i = 0; i < 15; i++) {
      if (this.validJokerPositions[i] === 1) {
        let bx, by;
        if (i < 5) {
          bx = padX + this.cellHalfWidth * 2 * i;
          by = padY;
        } else if (i < 10) {
          bx = padX + this.cellHalfWidth * 2 * (i - 5);
          by = padY + this.cellHalfHeight * 2;
        } else {
          bx = padX + this.cellHalfWidth * 2 * (i - 10);
          by = padY + this.cellHalfHeight * 4;
        }
        this.ctx.beginPath();
        this.ctx.rect(bx, by, this.cellHalfWidth * 2, this.cellHalfHeight * 2);
        this.ctx.stroke();
      }
    }

    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = this.lineColor;
    console.log('kurcina', x, y);
    // Now draw joker image on top using the existing method
    this.drawJokerAtPosition(x, y);
  }

  getLinesForJokerPosition(pos) {
    // Map of which lines each position is part of
    const jokerLineMapping = [
      [2, 6],         // pos 0
      [2, 5],         // pos 1
      [2, 7],         // pos 2
      [2, 4],         // pos 3
      [2, 6],         // pos 4
      [1, 4, 5],      // pos 5
      [1, 6, 7],      // pos 6
      [1, 4, 5],      // pos 7
      [1, 6, 7],      // pos 8
      [1, 4, 5],      // pos 9
      [3, 7],         // pos 10
      [3, 4],         // pos 11
      [3, 5],         // pos 12
      [3, 6],         // pos 13
      [3, 7]          // pos 14
    ];

    return jokerLineMapping[pos] || [];
  }

  drawJokerAtPosition(x, y) {
    // Base64 joker image
    this.img.src = "data:image/png;base64,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";


    const w = this.img.width;
    const h = this.img.height;
    const sizer = Math.min((2 * this.cellHalfWidth / w), (2 * this.cellHalfHeight / h));

    let drawX, drawY;
    if (this.cellHalfWidth > this.cellHalfHeight) {
      drawX = x + ((2 * this.cellHalfWidth - w * sizer) / 2);
      drawY = y;
    } else {
      drawX = x;
      drawY = y + ((2 * this.cellHalfHeight - h * sizer) / 2);
    }

    this.ctx.drawImage(this.img, drawX, drawY, w * sizer, h * sizer);

    // Show "Confirm Joker" button if not already confirmed
    const confirmBtn = this.shadowRoot.getElementById('confirmJokerBtn');
    const removeBtn = this.shadowRoot.getElementById('removeJokerBtn');
    const checkbox = this.shadowRoot.getElementById('jokerCheckbox');

    if (checkbox && checkbox.checked && !this.jokerAdded) {
      confirmBtn.style.display = 'block';
      removeBtn.style.display = 'none';
    }
  }

  confirmJoker() {
    this.jokerAdded = true;
    this.jokerCost = this.bet * 5;
    this.shadowRoot.getElementById('jokerStatus').textContent = `YES (${this.jokerCost} $)`;

    // Hide "Confirm Joker" button, show "Remove Joker" button
    this.shadowRoot.getElementById('confirmJokerBtn').style.display = 'none';
    this.shadowRoot.getElementById('removeJokerBtn').style.display = 'block';

    this.removeCanvasClickListener();

    // Clear and redraw lines with joker
    this.clearCanvas();
    this.lineCheck();
    this.drawJokerAtPosition(this.jokerCanvasX, this.jokerCanvasY);

    // Disable checkbox
    this.shadowRoot.getElementById('jokerCheckbox').disabled = true;

    // Show lines container again
    this.shadowRoot.getElementById('linesContainer').style.display = 'flex';

    this.updateDisplay();
  }

  removeJoker() {
    this.jokerPosition = 0;
    this.jokerCost = 0;
    this.jokerAdded = false;
    this.shadowRoot.getElementById('jokerStatus').textContent = 'NO (0 $)';

    this.clearCanvas();
    this.lineCheck();

    // Hide both joker buttons
    this.shadowRoot.getElementById('confirmJokerBtn').style.display = 'none';
    this.shadowRoot.getElementById('removeJokerBtn').style.display = 'none';

    // Re-enable and uncheck checkbox
    const checkbox = this.shadowRoot.getElementById('jokerCheckbox');
    checkbox.disabled = false;
    checkbox.checked = false;

    this.updateDisplay();
  }

  updateSymbols() {
    // Symbol sets for each game type
    const symbolSets = {
      1: [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6],
      2: ['I', 'II', 'III', 'IV', 'V', 'VI', 'I', 'II', 'III', 'IV', 'V', 'VI'],
      3: ['🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉'],
      4: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊'],
      5: ['😀', '😁', '😂', '🤣', '😅', '😎', '😀', '😁', '😂', '🤣', '😅', '😎']
    };

    // Odds for each game type: [table0: 4 values, table1: 4 values, table2: 4 values]
    const oddsSets = {
      1: [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3],       // Numbers
      2: [90, 40, 28, 4, 40, 28, 18, 3, 28, 18, 8, 2],         // Roman
      3: [200, 100, 60, 8, 100, 60, 40, 7, 60, 40, 20, 6],     // Fruits
      4: [150, 70, 40, 7, 70, 40, 30, 6, 40, 30, 15, 5],       // Animals
      5: [120, 60, 35, 6, 60, 35, 25, 5, 35, 25, 12, 4]        // Emoji
    };

    const symbols = symbolSets[this.gameTypeValue] || symbolSets[1];
    const odds = oddsSets[this.gameTypeValue] || oddsSets[1];

    // Update carousel symbols and reset to position 0
    this.carousels.forEach((carousel, i) => {
      carousel.querySelectorAll('.carousel__cell p').forEach((cell, idx) => {
        cell.textContent = symbols[idx];
      });
      // Reset carousel to position 0 (first symbol)
      this.currentRotations[i] = 0;
      carousel.style.cssText = 'transform: translateZ(-220px) rotateX(0deg); transition: 0.1s;';
    });

    // Update odds tables
    this.updateOddsTables(symbols, odds);

    // Update bet options for this game type
    this.updateBetOptions();
  }

  updateOddsTables(symbols, odds) {
    const container = this.shadowRoot.getElementById('oddsContainer');
    if (!container) return;

    // Clear existing tables
    container.innerHTML = '';

    // Table groups: symbols[4,5] for table 0, symbols[2,3] for table 1, symbols[0,1] for table 2
    const groups = [
      { symbols: [symbols[4], symbols[5]], odds: [odds[0], odds[1], odds[2], odds[3]] },
      { symbols: [symbols[2], symbols[3]], odds: [odds[4], odds[5], odds[6], odds[7]] },
      { symbols: [symbols[0], symbols[1]], odds: [odds[8], odds[9], odds[10], odds[11]] }
    ];

    groups.forEach(group => {
      const symLabel = `${group.symbols[0]} || ${group.symbols[1]}`;
      const table = document.createElement('table');
      table.className = 'odds-table';
      table.innerHTML = `
        <caption>Odds for ${symLabel}</caption>
        <tbody>
          ${group.odds.map((odd, row) => {
        const symbolCount = 5 - row; // 5, 4, 3, 2 symbols per row
        const emptyCount = row; // 0, 1, 2, 3 empty cells for alignment
        const lineLabel = `${symbolCount} in line`;
        return `
            <tr>
              <td class="line-label">${lineLabel}</td>
              ${Array(symbolCount).fill(`<td>${symLabel}</td>`).join('')}
              ${Array(emptyCount).fill('<td class="empty-cell"></td>').join('')}
              <td class="odds-value">${odd}</td>
            </tr>
          `}).join('')}
        </tbody>
      `;
      container.appendChild(table);
    });
  }

  updateDisplay() {
    this.shadowRoot.getElementById('credits').textContent = this.credits;
    this.shadowRoot.getElementById('currentBet').textContent = this.bet;
    const activeLines = this.rewardMode === 2 ? 1 : this.selectedPaylines.filter(l => l === 1).length;
    this.shadowRoot.getElementById('lineCount').textContent = activeLines;
    const totalBet = this.rewardMode === 2 ? this.bet : (activeLines * this.bet) + this.jokerCost;
    this.shadowRoot.getElementById('totalBet').textContent = totalBet;
    this.shadowRoot.getElementById('spinsCount').textContent = this.spinsCount;
  }

  clearCanvas() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.img = new Image();
  }

  lineCheck() {
    if (!this.ctx) return;

    // Only draw lines in multi-line mode
    // In single-line mode, the canvas border itself is the highlight
    if (this.rewardMode === 1) {
      for (let i = 0; i < 7; i++) {
        if (this.selectedPaylines[i] === 1) {
          this.drawPayline(i);
        }
      }
    }
  }

  drawPayline(x) {
    if (!this.ctx) return;

    // Padding offsets for proper alignment with reels
    const padX = this.spinnerPaddingLeft || 0;
    const padY = this.spinnerPaddingTop || 0;

    // Calculate Y positions with padding
    const topY = padY + this.cellHalfHeight;  // Center of top row
    // this.middleRowCenterY and this.bottomRowCenterY already include padding from initCanvas

    // 7 payline paths with line coordinates and circle positions
    // X coordinates need padding, Y uses precalculated values
    const path = [
      // Line 0: Middle horizontal
      [
        [[padX, this.middleRowCenterY], [this.canvasWidth - padX, this.middleRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.middleRowCenterY], [padX + 4 * this.cellHalfWidth - 1, this.middleRowCenterY], [padX + 6 * this.cellHalfWidth - 1, this.middleRowCenterY], [padX + 8 * this.cellHalfWidth - 1, this.middleRowCenterY]]
      ],
      // Line 1: Top horizontal
      [
        [[padX, topY], [this.canvasWidth - padX, topY]],
        [[padX + 2 * this.cellHalfWidth, topY], [padX + 4 * this.cellHalfWidth - 1, topY], [padX + 6 * this.cellHalfWidth - 1, topY], [padX + 8 * this.cellHalfWidth - 1, topY]]
      ],
      // Line 2: Bottom horizontal
      [
        [[padX, this.bottomRowCenterY], [this.canvasWidth - padX, this.bottomRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 4 * this.cellHalfWidth - 1, this.bottomRowCenterY], [padX + 6 * this.cellHalfWidth - 1, this.bottomRowCenterY], [padX + 8 * this.cellHalfWidth - 1, this.bottomRowCenterY]]
      ],
      // Line 3: Diagonal down
      [
        [[padX, this.middleRowCenterY], [padX + this.cellHalfWidth, this.middleRowCenterY], [padX + 3 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 7 * this.cellHalfWidth, topY], [padX + 9 * this.cellHalfWidth, this.middleRowCenterY], [this.canvasWidth - padX, this.middleRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight], [padX + 4 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight], [padX + 6 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight], [padX + 8 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight]]
      ],
      // Line 4: Diagonal up
      [
        [[padX, this.middleRowCenterY], [padX + this.cellHalfWidth, this.middleRowCenterY], [padX + 3 * this.cellHalfWidth, topY], [padX + 7 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 9 * this.cellHalfWidth, this.middleRowCenterY], [this.canvasWidth - padX, this.middleRowCenterY]],
        [[padX + 2 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight], [padX + 4 * this.cellHalfWidth, this.middleRowCenterY - this.cellHalfHeight], [padX + 6 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight], [padX + 8 * this.cellHalfWidth, this.middleRowCenterY + this.cellHalfHeight]]
      ],
      // Line 5: Zigzag down
      [
        [[padX, topY], [padX + this.cellHalfWidth, topY], [padX + 5 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 9 * this.cellHalfWidth, topY], [this.canvasWidth - padX, topY]],
        [[padX + this.cellHalfWidth, topY], [padX + 3 * this.cellHalfWidth, this.middleRowCenterY], [padX + 5 * this.cellHalfWidth, this.bottomRowCenterY], [padX + 7 * this.cellHalfWidth, this.middleRowCenterY], [padX + 9 * this.cellHalfWidth, topY]]
      ],
      // Line 6: Zigzag up
      [
        [[padX, this.bottomRowCenterY], [padX + this.cellHalfWidth, this.bottomRowCenterY], [padX + 5 * this.cellHalfWidth, topY], [padX + 9 * this.cellHalfWidth, this.bottomRowCenterY], [this.canvasWidth - padX, this.bottomRowCenterY]],
        [[padX + this.cellHalfWidth, this.bottomRowCenterY], [padX + 3 * this.cellHalfWidth, this.middleRowCenterY], [padX + 5 * this.cellHalfWidth, topY], [padX + 7 * this.cellHalfWidth, this.middleRowCenterY], [padX + 9 * this.cellHalfWidth, this.bottomRowCenterY]]
      ]
    ];

    // Draw the line path
    this.ctx.strokeStyle = this.lineColor;
    this.ctx.lineWidth = 10;
    this.ctx.beginPath();

    for (let i = 0; i < path[x][0].length; i++) {
      if (i === 0) {
        this.ctx.moveTo(path[x][0][i][0], path[x][0][i][1]);
      } else {
        this.ctx.lineTo(path[x][0][i][0], path[x][0][i][1]);
      }
    }
    this.ctx.stroke();

    // Draw numbered circles on the line
    for (let i = 0; i < path[x][1].length; i++) {
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(path[x][1][i][0], path[x][1][i][1], 10, 0, 2 * Math.PI);
      this.ctx.fillStyle = 'white';
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = 'black';
      this.ctx.fillText(x + 1, path[x][1][i][0] - 6, path[x][1][i][1] + 7);
    }

    this.ctx.lineWidth = 10;
  }

  drawLines() {
    this.clearCanvas();
    this.lineCheck();
    if (this.jokerAdded && this.jokerPosition > 0) {
      this.drawJokerAtPosition(this.jokerCanvasX, this.jokerCanvasY);
    }
  }

  getTotalBet() {
    if (this.rewardMode === 2) return this.bet;
    return this.selectedPaylines.filter(l => l === 1).length * this.bet + this.jokerCost;
  }

  setButtonsEnabled(enabled) {
    // Disable/enable buttons with pointer-events: none
    const buttons = ['startBtn', 'betBtn', 'gameTypeBtn', 'rewardModeBtn'];
    buttons.forEach(id => {
      const btn = this.shadowRoot.getElementById(id);
      if (btn) {
        btn.disabled = !enabled;
        if (enabled) {
          btn.classList.remove('disabled');
        } else {
          btn.classList.add('disabled');
        }
      }
    });

    // Disable/enable clickable divs in slot-options (bet options, game types, reward modes)
    const slotOptions = this.shadowRoot.querySelector('.slot-options');
    if (slotOptions) {
      slotOptions.querySelectorAll('.control-group').forEach(el => {
        if (enabled) {
          el.classList.remove('disabled');
        } else {
          el.classList.add('disabled');
        }
      });
    }

    // Disable/enable clickable divs in slot-sidebar (lines, joker, control groups)
    const slotSidebar = this.shadowRoot.querySelector('.slot-sidebar');
    if (slotSidebar) {
      // Lines container items
      const linesContainer = slotSidebar.querySelector('.lines-container');
      if (linesContainer) {
        linesContainer.querySelectorAll('div').forEach(el => {
          if (enabled) {
            el.classList.remove('disabled');
          } else {
            el.classList.add('disabled');
          }
        });
      }

      // Joker container
      const jokerContainer = slotSidebar.querySelector('.joker-container');
      if (jokerContainer) {
        if (enabled) {
          jokerContainer.classList.remove('disabled');
        } else {
          jokerContainer.classList.add('disabled');
        }
      }

      // Control groups in sidebar
      slotSidebar.querySelectorAll('.control-group').forEach(el => {
        if (enabled) {
          el.classList.remove('disabled');
        } else {
          el.classList.add('disabled');
        }
      });
    }
  }

  setStopButtonEnabled(enabled) {
    const stopBtn = this.shadowRoot.getElementById('stopBtn');
    if (stopBtn) stopBtn.disabled = !enabled;
  }

  async startSpin() {
    if (this.isSpinning) return;
    const totalBet = this.getTotalBet();
    if (this.credits < totalBet) {
      if (typeof window.showToast === 'function') {
        window.showToast('Not enough credits. Use Add Credits to continue.', 'warning');
      }
      return;
    }

    this.isSpinning = true;
    this.credits -= totalBet;
    this.updateDisplay();

    // Disable all buttons except Stop
    this.setButtonsEnabled(false);
    this.setStopButtonEnabled(true);

    this.rotateReels([360, 360, 360, 360, 360]);

    try {
      const response = await this.callSpinAPI();
      this.spinsCount++;
      this.stopArray = response;
      this.rotateReels(response, true);
      this.startProgressTimer(response);
    } catch (error) {
      console.error('Spin error:', error);
      this.credits += totalBet;
      this.isSpinning = false;
      this.setButtonsEnabled(true);
      this.setStopButtonEnabled(true);
      this.updateDisplay();
    }
  }

  async callSpinAPI() {
    const activeLines = this.rewardMode === 2 ? [1, 0, 0, 0, 0, 0, 0] : this.selectedPaylines;
    const body = {
      action: 'slot_spin',
      ulog: parseInt(this.bet),
      igra: this.gameTypeValue,
      kvote: this.kvote,
      brojLinija: activeLines,
      dzoker: this.rewardMode === 2 ? 0 : this.jokerPosition,
      vrednostDzokera: this.rewardMode === 2 ? 0 : this.jokerCost,
      nacin: this.rewardMode,
      brojKredita: this.credits + this.getTotalBet()
    };

    const response = await fetch('/api/games/slot-machine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.jwtToken}` },
      body: JSON.stringify(body)
    });
    const json = await response.json();

    // Extract result array from wrapped response { success: true, data: { result: [...] } }
    if (json.success && json.data && json.data.result) {
      return json.data.result;
    }

    // If error or unexpected format, throw
    throw new Error(json.message || 'Spin failed');
  }

  /**
   * Rotate reels with slot machine animation
   * @param {Array} values - Either [360,360,360,360,360] for initial spin or actual reel values [1-6]
   * @param {boolean} isFinalSpin - True when spinning to final position
   */
  rotateReels(values, isFinalSpin = false) {
    // In multi-line mode (3x5), generate random directions for each reel
    // In single-line mode (1x5), all reels spin same direction
    if (!isFinalSpin) {
      this.spinDirections = this.carousels.map(() => {
        if (this.rewardMode === 1) {
          return Math.random() < 0.5 ? 1 : -1;
        }
        return -1;
      });
    }

    if (!isFinalSpin) {
      // For initial spin: start each wheel with a staggered delay (left to right)
      this.carousels.forEach((carousel, i) => {
        const direction = this.spinDirections[i];
        const currentRotation = this.currentRotations[i];
        const spinRotations = 360 * (Math.floor(Math.random() * 5) + 8);
        const target = currentRotation + (direction * spinRotations);

        this.currentRotations[i] = target;

        // Staggered start: each wheel starts 100ms after the previous
        carousel.style.transition = `transform 1s linear ${i * 0.1}s`;
        carousel.style.transform = `translateZ(-220px) rotateX(${target}deg)`;
      });
    } else {
      // Final spin - decelerate and land on target value
      this.carousels.forEach((carousel, i) => {
        const direction = this.spinDirections[i];
        const currentRotation = this.currentRotations[i];

        // Each symbol is 30° apart (12 cells × 30° = 360°)
        // To show value N (1-6), rotate to -(N-1) * 30
        const targetAngle = -(values[i] - 1) * 30;

        // Calculate final rotation that lands exactly on targetAngle
        const fullRotations = 360 * (8 + Math.floor(Math.random() * 4) + i);
        let rotation = targetAngle + (direction * fullRotations);

        // Ensure rotation is ahead of current position in spin direction
        while (direction === -1 && rotation > currentRotation) {
          rotation -= 360;
        }
        while (direction === 1 && rotation < currentRotation) {
          rotation += 360;
        }

        this.currentRotations[i] = rotation;
        carousel.style.transition = `transform ${4.5 + i * 0.3}s cubic-bezier(0.12, 0.8, 0.32, 1) ${i * 0.15}s`;
        carousel.style.transform = `translateZ(-220px) rotateX(${rotation}deg)`;
      });
    }
  }

  startProgressTimer(data) {
    let timeLeft = 5;
    const progressBar = this.shadowRoot.getElementById('progressBar');
    const progressLabel = this.shadowRoot.getElementById('progressLabel');

    this.progressInterval = setInterval(() => {
      if (timeLeft <= 0) {
        clearInterval(this.progressInterval);
        this.finishSpin(data);
      } else {
        progressLabel.textContent = `${timeLeft} sec`;
        progressBar.value = 5 - timeLeft;
        timeLeft--;
      }
    }, 1000);
  }

  finishSpin(data) {
    const progressLabel = this.shadowRoot.getElementById('progressLabel');
    const progressBar = this.shadowRoot.getElementById('progressBar');
    progressLabel.textContent = '5 sec';
    progressBar.value = 0;

    // Don't reset the transform - the carousel is already at the correct position
    // from the animation. Just clear the transition for future use.
    this.carousels.forEach((carousel) => {
      carousel.style.transition = 'none';
    });

    if (data[8] !== undefined) this.credits = data[8];
    if (data[7] && data[7] > 0) this.showWin(data);

    this.isSpinning = false;
    this.setButtonsEnabled(true);
    this.setStopButtonEnabled(true);
    this.updateDisplay();
  }

  showWin(data) {
    const overlay = document.createElement('div');
    overlay.className = 'win-overlay';

    // Parse the request JSON from data[5] to check game mode
    let gameMode = 2;
    try {
      const requestJson = JSON.parse(data[5]);
      gameMode = requestJson.nacin;
    } catch (e) {
      console.warn('Could not parse request JSON:', e);
    }

    let html = `<h1>Congratulations!</h1>`;

    // Show winning lines info for multi-line mode
    if (gameMode === 1 && Array.isArray(data[10])) {
      for (let i = 0; i < data[10].length; i++) {
        const winInfo = data[10][i];
        // Check if it's a valid win (array with line info, not "no win" string)
        if (Array.isArray(winInfo) && winInfo.length >= 6) {
          const lineNum = winInfo[5] + 1;  // Line index is at position 5
          html += `<p>Win on line ${lineNum}!</p>`;
        }
      }
    } else {
      html += `<p>Well done, you have a win!</p>`;
    }

    html += `<h2>Winnings: ${data[7]} $</h2>`;
    if (data[9] === 1) html += '<button id="miniGameBtn">Mini Game</button>';
    html += '<button id="continueBtn">Continue</button>';
    overlay.innerHTML = html;
    this.shadowRoot.appendChild(overlay);

    overlay.querySelector('#continueBtn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#miniGameBtn')?.addEventListener('click', () => {
      overlay.remove();
      const winAmount = data[7];
      new BingoMiniGame(winAmount, this.shadowRoot, (finalWin) => {
        // Add any bonus winnings to credits
        const bonus = finalWin - winAmount;
        if (bonus > 0) {
          this.credits += bonus;
          this.updateDisplay();
        }
      }, this.credits); // Pass user balance for mini-game validation
    });
  }

  stopSpin() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);

      // Immediately disable stop button to prevent double-click
      this.setStopButtonEnabled(false);

      // Reset progress bar
      const progressLabel = this.shadowRoot.getElementById('progressLabel');
      const progressBar = this.shadowRoot.getElementById('progressBar');
      progressLabel.textContent = '5 sec';
      progressBar.value = 0;

      // Animate each carousel directly to final position with quick deceleration
      this.carousels.forEach((carousel, i) => {
        const targetValue = this.stopArray[i];
        const targetAngle = -(targetValue - 1) * 30;

        // Store the final rotation
        this.currentRotations[i] = targetAngle;

        // Instant stop - 10ms
        carousel.style.transition = 'transform 0.01s ease-out';
        carousel.style.transform = `translateZ(-220px) rotateX(${targetAngle}deg)`;
      });

      // Wait for animations to complete, then finalize
      setTimeout(() => {
        const data = this.stopArray;
        if (data[8] !== undefined) this.credits = data[8];
        if (data[7] && data[7] > 0) this.showWin(data);

        this.isSpinning = false;
        this.setButtonsEnabled(true);
        this.setStopButtonEnabled(true);
        this.updateDisplay();
      }, 50);
    }
  }
}
