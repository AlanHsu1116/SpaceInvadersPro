# Space Invaders PRO (小蜜蜂 PRO)

## Project Overview

**Space Invaders PRO** is a modern, web-based arcade shooter game inspired by the classic Space Invaders. Built with raw HTML5 Canvas and Vanilla JavaScript, it features a retro-futuristic aesthetic with emoji-based sprites and neon visual effects.

### Key Features
*   **Classic Gameplay:** Player controls a spaceship to shoot down waves of alien enemies.
*   **Level System:** 5 progressive levels with increasing difficulty (enemy speed, formation size, and fire rate).
*   **Modern Aesthetics:**
    *   **Graphics:** Uses Emojis (`🚀`, `👾`, `💥`) for lightweight, scalable rendering.
    *   **UI:** Cyberpunk-inspired design with neon borders (`box-shadow`) and the 'Exo 2' font from Google Fonts.
*   **Game Loop:** Custom `requestAnimationFrame` loop handling updates, collisions, and rendering.

### Tech Stack
*   **Frontend:** HTML5, CSS3
*   **Logic:** Vanilla JavaScript (ES6+)
*   **Rendering:** HTML5 Canvas API (2D Context)
*   **Fonts:** Google Fonts ('Exo 2')

## Building and Running

This project is a static web application and requires no build step.

### How to Run
1.  **Open `index.html`:** Simply double-click the `index.html` file to open it in your default web browser.
2.  **Serve Locally (Optional):** For a better experience (avoiding CORS issues with some local assets, though none are currently used), you can serve it using a simple HTTP server:
    ```bash
    # Python 3
    python3 -m http.server 8000
    
    # Node.js (http-server)
    npx http-server
    ```

### Controls
*   **Left / Right Arrow:** Move Ship
*   **Spacebar:** Shoot
*   **Mouse Click:** Start Game / Next Level / Restart

## Development Conventions

### File Structure
*   `index.html`: Main entry point, sets up the HTML5 Canvas.
*   `style.css`: Handles page layout, background colors, and canvas styling (neon glow).
*   `script.js`: Contains all game logic, state management, and rendering code.

### Architecture (`script.js`)
The code is organized into distinct sections:
1.  **Game State:** Centralized `gameState` object tracks player, enemies, bullets, score, and level status.
2.  **Configuration:** `levelConfig` object defines difficulty parameters (rows, cols, speed, fire rate) for each of the 5 levels.
3.  **Entity Management:** Functions like `createEnemies()` and `shoot()` manage the creation and lifecycle of game objects.
4.  **Game Loop:** The `gameLoop()` function orchestrates the `update` -> `draw` -> `requestAnimationFrame` cycle.
5.  **Collision Detection:** Simple AABB (Axis-Aligned Bounding Box) collision checks in `checkCollisions()`.
