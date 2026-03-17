/**
 * mondrian.js — Live-drawing Mondrian Art Generator
 *
 * The canvas background:
 *  1. Recursively splits the viewport into a grid of cells (Mondrian-style).
 *  2. Animates each cell being painted one-by-one in a random order,
 *     with thick black borders drawn as each cell is revealed.
 *  3. After the composition is complete, waits, then redraws from scratch.
 */

(function () {
  'use strict';

  // ── Palette ────────────────────────────────────────────────────────
  const PALETTE = {
    white:  '#F0EDE4',
    red:    '#E8192C',
    blue:   '#1E3F9E',
    yellow: '#F5C518',
  };

  // Weighted pool: white ~65%, primaries ~35%
  const COLOR_POOL = [
    PALETTE.white, PALETTE.white, PALETTE.white, PALETTE.white,
    PALETTE.white, PALETTE.white, PALETTE.white,
    PALETTE.red,
    PALETTE.blue,
    PALETTE.yellow,
  ];

  const BORDER_COLOR = '#111111';
  const BORDER_WIDTH = 6;          // logical px (scaled by DPR)
  const MIN_CELL     = 80;         // minimum cell dimension in logical px
  const SPLIT_PROB   = 0.72;       // chance a splittable rect is split further

  // Animation timing
  const CELL_DELAY      = 28;    // ms between each cell being painted
  const PAUSE_AFTER     = 4000; // ms to hold the finished painting before redrawing
  const ERASE_DURATION  = 800;  // ms to fade out before next redraw

  // ── Canvas setup ──────────────────────────────────────────────────
  const canvas = document.getElementById('mondrian-canvas');
  const ctx    = canvas.getContext('2d');

  let W, H, DPR;
  let animTimer    = null;  // setTimeout handle for cell paint steps
  let eraseTimer   = null;
  let pauseTimer   = null;
  let cellQueue    = [];    // ordered list of leaf cells to paint
  let cellIndex    = 0;

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W   = window.innerWidth;
    H   = window.innerHeight;
    canvas.width        = Math.round(W * DPR);
    canvas.height       = Math.round(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
  }

  // ── Tree builder (collect all leaf cells) ─────────────────────────
  /**
   * Recursively partitions (x,y,w,h) into leaf cells.
   * Returns an array of { x, y, w, h, color } objects.
   */
  function buildTree(x, y, w, h, depth, cells) {
    const canH = w > MIN_CELL * 2 * DPR;
    const canV = h > MIN_CELL * 2 * DPR;
    const doSplit = (canH || canV) && (depth < 2 || Math.random() < SPLIT_PROB);

    if (!doSplit) {
      // Leaf
      const color = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
      cells.push({ x, y, w, h, color });
      return;
    }

    let splitVertical;
    if (canH && canV) splitVertical = Math.random() < 0.5;
    else              splitVertical = canH;

    const minS = MIN_CELL * DPR;

    if (splitVertical) {
      const split = minS + Math.random() * (w - 2 * minS);
      buildTree(x,         y, split,     h, depth + 1, cells);
      buildTree(x + split, y, w - split, h, depth + 1, cells);
    } else {
      const split = minS + Math.random() * (h - 2 * minS);
      buildTree(x, y,         w, split,     depth + 1, cells);
      buildTree(x, y + split, w, h - split, depth + 1, cells);
    }
  }

  // ── Draw a single cell (fill + border) ───────────────────────────
  function paintCell(cell) {
    const bw = BORDER_WIDTH * DPR;

    // Fill
    ctx.fillStyle = cell.color;
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);

    // Border on top
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth   = bw;
    ctx.lineJoin    = 'miter';
    ctx.strokeRect(
      cell.x + bw / 2,
      cell.y + bw / 2,
      cell.w - bw,
      cell.h - bw
    );
  }

  // ── Shuffle helper ────────────────────────────────────────────────
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── Animation loop ────────────────────────────────────────────────
  function startDrawing() {
    clearTimeout(animTimer);
    clearTimeout(pauseTimer);
    clearTimeout(eraseTimer);
    cellIndex = 0;

    // White base
    ctx.fillStyle = PALETTE.white;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Build + shuffle cell queue
    cellQueue = [];
    buildTree(0, 0, canvas.width, canvas.height, 0, cellQueue);
    shuffle(cellQueue);

    paintNext();
  }

  function paintNext() {
    if (cellIndex >= cellQueue.length) {
      // All cells done — draw outer frame, then schedule next round
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth   = BORDER_WIDTH * DPR * 1.5;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      pauseTimer = setTimeout(fadeOut, PAUSE_AFTER);
      return;
    }

    paintCell(cellQueue[cellIndex]);
    cellIndex++;
    animTimer = setTimeout(paintNext, CELL_DELAY);
  }

  // ── Fade out then redraw ──────────────────────────────────────────
  function fadeOut() {
    const startTime = performance.now();
    const snapshot  = ctx.getImageData(0, 0, canvas.width, canvas.height);

    function step(now) {
      const t    = Math.min((now - startTime) / ERASE_DURATION, 1);
      const ease = t * t * (3 - 2 * t); // smoothstep

      // Restore snapshot, then overlay darkening white
      ctx.putImageData(snapshot, 0, 0);
      ctx.fillStyle = `rgba(240,237,228,${ease * 0.92})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (t < 1) {
        eraseTimer = requestAnimationFrame(step);
      } else {
        startDrawing();
      }
    }

    eraseTimer = requestAnimationFrame(step);
  }

  // ── Resize handler ────────────────────────────────────────────────
  let resizeDebounce = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      clearTimeout(animTimer);
      clearTimeout(pauseTimer);
      cancelAnimationFrame(eraseTimer);
      resize();
      startDrawing();
    }, 150);
  });

  // ── Boot ──────────────────────────────────────────────────────────
  resize();
  startDrawing();

})();
