"use strict";

(function () {
  const BASE_CONFIG = {
    slideBaseDuration: 0.08,
    slideCellDuration: 0.048,
    warningWindow: 1.45,
    impactDuration: 0.28,
    introFocusDuration: 1.15,
    maxLevel: 99,
  };

  class RNG {
    constructor(seed) {
      this.seed = seed >>> 0;
    }

    next() {
      this.seed = (1664525 * this.seed + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }

    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    }

    shuffle(list) {
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.next() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    }
  }

  class NeonCollapseMaze {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d", { alpha: false, desynchronized: false });
      this.levelValue = document.getElementById("levelValue");
      this.orbValue = document.getElementById("orbValue");
      this.runValue = document.getElementById("runValue");
      this.statusText = document.getElementById("statusText");
      this.dangerFill = document.getElementById("dangerFill");
      this.messagePanel = document.getElementById("messagePanel");
      this.messageTitle = document.getElementById("messageTitle");
      this.messageText = document.getElementById("messageText");

      this.level = 1;
      this.runOrbs = 0;
      this.lastTimestamp = 0;
      this.lastDelta = 1 / 60;
      this.pointerStart = null;
      this.activePointerId = null;
      this.pendingDirection = null;
      this.pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      this.performanceProfile = this.computePerformanceProfile(window.innerWidth, window.innerHeight);
      this.boardMetrics = null;
      this.backdropCache = null;
      this.focusMaskCache = null;
      this.camera = { x: 0, y: 0 };
      this.cameraVelocity = { x: 0, y: 0 };
      this.ambientField = [];
      this.introFocusTime = 0;
      this.impactEffect = null;
      this.exitEffect = null;
      this.deathEffect = null;
      this.winOverlayTime = 0;
      this.loseOverlayTime = 0;
      this.phase = "playing";

      this.resizeCanvas();
      this.bindEvents();
      this.startLevel(this.level);
      window.requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    bindEvents() {
      window.addEventListener("resize", () => this.resizeCanvas());
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => this.resizeCanvas());
      }

      this.canvas.addEventListener("pointerdown", (event) => {
        this.activePointerId = event.pointerId;
        if (this.canvas.setPointerCapture) {
          this.canvas.setPointerCapture(event.pointerId);
        }
        this.pointerStart = { x: event.clientX, y: event.clientY };
      });

      this.canvas.addEventListener("pointerup", (event) => {
        if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
          return;
        }

        if (this.phase !== "playing") {
          this.handleInterludeInput();
          this.clearPointerState(event.pointerId);
          return;
        }

        if (!this.pointerStart) {
          this.clearPointerState(event.pointerId);
          return;
        }

        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        this.pointerStart = null;

        const threshold = this.getSwipeThreshold();
        this.clearPointerState(event.pointerId);
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
          return;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
          this.queueMove(Math.sign(dx), 0);
        } else {
          this.queueMove(0, Math.sign(dy));
        }
      });

      this.canvas.addEventListener("pointercancel", (event) => {
        this.clearPointerState(event.pointerId);
      });

      this.canvas.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "mouse") {
          this.clearPointerState(event.pointerId);
        }
      });

      this.messagePanel.addEventListener("pointerup", () => {
        if (this.phase !== "playing") {
          this.handleInterludeInput();
        }
      });

      window.addEventListener("keydown", (event) => {
        if (this.phase !== "playing") {
          if ([" ", "Enter", "r", "R"].includes(event.key)) {
            this.handleInterludeInput();
          }
          return;
        }

        const key = event.key.toLowerCase();
        if (key === "arrowup" || key === "w") {
          this.queueMove(0, -1);
        } else if (key === "arrowdown" || key === "s") {
          this.queueMove(0, 1);
        } else if (key === "arrowleft" || key === "a") {
          this.queueMove(-1, 0);
        } else if (key === "arrowright" || key === "d") {
          this.queueMove(1, 0);
        }
      });
    }

    resizeCanvas() {
      const stage = this.canvas.parentElement;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      this.performanceProfile = this.computePerformanceProfile(width, height);
      this.pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, this.performanceProfile.pixelRatioCap));

      this.canvas.width = Math.floor(width * this.pixelRatio);
      this.canvas.height = Math.floor(height * this.pixelRatio);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.buildBackdropCache(width, height);
      this.buildFocusMaskCache(width, height);

      if (this.levelData) {
        this.updateBoardMetrics();
      }
    }

    loop(timestamp) {
      const delta = Math.min((timestamp - this.lastTimestamp) / 1000 || 0, this.performanceProfile.maxDelta);
      this.lastTimestamp = timestamp;
      this.lastDelta = delta || this.lastDelta;

      this.update(delta);
      this.draw();
      window.requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
    }

    startLevel(level) {
      this.phase = "playing";
      this.level = Math.max(1, Math.min(level, BASE_CONFIG.maxLevel));
      this.levelData = this.buildLevel(this.level);
      this.player = {
        x: this.levelData.start.x,
        y: this.levelData.start.y,
        renderX: this.levelData.start.x,
        renderY: this.levelData.start.y,
      };
      this.moveState = null;
      this.pendingDirection = null;
      this.levelTime = 0;
      this.levelOrbCount = 0;
      this.introFocusTime = BASE_CONFIG.introFocusDuration;
      this.impactEffect = null;
      this.exitEffect = null;
      this.deathEffect = null;
      this.winOverlayTime = 0;
      this.loseOverlayTime = 0;
      this.ambientField = this.buildAmbientField(this.levelData.seed);
      this.hideMessage();
      this.levelValue.textContent = String(this.level).padStart(2, "0");
      this.updateBoardMetrics();
      this.resetCamera();
      this.setStatusText(
        "One swipe sends the cube sliding until the next wall. Every second lost brings the collapse closer.",
        "Swipe to slide into walls."
      );
      this.updateHud();
    }

    buildLevel(level) {
      const baseSeed = (Date.now() + level * 4099 + Math.floor(Math.random() * 100000)) >>> 0;

      for (let attempt = 0; attempt < 512; attempt += 1) {
        const randomSalt = Math.floor(Math.random() * 4294967296) >>> 0;
        const seed = (baseSeed ^ randomSalt ^ Math.imul(attempt + 1, 2654435761)) >>> 0;
        const candidate = this.generateLevelCandidate(level, seed);
        if (candidate) {
          return candidate;
        }
      }

      for (let attempt = 512; attempt < 704; attempt += 1) {
        const randomSalt = Math.floor(Math.random() * 4294967296) >>> 0;
        const seed = (baseSeed ^ randomSalt ^ Math.imul(attempt + 1, 2654435761)) >>> 0;
        const candidate = this.generateLevelCandidate(level, seed, true);
        if (candidate) {
          return candidate;
        }
      }

      throw new Error("Unable to generate a solvable slide maze.");
    }

    generateLevelCandidate(level, seed, softMode = false) {
      const rng = new RNG(seed);
      const cols = this.toOdd(Math.min(17 + (level - 1) * 2, 29));
      const rows = this.toOdd(Math.min(21 + (level - 1) * 2, 35));
      const grid = Array.from({ length: rows }, () => Array(cols).fill("wall"));

      const internalStart = { x: this.closestOdd(Math.floor(cols / 2)), y: rows - 2 };
      const stack = [internalStart];
      grid[internalStart.y][internalStart.x] = "floor";

      while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const directions = rng.shuffle([
          { dx: 0, dy: -2 },
          { dx: 2, dy: 0 },
          { dx: 0, dy: 2 },
          { dx: -2, dy: 0 },
        ]);

        let carved = false;
        for (const direction of directions) {
          const nx = current.x + direction.dx;
          const ny = current.y + direction.dy;
          if (nx <= 0 || nx >= cols - 1 || ny <= 0 || ny >= rows - 1) {
            continue;
          }
          if (grid[ny][nx] !== "wall") {
            continue;
          }
          grid[current.y + direction.dy / 2][current.x + direction.dx / 2] = "floor";
          grid[ny][nx] = "floor";
          stack.push({ x: nx, y: ny });
          carved = true;
          break;
        }

        if (!carved) {
          stack.pop();
        }
      }

      const extraLoops = Math.floor((cols * rows) / 38) + Math.ceil(level * 1.5);
      for (let i = 0; i < extraLoops; i += 1) {
        const vertical = rng.next() > 0.5;
        const x = vertical ? this.closestEven(rng.int(2, cols - 3)) : this.closestOdd(rng.int(1, cols - 2));
        const y = vertical ? this.closestOdd(rng.int(1, rows - 2)) : this.closestEven(rng.int(2, rows - 3));

        if (x <= 0 || x >= cols - 1 || y <= 0 || y >= rows - 1) {
          continue;
        }

        if (vertical) {
          if (grid[y][x - 1] === "floor" && grid[y][x + 1] === "floor") {
            grid[y][x] = "floor";
          }
        } else if (grid[y - 1][x] === "floor" && grid[y + 1][x] === "floor") {
          grid[y][x] = "floor";
        }
      }

      const start = { x: internalStart.x, y: rows - 1 };
      grid[start.y][start.x] = "floor";
      grid[rows - 2][start.x] = "floor";

      const { distances } = this.bfs(grid, start);
      const topCandidates = [];
      for (let y = 0; y < Math.max(3, Math.floor(rows * 0.34)); y += 1) {
        for (let x = 1; x < cols - 1; x += 1) {
          if (grid[y][x] !== "floor" || distances[y][x] < 0) {
            continue;
          }
          topCandidates.push({ x, y, distance: distances[y][x] });
        }
      }

      topCandidates.sort((a, b) => b.distance - a.distance);
      const exitAnchor =
        topCandidates.find((candidate) => candidate.x >= 3 && candidate.x <= cols - 4) ||
        topCandidates[0] ||
        { x: internalStart.x, y: 1 };
      this.carveExitSuite(grid, exitAnchor.x, rows, cols);
      const exit = { x: exitAnchor.x, y: 0 };

      let slideGraph = this.buildSlideGraph(grid, start);
      let slideAnalysis = this.analyzeSlideGraph(slideGraph, start);
      for (let pass = 0; pass < 10 && slideAnalysis.trapEdgeCount > 0; pass += 1) {
        if (!this.sealTrapSegments(grid, slideAnalysis, start, exit)) {
          break;
        }
        slideGraph = this.buildSlideGraph(grid, start);
        slideAnalysis = this.analyzeSlideGraph(slideGraph, start);
      }

      const minimumNodes = Math.min(20, 8 + Math.floor(level * 0.5)) - (softMode ? 2 : 0);
      const minimumBranches = Math.min(6, 2 + Math.floor(level * 0.1)) - (softMode ? 1 : 0);
      if (
        slideAnalysis.strongNodeCount < minimumNodes ||
        slideAnalysis.branchCount < minimumBranches ||
        slideAnalysis.trapEdgeCount > 0
      ) {
        return null;
      }

      const slideSolution = this.findSlideSolution(grid, start, exit);
      if (!slideSolution) {
        return null;
      }
      if (!slideAnalysis.strongNodes.has(this.cellKey(exit.x, exit.y))) {
        return null;
      }

      const refreshed = this.bfs(grid, start);
      const mainPathSet = slideSolution.cellSet;
      const seededOrbs = this.placeOrbs(grid, refreshed.distances, slideAnalysis, slideSolution, start, exit, rng, level);
      const collapseAt = this.buildCollapseSchedule(
        grid,
        mainPathSet,
        slideAnalysis,
        slideGraph,
        seededOrbs,
        level,
        rng,
        slideSolution.arrivalTimes,
        exit
      );
      const orbAccessibility = this.filterAccessibleOrbs(seededOrbs, slideGraph, collapseAt, start, exit);
      const minimumAccessibleOrbs = Math.max(
        softMode ? 4 : 6,
        Math.floor(this.getTargetOrbCount(slideAnalysis.reversibleCells.size, level) * (softMode ? 0.58 : 0.72))
      );
      if (orbAccessibility.orbCells.size < minimumAccessibleOrbs || orbAccessibility.viableRatio < (softMode ? 0.76 : 0.82)) {
        return null;
      }
      const orbCells = orbAccessibility.orbCells;

      return {
        seed,
        cols,
        rows,
        grid,
        start,
        exit,
        orbCells,
        collapseAt,
        mainPathSet,
        slideSolution,
        slideGraph,
        slideAnalysis,
        maxCollapseTime: this.findMaxCollapse(collapseAt),
      };
    }

    findSlideSolution(grid, start, exit) {
      const frontier = [{ x: start.x, y: start.y, cost: 0 }];
      const bestTimes = new Map([[this.cellKey(start.x, start.y), 0]]);
      const parents = new Map();
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
      ];
      const exitKey = this.cellKey(exit.x, exit.y);

      while (frontier.length > 0) {
        frontier.sort((a, b) => a.cost - b.cost);
        const current = frontier.shift();
        const currentKey = this.cellKey(current.x, current.y);
        if (current.cost > bestTimes.get(currentKey)) {
          continue;
        }
        if (currentKey === exitKey) {
          break;
        }

        for (const direction of directions) {
          const segment = this.traceSlideOnGrid(grid, current.x, current.y, direction.dx, direction.dy);
          if (segment.distance === 0) {
            continue;
          }

          const nextKey = this.cellKey(segment.to.x, segment.to.y);
          const nextCost = current.cost + segment.duration;
          if (nextCost >= (bestTimes.get(nextKey) ?? Infinity)) {
            continue;
          }

          bestTimes.set(nextKey, nextCost);
          parents.set(nextKey, {
            from: { x: current.x, y: current.y },
            segment,
          });
          frontier.push({ x: segment.to.x, y: segment.to.y, cost: nextCost });
        }
      }

      if (!bestTimes.has(exitKey)) {
        return null;
      }

      const segments = [];
      let cursorKey = exitKey;
      while (cursorKey !== this.cellKey(start.x, start.y)) {
        const step = parents.get(cursorKey);
        if (!step) {
          return null;
        }
        segments.push(step.segment);
        cursorKey = this.cellKey(step.from.x, step.from.y);
      }
      segments.reverse();

      const arrivalTimes = new Map([[this.cellKey(start.x, start.y), 0]]);
      const cellSet = new Set([this.cellKey(start.x, start.y)]);
      let elapsed = 0;
      for (const segment of segments) {
        const stepTime = segment.duration / segment.distance;
        for (const cell of segment.cells) {
          elapsed += stepTime;
          const key = this.cellKey(cell.x, cell.y);
          cellSet.add(key);
          arrivalTimes.set(key, elapsed);
        }
      }

      return {
        segments,
        cellSet,
        arrivalTimes,
        totalDuration: bestTimes.get(exitKey),
      };
    }

    carveExitSuite(grid, exitX, rows, cols) {
      const left = Math.max(1, exitX - 2);
      const right = Math.min(cols - 2, exitX + 2);

      grid[0][exitX] = "floor";

      for (let x = left; x <= right; x += 1) {
        grid[1][x] = "floor";
        grid[2][x] = "floor";
        if (rows > 3) {
          grid[3][x] = "floor";
        }
      }

      if (rows > 4) {
        for (let x = Math.max(1, exitX - 1); x <= Math.min(cols - 2, exitX + 1); x += 1) {
          grid[4][x] = "floor";
        }
      }

      const gateColumns = [left, right];
      for (const gateX of gateColumns) {
        for (let y = 4; y < rows - 1; y += 1) {
          grid[y][gateX] = "floor";
          if (
            this.isFloorOnGrid(grid, gateX, y + 1) ||
            this.isFloorOnGrid(grid, gateX - 1, y) ||
            this.isFloorOnGrid(grid, gateX + 1, y)
          ) {
            break;
          }
        }
      }
    }

    buildSlideGraph(grid, start) {
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
      ];
      const startKey = this.cellKey(start.x, start.y);
      const visited = new Set([startKey]);
      const queue = [{ x: start.x, y: start.y }];
      const nodes = new Map([[startKey, { x: start.x, y: start.y }]]);
      const edgesFrom = new Map();
      const reverseEdges = new Map([[startKey, []]]);
      let branchCount = 0;

      while (queue.length > 0) {
        const current = queue.shift();
        const currentKey = this.cellKey(current.x, current.y);
        const outgoing = [];
        let degree = 0;

        for (const direction of directions) {
          const segment = this.traceSlideOnGrid(grid, current.x, current.y, direction.dx, direction.dy);
          if (segment.distance === 0) {
            continue;
          }

          degree += 1;
          const nextKey = this.cellKey(segment.to.x, segment.to.y);
          segment.fromKey = currentKey;
          segment.toKey = nextKey;
          segment.key = this.segmentKey(currentKey, nextKey, segment.dx, segment.dy);
          outgoing.push(segment);
          if (!reverseEdges.has(nextKey)) {
            reverseEdges.set(nextKey, []);
          }
          reverseEdges.get(nextKey).push(segment);
          if (!visited.has(nextKey)) {
            visited.add(nextKey);
            nodes.set(nextKey, { x: segment.to.x, y: segment.to.y });
            queue.push({ x: segment.to.x, y: segment.to.y });
          }
        }

        edgesFrom.set(currentKey, outgoing);
        if (degree >= 3) {
          branchCount += 1;
        }
      }

      for (const key of nodes.keys()) {
        if (!edgesFrom.has(key)) {
          edgesFrom.set(key, []);
        }
        if (!reverseEdges.has(key)) {
          reverseEdges.set(key, []);
        }
      }

      return {
        nodes,
        edgesFrom,
        reverseEdges,
        nodeCount: visited.size,
        branchCount,
      };
    }

    analyzeSlideGraph(slideGraph, start) {
      const startKey = this.cellKey(start.x, start.y);
      const nodeKeys = Array.from(slideGraph.nodes.keys());
      const visited = new Set();
      const order = [];

      for (const key of nodeKeys) {
        if (visited.has(key)) {
          continue;
        }

        const stack = [{ key, index: 0 }];
        visited.add(key);
        while (stack.length > 0) {
          const frame = stack[stack.length - 1];
          const edges = slideGraph.edgesFrom.get(frame.key) || [];
          if (frame.index < edges.length) {
            const nextKey = edges[frame.index].toKey;
            frame.index += 1;
            if (!visited.has(nextKey)) {
              visited.add(nextKey);
              stack.push({ key: nextKey, index: 0 });
            }
          } else {
            order.push(frame.key);
            stack.pop();
          }
        }
      }

      const componentOf = new Map();
      const components = [];
      while (order.length > 0) {
        const key = order.pop();
        if (componentOf.has(key)) {
          continue;
        }

        const componentIndex = components.length;
        const component = new Set();
        const stack = [key];
        componentOf.set(key, componentIndex);

        while (stack.length > 0) {
          const currentKey = stack.pop();
          component.add(currentKey);
          for (const edge of slideGraph.reverseEdges.get(currentKey) || []) {
            if (componentOf.has(edge.fromKey)) {
              continue;
            }
            componentOf.set(edge.fromKey, componentIndex);
            stack.push(edge.fromKey);
          }
        }

        components.push(component);
      }

      const startComponentIndex = componentOf.get(startKey);
      const strongNodes = components[startComponentIndex] || new Set();
      const reversibleSegments = [];
      const reversibleCells = new Set();
      const trapSegments = [];
      let trapEdgeCount = 0;
      let strongBranchCount = 0;

      for (const key of strongNodes) {
        const outgoing = slideGraph.edgesFrom.get(key) || [];
        let localDegree = 0;
        for (const segment of outgoing) {
          if (!strongNodes.has(segment.toKey)) {
            trapEdgeCount += 1;
            trapSegments.push(segment);
            continue;
          }
          reversibleSegments.push(segment);
          localDegree += 1;
          for (const cell of segment.cells) {
            reversibleCells.add(this.cellKey(cell.x, cell.y));
          }
        }
        if (localDegree >= 3) {
          strongBranchCount += 1;
        }
      }

      return {
        strongNodes,
        strongNodeCount: strongNodes.size,
        branchCount: strongBranchCount,
        trapEdgeCount,
        trapSegments,
        reversibleSegments,
        reversibleCells,
      };
    }

    sealTrapSegments(grid, slideAnalysis, start, exit) {
      let changed = false;
      for (const segment of slideAnalysis.trapSegments) {
        const sealCell = this.findTrapSealCell(grid, segment, start, exit);
        if (!sealCell) {
          continue;
        }
        if (grid[sealCell.y][sealCell.x] !== "floor") {
          continue;
        }
        grid[sealCell.y][sealCell.x] = "wall";
        changed = true;
      }
      return changed;
    }

    findTrapSealCell(grid, segment, start, exit) {
      const rows = grid.length;
      const cols = grid[0].length;
      let fallback = null;

      for (const cell of segment.cells) {
        if (
          (cell.x === start.x && cell.y === start.y) ||
          (cell.x === exit.x && cell.y === exit.y) ||
          this.isProtectedOrbCell(cell, start, exit, rows, cols) ||
          grid[cell.y][cell.x] !== "floor"
        ) {
          continue;
        }

        if (fallback === null) {
          fallback = cell;
        }

        if (this.countFloorNeighbors(grid, cell.x, cell.y) <= 2) {
          return cell;
        }
      }

      return fallback;
    }

    countFloorNeighbors(grid, x, y) {
      let count = 0;
      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];

      for (const direction of directions) {
        if (this.isFloorOnGrid(grid, x + direction.dx, y + direction.dy)) {
          count += 1;
        }
      }

      return count;
    }

    traceSlideOnGrid(grid, startX, startY, dx, dy) {
      const cells = [];
      let x = startX;
      let y = startY;

      while (this.isFloorOnGrid(grid, x + dx, y + dy)) {
        x += dx;
        y += dy;
        cells.push({ x, y });
      }

      return {
        from: { x: startX, y: startY },
        to: { x, y },
        dx,
        dy,
        cells,
        distance: cells.length,
        duration: this.getSlideDuration(cells.length),
      };
    }

    isFloorOnGrid(grid, x, y) {
      return (
        x >= 0 &&
        y >= 0 &&
        y < grid.length &&
        x < grid[0].length &&
        grid[y][x] === "floor"
      );
    }

    bfs(grid, start) {
      const rows = grid.length;
      const cols = grid[0].length;
      const distances = Array.from({ length: rows }, () => Array(cols).fill(-1));
      const parents = Array.from({ length: rows }, () => Array(cols).fill(null));
      const queue = [start];
      distances[start.y][start.x] = 0;

      while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 },
        ];

        for (const next of neighbors) {
          if (
            next.x < 0 ||
            next.y < 0 ||
            next.y >= rows ||
            next.x >= cols ||
            grid[next.y][next.x] !== "floor" ||
            distances[next.y][next.x] !== -1
          ) {
            continue;
          }
          distances[next.y][next.x] = distances[current.y][current.x] + 1;
          parents[next.y][next.x] = current;
          queue.push(next);
        }
      }

      return { distances, parents };
    }

    extractPath(parents, goal) {
      const path = [];
      let current = goal;
      while (current) {
        path.push(current);
        current = parents[current.y][current.x];
      }
      return path.reverse();
    }

    placeOrbs(grid, distances, slideAnalysis, slideSolution, start, exit, rng, level) {
      const rows = grid.length;
      const cols = grid[0].length;
      const mainPathSet = slideSolution.cellSet;
      const branchSegments = [];
      const supportSegments = [];
      const branchPool = [];
      const supportPool = [];
      const orbs = new Map();
      const targetCount = this.getTargetOrbCount(slideAnalysis.reversibleCells.size, level);
      const mainPathQuota = this.clamp(
        Math.round(targetCount * 0.52),
        4,
        Math.max(4, targetCount - 2)
      );

      const addOrb = (cell) => {
        if (!cell) {
          return false;
        }
        const key = this.cellKey(cell.x, cell.y);
        if (orbs.has(key) || this.isProtectedOrbCell(cell, start, exit, rows, cols)) {
          return false;
        }
        orbs.set(key, {
          x: cell.x,
          y: cell.y,
          collected: false,
        });
        return true;
      };

      for (const segment of slideAnalysis.reversibleSegments) {
        const usableCells = segment.cells.filter((cell) => !this.isProtectedOrbCell(cell, start, exit, rows, cols));
        if (usableCells.length === 0) {
          continue;
        }

        const offMainCells = [];
        const onMainCells = [];
        let distanceTotal = 0;

        for (const cell of usableCells) {
          const key = this.cellKey(cell.x, cell.y);
          distanceTotal += Math.max(0, distances[cell.y][cell.x]);
          if (mainPathSet.has(key)) {
            onMainCells.push(cell);
            supportPool.push(cell);
          } else {
            offMainCells.push(cell);
            branchPool.push(cell);
          }
        }

        const averageDistance = distanceTotal / usableCells.length;
        if (onMainCells.length > 0) {
          supportSegments.push({
            cells: onMainCells,
            score: onMainCells.length * 2.8 + averageDistance * 0.07 + segment.distance * 0.45,
          });
        }

        if (offMainCells.length > 0) {
          branchSegments.push({
            cells: offMainCells,
            score: offMainCells.length * 3 + averageDistance * 0.08 + segment.distance * 0.5,
          });
        }
      }

      branchSegments.sort((a, b) => b.score - a.score);
      supportSegments.sort((a, b) => b.score - a.score);

      for (const segment of supportSegments) {
        if (orbs.size >= mainPathQuota) {
          break;
        }
        this.seedOrbsAlongCells(segment.cells, addOrb, () => orbs.size >= mainPathQuota, rng, true);
      }

      if (orbs.size < mainPathQuota) {
        this.seedOrbPool(supportPool, addOrb, () => orbs.size >= mainPathQuota, rng);
      }

      for (const segment of branchSegments) {
        if (orbs.size >= targetCount) {
          break;
        }
        this.seedOrbsAlongCells(segment.cells, addOrb, () => orbs.size >= targetCount, rng, true);
      }

      if (orbs.size < Math.floor(targetCount * 0.75)) {
        this.seedOrbPool(branchPool, addOrb, () => orbs.size >= targetCount, rng);
      }

      for (const segment of supportSegments) {
        if (orbs.size >= targetCount) {
          break;
        }
        this.seedOrbsAlongCells(segment.cells, addOrb, () => orbs.size >= targetCount, rng, false);
      }

      if (orbs.size < targetCount) {
        this.seedOrbPool(supportPool, addOrb, () => orbs.size >= targetCount, rng);
      }

      return orbs;
    }

    getTargetOrbCount(reversibleCellCount, level) {
      return this.clamp(
        Math.floor(reversibleCellCount * (0.118 + level * 0.0028)),
        10,
        30
      );
    }

    seedOrbsAlongCells(cells, addOrb, isFull, rng, preferDense) {
      if (cells.length === 0) {
        return;
      }

      const ordered = (cells.length > 3 ? cells.slice(1, -1) : cells.slice());
      if (ordered.length === 0) {
        return;
      }

      if (ordered.length > 2 && rng.next() > 0.5) {
        ordered.reverse();
      }

      const step = preferDense ? (ordered.length >= 7 ? 2 : 1) : (ordered.length >= 5 ? 2 : 1);
      const offset = step > 1 ? rng.int(0, step - 1) : 0;
      for (let i = offset; i < ordered.length; i += step) {
        if (isFull()) {
          break;
        }
        addOrb(ordered[i]);
      }
    }

    seedOrbPool(cells, addOrb, isFull, rng) {
      const unique = new Map();
      for (const cell of cells) {
        unique.set(this.cellKey(cell.x, cell.y), cell);
      }

      const ordered = Array.from(unique.values());
      rng.shuffle(ordered);
      for (const cell of ordered) {
        if (isFull()) {
          break;
        }
        addOrb(cell);
      }
    }

    isProtectedOrbCell(cell, start, exit, rows, cols) {
      if (cell.x === start.x && cell.y === start.y) {
        return true;
      }
      if (cell.x === exit.x && cell.y === exit.y) {
        return true;
      }
      if (cell.y <= 4) {
        return true;
      }
      if (cell.y >= rows - 2) {
        return true;
      }
      if (Math.abs(cell.x - exit.x) <= 2 && cell.y <= 6) {
        return true;
      }
      if (Math.abs(cell.x - start.x) <= 1 && cell.y >= rows - 4) {
        return true;
      }
      return cell.x <= 0 || cell.x >= cols - 1;
    }

    buildCollapseSchedule(grid, mainPathSet, slideAnalysis, slideGraph, orbCells, level, rng, arrivalTimes, exit) {
      const rows = grid.length;
      const safeLead = Math.max(4.1, 6.25 - level * 0.055);
      const rowDelay = Math.max(0.72, 1.12 - level * 0.012);
      const criticalBuffer = Math.max(1.7, 2.3 - level * 0.018);
      const schedule = Array.from({ length: rows }, () => Array(grid[0].length).fill(Infinity));
      const exitKey = this.cellKey(exit.x, exit.y);
      const reversibleCells = slideAnalysis.reversibleCells;

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < grid[0].length; x += 1) {
          const key = this.cellKey(x, y);
          const distanceFromBottom = rows - 1 - y;
          const noise = rng.next() * 0.42;
          const onMainPath = mainPathSet.has(key);
          const onReversibleRoute = reversibleCells.has(key);
          const isStopNode = slideGraph.nodes.has(key);
          const floorBuffer = grid[y][x] === "floor" ? 0.08 : 0;
          const wallPenalty = grid[y][x] === "wall" ? 0.14 : 0;
          const pathBuffer = onMainPath ? 0.46 : (onReversibleRoute ? 0.2 : 0);
          const nodeBuffer = isStopNode ? 0.12 : 0;
          const orbBuffer = orbCells.has(key) ? 0.56 : 0;
          let collapseAt = safeLead + distanceFromBottom * rowDelay + noise + floorBuffer + pathBuffer + nodeBuffer + orbBuffer + wallPenalty;

          if (arrivalTimes.has(key)) {
            collapseAt = Math.max(collapseAt, arrivalTimes.get(key) + criticalBuffer);
          }

          if (key === exitKey) {
            collapseAt += 0.85;
          }

          schedule[y][x] = collapseAt;
        }
      }

      return schedule;
    }

    filterAccessibleOrbs(orbCells, slideGraph, collapseAt, start, exit) {
      if (orbCells.size === 0) {
        return {
          orbCells: new Map(),
          viableRatio: 1,
        };
      }

      const routeWindows = this.computeTimedRouteWindows(slideGraph, collapseAt, start, exit);
      const accessible = new Map();

      for (const [key, orb] of orbCells.entries()) {
        if (this.isOrbAccessible(orb, slideGraph, collapseAt, routeWindows)) {
          accessible.set(key, orb);
        }
      }

      return {
        orbCells: accessible,
        viableRatio: accessible.size / orbCells.size,
      };
    }

    computeTimedRouteWindows(slideGraph, collapseAt, start, exit) {
      const startKey = this.cellKey(start.x, start.y);
      const exitKey = this.cellKey(exit.x, exit.y);
      const epsilon = 0.0001;
      const earliestArrival = new Map([[startKey, 0]]);
      const frontier = [{ key: startKey, time: 0 }];

      while (frontier.length > 0) {
        frontier.sort((a, b) => a.time - b.time);
        const current = frontier.shift();
        if (current.time > earliestArrival.get(current.key)) {
          continue;
        }

        for (const segment of slideGraph.edgesFrom.get(current.key) || []) {
          const departureDeadline = this.getSegmentDepartureDeadline(collapseAt, segment);
          if (current.time > departureDeadline) {
            continue;
          }

          const nextTime = current.time + segment.duration;
          if (nextTime >= (earliestArrival.get(segment.toKey) ?? Infinity)) {
            continue;
          }

          earliestArrival.set(segment.toKey, nextTime);
          frontier.push({ key: segment.toKey, time: nextTime });
        }
      }

      const latestExit = new Map([
        [exitKey, collapseAt[exit.y][exit.x] - epsilon],
      ]);

      let changed = true;
      for (let pass = 0; pass < slideGraph.nodes.size * 4 && changed; pass += 1) {
        changed = false;
        for (const [fromKey, segments] of slideGraph.edgesFrom.entries()) {
          for (const segment of segments) {
            const targetLatest = latestExit.get(segment.toKey);
            if (targetLatest === undefined) {
              continue;
            }

            const departureDeadline = this.getSegmentDepartureDeadline(collapseAt, segment, targetLatest);
            if (departureDeadline <= (latestExit.get(fromKey) ?? -Infinity)) {
              continue;
            }

            latestExit.set(fromKey, departureDeadline);
            changed = true;
          }
        }
      }

      return {
        earliestArrival,
        latestExit,
      };
    }

    getSegmentDepartureDeadline(collapseAt, segment, targetLatest = Infinity) {
      if (segment.distance === 0) {
        return -Infinity;
      }

      const epsilon = 0.0001;
      const stepTime = segment.duration / segment.distance;
      let deadline = Math.min(
        collapseAt[segment.from.y][segment.from.x] - epsilon,
        targetLatest - segment.duration
      );

      for (let i = 0; i < segment.cells.length; i += 1) {
        const cell = segment.cells[i];
        deadline = Math.min(deadline, collapseAt[cell.y][cell.x] - (i + 1) * stepTime - epsilon);
      }

      return deadline;
    }

    isOrbAccessible(orb, slideGraph, collapseAt, routeWindows) {
      for (const [fromKey, segments] of slideGraph.edgesFrom.entries()) {
        const earliestStart = routeWindows.earliestArrival.get(fromKey);
        if (earliestStart === undefined) {
          continue;
        }

        for (const segment of segments) {
          const orbIndex = segment.cells.findIndex((cell) => cell.x === orb.x && cell.y === orb.y);
          if (orbIndex < 0) {
            continue;
          }

          const targetLatest = routeWindows.latestExit.get(segment.toKey);
          if (targetLatest === undefined) {
            continue;
          }

          const departureDeadline = this.getSegmentDepartureDeadline(collapseAt, segment, targetLatest);
          if (earliestStart <= departureDeadline) {
            return true;
          }
        }
      }

      return false;
    }

    findMaxCollapse(schedule) {
      let max = 0;
      for (const row of schedule) {
        for (const value of row) {
          if (Number.isFinite(value) && value > max) {
            max = value;
          }
        }
      }
      return max;
    }

    update(delta) {
      if (this.phase === "exiting") {
        this.updateExitEffect(delta);
        this.updateCamera();
        return;
      }

      if (this.phase === "won") {
        this.updateWinOverlay(delta);
        this.updateCamera();
        return;
      }

      if (this.phase === "dying") {
        this.updateDeathEffect(delta);
        this.updateCamera();
        return;
      }

      if (this.phase === "lost") {
        this.updateLoseOverlay(delta);
        this.updateCamera();
        return;
      }

      this.levelTime += delta;
      this.introFocusTime = Math.max(0, this.introFocusTime - delta);
      this.updateMovement(delta);
      this.updateImpact(delta);
      this.collectOrbIfNeeded();
      this.updateCamera();

      if (this.isCollapsed(this.player.x, this.player.y)) {
        this.beginLoseSequence();
        return;
      }

      if (this.player.x === this.levelData.exit.x && this.player.y === this.levelData.exit.y) {
        this.beginExitSequence();
        return;
      }

      this.updateHud();
    }

    queueMove(dx, dy) {
      if (window.__neonInstallLock || this.phase !== "playing" || this.moveState || this.pendingDirection) {
        return;
      }
      this.pendingDirection = { dx, dy };
      if (!this.moveState) {
        this.updateMovement(0);
      }
    }

    startSlide(dx, dy) {
      const path = this.findSlidePath(dx, dy);
      if (path.length <= 1) {
        this.triggerImpact(this.player.x, this.player.y, dx, dy, 0.42);
        return false;
      }

      const from = path[0];
      const to = path[path.length - 1];
      const distance = path.length - 1;
      const duration = this.getSlideDuration(distance);
      this.moveState = {
        from,
        to,
        dx,
        dy,
        distance,
        duration,
        stepTime: duration / distance,
        path,
        lastLogicalIndex: 0,
        progress: 0,
      };
      return true;
    }

    findSlidePath(dx, dy) {
      const rawPath = [{ x: this.player.x, y: this.player.y }];
      let currentX = this.player.x;
      let currentY = this.player.y;

      while (true) {
        const nextX = currentX + dx;
        const nextY = currentY + dy;
        if (!this.canMoveTo(nextX, nextY)) {
          break;
        }
        currentX = nextX;
        currentY = nextY;
        rawPath.push({ x: currentX, y: currentY });
      }

      if (rawPath.length <= 1) {
        return rawPath;
      }

      const distance = rawPath.length - 1;
      const stepTime = this.getSlideDuration(distance) / distance;
      const safePath = [rawPath[0]];
      for (let i = 1; i < rawPath.length; i += 1) {
        const cell = rawPath[i];
        if (this.levelTime + stepTime * i >= this.levelData.collapseAt[cell.y][cell.x]) {
          break;
        }
        safePath.push(cell);
      }

      if (safePath.length <= 1) {
        return [rawPath[0]];
      }

      const lastCell = safePath[safePath.length - 1];
      if (this.isCollapsed(lastCell.x, lastCell.y)) {
        return [rawPath[0]];
      }

      return safePath;
    }

    canMoveTo(x, y) {
      if (x < 0 || y < 0 || y >= this.levelData.rows || x >= this.levelData.cols) {
        return false;
      }
      if (this.levelData.grid[y][x] !== "floor") {
        return false;
      }
      return !this.isCollapsed(x, y);
    }

    collectOrbIfNeeded(x = this.player.x, y = this.player.y) {
      const key = `${x},${y}`;
      const orb = this.levelData.orbCells.get(key);
      if (!orb || orb.collected) {
        return;
      }

      orb.collected = true;
      this.levelOrbCount += 1;
      this.setStatusText(
        "Orb collected. Keep pushing upward before the maze gives way.",
        "Orb collected. Keep climbing."
      );
    }

    updateImpact(delta) {
      if (!this.impactEffect) {
        return;
      }

      this.impactEffect.time = Math.max(0, this.impactEffect.time - delta);
      if (this.impactEffect.time <= 0) {
        this.impactEffect = null;
      }
    }

    triggerImpact(x, y, dx, dy, strength) {
      this.impactEffect = {
        x,
        y,
        dx,
        dy,
        strength,
        time: BASE_CONFIG.impactDuration,
        duration: BASE_CONFIG.impactDuration,
      };
    }

    updateMovement(delta) {
      if (this.moveState) {
        this.moveState.progress = Math.min(1, this.moveState.progress + delta / this.moveState.duration);
        const eased = this.easeInOutCubic(this.moveState.progress);
        const flow = this.smoothPulse(this.moveState.progress) * 0.01;
        this.player.renderX = this.lerp(this.moveState.from.x, this.moveState.to.x, eased) + this.moveState.dy * flow;
        this.player.renderY = this.lerp(this.moveState.from.y, this.moveState.to.y, eased) - this.moveState.dx * flow;

        const elapsed = this.moveState.progress * this.moveState.duration;
        const logicalIndex = this.clamp(
          Math.floor(elapsed / this.moveState.stepTime + 0.0001),
          0,
          this.moveState.distance
        );

        if (logicalIndex > this.moveState.lastLogicalIndex) {
          for (let i = this.moveState.lastLogicalIndex + 1; i <= logicalIndex; i += 1) {
            const cell = this.moveState.path[i];
            this.player.x = cell.x;
            this.player.y = cell.y;
            this.collectOrbIfNeeded(cell.x, cell.y);
          }
          this.moveState.lastLogicalIndex = logicalIndex;
        }

        if (this.moveState.progress >= 1) {
          this.player.x = this.moveState.to.x;
          this.player.y = this.moveState.to.y;
          this.player.renderX = this.player.x;
          this.player.renderY = this.player.y;
          if (this.player.x === this.levelData.exit.x && this.player.y === this.levelData.exit.y) {
            this.moveState = null;
            this.beginExitSequence();
            return;
          }
          this.triggerImpact(this.player.x, this.player.y, this.moveState.dx, this.moveState.dy, 0.85);
          this.moveState = null;
        }
        return;
      }

      if (!this.pendingDirection) {
        this.player.renderX = this.player.x;
        this.player.renderY = this.player.y;
        return;
      }

      const { dx, dy } = this.pendingDirection;
      this.pendingDirection = null;
      this.startSlide(dx, dy);
    }

    beginExitSequence() {
      if (this.phase !== "playing") {
        return;
      }

      this.phase = "exiting";
      this.moveState = null;
      this.pendingDirection = null;
      this.impactEffect = null;
      this.exitEffect = {
        time: 0,
        duration: 0.5,
      };
      this.setStatusText(
        "Gate lock acquired. The cube is being pulled into the exit.",
        "Entering the gate."
      );
    }

    updateExitEffect(delta) {
      if (!this.exitEffect) {
        return;
      }

      this.exitEffect.time = Math.min(this.exitEffect.duration, this.exitEffect.time + delta);
      const progress = this.exitEffect.time / this.exitEffect.duration;
      const eased = this.easeInOutSine(progress);

      this.player.x = this.levelData.exit.x;
      this.player.y = this.levelData.exit.y;
      this.player.renderX = this.lerp(this.player.renderX, this.levelData.exit.x, 0.24 + eased * 0.14);
      this.player.renderY = this.lerp(this.player.renderY, this.levelData.exit.y, 0.24 + eased * 0.14);

      if (progress >= 1) {
        this.completeWinLevel();
      }
    }

    updateWinOverlay(delta) {
      this.winOverlayTime = Math.min(1.2, this.winOverlayTime + delta);
    }

    updateLoseOverlay(delta) {
      this.loseOverlayTime = Math.min(1.2, this.loseOverlayTime + delta);
    }

    beginLoseSequence() {
      if (this.phase !== "playing") {
        return;
      }

      this.phase = "dying";
      this.moveState = null;
      this.pendingDirection = null;
      this.impactEffect = null;
      this.exitEffect = null;
      this.deathEffect = {
        time: 0,
        duration: 0.58,
        shards: this.buildDeathShards(this.player.x, this.player.y),
      };
      this.hideMessage();
      this.setStatusText(
        "The collapse catches the cube and tears it apart in a flash.",
        "The collapse locks on."
      );
    }

    updateDeathEffect(delta) {
      if (!this.deathEffect) {
        return;
      }

      this.deathEffect.time = Math.min(this.deathEffect.duration, this.deathEffect.time + delta);
      if (this.deathEffect.time >= this.deathEffect.duration) {
        this.deathEffect = null;
        this.loseLevel();
      }
    }

    loseLevel() {
      this.phase = "lost";
      this.loseOverlayTime = 0;
      this.hideMessage();
      this.setStatusText(
        "The collapse got you. Reset and choose a cleaner line.",
        "The collapse got you."
      );
    }

    completeWinLevel() {
      this.phase = "won";
      this.exitEffect = null;
      this.winOverlayTime = 0;
      this.runOrbs += this.levelOrbCount;
      this.runValue.textContent = String(this.runOrbs).padStart(2, "0");
      this.hideMessage();
      this.setStatusText(
        "You made it through the collapse. The next maze will be denser and more unstable.",
        "Level complete."
      );
    }

    handleInterludeInput() {
      if (window.__neonInstallLock) {
        return;
      }

      if (this.phase === "won") {
        this.startLevel(this.level + 1);
      } else if (this.phase === "lost") {
        this.startLevel(this.level);
      }
    }

    updateHud() {
      const totalOrbs = this.levelData.orbCells.size;
      this.orbValue.textContent = `${String(this.levelOrbCount).padStart(2, "0")} / ${String(totalOrbs).padStart(2, "0")}`;
      this.runValue.textContent = String(this.runOrbs).padStart(2, "0");
      const ratio = this.clamp(this.levelTime / this.levelData.maxCollapseTime, 0, 1);
      this.dangerFill.style.width = `${ratio * 100}%`;
    }

    showMessage(title, text) {
      this.messageTitle.textContent = title;
      this.messageText.textContent = text;
      this.messagePanel.classList.remove("hidden");
    }

    hideMessage() {
      this.messagePanel.classList.add("hidden");
    }

    updateBoardMetrics() {
      const logicalWidth = this.canvas.width / this.pixelRatio;
      const logicalHeight = this.canvas.height / this.pixelRatio;
      const frameX = logicalWidth < 720 ? 12 : 24;
      const frameY = logicalHeight < 760 ? 12 : 24;
      const viewportWidth = logicalWidth - frameX * 2;
      const viewportHeight = logicalHeight - frameY * 2;
      const aspect = viewportWidth / Math.max(1, viewportHeight);
      const compactViewport = logicalWidth < 900 || logicalHeight < 900 || this.isCoarsePointer();
      let visibleCols;
      let visibleRows;

      if (aspect < 0.82) {
        visibleCols = compactViewport ? 4 : 5;
        visibleRows = compactViewport ? 7 : 8;
      } else if (aspect < 1.28) {
        visibleCols = compactViewport ? 5 : 6;
        visibleRows = compactViewport ? 6 : 7;
      } else {
        visibleCols = compactViewport ? 6 : 7;
        visibleRows = compactViewport ? 4 : 5;
      }

      const zoomScale = compactViewport ? 1.08 : 1.06;
      const cellSize = Math.max(
        compactViewport ? 18 : 22,
        Math.floor(
          Math.min(
            viewportWidth / visibleCols,
            viewportHeight / visibleRows
          ) * zoomScale
        )
      );

      this.boardMetrics = {
        cellSize,
        frameX,
        frameY,
        viewportWidth,
        viewportHeight,
        worldWidth: cellSize * this.levelData.cols,
        worldHeight: cellSize * this.levelData.rows,
      };
    }

    draw() {
      const ctx = this.ctx;
      const logicalWidth = this.canvas.width / this.pixelRatio;
      const logicalHeight = this.canvas.height / this.pixelRatio;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      this.drawBackdrop(ctx, logicalWidth, logicalHeight);
      const sceneAlpha = this.getSceneOpacity();
      ctx.save();
      ctx.globalAlpha = sceneAlpha;
      this.drawMaze(ctx);
      this.drawOrbs(ctx);
      this.drawExit(ctx);
      this.drawFocusMask(ctx);
      this.drawImpactEffect(ctx);
      this.drawPlayer(ctx);
      this.drawViewportFrame(ctx);
      ctx.restore();

      if (this.phase === "won") {
        this.drawWinOverlay(ctx, logicalWidth, logicalHeight);
      } else if (this.phase === "lost") {
        this.drawLoseOverlay(ctx, logicalWidth, logicalHeight);
      }
    }

    getSceneOpacity() {
      if (this.phase === "won") {
        const progress = this.easeOut(this.clamp(this.winOverlayTime / 0.5, 0, 1));
        return 1 - progress * 0.72;
      }

      if (this.phase === "lost") {
        const progress = this.easeOut(this.clamp(this.loseOverlayTime / 0.42, 0, 1));
        return 1 - progress * 0.82;
      }

      return 1;
    }

    drawBackdrop(ctx, width, height) {
      if (this.backdropCache) {
        ctx.drawImage(this.backdropCache, 0, 0, width, height);
      } else {
        ctx.fillStyle = "#010101";
        ctx.fillRect(0, 0, width, height);
      }
      this.drawAmbientField(ctx, width, height);
    }

    buildBackdropCache(width, height) {
      if (!width || !height) {
        this.backdropCache = null;
        return;
      }

      const cache = document.createElement("canvas");
      cache.width = Math.max(1, Math.floor(width));
      cache.height = Math.max(1, Math.floor(height));
      const cacheCtx = cache.getContext("2d");

      if (!cacheCtx) {
        this.backdropCache = null;
        return;
      }

      cacheCtx.fillStyle = "#010101";
      cacheCtx.fillRect(0, 0, cache.width, cache.height);

      const bloomAlpha = this.performanceProfile.backdropGlowAlpha;
      const gradient = cacheCtx.createRadialGradient(
        cache.width * 0.5,
        cache.height * 0.42,
        20,
        cache.width * 0.5,
        cache.height * 0.5,
        cache.height * 0.92
      );
      gradient.addColorStop(0, `rgba(255,255,255,${0.035 * bloomAlpha})`);
      gradient.addColorStop(0.55, `rgba(255,255,255,${0.015 * bloomAlpha})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      cacheCtx.fillStyle = gradient;
      cacheCtx.fillRect(0, 0, cache.width, cache.height);

      const lowerGlow = cacheCtx.createRadialGradient(
        cache.width * 0.78,
        cache.height * 0.8,
        0,
        cache.width * 0.78,
        cache.height * 0.8,
        Math.max(cache.width, cache.height) * 0.45
      );
      lowerGlow.addColorStop(0, `rgba(255,255,255,${0.02 * bloomAlpha})`);
      lowerGlow.addColorStop(1, "rgba(0,0,0,0)");
      cacheCtx.fillStyle = lowerGlow;
      cacheCtx.fillRect(0, 0, cache.width, cache.height);

      const vignette = cacheCtx.createRadialGradient(
        cache.width * 0.5,
        cache.height * 0.5,
        Math.min(cache.width, cache.height) * 0.32,
        cache.width * 0.5,
        cache.height * 0.5,
        Math.max(cache.width, cache.height) * 0.78
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(0.62, "rgba(0,0,0,0.2)");
      vignette.addColorStop(1, "rgba(0,0,0,0.5)");
      cacheCtx.fillStyle = vignette;
      cacheCtx.fillRect(0, 0, cache.width, cache.height);

      this.backdropCache = cache;
    }

    buildFocusMaskCache(width, height) {
      if (!width || !height) {
        this.focusMaskCache = null;
        return;
      }

      const cache = document.createElement("canvas");
      cache.width = Math.max(1, Math.floor(width));
      cache.height = Math.max(1, Math.floor(height));
      const cacheCtx = cache.getContext("2d");

      if (!cacheCtx) {
        this.focusMaskCache = null;
        return;
      }

      const gradient = cacheCtx.createRadialGradient(
        cache.width * 0.5,
        cache.height * 0.5,
        Math.min(cache.width, cache.height) * 0.16,
        cache.width * 0.5,
        cache.height * 0.5,
        Math.max(cache.width, cache.height) * 0.72
      );
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.56, "rgba(0,0,0,0.14)");
      gradient.addColorStop(1, "rgba(0,0,0,0.62)");

      cacheCtx.fillStyle = gradient;
      cacheCtx.fillRect(0, 0, cache.width, cache.height);
      this.focusMaskCache = cache;
    }

    buildAmbientField(seed) {
      const rng = new RNG(seed ^ 0xa53c9e17);
      const coarse = this.performanceProfile.isTouch;
      const count = this.performanceProfile.ambientParticleCount;
      const field = [];

      for (let i = 0; i < count; i += 1) {
        field.push({
          x: rng.next(),
          y: rng.next(),
          length: 10 + rng.next() * (coarse ? 11 : 18),
          drift: 5 + rng.next() * (coarse ? 9 : 12),
          speed: 0.14 + rng.next() * (coarse ? 0.2 : 0.26),
          alpha: 0.012 + rng.next() * (coarse ? 0.02 : 0.028),
          phase: rng.next() * Math.PI * 2,
          depth: 0.25 + rng.next() * 0.9,
          angle: -0.55 + (rng.next() - 0.5) * 0.22,
        });
      }

      return field;
    }

    buildDeathShards(x, y) {
      const seed =
        (this.levelData.seed ^ Math.imul(x + 17, 73856093) ^ Math.imul(y + 23, 19349663)) >>> 0;
      const rng = new RNG(seed);
      const shards = [];

      for (let i = 0; i < 10; i += 1) {
        shards.push({
          angle: rng.next() * Math.PI * 2,
          distance: 0.28 + rng.next() * 0.42,
          width: 0.08 + rng.next() * 0.08,
          height: 0.04 + rng.next() * 0.06,
          spin: (rng.next() - 0.5) * 3.4,
          delay: rng.next() * 0.16,
        });
      }

      return shards;
    }

    drawAmbientField(ctx, width, height) {
      const particles = this.ambientField || [];
      if (particles.length === 0) {
        return;
      }

      const time = this.levelTime || 0;
      const parallaxX = (this.camera?.x || 0) * 0.028;
      const parallaxY = (this.camera?.y || 0) * 0.028;

      ctx.save();
      ctx.lineCap = "round";

      for (const particle of particles) {
        const px =
          particle.x * width +
          Math.sin(time * particle.speed + particle.phase) * particle.drift -
          parallaxX * particle.depth;
        const py =
          particle.y * height +
          Math.cos(time * (particle.speed * 0.9) + particle.phase) * particle.drift * 0.75 -
          parallaxY * particle.depth;
        const alpha = particle.alpha * (0.78 + Math.sin(time * (particle.speed * 1.4) + particle.phase) * 0.18);
        const dx = Math.cos(particle.angle) * particle.length * 0.5;
        const dy = Math.sin(particle.angle) * particle.length * 0.5;

        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - dx, py - dy);
        ctx.lineTo(px + dx, py + dy);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawMaze(ctx) {
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const pulse = 0.72 + Math.sin(this.levelTime * 2.8) * 0.12;
      const wallCells = [];
      const warningWallCells = [];

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();

      const visible = this.getVisibleRange();
      for (let y = visible.startY; y <= visible.endY; y += 1) {
        for (let x = visible.startX; x <= visible.endX; x += 1) {
          const position = this.toScreen(x, y);
          const px = position.x;
          const py = position.y;
          const collapsed = this.isCollapsed(x, y);
          const warning = this.isWarning(x, y);
          const type = this.levelData.grid[y][x];

          if (collapsed) {
            ctx.fillStyle = "rgba(0,0,0,0.94)";
            ctx.fillRect(px, py, cellSize, cellSize);
            continue;
          }

          if (type === "wall") {
            wallCells.push({ x, y, px, py });
            if (warning) {
              warningWallCells.push({ x, y, px, py });
            }
            continue;
          }

          ctx.fillStyle = warning ? `rgba(255,255,255,${0.06 + pulse * 0.04})` : "rgba(255,255,255,0.028)";
          ctx.fillRect(px, py, cellSize, cellSize);

          if (warning) {
            ctx.strokeStyle = `rgba(255,255,255,${0.12 + pulse * 0.16})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
          }
        }
      }

      this.drawWallMass(ctx, wallCells, warningWallCells, cellSize, pulse);
      ctx.restore();
    }

    drawOrbs(ctx) {
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const pulse = 0.78 + Math.sin(this.levelTime * 3.6) * 0.08;
      const glowStrength = this.performanceProfile.glowStrength;

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();

      for (const orb of this.levelData.orbCells.values()) {
        if (orb.collected || this.isCollapsed(orb.x, orb.y)) {
          continue;
        }

        const position = this.toScreen(orb.x, orb.y);
        const cx = position.x + cellSize / 2;
        const cy = position.y + cellSize / 2;
        const radius = Math.max(1.9, cellSize * 0.12);

        ctx.save();
        if (glowStrength > 0) {
          ctx.shadowBlur = 10 * glowStrength;
          ctx.shadowColor = `rgba(255,255,255,${0.45 + glowStrength * 0.55})`;
        }
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    drawExit(ctx) {
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const enterBoost = this.exitEffect ? this.easeInOutSine(this.exitEffect.time / this.exitEffect.duration) : 0;
      const pulse = 0.82 + Math.sin(this.levelTime * (3.4 + enterBoost * 5)) * 0.08 + enterBoost * 0.18;
      const shimmer = (this.levelTime * (0.95 + enterBoost * 1.6)) % 1;
      const glowStrength = this.performanceProfile.glowStrength;
      const reducedEffects = this.performanceProfile.reducedEffects;

      if (this.isCollapsed(this.levelData.exit.x, this.levelData.exit.y)) {
        return;
      }

      const position = this.toScreen(this.levelData.exit.x, this.levelData.exit.y);
      const x = position.x;
      const y = position.y;

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();

      const outerInset = cellSize * 0.14;
      const innerInset = cellSize * 0.27;
      const frameWidth = cellSize - outerInset * 2;
      const frameHeight = cellSize - outerInset * 2;
      const coreWidth = cellSize - innerInset * 2;
      const coreHeight = cellSize - innerInset * 2;
      const aura = 0.18 + pulse * 0.1 + enterBoost * 0.12;

      ctx.save();
      if (glowStrength > 0) {
        ctx.shadowBlur = 20 * glowStrength;
        ctx.shadowColor = `rgba(255,255,255,${0.48 + glowStrength * 0.42})`;
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.86 + pulse * 0.08})`;
      ctx.lineWidth = Math.max(2, cellSize * 0.075);
      ctx.strokeRect(x + outerInset, y + outerInset, frameWidth, frameHeight);
      ctx.restore();

      ctx.save();
      if (glowStrength > 0) {
        ctx.shadowBlur = 14 * glowStrength;
        ctx.shadowColor = `rgba(255,255,255,${0.18 + glowStrength * 0.24})`;
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.34 + pulse * 0.12})`;
      ctx.lineWidth = Math.max(1, cellSize * 0.045);
      ctx.strokeRect(x + innerInset, y + innerInset, coreWidth, coreHeight);
      ctx.restore();

      if (enterBoost > 0 && !reducedEffects) {
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(255,255,255,0.72)";
        ctx.strokeStyle = `rgba(255,255,255,${0.22 + enterBoost * 0.26})`;
        ctx.lineWidth = Math.max(1, cellSize * 0.055);
        const haloInset = outerInset - cellSize * (0.05 + enterBoost * 0.08);
        ctx.strokeRect(
          x + haloInset,
          y + haloInset,
          cellSize - haloInset * 2,
          cellSize - haloInset * 2
        );
        ctx.restore();
      }

      ctx.fillStyle = `rgba(255,255,255,${aura})`;
      ctx.fillRect(x + innerInset, y + innerInset, coreWidth, coreHeight);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + innerInset, y + innerInset, coreWidth, coreHeight);
      ctx.clip();

      for (let i = 0; i < 3; i += 1) {
        const bandProgress = (shimmer + i / 3) % 1;
        const bandY = y + innerInset + bandProgress * coreHeight;
        const bandHeight = Math.max(1.5, cellSize * 0.065);
        const bandAlpha = 0.14 + (1 - bandProgress) * 0.16;
        ctx.fillStyle = `rgba(255,255,255,${bandAlpha})`;
        ctx.fillRect(x + innerInset, bandY - bandHeight * 0.5, coreWidth, bandHeight);
      }

      ctx.restore();

      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.28 + pulse * 0.08})`;
      ctx.lineWidth = Math.max(1, cellSize * 0.04);
      const corner = cellSize * 0.15;
      ctx.beginPath();
      ctx.moveTo(x + outerInset, y + outerInset + corner);
      ctx.lineTo(x + outerInset, y + outerInset);
      ctx.lineTo(x + outerInset + corner, y + outerInset);
      ctx.moveTo(x + cellSize - outerInset - corner, y + outerInset);
      ctx.lineTo(x + cellSize - outerInset, y + outerInset);
      ctx.lineTo(x + cellSize - outerInset, y + outerInset + corner);
      ctx.moveTo(x + outerInset, y + cellSize - outerInset - corner);
      ctx.lineTo(x + outerInset, y + cellSize - outerInset);
      ctx.lineTo(x + outerInset + corner, y + cellSize - outerInset);
      ctx.moveTo(x + cellSize - outerInset - corner, y + cellSize - outerInset);
      ctx.lineTo(x + cellSize - outerInset, y + cellSize - outerInset);
      ctx.lineTo(x + cellSize - outerInset, y + cellSize - outerInset - corner);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    drawPlayer(ctx) {
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const position = this.toScreen(this.player.renderX, this.player.renderY);
      const centerX = position.x + cellSize / 2;
      const centerY = position.y + cellSize / 2;
      const size = cellSize * 0.48;
      const reducedEffects = this.performanceProfile.reducedEffects;
      const glowStrength = this.performanceProfile.glowStrength;
      const trailStrength = this.performanceProfile.trailStrength;

      if (this.deathEffect) {
        this.drawPlayerDeath(ctx, centerX, centerY, size, frameX, frameY, viewportWidth, viewportHeight, cellSize);
        return;
      }

      if (this.phase === "lost") {
        return;
      }

      let pulse = 0.93 + Math.sin(this.levelTime * 2.4) * 0.025;
      let scaleX = 1;
      let scaleY = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (this.moveState) {
        const envelope = this.smoothPulse(this.moveState.progress);
        const stretch = 1 + envelope * 0.09;
        const squeeze = 1 - envelope * 0.045;
        scaleX = this.moveState.dx !== 0 ? stretch : squeeze;
        scaleY = this.moveState.dy !== 0 ? stretch : squeeze;
        if (this.moveState.dx === 0) {
          scaleX = squeeze;
        }
        if (this.moveState.dy === 0) {
          scaleY = squeeze;
        }
      }

      if (this.impactEffect) {
        const impactProgress = 1 - this.impactEffect.time / this.impactEffect.duration;
        const burst = this.springOut(impactProgress) * this.impactEffect.strength;
        offsetX -= this.impactEffect.dx * cellSize * 0.06 * burst;
        offsetY -= this.impactEffect.dy * cellSize * 0.06 * burst;
        if (this.impactEffect.dx !== 0) {
          scaleX *= 1 - burst * 0.18;
          scaleY *= 1 + burst * 0.12;
        } else {
          scaleY *= 1 - burst * 0.18;
          scaleX *= 1 + burst * 0.12;
        }
      }

      if (this.exitEffect) {
        const enter = this.easeInOutSine(this.exitEffect.time / this.exitEffect.duration);
        const collapse = 1 - enter * 0.72;
        scaleX *= collapse;
        scaleY *= collapse;
        pulse += enter * 0.12;
      }

      const width = size * scaleX;
      const height = size * scaleY;
      const px = centerX - width / 2 + offsetX;
      const py = centerY - height / 2 + offsetY;
      const auraPulse = 0.84 + Math.sin(this.levelTime * 3.2) * 0.16;

      if (this.moveState && !this.exitEffect && trailStrength > 0) {
        const trail = this.smoothPulse(this.moveState.progress) * cellSize * 0.12;
        const trailWidth = width + Math.abs(this.moveState.dx) * trail;
        const trailHeight = height + Math.abs(this.moveState.dy) * trail;
        const trailX = px - this.moveState.dx * trail * 0.7;
        const trailY = py - this.moveState.dy * trail * 0.7;

        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
        ctx.clip();
        ctx.shadowBlur = 14 * trailStrength;
        ctx.shadowColor = `rgba(255,255,255,${0.16 + trailStrength * 0.18})`;
        ctx.fillStyle = `rgba(255,255,255,${0.04 + trailStrength * 0.06})`;
        ctx.fillRect(trailX, trailY, trailWidth, trailHeight);
        ctx.restore();
      }

      if (this.exitEffect && !reducedEffects) {
        const enter = this.easeInOutSine(this.exitEffect.time / this.exitEffect.duration);
        const wellRadius = cellSize * (0.2 + enter * 0.34);
        const well = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, wellRadius);
        well.addColorStop(0, `rgba(255,255,255,${0.28 + enter * 0.24})`);
        well.addColorStop(1, "rgba(255,255,255,0)");

        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
        ctx.clip();
        ctx.fillStyle = well;
        ctx.fillRect(centerX - wellRadius, centerY - wellRadius, wellRadius * 2, wellRadius * 2);
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();
      if (glowStrength > 0) {
        const auraRadius = Math.max(width, height) * (1.45 + auraPulse * 0.22);
        const aura = ctx.createRadialGradient(centerX + offsetX, centerY + offsetY, 0, centerX + offsetX, centerY + offsetY, auraRadius);
        aura.addColorStop(0, `rgba(255,255,255,${0.2 + glowStrength * 0.14})`);
        aura.addColorStop(0.38, `rgba(255,255,255,${0.09 + glowStrength * 0.08})`);
        aura.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = aura;
        ctx.fillRect(centerX + offsetX - auraRadius, centerY + offsetY - auraRadius, auraRadius * 2, auraRadius * 2);
      }
      if (glowStrength > 0) {
        ctx.shadowBlur = 16 * glowStrength;
        ctx.shadowColor = `rgba(255,255,255,${0.52 + glowStrength * 0.48})`;
      }
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      ctx.fillRect(px, py, width, height);
      ctx.restore();
    }

    drawPlayerDeath(ctx, centerX, centerY, size, frameX, frameY, viewportWidth, viewportHeight, cellSize) {
      const progress = this.clamp(this.deathEffect.time / this.deathEffect.duration, 0, 1);
      const implode = this.easeInOutSine(Math.min(1, progress * 1.08));
      const flash = 1 - progress;
      const coreScale = 1 - implode * 0.92;
      const coreSize = Math.max(cellSize * 0.045, size * coreScale);
      const ringRadius = cellSize * (0.08 + progress * 0.44);
      const wellRadius = cellSize * (0.16 + progress * 0.38);
      const reducedEffects = this.performanceProfile.reducedEffects;
      const glowStrength = this.performanceProfile.glowStrength;

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();

      if (!reducedEffects) {
        const well = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, wellRadius);
        well.addColorStop(0, `rgba(0,0,0,${0.22 + progress * 0.44})`);
        well.addColorStop(0.68, `rgba(0,0,0,${0.08 + progress * 0.18})`);
        well.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = well;
        ctx.fillRect(centerX - wellRadius, centerY - wellRadius, wellRadius * 2, wellRadius * 2);
      }

      if (progress < 0.88) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(progress * 0.36);
        if (glowStrength > 0) {
          ctx.shadowBlur = 12 * glowStrength;
          ctx.shadowColor = `rgba(255,255,255,${0.14 + glowStrength * (0.18 + flash * 0.22)})`;
        }
        ctx.fillStyle = `rgba(255,255,255,${0.28 + flash * 0.62})`;
        ctx.fillRect(-coreSize / 2, -coreSize / 2, coreSize, coreSize);
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + flash * 0.34})`;
      ctx.lineWidth = Math.max(1, cellSize * 0.034);
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      for (const shard of this.deathEffect.shards) {
        const local = this.clamp((progress - shard.delay) / (1 - shard.delay), 0, 1);
        if (local <= 0) {
          continue;
        }

        const travel = cellSize * shard.distance * this.easeOut(local);
        const shardX = centerX + Math.cos(shard.angle) * travel;
        const shardY = centerY + Math.sin(shard.angle) * travel;
        const width = cellSize * shard.width * (1 - local * 0.3);
        const height = cellSize * shard.height * (1 - local * 0.22);
        const alpha = (1 - local) * (0.32 + flash * 0.34);

        ctx.save();
        ctx.translate(shardX, shardY);
        ctx.rotate(shard.angle + shard.spin * local);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.restore();
      }

      ctx.restore();
    }

    drawFocusMask(ctx) {
      if (!this.performanceProfile.dynamicFocusMask) {
        if (!this.focusMaskCache) {
          return;
        }

        const { frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
        ctx.clip();
        ctx.globalAlpha = 0.94;
        ctx.drawImage(this.focusMaskCache, 0, 0, viewportWidth + frameX * 2, viewportHeight + frameY * 2);
        ctx.restore();
        return;
      }

      const { frameX, frameY, viewportWidth, viewportHeight, cellSize } = this.boardMetrics;
      const playerPos = this.toScreen(this.player.renderX, this.player.renderY);
      const centerX = playerPos.x + cellSize / 2;
      const centerY = playerPos.y + cellSize / 2;
      const intro = this.clamp(this.introFocusTime / BASE_CONFIG.introFocusDuration, 0, 1);
      const innerRadius = cellSize * (0.88 + intro * 0.14);
      const outerRadius = Math.max(viewportWidth, viewportHeight) * (0.24 + (1 - intro) * 0.07);
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        innerRadius,
        centerX,
        centerY,
        outerRadius
      );
      gradient.addColorStop(0, `rgba(0,0,0,${0.02 + intro * 0.04})`);
      gradient.addColorStop(0.36, `rgba(0,0,0,${0.24 + intro * 0.18})`);
      gradient.addColorStop(1, `rgba(0,0,0,${0.82 + intro * 0.08})`);

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fillRect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.restore();
    }

    drawWinOverlay(ctx, width, height) {
      const progress = this.easeOut(this.clamp(this.winOverlayTime / 0.5, 0, 1));
      const pulse = 0.78 + Math.sin((this.levelTime + this.winOverlayTime) * 4.2) * 0.08;
      const prompt = this.isCoarsePointer() ? "Tap for the next level" : "Press for the next level";
      const title = `Level ${String(this.level).padStart(2, "0")} complete`;
      const { frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;

      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.34 + progress * 0.34})`;
      ctx.fillRect(0, 0, width, height);

      const cardWidth = Math.min(viewportWidth * 0.82, 420);
      const cardHeight = Math.min(viewportHeight * 0.32, 180);
      const cardX = frameX + (viewportWidth - cardWidth) / 2;
      const cardY = frameY + (viewportHeight - cardHeight) / 2;
      const translateY = (1 - progress) * 16;

      ctx.translate(0, translateY);
      ctx.globalAlpha = 0.2 + progress * 0.8;
      ctx.fillStyle = "rgba(8,8,8,0.76)";
      if (!this.performanceProfile.reducedEffects) {
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = "rgba(255,255,255,0.16)";
        this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 22);
        ctx.fill();
        ctx.restore();
      } else {
        this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 22);
        ctx.fill();
      }

      ctx.strokeStyle = `rgba(255,255,255,${0.18 + progress * 0.18})`;
      ctx.lineWidth = 1;
      this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 22);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255,255,255,${0.78 + progress * 0.18})`;
      ctx.font = `700 ${Math.max(16, Math.min(28, cardWidth * 0.065))}px ${this.getDisplayFont()}`;
      ctx.fillText(title, cardX + cardWidth / 2, cardY + cardHeight * 0.34);

      ctx.fillStyle = `rgba(255,255,255,${0.54 + pulse * 0.18})`;
      ctx.font = `600 ${Math.max(12, Math.min(19, cardWidth * 0.045))}px ${this.getUiFont()}`;
      ctx.fillText(prompt, cardX + cardWidth / 2, cardY + cardHeight * 0.63);

      const lineWidth = cardWidth * 0.34;
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + pulse * 0.18})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + (cardWidth - lineWidth) / 2, cardY + cardHeight * 0.78);
      ctx.lineTo(cardX + (cardWidth + lineWidth) / 2, cardY + cardHeight * 0.78);
      ctx.stroke();
      ctx.restore();
    }

    drawLoseOverlay(ctx, width, height) {
      const progress = this.easeOut(this.clamp(this.loseOverlayTime / 0.42, 0, 1));
      const pulse = 0.74 + Math.sin((this.levelTime + this.loseOverlayTime) * 4.8) * 0.06;
      const prompt = this.isCoarsePointer() ? "Tap to retry" : "Press to retry";
      const title = "Collapsed";
      const subtitle = `${String(this.levelOrbCount).padStart(2, "0")} orbs recovered`;
      const { frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;

      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.42 + progress * 0.4})`;
      ctx.fillRect(0, 0, width, height);

      const cardWidth = Math.min(viewportWidth * 0.82, 420);
      const cardHeight = Math.min(viewportHeight * 0.34, 190);
      const cardX = frameX + (viewportWidth - cardWidth) / 2;
      const cardY = frameY + (viewportHeight - cardHeight) / 2;
      const translateY = (1 - progress) * 18;

      ctx.translate(0, translateY);
      ctx.globalAlpha = 0.2 + progress * 0.8;
      ctx.fillStyle = "rgba(8,8,8,0.84)";
      this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 22);
      ctx.fill();

      ctx.strokeStyle = `rgba(255,255,255,${0.16 + progress * 0.14})`;
      ctx.lineWidth = 1;
      this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 22);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255,255,255,${0.84 + progress * 0.12})`;
      ctx.font = `700 ${Math.max(18, Math.min(30, cardWidth * 0.07))}px ${this.getDisplayFont()}`;
      ctx.fillText(title, cardX + cardWidth / 2, cardY + cardHeight * 0.32);

      ctx.fillStyle = `rgba(255,255,255,${0.42 + progress * 0.18})`;
      ctx.font = `600 ${Math.max(11, Math.min(17, cardWidth * 0.04))}px ${this.getUiFont()}`;
      ctx.fillText(subtitle, cardX + cardWidth / 2, cardY + cardHeight * 0.52);

      ctx.fillStyle = `rgba(255,255,255,${0.58 + pulse * 0.18})`;
      ctx.font = `600 ${Math.max(12, Math.min(19, cardWidth * 0.045))}px ${this.getUiFont()}`;
      ctx.fillText(prompt, cardX + cardWidth / 2, cardY + cardHeight * 0.72);

      const lineWidth = cardWidth * 0.28;
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + pulse * 0.16})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + (cardWidth - lineWidth) / 2, cardY + cardHeight * 0.82);
      ctx.lineTo(cardX + (cardWidth + lineWidth) / 2, cardY + cardHeight * 0.82);
      ctx.stroke();
      ctx.restore();
    }

    drawViewportFrame(ctx) {
      const { frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;

      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(frameX, frameY, viewportWidth, viewportHeight);

      const corner = 16;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.moveTo(frameX, frameY + corner);
      ctx.lineTo(frameX, frameY);
      ctx.lineTo(frameX + corner, frameY);
      ctx.moveTo(frameX + viewportWidth - corner, frameY);
      ctx.lineTo(frameX + viewportWidth, frameY);
      ctx.lineTo(frameX + viewportWidth, frameY + corner);
      ctx.moveTo(frameX, frameY + viewportHeight - corner);
      ctx.lineTo(frameX, frameY + viewportHeight);
      ctx.lineTo(frameX + corner, frameY + viewportHeight);
      ctx.moveTo(frameX + viewportWidth - corner, frameY + viewportHeight);
      ctx.lineTo(frameX + viewportWidth, frameY + viewportHeight);
      ctx.lineTo(frameX + viewportWidth, frameY + viewportHeight - corner);
      ctx.stroke();
    }

    drawWallMass(ctx, wallCells, warningWallCells, cellSize, pulse) {
      if (wallCells.length === 0) {
        return;
      }

      const bodyWidth = Math.max(3.2, cellSize * 0.102);

      const strokeWallSet = (cells, width, color) => {
        if (cells.length === 0) {
          return;
        }

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (const cell of cells) {
          this.traceWallCellPath(ctx, cell.x, cell.y, cell.px, cell.py, cellSize, width);
        }
        ctx.stroke();
        ctx.restore();
      };

      strokeWallSet(wallCells, bodyWidth, "rgba(255,255,255,0.82)");

      if (warningWallCells.length > 0) {
        strokeWallSet(
          warningWallCells,
          bodyWidth,
          `rgba(255,255,255,${0.84 + pulse * 0.08})`
        );
      }
    }

    traceWallCellPath(ctx, x, y, px, py, cellSize, width) {
      const left = this.isWallCell(x - 1, y);
      const right = this.isWallCell(x + 1, y);
      const up = this.isWallCell(x, y - 1);
      const down = this.isWallCell(x, y + 1);
      const cx = px + cellSize / 2;
      const cy = py + cellSize / 2;
      const isolated = !left && !right && !up && !down;

      if (left || right) {
        ctx.moveTo(left ? px : cx, cy);
        ctx.lineTo(right ? px + cellSize : cx, cy);
      }

      if (up || down) {
        ctx.moveTo(cx, up ? py : cy);
        ctx.lineTo(cx, down ? py + cellSize : cy);
      }

      if (isolated) {
        const radius = Math.max(width * 0.5, 1);
        ctx.moveTo(cx + radius, cy);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      }
    }

    drawWallLine(ctx, x, y, px, py, cellSize, warning, pulse) {
      const left = this.isWallCell(x - 1, y);
      const right = this.isWallCell(x + 1, y);
      const up = this.isWallCell(x, y - 1);
      const down = this.isWallCell(x, y + 1);
      const thickness = Math.max(2, Math.round(cellSize * 0.13));
      const center = Math.floor((cellSize - thickness) / 2);
      const glowAlpha = warning ? 0.22 + pulse * 0.08 : 0.14;
      const coreAlpha = warning ? 0.9 + pulse * 0.04 : 0.86;
      const shadow = warning ? 16 : 11;

      const drawSegments = (alpha) => {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;

        if (left || right) {
          const startX = left ? 0 : center;
          const endX = right ? cellSize : center + thickness;
          ctx.fillRect(px + startX, py + center, endX - startX, thickness);
        }

        if (up || down) {
          const startY = up ? 0 : center;
          const endY = down ? cellSize : center + thickness;
          ctx.fillRect(px + center, py + startY, thickness, endY - startY);
        }

        if (!left && !right && !up && !down) {
          ctx.fillRect(px + cellSize * 0.24, py + center, cellSize * 0.52, thickness);
        } else {
          ctx.fillRect(px + center, py + center, thickness, thickness);
        }
      };

      ctx.save();
      ctx.shadowBlur = shadow;
      ctx.shadowColor = "rgba(255,255,255,0.62)";
      drawSegments(glowAlpha);
      ctx.restore();

      ctx.save();
      drawSegments(coreAlpha);
      ctx.restore();
    }

    drawImpactEffect(ctx) {
      if (!this.impactEffect) {
        return;
      }

      const { frameX, frameY, viewportWidth, viewportHeight, cellSize } = this.boardMetrics;
      const progress = 1 - this.impactEffect.time / this.impactEffect.duration;
      const burst = this.springOut(progress) * this.impactEffect.strength;
      const position = this.toScreen(this.impactEffect.x, this.impactEffect.y);
      const centerX = position.x + cellSize / 2 + this.impactEffect.dx * cellSize * 0.34;
      const centerY = position.y + cellSize / 2 + this.impactEffect.dy * cellSize * 0.34;
      const span = cellSize * (0.16 + burst * 0.18);
      const cross = cellSize * (0.04 + burst * 0.06);
      const glowStrength = this.performanceProfile.glowStrength;

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + burst * 0.16})`;
      ctx.lineWidth = Math.max(1, cellSize * 0.05);
      if (glowStrength > 0) {
        ctx.shadowBlur = 10 * glowStrength;
        ctx.shadowColor = `rgba(255,255,255,${0.18 + glowStrength * 0.27})`;
      }
      ctx.beginPath();
      if (this.impactEffect.dx !== 0) {
        ctx.moveTo(centerX, centerY - span);
        ctx.lineTo(centerX, centerY + span);
        ctx.moveTo(centerX - cross, centerY - span * 0.55);
        ctx.lineTo(centerX + cross, centerY - span * 0.55);
        ctx.moveTo(centerX - cross, centerY + span * 0.55);
        ctx.lineTo(centerX + cross, centerY + span * 0.55);
      } else {
        ctx.moveTo(centerX - span, centerY);
        ctx.lineTo(centerX + span, centerY);
        ctx.moveTo(centerX - span * 0.55, centerY - cross);
        ctx.lineTo(centerX - span * 0.55, centerY + cross);
        ctx.moveTo(centerX + span * 0.55, centerY - cross);
        ctx.lineTo(centerX + span * 0.55, centerY + cross);
      }
      ctx.stroke();
      ctx.restore();
    }

    isWarning(x, y) {
      const collapseTime = this.levelData.collapseAt[y][x];
      return this.levelTime >= collapseTime - BASE_CONFIG.warningWindow && this.levelTime < collapseTime;
    }

    isCollapsed(x, y) {
      return this.levelTime >= this.levelData.collapseAt[y][x];
    }

    isWallCell(x, y) {
      return (
        x >= 0 &&
        y >= 0 &&
        y < this.levelData.rows &&
        x < this.levelData.cols &&
        this.levelData.grid[y][x] === "wall" &&
        !this.isCollapsed(x, y)
      );
    }

    resetCamera() {
      const target = this.getCameraTarget();
      this.camera.x = target.x;
      this.camera.y = target.y;
      this.cameraVelocity.x = 0;
      this.cameraVelocity.y = 0;
    }

    updateCamera() {
      const target = this.getCameraTarget();
      const delta = Math.max(0.001, Math.min(0.05, this.lastDelta || 1 / 60));
      const stiffness = this.moveState ? 15.5 : this.introFocusTime > 0 ? 13.5 : 10.5;
      const damping = 0.82;
      this.cameraVelocity.x = (this.cameraVelocity.x + (target.x - this.camera.x) * stiffness * delta) * damping;
      this.cameraVelocity.y = (this.cameraVelocity.y + (target.y - this.camera.y) * stiffness * delta) * damping;
      this.camera.x += this.cameraVelocity.x;
      this.camera.y += this.cameraVelocity.y;
    }

    getCameraTarget() {
      const { cellSize, viewportWidth, viewportHeight, worldWidth, worldHeight } = this.boardMetrics;
      const playerCenterX = (this.player.renderX + 0.5) * cellSize;
      const playerCenterY = (this.player.renderY + 0.5) * cellSize;
      let lookAheadX = 0;
      let lookAheadY = 0;

      if (this.moveState) {
        const lookAheadFactor = Math.sin(this.moveState.progress * Math.PI * 0.5);
        const lookAheadCells = Math.min(0.95, 0.38 + this.moveState.distance * 0.04);
        lookAheadX += this.moveState.dx * cellSize * lookAheadCells * lookAheadFactor;
        lookAheadY += this.moveState.dy * cellSize * lookAheadCells * lookAheadFactor;
      }

      if (this.impactEffect) {
        const impactBlend = this.springOut(1 - this.impactEffect.time / this.impactEffect.duration) * 0.16;
        lookAheadX -= this.impactEffect.dx * cellSize * impactBlend;
        lookAheadY -= this.impactEffect.dy * cellSize * impactBlend;
      }

      return {
        x: this.clamp(playerCenterX + lookAheadX - viewportWidth / 2, 0, Math.max(0, worldWidth - viewportWidth)),
        y: this.clamp(playerCenterY + lookAheadY - viewportHeight / 2, 0, Math.max(0, worldHeight - viewportHeight)),
      };
    }

    getVisibleRange() {
      const { cellSize, viewportWidth, viewportHeight } = this.boardMetrics;
      return {
        startX: this.clamp(Math.floor(this.camera.x / cellSize) - 2, 0, this.levelData.cols - 1),
        endX: this.clamp(Math.ceil((this.camera.x + viewportWidth) / cellSize) + 2, 0, this.levelData.cols - 1),
        startY: this.clamp(Math.floor(this.camera.y / cellSize) - 2, 0, this.levelData.rows - 1),
        endY: this.clamp(Math.ceil((this.camera.y + viewportHeight) / cellSize) + 2, 0, this.levelData.rows - 1),
      };
    }

    toScreen(cellX, cellY) {
      const { cellSize, frameX, frameY } = this.boardMetrics;
      return {
        x: frameX + cellX * cellSize - this.camera.x,
        y: frameY + cellY * cellSize - this.camera.y,
      };
    }

    roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    toOdd(value) {
      return value % 2 === 0 ? value + 1 : value;
    }

    closestOdd(value) {
      return value % 2 === 0 ? value + 1 : value;
    }

    closestEven(value) {
      return value % 2 === 0 ? value : value + 1;
    }

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    lerp(start, end, amount) {
      return start + (end - start) * amount;
    }

    getSlideDuration(distance) {
      const duration = BASE_CONFIG.slideBaseDuration + distance * BASE_CONFIG.slideCellDuration;
      return duration * this.performanceProfile.slideDurationScale;
    }

    segmentKey(fromKey, toKey, dx, dy) {
      return `${fromKey}>${toKey}:${dx},${dy}`;
    }

    getSwipeThreshold() {
      const stage = this.canvas.parentElement;
      const shortEdge = Math.min(stage.clientWidth, stage.clientHeight);
      if (this.isCoarsePointer()) {
        return Math.max(12, shortEdge * 0.024);
      }
      return Math.max(18, shortEdge * 0.035);
    }

    clearPointerState(pointerId) {
      if (pointerId !== undefined && this.canvas.releasePointerCapture) {
        try {
          this.canvas.releasePointerCapture(pointerId);
        } catch (_error) {
        }
      }
      this.pointerStart = null;
      this.activePointerId = null;
    }

    isCoarsePointer() {
      return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    }

    computePerformanceProfile(viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
      const coarsePointer = this.isCoarsePointer();
      const shortEdge = Math.max(1, Math.min(viewportWidth || 0, viewportHeight || 0));
      const longEdge = Math.max(1, Math.max(viewportWidth || 0, viewportHeight || 0));
      const viewportArea = Math.max(1, shortEdge * longEdge);
      const ultraCompact = coarsePointer && shortEdge < 420;
      const reducedEffects = coarsePointer && shortEdge < 360;
      const renderBudget = coarsePointer ? 3200000 : 5600000;
      const adaptiveCap = Math.sqrt(renderBudget / viewportArea);
      const pixelRatioCap = this.clamp(adaptiveCap, 1.4, coarsePointer ? 2.35 : 3);

      return {
        isTouch: coarsePointer,
        isPhone: ultraCompact,
        reducedEffects,
        dynamicFocusMask: !reducedEffects,
        glowStrength: coarsePointer ? (ultraCompact ? 0.78 : 0.95) : 1,
        trailStrength: coarsePointer ? (ultraCompact ? 0.24 : 0.62) : 1,
        backdropGlowAlpha: coarsePointer ? (ultraCompact ? 0.82 : 0.95) : 1,
        pixelRatioCap,
        maxDelta: coarsePointer ? 0.18 : 0.1,
        slideDurationScale: coarsePointer ? (ultraCompact ? 0.86 : 0.92) : 0.98,
        ambientParticleCount: coarsePointer ? (ultraCompact ? 3 : 6) : 14,
      };
    }

    isCompactViewport() {
      return window.innerWidth < 820 || window.innerHeight < 760 || this.isCoarsePointer();
    }

    setStatusText(fullText, compactText = fullText) {
      this.statusText.textContent = this.isCompactViewport() ? compactText : fullText;
    }

    getUiFont() {
      return '"Bahnschrift", "Arial Narrow", "Segoe UI", sans-serif';
    }

    getDisplayFont() {
      return '"Consolas", "Lucida Console", monospace';
    }

    cellKey(x, y) {
      return `${x},${y}`;
    }

    easeOut(value) {
      return 1 - Math.pow(1 - value, 3);
    }

    easeInOutSine(value) {
      return -(Math.cos(Math.PI * value) - 1) / 2;
    }

    easeInOutCubic(value) {
      if (value < 0.5) {
        return 4 * value * value * value;
      }
      return 1 - Math.pow(-2 * value + 2, 3) / 2;
    }

    smoothPulse(value) {
      return Math.sin(Math.PI * value);
    }

    springOut(value) {
      const damped = Math.exp(-5.6 * value);
      return 1 - Math.cos(value * Math.PI * 3.2) * damped;
    }
  }

  window.NeonCollapseMaze = NeonCollapseMaze;
  window.addEventListener("load", () => {
    new NeonCollapseMaze();
  });
})();
