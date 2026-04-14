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
  const BEST_TIME_KEY = "slidey_best_time_ms";
  const TOP_RECORD_KEY = "slidey_top_record";
  const PLAYER_SHAPES = new Set([
    "square", "triangle", "circle", "diamond", "hex", "star", "capsule", "cross", "droplet",
    "heart", "moon", "crown", "bolt", "cog", "hourglass", "kite", "orbit"
  ]);

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
      this.ctx = this.canvas.getContext("2d", { alpha: false, desynchronized: true });
      this.levelValue = document.getElementById("levelValue");
      this.orbValue = document.getElementById("orbValue");
      this.timerValue = document.getElementById("timerValue");
      this.runValue = document.getElementById("runValue");
      this.statusText = document.getElementById("statusText");
      this.dangerFill = document.getElementById("dangerFill");
      this.messagePanel = document.getElementById("messagePanel");
      this.messageTitle = document.getElementById("messageTitle");
      this.messageText = document.getElementById("messageText");
      this.tutorialBlur = document.getElementById("tutorialBlur");
      this.tutorialDialog = document.getElementById("tutorialDialog");
      this.tutorialAvatar = document.getElementById("tutorialAvatar");
      this.tutorialDialogMeta = document.getElementById("tutorialDialogMeta");
      this.tutorialDialogText = document.getElementById("tutorialDialogText");
      this.tutorialDialogNext = document.getElementById("tutorialDialogNext");
      this.interludeActions = document.getElementById("interludeActions");
      this.replayRunBtn = document.getElementById("replayRunBtn");
      this.continueRunBtn = document.getElementById("continueRunBtn");
      this.mainMenuBtn = document.getElementById("mainMenuBtn");

      this.level = 1;
      this.unlockedLevel = 1;
      this.runOrbs = 0;
      this.playerShape = "square";
      this.bestTimeMs = this.readStoredNumber(BEST_TIME_KEY, 0);
      this.topRecord = this.loadTopRecord();
      this.levelTopRecords = new Map();
      this.currentRunTimeMs = 0;
      this.runClockTime = 0;
      this.lastRunBeatTop = false;
      this.collapseFreezeRemaining = 0;
      this.orbMultiplierRemaining = 0;
      this.orbMultiplierValue = 1;
      this.orbPickupWhisper = null;
      this.levelOrbCollected = 0;
      this.freezeWaveOrigin = null;
      this.lastTimestamp = 0;
      this.lastDelta = 1 / 60;
      this.pointerStart = null;
      this.activePointerId = null;
      this.pendingDirection = null;
      this.bufferedDirection = null;
      this.lastMoveDirection = { dx: 0, dy: -1 };
      this.triangleSpinTime = 0;
      this.isMenuDemo = false;
      this.isTutorialRun = false;
      this.isChallengeRun = false;
      this.isDailyRun = false;
      this.dailyDateKey = "";
      this.challengeCode = "";
      this.challengeSeed = 0;
      this.tutorialStage = 0;
      this.tutorialFlow = null;
      this.ghostState = null;
      this.ghostStates = [];
      this.challengeVariant = "classic";
      this.challengeModifier = "none";
      this.challengeRound = 1;
      this.challengeTotalRounds = 1;
      this.challengeTimeLimitSec = 0;
      this.dailyReplayTrack = [];
      this.dailyReplayGhost = null;
      this.tutorialStep = 0;
      this.tutorialAdvanceTimer = null;
      this.demoStepCooldown = 0;
      this.demoPrevStopKey = "";
      this.demoLastStopKey = "";
      this.demoLastDir = { dx: 0, dy: 0 };
      this.demoRepeatCount = 0;
      this.demoBounceCount = 0;
      this.demoRecentStops = [];
      this.demoStopVisitCounts = new Map();
      this.demoIdleTime = 0;
      this.pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      this.performanceProfile = this.computePerformanceProfile(window.innerWidth, window.innerHeight);
      this.boardMetrics = null;
      this.backdropCache = null;
      this.focusMaskCache = null;
      this.exitVisualCache = new Map();
      this.lastCanvasWidth = 0;
      this.lastCanvasHeight = 0;
      this.lastCanvasPixelRatio = 0;
      this.camera = { x: 0, y: 0 };
      this.cameraVelocity = { x: 0, y: 0 };
      this.renderCamera = { x: 0, y: 0 };
      this.ambientField = [];
      this.introFocusTime = 0;
      this.impactEffect = null;
      this.exitEffect = null;
      this.deathEffect = null;
      this.winOverlayTime = 0;
      this.loseOverlayTime = 0;
      this.phase = "playing";
      this.resizeRafId = 0;

      this.resizeCanvas();
      this.bindEvents();
      this.startLevel(this.level);
      this.enterMenuDemo();
      window.__slideyGame = this;
      window.requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    readStoredNumber(key, fallback = 0) {
      const raw = window.localStorage.getItem(key);
      const value = Number(raw);
      return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
    }

    loadTopRecord() {
      const raw = window.localStorage.getItem(TOP_RECORD_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.name === "string" && Number.isFinite(parsed.timeMs) && parsed.timeMs > 0) {
            return { name: parsed.name, timeMs: Math.floor(parsed.timeMs) };
          }
        } catch (_error) {
        }
      }
      return { name: "Top Runner", timeMs: 62000 };
    }

    saveTopRecord() {
      window.localStorage.setItem(TOP_RECORD_KEY, JSON.stringify(this.topRecord));
    }

    formatTime(ms) {
      const safe = Math.max(0, Math.floor(ms));
      const minutes = Math.floor(safe / 60000);
      const seconds = Math.floor((safe % 60000) / 1000);
      const centiseconds = Math.floor((safe % 1000) / 10);
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
    }

    getBestTimeMs() {
      return this.bestTimeMs;
    }

    getTopRecord() {
      return { ...this.topRecord };
    }

    setUnlockedLevel(level) {
      const safe = Math.max(1, Number.isFinite(level) ? Math.floor(level) : 1);
      this.unlockedLevel = Math.min(BASE_CONFIG.maxLevel, safe);
    }

    startRun(level = this.unlockedLevel) {
      this.startLevel(level);
    }

    startTutorialRun() {
      this.startLevel(1, { tutorial: true, tutorialStage: 0 });
    }

    startTutorialStage(stage) {
      this.startLevel(1, { tutorial: true, tutorialStage: stage });
    }

    startChallengeRun(level = this.unlockedLevel, challenge = {}) {
      const seed = Number.isFinite(challenge.seed) ? (challenge.seed >>> 0) : ((Date.now() ^ Math.floor(Math.random() * 2147483647)) >>> 0);
      const code = typeof challenge.code === "string" ? challenge.code : "";
      const chaos = challenge.chaos && typeof challenge.chaos === "object" ? challenge.chaos : null;
      this.startLevel(level, {
        challenge: true,
        challengeSeed: seed,
        challengeCode: code,
        challengeVariant: chaos ? "chaos" : "classic",
        challengeModifier: chaos?.modifier || "none",
        challengeRound: Number.isFinite(chaos?.round) ? Math.max(1, Math.floor(chaos.round)) : 1,
        challengeTotalRounds: Number.isFinite(chaos?.totalRounds) ? Math.max(1, Math.floor(chaos.totalRounds)) : 1,
        challengeTimeLimitSec: Number.isFinite(chaos?.timeLimitSec) ? Math.max(0, chaos.timeLimitSec) : 0
      });
    }

    startDailyRun(level = 1, daily = {}) {
      const seed = Number.isFinite(daily.seed) ? (daily.seed >>> 0) : ((Date.now() ^ 0x5f3759df) >>> 0);
      const dateKey = typeof daily.dateKey === "string" ? daily.dateKey : "";
      this.startLevel(level, { daily: true, dailySeed: seed, dailyDateKey: dateKey });
    }

    enterMenuDemo() {
      this.startLevel(1, { menuDemo: true });
    }

    bindEvents() {
      window.addEventListener("resize", () => this.scheduleResize());
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => this.scheduleResize());
      }

      this.canvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (this.isTutorialDialogBlockingInput()) {
          return;
        }
        this.activePointerId = event.pointerId;
        if (this.canvas.setPointerCapture) {
          this.canvas.setPointerCapture(event.pointerId);
        }
        this.pointerStart = { x: event.clientX, y: event.clientY, consumed: false };
      }, { passive: false });

      this.canvas.addEventListener("pointermove", (event) => {
        if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
          return;
        }
        if (!this.pointerStart || this.pointerStart.consumed || this.phase !== "playing") {
          return;
        }
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        const threshold = this.getSwipeThreshold();
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
          return;
        }
        event.preventDefault();
        this.pointerStart.consumed = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          this.queueMove(Math.sign(dx), 0);
        } else {
          this.queueMove(0, Math.sign(dy));
        }
      }, { passive: false });

      this.canvas.addEventListener("pointerup", (event) => {
        if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
          return;
        }
        event.preventDefault();

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
        const consumed = Boolean(this.pointerStart.consumed);
        this.pointerStart = null;
        if (consumed) {
          this.clearPointerState(event.pointerId);
          return;
        }

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
      }, { passive: false });

      this.canvas.addEventListener("pointercancel", (event) => {
        event.preventDefault();
        this.clearPointerState(event.pointerId);
      }, { passive: false });

      this.canvas.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "mouse") {
          this.clearPointerState(event.pointerId);
        }
      });

      this.messagePanel.addEventListener("pointerup", () => {
        if (this.isTutorialRun && this.phase === "playing" && this.tutorialFlow) {
          this.advanceTutorialDialog();
          return;
        }
        if (this.phase !== "playing") {
          this.handleInterludeInput();
        }
      });

      this.tutorialDialogNext?.addEventListener("click", () => {
        this.advanceTutorialDialog();
      });

      this.replayRunBtn?.addEventListener("click", () => {
        this.handleReplayInput();
      });

      this.continueRunBtn?.addEventListener("click", () => {
        this.handleInterludeInput();
      });

      this.mainMenuBtn?.addEventListener("click", () => {
        this.returnToMainMenu();
      });

      window.addEventListener("keydown", (event) => {
        if (this.phase !== "playing") {
          if (event.key === "r" || event.key === "R") {
            this.handleReplayInput();
          } else if ([" ", "Enter", "n", "N"].includes(event.key)) {
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
      const nextPixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, this.performanceProfile.pixelRatioCap));
      const sizeUnchanged = Math.abs(width - this.lastCanvasWidth) < 1 && Math.abs(height - this.lastCanvasHeight) < 1;
      const ratioUnchanged = Math.abs(nextPixelRatio - this.lastCanvasPixelRatio) < 0.01;
      if (sizeUnchanged && ratioUnchanged && this.levelData) {
        this.pixelRatio = nextPixelRatio;
        this.updateBoardMetrics();
        return;
      }
      this.pixelRatio = nextPixelRatio;

      this.canvas.width = Math.floor(width * this.pixelRatio);
      this.canvas.height = Math.floor(height * this.pixelRatio);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in this.ctx) {
        this.ctx.imageSmoothingQuality = this.performanceProfile.isTouch ? "medium" : "high";
      }
      this.lastCanvasWidth = width;
      this.lastCanvasHeight = height;
      this.lastCanvasPixelRatio = this.pixelRatio;
      this.buildBackdropCache(width, height);
      this.buildFocusMaskCache(width, height);
      this.exitVisualCache.clear();

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

    startLevel(level, options = {}) {
      const tutorial = Boolean(options.tutorial);
      const menuDemo = Boolean(options.menuDemo);
      const challenge = Boolean(options.challenge);
      const daily = Boolean(options.daily);
      const tutorialStage = Number.isFinite(options.tutorialStage) ? Math.max(0, Math.floor(options.tutorialStage)) : 0;
      const challengeSeed = Number.isFinite(options.challengeSeed) ? (options.challengeSeed >>> 0) : 0;
      const challengeCode = typeof options.challengeCode === "string" ? options.challengeCode : "";
      const challengeVariant = typeof options.challengeVariant === "string" ? options.challengeVariant : "classic";
      const challengeModifier = typeof options.challengeModifier === "string" ? options.challengeModifier : "none";
      const challengeRound = Number.isFinite(options.challengeRound) ? Math.max(1, Math.floor(options.challengeRound)) : 1;
      const challengeTotalRounds = Number.isFinite(options.challengeTotalRounds) ? Math.max(1, Math.floor(options.challengeTotalRounds)) : 1;
      const challengeTimeLimitSec = Number.isFinite(options.challengeTimeLimitSec) ? Math.max(0, options.challengeTimeLimitSec) : 0;
      const dailySeed = Number.isFinite(options.dailySeed) ? (options.dailySeed >>> 0) : 0;
      const dailyDateKey = typeof options.dailyDateKey === "string" ? options.dailyDateKey : "";
      this.phase = "playing";
      this.level = Math.max(1, Math.min(level, BASE_CONFIG.maxLevel));
      this.isTutorialRun = tutorial;
      this.isChallengeRun = challenge;
      this.isDailyRun = daily;
      this.dailyDateKey = daily ? dailyDateKey : "";
      this.challengeSeed = challenge ? challengeSeed : 0;
      this.challengeCode = challenge ? challengeCode : "";
      this.challengeVariant = challenge ? (challengeVariant === "chaos" ? "chaos" : "classic") : "classic";
      this.challengeModifier = challenge ? challengeModifier : "none";
      this.challengeRound = challenge ? challengeRound : 1;
      this.challengeTotalRounds = challenge ? challengeTotalRounds : 1;
      this.challengeTimeLimitSec = challenge ? challengeTimeLimitSec : 0;
      this.tutorialStage = tutorial ? tutorialStage : 0;
      this.isMenuDemo = menuDemo;
      this.tutorialStep = 0;
      this.demoStepCooldown = 0;
      this.levelData = tutorial
        ? this.buildTutorialLevel(this.tutorialStage)
        : (challenge
          ? this.buildLevelFromSeed(this.level, this.challengeSeed || 1)
          : (daily ? this.buildLevelFromSeed(this.level, dailySeed || 1) : this.buildLevel(this.level)));
      this.player = {
        x: this.levelData.start.x,
        y: this.levelData.start.y,
        renderX: this.levelData.start.x,
        renderY: this.levelData.start.y,
      };
      const startKey = this.cellKey(this.player.x, this.player.y);
      this.demoPrevStopKey = "";
      this.demoLastStopKey = startKey;
      this.demoLastDir = { dx: 0, dy: 0 };
      this.demoRepeatCount = 0;
      this.demoBounceCount = 0;
      this.demoRecentStops = [startKey];
      this.demoStopVisitCounts = new Map([[startKey, 1]]);
      this.demoIdleTime = 0;
      this.dailyReplayTrack = [{ t: 0, x: this.player.x, y: this.player.y }];
      this.moveState = null;
      this.pendingDirection = null;
      this.bufferedDirection = null;
      this.levelTime = 0;
      this.levelOrbCount = 0;
      this.introFocusTime = BASE_CONFIG.introFocusDuration;
      this.impactEffect = null;
      this.exitEffect = null;
      this.deathEffect = null;
      this.winOverlayTime = 0;
      this.loseOverlayTime = 0;
      this.currentRunTimeMs = 0;
      this.runClockTime = 0;
      this.lastRunBeatTop = false;
      this.collapseFreezeRemaining = 0;
      this.orbMultiplierRemaining = 0;
      this.orbMultiplierValue = 1;
      this.orbPickupWhisper = null;
      this.levelOrbCollected = 0;
      this.freezeWaveOrigin = null;
      this.tutorialFlow = null;
      if (this.tutorialAdvanceTimer) {
        window.clearTimeout(this.tutorialAdvanceTimer);
        this.tutorialAdvanceTimer = null;
      }
      if (!challenge) {
        this.ghostState = null;
        this.ghostStates = [];
      }
      this.ambientField = this.buildAmbientField(this.levelData.seed);
      this.hideMessage();
      this.hideInterludeActions();
      this.levelValue.textContent = String(this.level).padStart(2, "0");
      this.updateBoardMetrics();
      this.resetCamera();
      window.dispatchEvent(new CustomEvent("slidey:level-started", {
        detail: { level: this.level }
      }));
      if (tutorial) {
        this.setStatusText("", "");
        this.startTutorialFlowForStage(this.tutorialStage);
      } else if (menuDemo) {
        this.hideTutorialDialog();
        this.setStatusText(
          "Attract mode running in background.",
          "Background demo."
        );
      } else {
        this.hideTutorialDialog();
        if (daily) {
          this.setStatusText(
            "Daily run active: same seeded maze for everyone today.",
            "Daily run active."
          );
        } else if (challenge) {
          const modLabel = this.challengeModifier === "no_orbs"
            ? "No Orbs"
            : (this.challengeModifier === "collapse_fast" ? "Fast Collapse" : (this.challengeModifier === "time_limit" ? "Time Limit" : "Standard"));
          const variantLabel = this.challengeVariant === "chaos" ? "Chaos" : "Challenge";
          this.setStatusText(`${variantLabel} R${this.challengeRound}/${this.challengeTotalRounds} - ${modLabel}`, `${variantLabel} active.`);
        } else {
          this.setStatusText("", "");
        }
      }
      this.updateHud();
    }

    buildLevelFromSeed(level, seedBase) {
      const base = seedBase >>> 0;
      for (let attempt = 0; attempt < 768; attempt += 1) {
        const seed = (base ^ Math.imul(attempt + 1, 2654435761)) >>> 0;
        const candidate = this.generateLevelCandidate(level, seed);
        if (candidate) {
          return candidate;
        }
      }

      for (let attempt = 768; attempt < 1024; attempt += 1) {
        const seed = (base ^ 0x9e3779b9 ^ Math.imul(attempt + 1, 2246822519)) >>> 0;
        const candidate = this.generateLevelCandidate(level, seed, true);
        if (candidate) {
          return candidate;
        }
      }

      return this.buildLevel(level);
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

    buildTutorialLevel(stage = 0) {
      const rows = 11;
      const cols = 11;
      const grid = Array.from({ length: rows }, () => Array(cols).fill("wall"));
      const layouts = [
        {
          floorCells: [
            [1, 9], [1, 8], [1, 7], [1, 6],
            [2, 6], [3, 6], [4, 6],
            [4, 5], [4, 4], [4, 3],
            [5, 3], [6, 3], [7, 3],
            [7, 2], [7, 1],
            [8, 1], [9, 1]
          ],
          start: { x: 1, y: 9 },
          exit: { x: 9, y: 1 },
          orbs: [
            { x: 3, y: 6, type: "normal" },
            { x: 6, y: 3, type: "normal" }
          ],
          checkpoints: {
            reach_stage1_corner: { x: 4, y: 3 }
          }
        },
        {
          floorCells: [
            [1, 9], [1, 8], [1, 7], [1, 6], [1, 5],
            [2, 5], [3, 5], [4, 5], [5, 5],
            [5, 4], [5, 3],
            [6, 3], [7, 3], [8, 3],
            [8, 2], [8, 1],
            [9, 1]
          ],
          start: { x: 1, y: 9 },
          exit: { x: 9, y: 1 },
          orbs: [
            { x: 5, y: 3, type: "freeze" },
            { x: 7, y: 3, type: "normal" }
          ],
          checkpoints: {
            reach_stage2_mid: { x: 5, y: 5 }
          }
        },
        {
          floorCells: [
            [1, 9], [1, 8], [1, 7], [1, 6],
            [2, 6], [3, 6], [4, 6],
            [4, 5], [4, 4],
            [5, 4], [6, 4], [7, 4],
            [7, 3], [7, 2],
            [8, 2], [9, 2],
            [9, 1]
          ],
          start: { x: 1, y: 9 },
          exit: { x: 9, y: 1 },
          orbs: [
            { x: 6, y: 4, type: "multiplier" },
            { x: 8, y: 2, type: "normal" },
            { x: 9, y: 2, type: "normal" }
          ],
          checkpoints: {
            reach_stage3_branch: { x: 4, y: 6 },
            reach_stage3_lane: { x: 7, y: 2 }
          }
        }
      ];
      const config = layouts[this.clamp(stage, 0, layouts.length - 1)];

      for (const [x, y] of config.floorCells) {
        grid[y][x] = "floor";
      }

      const start = { ...config.start };
      const exit = { ...config.exit };
      const orbCells = new Map();
      for (const orb of config.orbs) {
        orbCells.set(this.cellKey(orb.x, orb.y), { x: orb.x, y: orb.y, type: orb.type, collected: false });
      }

      const collapseAt = Array.from({ length: rows }, () => Array(cols).fill(Number.POSITIVE_INFINITY));
      for (const [x, y] of config.floorCells) {
        collapseAt[y][x] = 120;
      }
      collapseAt[start.y][start.x] = 120;
      collapseAt[exit.y][exit.x] = 120;

      const mainPathSet = new Set(config.floorCells.map(([x, y]) => this.cellKey(x, y)));
      const slideGraph = { edges: new Map() };
      const slideAnalysis = {
        strongNodes: new Set(mainPathSet),
        reversibleCells: new Set(mainPathSet),
        trappedSegments: []
      };

      return {
        seed: 20260412,
        cols,
        rows,
        grid,
        start,
        exit,
        orbCells,
        collapseAt,
        mainPathSet,
        slideSolution: { path: [], cellSet: mainPathSet, arrivalTimes: new Map() },
        slideGraph,
        slideAnalysis,
        dynamicWallMap: new Map(),
        maxCollapseTime: 120,
        tutorialCheckpoints: config.checkpoints || {}
      };
    }

    getTutorialScript(stage) {
      const scripts = [
        [
          { text: "Hi, I am Slidey. Quick tutorial: 3 short steps and you are in.", cta: "Start" },
          { text: "Swipe once: your shape keeps sliding until a wall stops it.", waitFor: "move", cta: "Got it" },
          { text: "Follow the corridor and reach the upper corner first.", waitFor: "reach_stage1_corner", cta: "Go" },
          { text: "Great. Collect one white orb.", waitFor: "collect_normal", cta: "Go" },
          { text: "Perfect. Reach the gate to finish tutorial stage one.", waitFor: "complete_stage", cta: "Go" }
        ],
        [
          { text: "Stage 2: red orb training.", cta: "Continue" },
          { text: "Move to the middle lane on the right side.", waitFor: "reach_stage2_mid", cta: "Go" },
          { text: "Collect the red orb: collapse freezes for 4 seconds.", waitFor: "collect_freeze", cta: "Go" },
          { text: "Use that safe window and close the gate.", waitFor: "complete_stage", cta: "Go" }
        ],
        [
          { text: "Stage 3: yellow orb gives time cut and x2 orb gain.", cta: "Continue" },
          { text: "Move into the side branch.", waitFor: "reach_stage3_branch", cta: "Go" },
          { text: "Collect the yellow orb.", waitFor: "collect_multiplier", cta: "Go" },
          { text: "Return to the lane and stabilize your line.", waitFor: "reach_stage3_lane", cta: "Go" },
          { text: "Collect one normal orb while x2 is active.", waitFor: "collect_while_multiplier", cta: "Go" },
          { text: "Close the gate to finish tutorial and claim 20 bonus orbs.", waitFor: "complete_stage", cta: "Go" }
        ]
      ];
      return scripts[this.clamp(stage, 0, scripts.length - 1)];
    }

    startTutorialFlowForStage(stage) {
      const script = this.getTutorialScript(stage);
      this.tutorialFlow = {
        stage,
        script,
        index: 0,
        waitingFor: null,
        multiplierCollectedNormal: false
      };
      this.showTutorialDialogStep();
    }

    updateTutorialAvatar() {
      if (!this.tutorialAvatar) {
        return;
      }
      this.tutorialAvatar.className = "tutorial-avatar";
      if (this.playerShape === "circle") {
        this.tutorialAvatar.classList.add("tutorial-avatar-circle");
      } else if (this.playerShape === "triangle") {
        this.tutorialAvatar.classList.add("tutorial-avatar-triangle");
      } else {
        this.tutorialAvatar.classList.add("tutorial-avatar-square");
      }
    }

    showTutorialDialogStep() {
      if (!this.tutorialFlow || !this.tutorialDialog || !this.tutorialDialogText) {
        return;
      }
      const step = this.tutorialFlow.script[this.tutorialFlow.index];
      if (!step) {
        this.hideTutorialDialog();
        return;
      }
      this.updateTutorialAvatar();
      if (this.tutorialDialogMeta) {
        const stageLabel = this.tutorialFlow.stage + 1;
        const stepLabel = Math.min(this.tutorialFlow.index + 1, this.tutorialFlow.script.length);
        this.tutorialDialogMeta.textContent = `Tutorial ${stageLabel}/3 - Step ${stepLabel}/${this.tutorialFlow.script.length}`;
      }
      this.tutorialDialogText.textContent = step.text;
      if (this.tutorialDialogNext) {
        this.tutorialDialogNext.textContent = step.cta || (step.waitFor ? "Go" : "Next");
      }
      this.tutorialBlur?.classList.remove("hidden");
      this.tutorialDialog.classList.remove("hidden");
      this.canvas.parentElement?.classList.add("tutorial-focus");
    }

    hideTutorialDialog() {
      this.tutorialBlur?.classList.add("hidden");
      this.tutorialDialog?.classList.add("hidden");
      this.canvas.parentElement?.classList.remove("tutorial-focus");
    }

    advanceTutorialDialog() {
      if (!this.tutorialFlow) {
        return;
      }
      const step = this.tutorialFlow.script[this.tutorialFlow.index];
      if (!step) {
        return;
      }
      if (step.waitFor) {
        this.tutorialFlow.waitingFor = step.waitFor;
        this.setTutorialObjectiveStatus(step.waitFor);
        this.hideTutorialDialog();
        return;
      }
      this.tutorialFlow.index += 1;
      this.showTutorialDialogStep();
    }

    satisfyTutorialWait(condition) {
      if (!this.tutorialFlow || !this.tutorialFlow.waitingFor) {
        return;
      }
      if (this.tutorialFlow.waitingFor !== condition) {
        return;
      }
      this.tutorialFlow.waitingFor = null;
      this.tutorialFlow.index += 1;
      this.setStatusText("Perfect. Keep the flow.", "Perfect.");
      if (this.tutorialAdvanceTimer) {
        window.clearTimeout(this.tutorialAdvanceTimer);
        this.tutorialAdvanceTimer = null;
      }
      this.tutorialAdvanceTimer = window.setTimeout(() => {
        this.tutorialAdvanceTimer = null;
        if (!this.isTutorialRun) {
          return;
        }
        this.showTutorialDialogStep();
      }, 220);
    }

    setTutorialObjectiveStatus(waitFor) {
      const hints = {
        move: {
          full: "Objective: perform one swipe to start sliding.",
          compact: "Objective: do one swipe."
        },
        reach_stage1_corner: {
          full: "Objective: reach the upper corner marker.",
          compact: "Reach upper corner."
        },
        collect_normal: {
          full: "Objective: collect one white orb.",
          compact: "Collect one white orb."
        },
        complete_stage: {
          full: "Objective: close the gate to complete this stage.",
          compact: "Reach the gate."
        },
        reach_stage2_mid: {
          full: "Objective: reach the right middle lane.",
          compact: "Reach mid lane."
        },
        collect_freeze: {
          full: "Objective: collect the red orb to freeze collapse.",
          compact: "Collect red orb."
        },
        reach_stage3_branch: {
          full: "Objective: enter the side branch.",
          compact: "Enter branch."
        },
        collect_multiplier: {
          full: "Objective: collect the yellow multiplier orb.",
          compact: "Collect yellow orb."
        },
        reach_stage3_lane: {
          full: "Objective: return to the lane.",
          compact: "Return to lane."
        },
        collect_while_multiplier: {
          full: "Objective: collect one white orb while x2 is active.",
          compact: "Collect orb with x2."
        }
      };
      const hint = hints[waitFor];
      if (!hint) {
        return;
      }
      this.setStatusText(hint.full, hint.compact);
    }

    checkTutorialCheckpoint() {
      if (!this.isTutorialRun || !this.tutorialFlow || !this.tutorialFlow.waitingFor || !this.levelData?.tutorialCheckpoints) {
        return;
      }
      const target = this.levelData.tutorialCheckpoints[this.tutorialFlow.waitingFor];
      if (!target) {
        return;
      }
      if (this.player.x === target.x && this.player.y === target.y) {
        this.satisfyTutorialWait(this.tutorialFlow.waitingFor);
      }
    }

    generateLevelCandidate(level, seed, softMode = false) {
      const rng = new RNG(seed);
      const cols = this.toOdd(Math.min(17 + Math.floor((level - 1) * 2.4), 37));
      const rows = this.toOdd(Math.min(21 + Math.floor((level - 1) * 2.7), 45));
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

      const extraLoops = Math.floor((cols * rows) / 34) + Math.ceil(level * 2.1);
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
      this.assignSpecialOrbs(orbCells, refreshed.distances, collapseAt, start, level, rng);
      const dynamicWallMap = this.buildDynamicWalls(grid, level, mainPathSet, orbCells, start, exit, rng);

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
        dynamicWallMap,
        maxCollapseTime: this.findMaxCollapse(collapseAt),
      };
    }

    buildDynamicWalls(grid, level, mainPathSet, orbCells, start, exit, rng) {
      const map = new Map();
      if (level < 12) {
        return map;
      }

      const cols = grid[0].length;
      const rows = grid.length;
      const orbSet = new Set(orbCells.keys());
      const candidates = [];

      for (let y = 1; y < rows - 1; y += 1) {
        for (let x = 1; x < cols - 1; x += 1) {
          if (grid[y][x] !== "floor") {
            continue;
          }
          const key = this.cellKey(x, y);
          if (key === this.cellKey(start.x, start.y) || key === this.cellKey(exit.x, exit.y)) {
            continue;
          }
          if (mainPathSet.has(key) || orbSet.has(key)) {
            continue;
          }
          if (y <= 3 || y >= rows - 3) {
            continue;
          }
          const floorNeighbors = this.countFloorNeighbors(grid, x, y);
          if (floorNeighbors < 2 || floorNeighbors > 3) {
            continue;
          }
          candidates.push({ x, y });
        }
      }

      if (candidates.length === 0) {
        return map;
      }

      rng.shuffle(candidates);
      const dynamicCount = Math.min(candidates.length, Math.max(2, Math.min(20, Math.floor((level - 10) * 0.72))));
      const cycleBase = this.clamp(2.55 - (level - 12) * 0.034, 1.1, 2.55);
      const openWindowBase = this.clamp(0.42 - (level - 12) * 0.005, 0.2, 0.42);

      for (let i = 0; i < dynamicCount; i += 1) {
        const cell = candidates[i];
        const cycle = cycleBase * (0.92 + rng.next() * 0.2);
        const openWindow = this.clamp(openWindowBase + (rng.next() - 0.5) * 0.08, 0.22, 0.5);
        map.set(this.cellKey(cell.x, cell.y), {
          cycle,
          openWindow,
          offset: rng.next() * cycle,
        });
      }

      return map;
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
          type: "normal",
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

    assignSpecialOrbs(orbs, distances, collapseAt, start, level, rng) {
      const rows = collapseAt.length;
      const cols = collapseAt[0].length;
      const candidates = Array.from(orbs.values()).filter((orb) => orb.type === "normal");
      if (candidates.length === 0) {
        return;
      }

      const scored = candidates.map((orb) => {
        const distance = Math.max(0, distances[orb.y]?.[orb.x] ?? 0);
        const collapseTime = collapseAt[orb.y]?.[orb.x] ?? 999;
        const travelEstimate = distance * 0.07 + 1.15;
        const safetyMargin = Math.max(0.1, collapseTime - travelEstimate);
        const urgency = 1 / safetyMargin;
        const upperMapBias = orb.y < Math.floor(rows * 0.45) ? 1.6 : 0;
        const edgeRiskBias = (orb.x <= 2 || orb.x >= cols - 3) ? 0.8 : 0;
        const farFromStart = Math.hypot(orb.x - start.x, orb.y - start.y);
        const score = distance * 1.22 + farFromStart * 0.28 + urgency * 24 + upperMapBias + edgeRiskBias;
        return { orb, score };
      });
      scored.sort((a, b) => b.score - a.score);

      const pickWeighted = (sliceFrom = 0, sliceTo = 1) => {
        const from = Math.floor(scored.length * sliceFrom);
        const to = Math.max(from + 1, Math.floor(scored.length * sliceTo));
        const pool = scored.slice(from, to);
        if (pool.length === 0) {
          return null;
        }
        const jittered = pool
          .map((entry) => ({ entry, jitter: entry.score * (0.86 + rng.next() * 0.28) }))
          .sort((a, b) => b.jitter - a.jitter);
        return jittered[0].entry.orb;
      };

      const minSpecialDistance = Math.max(4, Math.floor(Math.min(rows, cols) * 0.14));
      const yellow = pickWeighted(0.08, 0.46);
      if (yellow) {
        yellow.type = "multiplier";
      }

      if (level >= 3) {
        const isFarEnough = (orb) => {
          if (!orb || !yellow) {
            return true;
          }
          const dist = Math.hypot(orb.x - yellow.x, orb.y - yellow.y);
          return dist >= minSpecialDistance;
        };

        const red = pickWeighted(0, 0.3);
        if (red && red !== yellow && isFarEnough(red)) {
          red.type = "freeze";
        } else {
          for (const candidate of scored) {
            if (candidate.orb === yellow) {
              continue;
            }
            if (!isFarEnough(candidate.orb)) {
              continue;
            }
            candidate.orb.type = "freeze";
            break;
          }
        }
      }
    }

    getTargetOrbCount(reversibleCellCount, level) {
      const progressiveDensity = 0.132 + level * 0.0042;
      return this.clamp(
        Math.floor(reversibleCellCount * progressiveDensity),
        12,
        72
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

    tickRunClock(delta) {
      this.runClockTime += delta;
      this.currentRunTimeMs = Math.floor(this.runClockTime * 1000);
    }

    tickCollapseClock(delta) {
      if (this.collapseFreezeRemaining > 0) {
        const consumed = Math.min(this.collapseFreezeRemaining, delta);
        this.collapseFreezeRemaining -= consumed;
        return;
      }
      const collapseSpeed = this.isChallengeRun && this.challengeModifier === "collapse_fast" ? 1.55 : 1;
      this.levelTime += delta * collapseSpeed;
    }

    tickOrbEffects(delta) {
      if (this.orbMultiplierRemaining > 0) {
        this.orbMultiplierRemaining = Math.max(0, this.orbMultiplierRemaining - delta);
        if (this.orbMultiplierRemaining <= 0) {
          this.orbMultiplierValue = 1;
        }
      }
      if (this.orbPickupWhisper) {
        this.orbPickupWhisper.time = Math.max(0, this.orbPickupWhisper.time - delta);
        if (this.orbPickupWhisper.time <= 0) {
          this.orbPickupWhisper = null;
        }
      }
    }

    getFreezeWaveState() {
      if (!this.freezeWaveOrigin || this.collapseFreezeRemaining <= 0 || !this.levelData) {
        return {
          active: false,
          phase: "none",
          factor: 0,
          center: null,
          radiusCells: 0,
          maxRadiusCells: 0
        };
      }

      const total = 4;
      const outDuration = 0.85;
      const backDuration = 0.85;
      const elapsed = total - this.collapseFreezeRemaining;
      const maxRadiusCells = Math.hypot(this.levelData.cols, this.levelData.rows);
      let phase = "hold";
      let factor = 1;
      let radiusCells = maxRadiusCells;
      let center = { x: this.freezeWaveOrigin.x, y: this.freezeWaveOrigin.y };

      if (elapsed < outDuration) {
        phase = "out";
        const p = this.clamp(elapsed / outDuration, 0, 1);
        factor = p;
        radiusCells = maxRadiusCells * this.easeOut(p);
      } else if (this.collapseFreezeRemaining <= backDuration) {
        phase = "back";
        const p = this.clamp(1 - this.collapseFreezeRemaining / backDuration, 0, 1);
        factor = 1 - p;
        radiusCells = maxRadiusCells * (1 - this.easeInOutSine(p));
        center = {
          x: this.lerp(this.freezeWaveOrigin.x, this.player.renderX, p),
          y: this.lerp(this.freezeWaveOrigin.y, this.player.renderY, p)
        };
      }

      return {
        active: true,
        phase,
        factor,
        center,
        radiusCells,
        maxRadiusCells
      };
    }

    getFreezeTintAtCell(x, y) {
      const wave = this.getFreezeWaveState();
      if (!wave.active || !wave.center) {
        return 0;
      }

      if (wave.phase === "hold") {
        return wave.factor;
      }

      const distance = Math.hypot(x - wave.center.x, y - wave.center.y);
      if (distance <= wave.radiusCells) {
        return wave.factor;
      }
      if (wave.phase === "out") {
        const edgeSoftness = 1.5;
        if (distance <= wave.radiusCells + edgeSoftness) {
          return wave.factor * (1 - (distance - wave.radiusCells) / edgeSoftness) * 0.7;
        }
      }
      return 0;
    }

    update(delta) {
      if (this.isMenuDemo) {
        this.updateMenuDemo(delta);
        return;
      }

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
        this.updateGhost(delta);
        this.updateCamera();
        return;
      }

      if (this.isTutorialDialogBlockingInput()) {
        this.updateGhost(delta);
        this.updateCamera();
        this.updateHud();
        return;
      }

      this.hideInterludeActions();
      this.tickRunClock(delta);
      this.tickCollapseClock(delta);
      this.tickOrbEffects(delta);
      if (this.moveState) {
        this.triangleSpinTime += delta * 6.8;
      }
      this.introFocusTime = Math.max(0, this.introFocusTime - delta);
      this.updateMovement(delta);
      this.updateImpact(delta);
      this.collectOrbIfNeeded();
      this.checkTutorialCheckpoint();
      this.updateGhost(delta);
      this.updateCamera();
      this.updateDailyReplayGhost();

      if (this.isChallengeRun && this.challengeModifier === "time_limit" && this.challengeTimeLimitSec > 0 && this.runClockTime >= this.challengeTimeLimitSec) {
        this.beginLoseSequence();
        return;
      }

      if (this.isCollapsed(this.player.x, this.player.y)) {
        this.beginLoseSequence();
        return;
      }

      if (this.player.x === this.levelData.exit.x && this.player.y === this.levelData.exit.y) {
        if (this.isTutorialRun) {
          const waiting = this.tutorialFlow?.waitingFor || null;
          if (waiting && waiting !== "complete_stage") {
            this.setStatusText(
              "Complete the current tutorial step before closing the gate.",
              "Complete the step before the gate."
            );
            return;
          }
          this.satisfyTutorialWait("complete_stage");
        }
        this.beginExitSequence();
        return;
      }

      this.updateHud();
    }

    updateMenuDemo(delta) {
      this.hideInterludeActions();
      if (this.phase === "won" || this.phase === "lost") {
        this.demoStepCooldown -= delta;
        if (this.demoStepCooldown <= 0) {
          this.startLevel(1, { menuDemo: true });
        }
        return;
      }

      if (this.phase === "exiting") {
        this.updateExitEffect(delta);
        this.updateCamera();
        return;
      }

      if (this.phase === "dying") {
        this.updateDeathEffect(delta);
        this.updateCamera();
        return;
      }

      this.tickRunClock(delta);
      this.tickCollapseClock(delta);
      this.tickOrbEffects(delta);
      if (this.moveState) {
        this.demoIdleTime = 0;
        this.triangleSpinTime += delta * 6.8;
      }
      this.introFocusTime = Math.max(0, this.introFocusTime - delta);
      this.updateMovement(delta);
      this.updateImpact(delta);
      this.collectOrbIfNeeded();
      this.checkTutorialCheckpoint();
      this.updateGhost(delta);
      this.updateCamera();
      this.updateDailyReplayGhost();

      if (this.isCollapsed(this.player.x, this.player.y)) {
        this.beginLoseSequence();
        return;
      }

      if (this.player.x === this.levelData.exit.x && this.player.y === this.levelData.exit.y) {
        if (this.isTutorialRun) {
          const waiting = this.tutorialFlow?.waitingFor || null;
          if (waiting && waiting !== "complete_stage") {
            this.setStatusText(
              "Complete the current tutorial step before closing the gate.",
              "Complete the step before the gate."
            );
            return;
          }
          this.satisfyTutorialWait("complete_stage");
        }
        this.beginExitSequence();
        return;
      }

      this.demoStepCooldown -= delta;
      if (this.demoStepCooldown <= 0 && !this.moveState && !this.pendingDirection) {
        const choice = this.chooseMenuDemoMove();
        if (choice) {
          const bouncedBack = choice.toKey === this.demoPrevStopKey;
          this.demoBounceCount = bouncedBack ? this.demoBounceCount + 1 : 0;
          if (this.demoBounceCount >= 6) {
            this.startLevel(1, { menuDemo: true });
            return;
          }
          this.queueMove(choice.dx, choice.dy, true);
          this.demoPrevStopKey = this.demoLastStopKey;
          this.demoLastStopKey = choice.toKey;
          this.demoRecentStops.push(choice.toKey);
          while (this.demoRecentStops.length > 10) {
            this.demoRecentStops.shift();
          }
          this.demoStopVisitCounts.set(choice.toKey, (this.demoStopVisitCounts.get(choice.toKey) || 0) + 1);
          if (choice.dx === this.demoLastDir.dx && choice.dy === this.demoLastDir.dy) {
            this.demoRepeatCount = Math.min(5, this.demoRepeatCount + 1);
          } else {
            this.demoRepeatCount = 0;
          }
          this.demoLastDir = { dx: choice.dx, dy: choice.dy };
          this.demoStepCooldown = 0.08 + Math.min(0.26, choice.distance * 0.016) + Math.random() * 0.08;
          this.demoIdleTime = 0;
        } else {
          this.demoIdleTime += delta;
          if (this.demoIdleTime > 0.75) {
            this.startLevel(1, { menuDemo: true });
            return;
          }
          this.demoStepCooldown = 0.06;
        }
      }

      this.updateHud();
    }

    queueMove(dx, dy, force = false) {
      if (!force && (window.__neonInstallLock || this.isMenuDemo || this.phase !== "playing" || this.moveState || this.pendingDirection)) {
        if (!force && this.phase === "playing" && !window.__neonInstallLock && !this.isMenuDemo) {
          this.bufferedDirection = { dx, dy };
        }
        return;
      }
      if (!force && this.isTutorialDialogBlockingInput()) {
        return;
      }
      this.pendingDirection = { dx, dy };
      if (!this.moveState) {
        this.updateMovement(0);
      }
    }

    isTutorialDialogBlockingInput() {
      return Boolean(
        this.isTutorialRun &&
        this.phase === "playing" &&
        this.tutorialDialog &&
        !this.tutorialDialog.classList.contains("hidden")
      );
    }

    startSlide(dx, dy) {
      const path = this.findSlidePath(dx, dy);
      if (path.length <= 1) {
        this.triggerImpact(this.player.x, this.player.y, dx, dy, 0.42);
        return false;
      }

      if (this.isTutorialRun && this.tutorialStep === 0) {
        this.tutorialStep = 1;
        this.satisfyTutorialWait("move");
      }

      const from = path[0];
      const to = path[path.length - 1];
      const distance = path.length - 1;
      const duration = this.getSlideDuration(distance);
      this.lastMoveDirection = { dx, dy };
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

    chooseMenuDemoMove() {
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
      ];
      for (let i = directions.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
      }

      const rootState = this.buildMenuDemoSimState();
      let best = null;
      let fallback = null;
      for (const dir of directions) {
        const path = this.findSlidePathFromState(rootState, dir.dx, dir.dy);
        if (path.length <= 1) {
          continue;
        }
        if (!fallback || path.length > fallback.distance) {
          const to = path[path.length - 1];
          fallback = {
            dx: dir.dx,
            dy: dir.dy,
            score: -Infinity,
            distance: path.length - 1,
            toKey: this.cellKey(to.x, to.y),
          };
        }
        const immediateScore = this.scoreMenuDemoMove(path, dir.dx, dir.dy, rootState);
        const projectedState = this.projectMenuDemoStateAfterMove(rootState, path, dir.dx, dir.dy);
        const lookaheadScore = this.evaluateMenuDemoLookahead(projectedState, 2);
        const score = immediateScore + lookaheadScore * 0.7;
        if (!Number.isFinite(score)) {
          continue;
        }
        if (!best || score > best.score) {
          const to = path[path.length - 1];
          best = {
            dx: dir.dx,
            dy: dir.dy,
            score,
            distance: path.length - 1,
            toKey: this.cellKey(to.x, to.y),
          };
        }
      }
      return best || fallback;
    }

    evaluateMenuDemoLookahead(state, depth) {
      if (depth <= 0) {
        return 0;
      }
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
      ];
      let best = -Infinity;
      for (const dir of directions) {
        const path = this.findSlidePathFromState(state, dir.dx, dir.dy);
        if (path.length <= 1) {
          continue;
        }
        const moveScore = this.scoreMenuDemoMove(path, dir.dx, dir.dy, state);
        if (!Number.isFinite(moveScore)) {
          continue;
        }
        const nextState = this.projectMenuDemoStateAfterMove(state, path, dir.dx, dir.dy);
        const futureScore = this.evaluateMenuDemoLookahead(nextState, depth - 1);
        const totalScore = moveScore * 0.84 + futureScore * 0.64;
        if (totalScore > best) {
          best = totalScore;
        }
      }
      if (!Number.isFinite(best)) {
        return -120;
      }
      return best;
    }

    buildMenuDemoSimState() {
      const collectedOrbKeys = new Set();
      for (const [key, orb] of this.levelData.orbCells.entries()) {
        if (orb?.collected) {
          collectedOrbKeys.add(key);
        }
      }
      return {
        x: this.player.x,
        y: this.player.y,
        time: this.levelTime,
        prevStopKey: this.demoPrevStopKey,
        lastStopKey: this.demoLastStopKey,
        lastDir: { ...this.demoLastDir },
        repeatCount: this.demoRepeatCount,
        bounceCount: this.demoBounceCount,
        recentStops: [...this.demoRecentStops],
        visitCounts: new Map(this.demoStopVisitCounts),
        collectedOrbKeys
      };
    }

    projectMenuDemoStateAfterMove(state, path, dx, dy) {
      const to = path[path.length - 1];
      const toKey = this.cellKey(to.x, to.y);
      const distance = Math.max(0, path.length - 1);
      const nextTime = state.time + this.getSlideDuration(distance);
      const nextCollected = new Set(state.collectedOrbKeys);
      for (let i = 1; i < path.length; i += 1) {
        const key = this.cellKey(path[i].x, path[i].y);
        if (this.levelData.orbCells.has(key)) {
          nextCollected.add(key);
        }
      }

      const nextRecentStops = [...state.recentStops, toKey];
      while (nextRecentStops.length > 10) {
        nextRecentStops.shift();
      }
      const nextVisitCounts = new Map(state.visitCounts);
      nextVisitCounts.set(toKey, (nextVisitCounts.get(toKey) || 0) + 1);

      return {
        x: to.x,
        y: to.y,
        time: nextTime,
        prevStopKey: state.lastStopKey,
        lastStopKey: toKey,
        lastDir: { dx, dy },
        repeatCount: (dx === state.lastDir.dx && dy === state.lastDir.dy) ? Math.min(7, state.repeatCount + 1) : 0,
        bounceCount: toKey === state.prevStopKey ? state.bounceCount + 1 : 0,
        recentStops: nextRecentStops,
        visitCounts: nextVisitCounts,
        collectedOrbKeys: nextCollected
      };
    }

    findSlidePathFromState(state, dx, dy) {
      const rawPath = [{ x: state.x, y: state.y }];
      let currentX = state.x;
      let currentY = state.y;

      while (true) {
        const nextX = currentX + dx;
        const nextY = currentY + dy;
        if (!this.canMoveToAt(nextX, nextY, state.time)) {
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
        if (state.time + stepTime * i >= this.levelData.collapseAt[cell.y][cell.x]) {
          break;
        }
        safePath.push(cell);
      }

      if (safePath.length <= 1) {
        return [rawPath[0]];
      }
      return safePath;
    }

    scoreMenuDemoMove(path, dx, dy, state = null) {
      const simulatedState = state || this.buildMenuDemoSimState();
      const from = path[0];
      const to = path[path.length - 1];
      const toKey = this.cellKey(to.x, to.y);
      let score = 0;
      const projectedCollected = new Set(simulatedState.collectedOrbKeys);

      let normalCollected = 0;
      let specialCollected = 0;
      for (let i = 1; i < path.length; i += 1) {
        const cell = path[i];
        const key = this.cellKey(cell.x, cell.y);
        if (projectedCollected.has(key)) {
          continue;
        }
        const orb = this.levelData.orbCells.get(key);
        if (!orb) {
          continue;
        }
        projectedCollected.add(key);
        if ((orb.type || "normal") === "normal") {
          normalCollected += 1;
        } else {
          specialCollected += 1;
        }
      }
      score += normalCollected * 250;
      score += specialCollected * 70;

      let remainingNormal = 0;
      for (const orb of this.levelData.orbCells.values()) {
        if ((orb.type || "normal") === "normal" && !projectedCollected.has(this.cellKey(orb.x, orb.y))) {
          remainingNormal += 1;
        }
      }
      const hasRemainingNormal = remainingNormal > 0;
      if (hasRemainingNormal) {
        let nearestNormal = Infinity;
        for (const orb of this.levelData.orbCells.values()) {
          if ((orb.type || "normal") !== "normal") {
            continue;
          }
          if (projectedCollected.has(this.cellKey(orb.x, orb.y))) {
            continue;
          }
          const manhattan = Math.abs(orb.x - to.x) + Math.abs(orb.y - to.y);
          if (manhattan < nearestNormal) {
            nearestNormal = manhattan;
          }
        }
        if (Number.isFinite(nearestNormal)) {
          score -= nearestNormal * 7.1;
        }
      }

      const exitDist = Math.abs(this.levelData.exit.x - to.x) + Math.abs(this.levelData.exit.y - to.y);
      score -= exitDist * (hasRemainingNormal ? 1.9 : 8.2);

      score += (from.y - to.y) * 7.5;
      score += (path.length - 1) * 2.4;

      if (toKey === simulatedState.prevStopKey) {
        score -= 92 + simulatedState.bounceCount * 66;
      }
      if (toKey === simulatedState.lastStopKey) {
        score -= 240;
      }
      if (dx === simulatedState.lastDir.dx && dy === simulatedState.lastDir.dy) {
        score -= 24 + simulatedState.repeatCount * 12;
      }

      const recentHits = simulatedState.recentStops.reduce((acc, key) => acc + (key === toKey ? 1 : 0), 0);
      score -= recentHits * 70;
      const visitedCount = simulatedState.visitCounts.get(toKey) || 0;
      if (visitedCount === 0) {
        score += 36;
      } else {
        score -= visitedCount * 28;
      }

      const collapseTime = this.levelData.collapseAt[to.y]?.[to.x] ?? Infinity;
      const distance = Math.max(0, path.length - 1);
      const arrivalTime = simulatedState.time + this.getSlideDuration(distance);
      const timeLeft = collapseTime - arrivalTime;
      if (timeLeft < 0.9) {
        score -= 320;
      } else if (timeLeft < 1.35) {
        score -= 120;
      } else if (timeLeft < 1.8) {
        score -= 48;
      }

      return score;
    }

    canMoveTo(x, y) {
      if (x < 0 || y < 0 || y >= this.levelData.rows || x >= this.levelData.cols) {
        return false;
      }
      if (this.levelData.grid[y][x] !== "floor") {
        return false;
      }
      if (this.isDynamicWallClosed(x, y)) {
        return false;
      }
      return !this.isCollapsed(x, y);
    }

    canMoveToAt(x, y, time) {
      if (x < 0 || y < 0 || y >= this.levelData.rows || x >= this.levelData.cols) {
        return false;
      }
      if (this.levelData.grid[y][x] !== "floor") {
        return false;
      }
      if (this.isDynamicWallClosed(x, y, time)) {
        return false;
      }
      return !this.isCollapsedAt(x, y, time);
    }

    collectOrbIfNeeded(x = this.player.x, y = this.player.y) {
      if (this.isChallengeRun && this.challengeModifier === "no_orbs") {
        return;
      }
      const key = `${x},${y}`;
      const orb = this.levelData.orbCells.get(key);
      if (!orb || orb.collected) {
        return;
      }

      orb.collected = true;
      const orbType = orb.type || "normal";
      this.orbPickupWhisper = {
        x: orb.x,
        y: orb.y,
        time: 0.18,
        duration: 0.18
      };
      let gained = orbType === "normal" ? this.orbMultiplierValue : 0;
      if (orbType === "multiplier") {
        this.orbMultiplierRemaining = Math.max(this.orbMultiplierRemaining, 8);
        this.orbMultiplierValue = 2;
        this.satisfyTutorialWait("collect_multiplier");
      } else if (orbType === "freeze") {
        this.collapseFreezeRemaining = Math.max(this.collapseFreezeRemaining, 4);
        this.freezeWaveOrigin = { x: orb.x, y: orb.y };
        this.satisfyTutorialWait("collect_freeze");
      } else {
        this.satisfyTutorialWait("collect_normal");
        if (this.orbMultiplierRemaining > 0) {
          this.satisfyTutorialWait("collect_while_multiplier");
        }
      }

      const timeBonusSec = this.orbMultiplierValue > 1 ? 1 : 0.5;
      this.runClockTime = Math.max(0, this.runClockTime - timeBonusSec);
      this.levelTime = Math.max(0, this.levelTime - timeBonusSec);
      this.currentRunTimeMs = Math.floor(this.runClockTime * 1000);

      if (orbType === "normal") {
        this.levelOrbCollected += 1;
      }
      this.levelOrbCount += gained;
      if (!this.isTutorialRun) {
        if (orbType === "multiplier") {
          this.setStatusText(
            "Yellow orb: x2 orbs active for 8 seconds.",
            "Yellow orb: x2 active."
          );
        } else if (orbType === "freeze") {
          this.setStatusText(
            "Red orb: collapse frozen for 4 seconds.",
            "Red orb: freeze 4s."
          );
        } else {
          this.setStatusText(
            "Orb collected. Keep pushing upward before the maze gives way.",
            "Orb collected. Keep climbing."
          );
        }
      }
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
        const motionBlend = this.moveState.progress;
        const eased = this.lerp(this.easeInOutSine(motionBlend), this.easeInOutCubic(motionBlend), 0.35);
        const flow = this.smoothPulse(motionBlend) * 0.0085;
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
          if (this.isDailyRun) {
            this.dailyReplayTrack.push({
              t: Math.max(0, Number(this.runClockTime || 0)),
              x: this.player.x,
              y: this.player.y
            });
            if (this.dailyReplayTrack.length > 256) {
              this.dailyReplayTrack.shift();
            }
          }
          if (this.player.x === this.levelData.exit.x && this.player.y === this.levelData.exit.y) {
            this.moveState = null;
            this.beginExitSequence();
            return;
          }
          this.triggerImpact(this.player.x, this.player.y, this.moveState.dx, this.moveState.dy, 0.85);
          this.moveState = null;
          this.promoteBufferedMove();
        }
        return;
      }

      this.promoteBufferedMove();
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
      this.bufferedDirection = null;
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
      this.bufferedDirection = null;
      this.impactEffect = null;
      this.exitEffect = null;
      this.deathEffect = {
        time: 0,
        duration: 0.76,
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
      if (this.isMenuDemo) {
        this.demoStepCooldown = 0.22;
        this.hideInterludeActions();
        return;
      }
      if (this.isChallengeRun) {
        this.hideMessage();
        this.hideInterludeActions();
        this.setStatusText(
          "You collapsed. Waiting for your rival result...",
          "Waiting for rival..."
        );
        return;
      }
      this.hideMessage();
      this.showInterludeActions("lost");
      this.setStatusText(
        "The collapse got you. Reset and choose a cleaner line.",
        "The collapse got you."
      );
    }

    completeWinLevel() {
      this.phase = "won";
      this.exitEffect = null;
      this.winOverlayTime = 0;
      if (this.isMenuDemo) {
        this.demoStepCooldown = 0.28;
        this.hideInterludeActions();
        return;
      }

      this.currentRunTimeMs = Math.floor(this.runClockTime * 1000);
      this.lastRunBeatTop = false;

      if (!this.isTutorialRun && this.currentRunTimeMs > 0) {
        if (this.bestTimeMs <= 0 || this.currentRunTimeMs < this.bestTimeMs) {
          this.bestTimeMs = this.currentRunTimeMs;
          window.localStorage.setItem(BEST_TIME_KEY, String(this.bestTimeMs));
          window.dispatchEvent(new CustomEvent("slidey:best-time-updated", {
            detail: { bestTimeMs: this.bestTimeMs }
          }));
        }

        if (this.currentRunTimeMs < this.topRecord.timeMs) {
          this.topRecord = { name: "YOU", timeMs: this.currentRunTimeMs };
          this.lastRunBeatTop = true;
          this.saveTopRecord();
        }
        window.dispatchEvent(new CustomEvent("slidey:level-completed-time", {
          detail: {
            level: this.level,
            timeMs: this.currentRunTimeMs
          }
        }));
        if (this.isDailyRun) {
          window.dispatchEvent(new CustomEvent("slidey:daily-finished", {
            detail: {
              dateKey: this.dailyDateKey,
              level: this.level,
              timeMs: this.currentRunTimeMs,
              replay: this.dailyReplayTrack.slice(0, 256),
              shape: this.playerShape
            }
          }));
        }
      }

      if (!this.isTutorialRun) {
        const gainedOrbs = this.levelOrbCount;
        this.runOrbs += gainedOrbs;
        this.runValue.textContent = String(this.runOrbs).padStart(2, "0");
        window.dispatchEvent(new CustomEvent("slidey:orbs-earned", {
          detail: {
            gained: gainedOrbs,
            total: this.runOrbs,
            level: this.level,
            unlockedLevel: this.level + 1
          }
        }));
      }
      this.hideMessage();
      if (this.isChallengeRun) {
        this.hideInterludeActions();
      } else {
        this.showInterludeActions("won");
      }
      if (this.isTutorialRun) {
        this.setStatusText(
          "Tutorial complete: you can now start a normal run from the Start menu.",
          "Tutorial complete."
        );
      } else if (this.isChallengeRun) {
        this.setStatusText(
          "Finish locked in. Waiting for your rival result...",
          "Waiting for rival..."
        );
      } else {
        this.setStatusText(
          "You made it through the collapse. The next maze will be denser and more unstable.",
          "Level complete."
        );
      }
    }

    setWalletOrbs(orbs) {
      const safe = Math.max(0, Number.isFinite(orbs) ? Math.floor(orbs) : 0);
      this.runOrbs = safe;
      this.runValue.textContent = String(this.runOrbs).padStart(2, "0");
    }

    setPlayerShape(shape) {
      if (!PLAYER_SHAPES.has(shape)) {
        return;
      }
      this.playerShape = shape;
    }

    handleInterludeInput() {
      if (window.__neonInstallLock) {
        return;
      }
      if (this.isMenuDemo) {
        return;
      }
      if (this.isChallengeRun && (this.phase === "won" || this.phase === "lost")) {
        return;
      }

      if (this.phase === "won") {
        if (this.isTutorialRun) {
          if (this.tutorialStage < 2) {
            this.startTutorialStage(this.tutorialStage + 1);
          } else {
            this.enterMenuDemo();
            window.dispatchEvent(new CustomEvent("slidey:tutorial-complete", {
              detail: { reward: 20 }
            }));
            window.dispatchEvent(new CustomEvent("slidey:return-to-main"));
          }
        } else if (this.isChallengeRun) {
          this.startChallengeRun(this.level, { seed: this.challengeSeed, code: this.challengeCode });
        } else {
          this.startLevel(this.level + 1);
        }
      } else if (this.phase === "lost") {
        if (this.isChallengeRun) {
          this.startChallengeRun(this.level, { seed: this.challengeSeed, code: this.challengeCode });
        } else {
          this.startLevel(this.level, { tutorial: this.isTutorialRun, tutorialStage: this.tutorialStage });
        }
      }
    }

    handleReplayInput() {
      if (window.__neonInstallLock) {
        return;
      }
      if (this.isMenuDemo) {
        return;
      }
      if (this.isChallengeRun && (this.phase === "won" || this.phase === "lost")) {
        return;
      }
      if (this.phase === "won" || this.phase === "lost") {
        if (this.isChallengeRun) {
          this.startChallengeRun(this.level, { seed: this.challengeSeed, code: this.challengeCode });
        } else {
          this.startLevel(this.level, { tutorial: this.isTutorialRun, tutorialStage: this.tutorialStage });
        }
      }
    }

    returnToMainMenu() {
      if (window.__neonInstallLock) {
        return;
      }
      this.enterMenuDemo();
      window.dispatchEvent(new CustomEvent("slidey:return-to-main"));
    }

    updateHud() {
      const totalOrbs = this.countNormalOrbs();
      this.orbValue.textContent = `${String(this.levelOrbCollected).padStart(2, "0")} / ${String(totalOrbs).padStart(2, "0")}`;
      this.runValue.textContent = String(this.runOrbs).padStart(2, "0");
      if (this.timerValue) {
        this.timerValue.textContent = this.formatTime(this.currentRunTimeMs);
      }
      const ratio = this.clamp(this.levelTime / this.levelData.maxCollapseTime, 0, 1);
      this.dangerFill.style.width = `${ratio * 100}%`;
    }

    setLevelTopRecord(level, timeMs, holderName = "Top") {
      const lv = Math.max(1, Number.isFinite(level) ? Math.floor(level) : 1);
      if (!Number.isFinite(timeMs) || timeMs <= 0) {
        return;
      }
      this.levelTopRecords.set(lv, {
        timeMs: Math.floor(timeMs),
        holderName: typeof holderName === "string" && holderName.trim() ? holderName.trim() : "Top"
      });
    }

    showMessage(title, text) {
      this.messageTitle.textContent = title;
      this.messageText.textContent = text;
      this.messagePanel.classList.remove("hidden");
    }

    hideMessage() {
      this.messagePanel.classList.add("hidden");
    }

    showInterludeActions(mode) {
      if (!this.interludeActions) {
        return;
      }
      if (mode !== "won" && mode !== "lost") {
        this.hideInterludeActions();
        return;
      }
      this.interludeActions.classList.remove("hidden");
      if (this.replayRunBtn) {
        this.replayRunBtn.classList.remove("hidden");
        this.replayRunBtn.textContent = "Retry";
      }
      if (this.continueRunBtn) {
        this.continueRunBtn.classList.toggle("hidden", mode !== "won");
        this.continueRunBtn.textContent = this.isChallengeRun ? "Rematch" : "Continue";
      }
      if (this.mainMenuBtn) {
        this.mainMenuBtn.classList.remove("hidden");
      }
    }

    hideInterludeActions() {
      this.interludeActions?.classList.add("hidden");
    }

    countNormalOrbs() {
      if (this.isChallengeRun && this.challengeModifier === "no_orbs") {
        return 0;
      }
      let total = 0;
      for (const orb of this.levelData.orbCells.values()) {
        if ((orb.type || "normal") === "normal") {
          total += 1;
        }
      }
      return total;
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
      this.drawOrbPickupWhisper(ctx);
      this.drawFreezeWave(ctx);
      this.drawExit(ctx);
      this.drawFocusMask(ctx);
      this.drawImpactEffect(ctx);
      this.drawGhost(ctx);
      this.drawDailyReplayGhost(ctx);
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

      const freeze = this.getFreezeWaveState();
      if (freeze.active && freeze.factor > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(145,0,0,${0.08 + freeze.factor * 0.2})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
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

      for (let i = 0; i < 18; i += 1) {
        shards.push({
          angle: rng.next() * Math.PI * 2,
          distance: 0.24 + rng.next() * 0.56,
          width: 0.06 + rng.next() * 0.1,
          height: 0.03 + rng.next() * 0.08,
          spin: (rng.next() - 0.5) * 4.6,
          delay: rng.next() * 0.24,
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
      const cameraX = this.renderCamera?.x ?? this.camera?.x ?? 0;
      const cameraY = this.renderCamera?.y ?? this.camera?.y ?? 0;
      const parallaxX = cameraX * 0.028;
      const parallaxY = cameraY * 0.028;

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
          const dynamicWall = type === "floor" && this.isDynamicWallCell(x, y);
          const dynamicClosed = dynamicWall && this.isDynamicWallClosed(x, y);
          const collapseDelta = this.levelTime - this.levelData.collapseAt[y][x];

          if (collapsed) {
            if (collapseDelta < 0.62) {
              const p = this.clamp(collapseDelta / 0.62, 0, 1);
              const coreSize = cellSize * (0.92 - this.easeOut(p) * 0.8);
              const coreX = px + (cellSize - coreSize) * 0.5;
              const coreY = py + (cellSize - coreSize) * 0.5;
              ctx.fillStyle = `rgba(0,0,0,${0.35 + p * 0.55})`;
              ctx.fillRect(px, py, cellSize, cellSize);
              ctx.fillStyle = `rgba(255,${Math.floor(120 - p * 90)},${Math.floor(120 - p * 90)},${0.18 + (1 - p) * 0.26})`;
              ctx.fillRect(coreX, coreY, coreSize, coreSize);
              ctx.strokeStyle = `rgba(255,255,255,${0.08 + (1 - p) * 0.2})`;
              ctx.lineWidth = Math.max(1, cellSize * 0.03);
              ctx.strokeRect(coreX, coreY, coreSize, coreSize);
            } else {
              ctx.fillStyle = "rgba(0,0,0,0.94)";
              ctx.fillRect(px, py, cellSize, cellSize);
            }
            continue;
          }

          if (type === "wall" || dynamicClosed) {
            wallCells.push({ x, y, px, py });
            if (warning) {
              warningWallCells.push({ x, y, px, py });
            }
            continue;
          }

          const freezeTint = this.getFreezeTintAtCell(x + 0.5, y + 0.5);
          if (freezeTint > 0.01) {
            const base = warning ? 0.08 + pulse * 0.04 : 0.04;
            ctx.fillStyle = `rgba(255,${Math.floor(140 - freezeTint * 105)},${Math.floor(140 - freezeTint * 105)},${base + freezeTint * 0.14})`;
          } else {
            ctx.fillStyle = warning ? `rgba(255,255,255,${0.06 + pulse * 0.04})` : "rgba(255,255,255,0.028)";
          }
          ctx.fillRect(px, py, cellSize, cellSize);

          if (dynamicWall) {
            const cyclePulse = this.getDynamicWallPulse(x, y);
            ctx.strokeStyle = `rgba(255,255,255,${0.08 + cyclePulse * 0.18})`;
            ctx.lineWidth = Math.max(1, cellSize * 0.035);
            const inset = Math.max(2, cellSize * 0.26);
            ctx.strokeRect(px + inset, py + inset, cellSize - inset * 2, cellSize - inset * 2);
          }

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
      if (this.isChallengeRun && this.challengeModifier === "no_orbs") {
        return;
      }
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const pulse = 0.78 + Math.sin(this.levelTime * 3.6) * 0.08;
      const glowStrength = this.performanceProfile.glowStrength;
      const goldActive = this.orbMultiplierRemaining > 0;

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
        const orbType = orb.type || "normal";
        const special = orbType !== "normal";
        const radius = special ? Math.max(2.4, cellSize * 0.145) : Math.max(1.9, cellSize * 0.12);
        const pulseScale = special ? 1.08 : 1;
        const alphaPulse = 0.76 + Math.sin(this.levelTime * (orbType === "freeze" ? 4.5 : 4)) * 0.12;
        const freezeTint = this.getFreezeTintAtCell(orb.x + 0.5, orb.y + 0.5);
        let color = `rgba(255,255,255,${pulse * 0.92})`;
        let glow = `rgba(255,255,255,${0.45 + glowStrength * 0.55})`;
        if (goldActive) {
          color = `rgba(255,245,186,${0.93 + Math.sin(this.levelTime * 3.8) * 0.06})`;
          glow = "rgba(255,240,180,0.98)";
        } else if (orbType === "multiplier") {
          color = `rgba(255,222,90,${alphaPulse})`;
          glow = "rgba(255,214,86,0.9)";
        } else if (orbType === "freeze") {
          color = `rgba(255,92,92,${alphaPulse})`;
          glow = "rgba(255,92,92,0.9)";
        }
        if (!goldActive && freezeTint > 0.01) {
          color = `rgba(255,${Math.floor(130 - freezeTint * 90)},${Math.floor(130 - freezeTint * 90)},${0.74 + freezeTint * 0.18})`;
          glow = `rgba(255,78,78,${0.72 + freezeTint * 0.2})`;
        }

        ctx.save();
        if (glowStrength > 0) {
          ctx.shadowBlur = (special ? 13 : 10) * glowStrength;
          ctx.shadowColor = glow;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * pulseScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    drawOrbPickupWhisper(ctx) {
      if (!this.orbPickupWhisper) {
        return;
      }
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const progress = 1 - this.clamp(this.orbPickupWhisper.time / this.orbPickupWhisper.duration, 0, 1);
      const alpha = (1 - progress) * 0.075;
      if (alpha <= 0.003) {
        return;
      }

      const center = this.toScreen(this.orbPickupWhisper.x, this.orbPickupWhisper.y);
      const cx = center.x + cellSize / 2;
      const cy = center.y + cellSize / 2;
      const innerRadius = cellSize * (0.03 + progress * 0.04);
      const outerRadius = cellSize * (0.14 + progress * 0.16);

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();
      const ring = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
      ring.addColorStop(0, `rgba(255,255,255,${alpha})`);
      ring.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = ring;
      const size = outerRadius * 2;
      ctx.fillRect(cx - outerRadius, cy - outerRadius, size, size);
      ctx.restore();
    }

    drawFreezeWave(ctx) {
      const wave = this.getFreezeWaveState();
      if (!wave.active || !wave.center) {
        return;
      }

      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const centerPos = this.toScreen(wave.center.x, wave.center.y);
      const centerX = centerPos.x + cellSize / 2;
      const centerY = centerPos.y + cellSize / 2;
      const radius = Math.max(0, wave.radiusCells * cellSize);
      const alpha = this.clamp(0.18 + wave.factor * 0.24, 0, 0.46);

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();

      const ring = ctx.createRadialGradient(centerX, centerY, Math.max(0, radius - cellSize * 1.2), centerX, centerY, radius + cellSize * 0.9);
      ring.addColorStop(0, "rgba(255,80,80,0)");
      ring.addColorStop(0.62, `rgba(255,64,64,${alpha})`);
      ring.addColorStop(1, "rgba(255,64,64,0)");
      ctx.fillStyle = ring;
      ctx.fillRect(centerX - radius - cellSize * 2, centerY - radius - cellSize * 2, (radius + cellSize * 2) * 2, (radius + cellSize * 2) * 2);

      if (wave.phase === "out" || wave.phase === "back") {
        ctx.strokeStyle = `rgba(255,180,180,${0.18 + wave.factor * 0.22})`;
        ctx.lineWidth = Math.max(1, cellSize * 0.03);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    getExitVisualCache(cellSize, glowStrength) {
      const key = `${Math.round(cellSize * 10)}:${Math.round(glowStrength * 100)}`;
      const cached = this.exitVisualCache.get(key);
      if (cached) {
        return cached;
      }

      const padding = Math.ceil(cellSize * 0.62);
      const size = Math.ceil(cellSize + padding * 2);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const c = canvas.getContext("2d");

      if (!c) {
        return { canvas, padding };
      }

      const outerInset = cellSize * 0.14;
      const innerInset = cellSize * 0.27;
      const frameWidth = cellSize - outerInset * 2;
      const frameHeight = cellSize - outerInset * 2;
      const coreWidth = cellSize - innerInset * 2;
      const coreHeight = cellSize - innerInset * 2;

      c.translate(padding, padding);

      if (glowStrength > 0) {
        c.save();
        c.shadowBlur = 20 * glowStrength;
        c.shadowColor = `rgba(255,255,255,${0.48 + glowStrength * 0.42})`;
        c.strokeStyle = "rgba(255,255,255,0.92)";
        c.lineWidth = Math.max(2, cellSize * 0.075);
        c.strokeRect(outerInset, outerInset, frameWidth, frameHeight);
        c.restore();
      }

      if (glowStrength > 0) {
        c.save();
        c.shadowBlur = 14 * glowStrength;
        c.shadowColor = `rgba(255,255,255,${0.22 + glowStrength * 0.22})`;
        c.strokeStyle = "rgba(255,255,255,0.42)";
        c.lineWidth = Math.max(1, cellSize * 0.045);
        c.strokeRect(innerInset, innerInset, coreWidth, coreHeight);
        c.restore();
      }

      c.fillStyle = "rgba(255,255,255,0.26)";
      c.fillRect(innerInset, innerInset, coreWidth, coreHeight);

      c.save();
      c.strokeStyle = "rgba(255,255,255,0.34)";
      c.lineWidth = Math.max(1, cellSize * 0.04);
      const corner = cellSize * 0.15;
      c.beginPath();
      c.moveTo(outerInset, outerInset + corner);
      c.lineTo(outerInset, outerInset);
      c.lineTo(outerInset + corner, outerInset);
      c.moveTo(cellSize - outerInset - corner, outerInset);
      c.lineTo(cellSize - outerInset, outerInset);
      c.lineTo(cellSize - outerInset, outerInset + corner);
      c.moveTo(outerInset, cellSize - outerInset - corner);
      c.lineTo(outerInset, cellSize - outerInset);
      c.lineTo(outerInset + corner, cellSize - outerInset);
      c.moveTo(cellSize - outerInset - corner, cellSize - outerInset);
      c.lineTo(cellSize - outerInset, cellSize - outerInset);
      c.lineTo(cellSize - outerInset, cellSize - outerInset - corner);
      c.stroke();
      c.restore();

      const snapshot = { canvas, padding, innerInset, coreWidth, coreHeight };
      this.exitVisualCache.set(key, snapshot);
      return snapshot;
    }

    drawExit(ctx) {
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const enterBoost = this.exitEffect ? this.easeInOutSine(this.exitEffect.time / this.exitEffect.duration) : 0;
      const pulse = 0.82 + Math.sin(this.levelTime * (3.4 + enterBoost * 5)) * 0.08 + enterBoost * 0.18;
      const shimmer = (this.levelTime * (0.95 + enterBoost * 1.6)) % 1;
      const glowStrength = this.performanceProfile.glowStrength;
      const reducedEffects = this.performanceProfile.reducedEffects;
      const freezeTint = this.getFreezeTintAtCell(this.levelData.exit.x + 0.5, this.levelData.exit.y + 0.5);

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

      const cached = this.getExitVisualCache(cellSize, glowStrength);
      const aura = 0.16 + pulse * 0.08 + enterBoost * 0.1;
      const innerInset = cellSize * 0.27;
      const coreWidth = cellSize - innerInset * 2;
      const coreHeight = cellSize - innerInset * 2;

      ctx.save();
      ctx.globalAlpha = 0.86 + pulse * 0.1;
      ctx.drawImage(cached.canvas, x - cached.padding, y - cached.padding);
      ctx.restore();

      if (enterBoost > 0 && !reducedEffects) {
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(255,255,255,0.72)";
        ctx.strokeStyle = `rgba(255,255,255,${0.22 + enterBoost * 0.26})`;
        ctx.lineWidth = Math.max(1, cellSize * 0.055);
        const outerInset = cellSize * 0.14;
        const haloInset = outerInset - cellSize * (0.05 + enterBoost * 0.08);
        ctx.strokeRect(
          x + haloInset,
          y + haloInset,
          cellSize - haloInset * 2,
          cellSize - haloInset * 2
        );
        ctx.restore();
      }

      if (freezeTint > 0.01) {
        ctx.fillStyle = `rgba(255,${Math.floor(124 - freezeTint * 96)},${Math.floor(124 - freezeTint * 96)},${aura + freezeTint * 0.14})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${aura})`;
      }
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

      if (enterBoost > 0) {
        const shutterSizeY = (coreHeight * 0.5) * enterBoost;
        const shutterSizeX = (coreWidth * 0.5) * enterBoost * 0.8;
        const shutterAlpha = 0.24 + enterBoost * 0.62;

        ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${shutterAlpha})`;
        // top and bottom shutters
        ctx.fillRect(x + innerInset, y + innerInset, coreWidth, shutterSizeY);
        ctx.fillRect(x + innerInset, y + innerInset + coreHeight - shutterSizeY, coreWidth, shutterSizeY);
        // left and right shutters for a tighter close
        ctx.fillRect(x + innerInset, y + innerInset, shutterSizeX, coreHeight);
        ctx.fillRect(x + innerInset + coreWidth - shutterSizeX, y + innerInset, shutterSizeX, coreHeight);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${0.24 + enterBoost * 0.34})`;
        ctx.lineWidth = Math.max(1, cellSize * 0.03);
        ctx.strokeRect(
          x + innerInset + shutterSizeX,
          y + innerInset + shutterSizeY,
          Math.max(0, coreWidth - shutterSizeX * 2),
          Math.max(0, coreHeight - shutterSizeY * 2)
        );
        ctx.restore();
      }
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

      if (this.deathEffect) {
        this.drawPlayerDeath(ctx, centerX, centerY, size, frameX, frameY, viewportWidth, viewportHeight, cellSize);
        return;
      }

      if (this.phase === "lost" || this.phase === "won" || this.phase === "exiting") {
        return;
      }

      if (this.exitEffect) {
        return;
      }

      let pulse = 0.93 + Math.sin(this.levelTime * 2.4) * 0.025;
      let scaleX = 1;
      let scaleY = 1;
      let offsetX = 0;
      let offsetY = 0;
      const motionProfile = this.getShapeMotionProfile(this.playerShape);

      if (this.moveState) {
        const envelope = this.smoothPulse(this.moveState.progress);
        const stretch = 1 + envelope * motionProfile.moveStretch;
        const squeeze = 1 - envelope * motionProfile.moveSqueeze;
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
        const squashStrength = motionProfile.collisionSquash;
        const stretchStrength = motionProfile.collisionStretch;
        if (this.impactEffect.dx !== 0) {
          scaleX *= 1 - burst * squashStrength;
          scaleY *= 1 + burst * stretchStrength;
        } else {
          scaleY *= 1 - burst * squashStrength;
          scaleX *= 1 + burst * stretchStrength;
        }
      }

      const width = size * scaleX;
      const height = size * scaleY;
      const px = centerX - width / 2 + offsetX;
      const py = centerY - height / 2 + offsetY;
      const auraPulse = 0.84 + Math.sin(this.levelTime * 3.2) * 0.16;
      const freezeTint = this.getFreezeTintAtCell(this.player.renderX + 0.5, this.player.renderY + 0.5);
      const goldActive = this.orbMultiplierRemaining > 0;

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
        const auraR = 255;
        const auraG = freezeTint > 0.01 ? Math.floor(112 - freezeTint * 46) : (goldActive ? 208 : 255);
        const auraB = freezeTint > 0.01 ? Math.floor(112 - freezeTint * 46) : (goldActive ? 64 : 255);
        aura.addColorStop(0, `rgba(${auraR},${auraG},${auraB},${0.2 + glowStrength * 0.14})`);
        aura.addColorStop(0.38, `rgba(${auraR},${auraG},${auraB},${0.09 + glowStrength * 0.08})`);
        aura.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = aura;
        ctx.fillRect(centerX + offsetX - auraRadius, centerY + offsetY - auraRadius, auraRadius * 2, auraRadius * 2);
      }
      if (glowStrength > 0) {
        ctx.shadowBlur = 16 * glowStrength;
        if (freezeTint > 0.01) {
          ctx.shadowColor = `rgba(255,76,76,${0.68 + glowStrength * 0.3})`;
        } else if (goldActive) {
          ctx.shadowColor = `rgba(255,214,88,${0.62 + glowStrength * 0.38})`;
        } else {
          ctx.shadowColor = `rgba(255,255,255,${0.52 + glowStrength * 0.48})`;
        }
      }
      if (freezeTint > 0.01) {
        ctx.fillStyle = `rgba(255,${Math.floor(112 - freezeTint * 44)},${Math.floor(112 - freezeTint * 44)},${pulse})`;
      } else if (goldActive) {
        ctx.fillStyle = `rgba(255,216,72,${pulse})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      }
      this.drawShapeByType(ctx, this.playerShape, px, py, width, height, centerX + offsetX, centerY + offsetY);
      ctx.restore();
    }

    drawGhost(ctx) {
      if (!this.isChallengeRun) {
        return;
      }
      if (this.phase === "lost" || this.phase === "won") {
        return;
      }

      const now = Date.now();
      const states = this.ghostStates.length > 0
        ? this.ghostStates
        : (this.ghostState ? [this.ghostState] : []);
      if (!states.length) {
        return;
      }

      for (let i = 0; i < states.length; i += 1) {
        this.drawSingleGhost(ctx, states[i], now, i);
      }
    }

    drawSingleGhost(ctx, ghost, now, index = 0) {
      if (!ghost || !ghost.updatedAt || now - ghost.updatedAt > 3500) {
        return;
      }
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const gx = Number.isFinite(ghost.renderX) ? ghost.renderX : ghost.x;
      const gy = Number.isFinite(ghost.renderY) ? ghost.renderY : ghost.y;
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
        return;
      }
      const position = this.toScreen(gx, gy);
      const centerX = position.x + cellSize / 2;
      const centerY = position.y + cellSize / 2;
      const size = cellSize * 0.44;
      const shape = PLAYER_SHAPES.has(ghost.shape) ? ghost.shape : "square";
      const px = centerX - size / 2;
      const py = centerY - size / 2;
      const ageMs = Math.max(0, now - (ghost.updatedAt || now));
      const fade = this.clamp(1 - ageMs / 4200, 0, 1);
      const colorShift = index % 3;
      const color = colorShift === 1
        ? "rgba(176,255,220,0.88)"
        : (colorShift === 2 ? "rgba(214,196,255,0.86)" : "rgba(180,230,255,0.9)");

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();
      ctx.globalAlpha = 0.16 + fade * 0.24;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      this.drawShapeByType(ctx, shape, px, py, size, size, centerX, centerY);
      ctx.restore();
    }

    drawDailyReplayGhost(ctx) {
      if (!this.isDailyRun || !this.dailyReplayGhost || !this.dailyReplayGhost.current) {
        return;
      }
      if (this.phase === "lost" || this.phase === "won") {
        return;
      }
      const current = this.dailyReplayGhost.current;
      const { cellSize, frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;
      const position = this.toScreen(current.x, current.y);
      const centerX = position.x + cellSize / 2;
      const centerY = position.y + cellSize / 2;
      const size = cellSize * 0.4;
      const shape = PLAYER_SHAPES.has(this.dailyReplayGhost.shape) ? this.dailyReplayGhost.shape : "square";
      const width = size;
      const height = size;
      const px = centerX - width / 2;
      const py = centerY - height / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, viewportWidth, viewportHeight);
      ctx.clip();
      ctx.globalAlpha = 0.24;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(184,224,255,0.42)";
      ctx.fillStyle = "rgba(184,224,255,0.9)";
      this.drawShapeByType(ctx, shape, px, py, width, height, centerX, centerY);
      ctx.restore();
    }

    updateDailyReplayGhost() {
      if (!this.isDailyRun || !this.dailyReplayGhost || !Array.isArray(this.dailyReplayGhost.points)) {
        return;
      }
      if (this.phase !== "playing") {
        return;
      }
      const points = this.dailyReplayGhost.points;
      if (points.length < 2) {
        return;
      }
      const time = Math.max(0, Number(this.runClockTime || 0));
      let index = this.dailyReplayGhost.index || 0;
      while (index < points.length - 2 && points[index + 1].t <= time) {
        index += 1;
      }
      this.dailyReplayGhost.index = index;
      const a = points[index];
      const b = points[Math.min(points.length - 1, index + 1)];
      if (!a || !b) {
        return;
      }
      const span = Math.max(0.001, b.t - a.t);
      const p = this.clamp((time - a.t) / span, 0, 1);
      this.dailyReplayGhost.current = {
        x: this.lerp(a.x, b.x, p),
        y: this.lerp(a.y, b.y, p)
      };
    }

    setDailyReplayGhost(replay, shape = "square") {
      if (!Array.isArray(replay) || replay.length < 2) {
        this.dailyReplayGhost = null;
        return;
      }
      const points = replay
        .map((p) => ({
          t: Math.max(0, Number(p.t || 0)),
          x: Number(p.x),
          y: Number(p.y)
        }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .sort((a, b) => a.t - b.t);
      if (points.length < 2) {
        this.dailyReplayGhost = null;
        return;
      }
      this.dailyReplayGhost = {
        points: points.slice(0, 256),
        shape,
        index: 0,
        current: { x: points[0].x, y: points[0].y }
      };
    }

    clearDailyReplayGhost() {
      this.dailyReplayGhost = null;
    }

    updateGhost(delta) {
      if (!this.isChallengeRun) {
        return;
      }
      const states = this.ghostStates.length > 0 ? this.ghostStates : (this.ghostState ? [this.ghostState] : []);
      if (!states.length) {
        return;
      }
      for (const state of states) {
        if (!Number.isFinite(state.targetX) || !Number.isFinite(state.targetY)) {
          continue;
        }
        const speed = this.performanceProfile.isTouch ? 17 : 20;
        const blend = 1 - Math.exp(-speed * Math.max(0, delta));
        const predictLead = this.performanceProfile.isTouch ? 0.035 : 0.05;
        const px = state.targetX + (state.velocityX || 0) * predictLead;
        const py = state.targetY + (state.velocityY || 0) * predictLead;
        state.renderX += (px - state.renderX) * blend;
        state.renderY += (py - state.renderY) * blend;
        state.x = state.targetX;
        state.y = state.targetY;
      }
    }

    setGhostState(state) {
      if (!state || !Number.isFinite(state.x) || !Number.isFinite(state.y)) {
        return;
      }
      const nextTargetX = Number.isFinite(state.renderX) ? state.renderX : state.x;
      const nextTargetY = Number.isFinite(state.renderY) ? state.renderY : state.y;
      const now = Date.now();
      if (!this.ghostState) {
        this.ghostState = {
          x: state.x,
          y: state.y,
          targetX: nextTargetX,
          targetY: nextTargetY,
          renderX: nextTargetX,
          renderY: nextTargetY,
          velocityX: 0,
          velocityY: 0,
          shape: state.shape,
          updatedAt: now,
          lastTargetAt: now
        };
        this.ghostStates = [this.ghostState];
        return;
      }
      const prev = this.ghostState;
      const dt = Math.max(0.001, (now - (prev.lastTargetAt || now)) / 1000);
      const vx = (nextTargetX - prev.targetX) / dt;
      const vy = (nextTargetY - prev.targetY) / dt;
      prev.targetX = nextTargetX;
      prev.targetY = nextTargetY;
      prev.velocityX = this.clamp(vx, -30, 30);
      prev.velocityY = this.clamp(vy, -30, 30);
      prev.shape = state.shape;
      prev.updatedAt = now;
      prev.lastTargetAt = now;
      this.ghostStates = [prev];
    }

    setGhostStates(states) {
      if (!Array.isArray(states) || states.length === 0) {
        this.ghostStates = [];
        this.ghostState = null;
        return;
      }
      const next = [];
      for (let i = 0; i < states.length; i += 1) {
        const ghost = states[i];
        if (!ghost || !Number.isFinite(ghost.x) || !Number.isFinite(ghost.y)) {
          continue;
        }
        const prev = this.ghostStates[i];
        const now = Date.now();
        const targetX = Number.isFinite(ghost.renderX) ? ghost.renderX : ghost.x;
        const targetY = Number.isFinite(ghost.renderY) ? ghost.renderY : ghost.y;
        if (prev) {
          const dt = Math.max(0.001, (now - (prev.lastTargetAt || now)) / 1000);
          const vx = (targetX - prev.targetX) / dt;
          const vy = (targetY - prev.targetY) / dt;
          prev.targetX = targetX;
          prev.targetY = targetY;
          prev.velocityX = this.clamp(vx, -30, 30);
          prev.velocityY = this.clamp(vy, -30, 30);
          prev.shape = ghost.shape;
          prev.updatedAt = now;
          prev.lastTargetAt = now;
          next.push(prev);
        } else {
          next.push({
            x: ghost.x,
            y: ghost.y,
            targetX,
            targetY,
            renderX: targetX,
            renderY: targetY,
            velocityX: 0,
            velocityY: 0,
            shape: ghost.shape,
            updatedAt: now,
            lastTargetAt: now
          });
        }
      }
      this.ghostStates = next;
      this.ghostState = next[0] || null;
    }

    clearGhostState() {
      this.ghostState = null;
      this.ghostStates = [];
    }

    forceChallengeLoss() {
      if (!this.isChallengeRun) {
        return;
      }
      if (this.phase !== "playing") {
        return;
      }
      this.phase = "lost";
      this.hideInterludeActions();
      this.hideMessage();
      this.setStatusText(
        "Rival finished first. Challenge locked.",
        "Rival finished first."
      );
    }

    getChallengeSnapshot() {
      if (!this.isChallengeRun || this.isMenuDemo) {
        return null;
      }
      return {
        level: this.level,
        x: this.player.x,
        y: this.player.y,
        renderX: this.player.renderX,
        renderY: this.player.renderY,
        shape: this.playerShape,
        phase: this.phase,
        runTimeMs: this.currentRunTimeMs,
        updatedAt: Date.now()
      };
    }

    getShapeMotionProfile(shape) {
      const defaults = {
        moveStretch: 0.09,
        moveSqueeze: 0.045,
        collisionSquash: 0.18,
        collisionStretch: 0.12
      };
      const profiles = {
        square: defaults,
        triangle: { moveStretch: 0.1, moveSqueeze: 0.05, collisionSquash: 0.17, collisionStretch: 0.12 },
        circle: { moveStretch: 0.11, moveSqueeze: 0.055, collisionSquash: 0.3, collisionStretch: 0.22 },
        diamond: { moveStretch: 0.1, moveSqueeze: 0.052, collisionSquash: 0.2, collisionStretch: 0.13 },
        hex: { moveStretch: 0.084, moveSqueeze: 0.04, collisionSquash: 0.16, collisionStretch: 0.11 },
        star: { moveStretch: 0.12, moveSqueeze: 0.06, collisionSquash: 0.22, collisionStretch: 0.16 },
        capsule: { moveStretch: 0.125, moveSqueeze: 0.066, collisionSquash: 0.26, collisionStretch: 0.18 },
        cross: { moveStretch: 0.082, moveSqueeze: 0.04, collisionSquash: 0.19, collisionStretch: 0.14 },
        droplet: { moveStretch: 0.11, moveSqueeze: 0.05, collisionSquash: 0.24, collisionStretch: 0.17 },
        heart: { moveStretch: 0.118, moveSqueeze: 0.054, collisionSquash: 0.23, collisionStretch: 0.16 },
        moon: { moveStretch: 0.106, moveSqueeze: 0.05, collisionSquash: 0.22, collisionStretch: 0.15 },
        crown: { moveStretch: 0.09, moveSqueeze: 0.042, collisionSquash: 0.17, collisionStretch: 0.13 },
        bolt: { moveStretch: 0.128, moveSqueeze: 0.062, collisionSquash: 0.24, collisionStretch: 0.18 },
        cog: { moveStretch: 0.088, moveSqueeze: 0.042, collisionSquash: 0.18, collisionStretch: 0.12 },
        hourglass: { moveStretch: 0.102, moveSqueeze: 0.05, collisionSquash: 0.2, collisionStretch: 0.15 },
        kite: { moveStretch: 0.108, moveSqueeze: 0.05, collisionSquash: 0.21, collisionStretch: 0.15 },
        orbit: { moveStretch: 0.1, moveSqueeze: 0.047, collisionSquash: 0.19, collisionStretch: 0.14 }
      };
      return profiles[shape] || defaults;
    }

    drawShapeByType(ctx, shape, px, py, width, height, centerX, centerY) {
      if (shape === "circle") {
        this.drawCircleShape(ctx, px, py, width, height);
      } else if (shape === "triangle") {
        this.drawTriangleShape(ctx, centerX, centerY, width, height);
      } else if (shape === "diamond") {
        this.drawDiamondShape(ctx, centerX, centerY, width, height);
      } else if (shape === "hex") {
        this.drawRegularPolygon(ctx, centerX, centerY, Math.min(width, height) * 0.58, 6, this.levelTime * 0.6);
      } else if (shape === "star") {
        this.drawStarShape(ctx, centerX, centerY, Math.min(width, height) * 0.62, this.levelTime * 1.2);
      } else if (shape === "capsule") {
        this.drawCapsuleShape(ctx, centerX, centerY, width, height);
      } else if (shape === "cross") {
        this.drawCrossShape(ctx, centerX, centerY, width, height, this.levelTime * 0.5);
      } else if (shape === "droplet") {
        this.drawDropletShape(ctx, centerX, centerY, width, height);
      } else if (shape === "heart") {
        this.drawHeartShape(ctx, centerX, centerY, width, height);
      } else if (shape === "moon") {
        this.drawMoonShape(ctx, centerX, centerY, width, height);
      } else if (shape === "crown") {
        this.drawCrownShape(ctx, centerX, centerY, width, height);
      } else if (shape === "bolt") {
        this.drawBoltShape(ctx, centerX, centerY, width, height);
      } else if (shape === "cog") {
        this.drawCogShape(ctx, centerX, centerY, width, height);
      } else if (shape === "hourglass") {
        this.drawHourglassShape(ctx, centerX, centerY, width, height);
      } else if (shape === "kite") {
        this.drawKiteShape(ctx, centerX, centerY, width, height);
      } else if (shape === "orbit") {
        this.drawOrbitShape(ctx, centerX, centerY, width, height);
      } else {
        this.drawSquareShape(ctx, px, py, width, height);
      }
    }

    drawSquareShape(ctx, px, py, width, height) {
      ctx.fillRect(px, py, width, height);
    }

    drawCircleShape(ctx, px, py, width, height) {
      ctx.beginPath();
      ctx.ellipse(px + width / 2, py + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawTriangleShape(ctx, centerX, centerY, width, height) {
      const travel = this.moveState
        ? { dx: this.moveState.dx, dy: this.moveState.dy }
        : (this.impactEffect ? { dx: this.impactEffect.dx, dy: this.impactEffect.dy } : this.lastMoveDirection);
      const magnitude = Math.hypot(travel.dx, travel.dy) || 1;
      const dirX = travel.dx / magnitude;
      const dirY = travel.dy / magnitude;
      const perpX = -dirY;
      const perpY = dirX;
      const wobble = this.moveState ? Math.sin(this.triangleSpinTime) * 0.22 : 0;
      const sin = Math.sin(wobble);
      const cos = Math.cos(wobble);
      const basisDirX = dirX * cos - dirY * sin;
      const basisDirY = dirX * sin + dirY * cos;
      const basisPerpX = -basisDirY;
      const basisPerpY = basisDirX;
      const halfBase = width * 0.52;
      const tipLen = height * 0.62;
      const baseLen = height * 0.42;
      const baseCenterX = centerX + basisDirX * baseLen;
      const baseCenterY = centerY + basisDirY * baseLen;
      const tipX = centerX - basisDirX * tipLen;
      const tipY = centerY - basisDirY * tipLen;
      const leftX = baseCenterX + basisPerpX * halfBase;
      const leftY = baseCenterY + basisPerpY * halfBase;
      const rightX = baseCenterX - basisPerpX * halfBase;
      const rightY = baseCenterY - basisPerpY * halfBase;

      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fill();
    }

    drawDiamondShape(ctx, centerX, centerY, width, height) {
      const spin = this.moveState ? this.levelTime * 4.2 : this.levelTime * 1.7;
      const rx = width * 0.5;
      const ry = height * 0.5;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(Math.PI / 4 + spin * 0.05);
      ctx.fillRect(-rx * 0.76, -ry * 0.76, rx * 1.52, ry * 1.52);
      ctx.restore();
    }

    drawRegularPolygon(ctx, centerX, centerY, radius, sides, rotation = 0) {
      ctx.beginPath();
      for (let i = 0; i < sides; i += 1) {
        const angle = rotation + (i / sides) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
    }

    drawStarShape(ctx, centerX, centerY, radius, spin) {
      const inner = radius * 0.46;
      const points = 5;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i += 1) {
        const angle = spin + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? radius : inner;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
    }

    drawCapsuleShape(ctx, centerX, centerY, width, height) {
      const horizontal = Math.abs(this.lastMoveDirection.dx) >= Math.abs(this.lastMoveDirection.dy);
      const bodyW = horizontal ? width * 1.1 : width * 0.84;
      const bodyH = horizontal ? height * 0.78 : height * 1.12;
      const radius = Math.min(bodyW, bodyH) * 0.5;
      ctx.beginPath();
      ctx.roundRect(centerX - bodyW / 2, centerY - bodyH / 2, bodyW, bodyH, radius);
      ctx.fill();
    }

    drawCrossShape(ctx, centerX, centerY, width, height, spin) {
      const arm = Math.min(width, height) * 0.26;
      const len = Math.min(width, height) * 0.92;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(spin);
      ctx.fillRect(-arm / 2, -len / 2, arm, len);
      ctx.fillRect(-len / 2, -arm / 2, len, arm);
      ctx.restore();
    }

    drawDropletShape(ctx, centerX, centerY, width, height) {
      const wobble = this.moveState ? Math.sin(this.levelTime * 8.2) * 0.14 : Math.sin(this.levelTime * 2.8) * 0.05;
      const stretchY = height * (1.08 + wobble);
      const stretchX = width * (0.84 - wobble * 0.35);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - stretchY * 0.62);
      ctx.bezierCurveTo(
        centerX + stretchX * 0.7, centerY - stretchY * 0.34,
        centerX + stretchX * 0.76, centerY + stretchY * 0.24,
        centerX, centerY + stretchY * 0.62
      );
      ctx.bezierCurveTo(
        centerX - stretchX * 0.76, centerY + stretchY * 0.24,
        centerX - stretchX * 0.7, centerY - stretchY * 0.34,
        centerX, centerY - stretchY * 0.62
      );
      ctx.closePath();
      ctx.fill();
    }

    drawHeartShape(ctx, centerX, centerY, width, height) {
      const w = width * 0.9;
      const h = height * 0.92;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + h * 0.42);
      ctx.bezierCurveTo(centerX - w * 0.58, centerY + h * 0.08, centerX - w * 0.62, centerY - h * 0.34, centerX, centerY - h * 0.04);
      ctx.bezierCurveTo(centerX + w * 0.62, centerY - h * 0.34, centerX + w * 0.58, centerY + h * 0.08, centerX, centerY + h * 0.42);
      ctx.closePath();
      ctx.fill();
    }

    drawMoonShape(ctx, centerX, centerY, width, height) {
      const r = Math.min(width, height) * 0.52;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.arc(centerX + r * 0.34, centerY - r * 0.08, r * 0.86, 0, Math.PI * 2, true);
      ctx.fill();
    }

    drawCrownShape(ctx, centerX, centerY, width, height) {
      const w = width * 0.94;
      const h = height * 0.9;
      ctx.beginPath();
      ctx.moveTo(centerX - w * 0.5, centerY + h * 0.35);
      ctx.lineTo(centerX - w * 0.5, centerY - h * 0.08);
      ctx.lineTo(centerX - w * 0.25, centerY + h * 0.03);
      ctx.lineTo(centerX - w * 0.08, centerY - h * 0.33);
      ctx.lineTo(centerX, centerY - h * 0.02);
      ctx.lineTo(centerX + w * 0.08, centerY - h * 0.33);
      ctx.lineTo(centerX + w * 0.25, centerY + h * 0.03);
      ctx.lineTo(centerX + w * 0.5, centerY - h * 0.08);
      ctx.lineTo(centerX + w * 0.5, centerY + h * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    drawBoltShape(ctx, centerX, centerY, width, height) {
      const w = width * 0.86;
      const h = height * 0.92;
      ctx.beginPath();
      ctx.moveTo(centerX + w * 0.04, centerY - h * 0.5);
      ctx.lineTo(centerX - w * 0.24, centerY - h * 0.06);
      ctx.lineTo(centerX, centerY - h * 0.06);
      ctx.lineTo(centerX - w * 0.22, centerY + h * 0.5);
      ctx.lineTo(centerX + w * 0.27, centerY - h * 0.02);
      ctx.lineTo(centerX, centerY - h * 0.02);
      ctx.closePath();
      ctx.fill();
    }

    drawCogShape(ctx, centerX, centerY, width, height) {
      const radius = Math.min(width, height) * 0.5;
      const inner = radius * 0.62;
      const teeth = 10;
      const spin = this.levelTime * 0.9;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i += 1) {
        const angle = spin + (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? radius : inner;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
    }

    drawHourglassShape(ctx, centerX, centerY, width, height) {
      const w = width * 0.8;
      const h = height * 0.9;
      ctx.beginPath();
      ctx.moveTo(centerX - w * 0.5, centerY - h * 0.5);
      ctx.lineTo(centerX + w * 0.5, centerY - h * 0.5);
      ctx.lineTo(centerX + w * 0.16, centerY);
      ctx.lineTo(centerX + w * 0.5, centerY + h * 0.5);
      ctx.lineTo(centerX - w * 0.5, centerY + h * 0.5);
      ctx.lineTo(centerX - w * 0.16, centerY);
      ctx.closePath();
      ctx.fill();
    }

    drawKiteShape(ctx, centerX, centerY, width, height) {
      const w = width * 0.78;
      const h = height * 0.94;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - h * 0.5);
      ctx.lineTo(centerX + w * 0.5, centerY);
      ctx.lineTo(centerX, centerY + h * 0.5);
      ctx.lineTo(centerX - w * 0.5, centerY);
      ctx.closePath();
      ctx.fill();
    }

    drawOrbitShape(ctx, centerX, centerY, width, height) {
      const core = Math.min(width, height) * 0.22;
      const rx = width * 0.48;
      const ry = height * 0.33;
      const spin = this.levelTime * 2.1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, core, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha *= 0.82;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1.2, Math.min(width, height) * 0.08);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, rx, ry, spin, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawPlayerDeath(ctx, centerX, centerY, size, frameX, frameY, viewportWidth, viewportHeight, cellSize) {
      const progress = this.clamp(this.deathEffect.time / this.deathEffect.duration, 0, 1);
      const implode = this.easeInOutCubic(Math.min(1, progress * 1.08));
      const flash = 1 - progress;
      const coreScale = 1 - implode * 0.92;
      const coreSize = Math.max(cellSize * 0.045, size * coreScale);
      const ringRadius = cellSize * (0.08 + progress * 0.6);
      const outerRingRadius = cellSize * (0.16 + progress * 0.92);
      const wellRadius = cellSize * (0.16 + progress * 0.5);
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
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + flash * 0.18})`;
      ctx.lineWidth = Math.max(1, cellSize * 0.02);
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRingRadius, 0, Math.PI * 2);
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

      const shockAlpha = (1 - progress) * 0.22;
      if (shockAlpha > 0.01) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${shockAlpha})`;
        ctx.lineWidth = Math.max(1, cellSize * 0.028);
        ctx.beginPath();
        ctx.arc(centerX, centerY, cellSize * (0.18 + progress * 1.25), 0, Math.PI * 2);
        ctx.stroke();
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
      const freezeFocus = this.clamp(this.collapseFreezeRemaining / 4, 0, 1);
      const innerRadius = cellSize * (0.88 + intro * 0.14) * (1 - freezeFocus * 0.18);
      const outerRadius = Math.max(viewportWidth, viewportHeight) * (0.24 + (1 - intro) * 0.07) * (1 - freezeFocus * 0.12);
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        innerRadius,
        centerX,
        centerY,
        outerRadius
      );
      gradient.addColorStop(0, `rgba(0,0,0,${0.02 + intro * 0.04 + freezeFocus * 0.06})`);
      gradient.addColorStop(0.36, `rgba(0,0,0,${0.24 + intro * 0.18 + freezeFocus * 0.2})`);
      gradient.addColorStop(1, `rgba(0,0,0,${0.82 + intro * 0.08 + freezeFocus * 0.12})`);

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
      const title = `Level ${String(this.level).padStart(2, "0")} complete`;
      const runLabel = `Run: ${this.formatTime(this.currentRunTimeMs)}`;
      const levelTop = this.levelTopRecords.get(this.level);
      const topLabel = levelTop
        ? `Level ${String(this.level).padStart(2, "0")} Top: ${this.formatTime(levelTop.timeMs)}`
        : `Level ${String(this.level).padStart(2, "0")} Top: --:--.--`;
      const { frameX, frameY, viewportWidth, viewportHeight } = this.boardMetrics;

      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.34 + progress * 0.34})`;
      ctx.fillRect(0, 0, width, height);

      const cardWidth = Math.min(viewportWidth * 0.82, 420);
      const cardHeight = Math.min(viewportHeight * 0.34, 200);
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
      ctx.fillText(title, cardX + cardWidth / 2, cardY + cardHeight * 0.24);

      ctx.fillStyle = `rgba(255,255,255,${0.66 + progress * 0.14})`;
      ctx.font = `600 ${Math.max(11, Math.min(17, cardWidth * 0.04))}px ${this.getUiFont()}`;
      ctx.fillText(runLabel, cardX + cardWidth / 2, cardY + cardHeight * 0.52);
      ctx.fillText(topLabel, cardX + cardWidth / 2, cardY + cardHeight * 0.67);

      const lineWidth = cardWidth * 0.34;
      ctx.strokeStyle = `rgba(255,255,255,${0.26 + progress * 0.12})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + (cardWidth - lineWidth) / 2, cardY + cardHeight * 0.8);
      ctx.lineTo(cardX + (cardWidth + lineWidth) / 2, cardY + cardHeight * 0.8);
      ctx.stroke();
      ctx.restore();
    }

    drawLoseOverlay(ctx, width, height) {
      const progress = this.easeOut(this.clamp(this.loseOverlayTime / 0.42, 0, 1));
      const pulse = 0.74 + Math.sin((this.levelTime + this.loseOverlayTime) * 4.8) * 0.06;
      const title = "Collapsed";
      const subtitle = `${String(this.levelOrbCollected).padStart(2, "0")} orbs recovered`;
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

      const lineWidth = cardWidth * 0.28;
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + pulse * 0.16})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + (cardWidth - lineWidth) / 2, cardY + cardHeight * 0.72);
      ctx.lineTo(cardX + (cardWidth + lineWidth) / 2, cardY + cardHeight * 0.72);
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

    isCollapsedAt(x, y, time) {
      if (x < 0 || y < 0 || y >= this.levelData.rows || x >= this.levelData.cols) {
        return true;
      }
      const collapseTime = this.levelData.collapseAt[y]?.[x] ?? 0;
      return time >= collapseTime;
    }

    isWallCell(x, y) {
      return (
        x >= 0 &&
        y >= 0 &&
        y < this.levelData.rows &&
        x < this.levelData.cols &&
        (this.levelData.grid[y][x] === "wall" || this.isDynamicWallClosed(x, y)) &&
        !this.isCollapsed(x, y)
      );
    }

    isDynamicWallCell(x, y) {
      if (!this.levelData || !this.levelData.dynamicWallMap) {
        return false;
      }
      return this.levelData.dynamicWallMap.has(this.cellKey(x, y));
    }

    isDynamicWallClosed(x, y, time = this.levelTime) {
      if (!this.isDynamicWallCell(x, y)) {
        return false;
      }
      const config = this.levelData.dynamicWallMap.get(this.cellKey(x, y));
      if (!config || config.cycle <= 0) {
        return false;
      }
      const phase = ((time || 0) + config.offset) % config.cycle;
      const openSpan = config.cycle * config.openWindow;
      return phase > openSpan;
    }

    getDynamicWallPulse(x, y, time = this.levelTime) {
      if (!this.isDynamicWallCell(x, y)) {
        return 0;
      }
      const config = this.levelData.dynamicWallMap.get(this.cellKey(x, y));
      if (!config || config.cycle <= 0) {
        return 0;
      }
      const phase = ((time || 0) + config.offset) % config.cycle;
      return 0.5 + Math.sin((phase / config.cycle) * Math.PI * 2) * 0.5;
    }

    resetCamera() {
      const target = this.getCameraTarget();
      this.camera.x = target.x;
      this.camera.y = target.y;
      this.cameraVelocity.x = 0;
      this.cameraVelocity.y = 0;
      this.renderCamera.x = target.x;
      this.renderCamera.y = target.y;
    }

    updateCamera() {
      const target = this.getCameraTarget();
      const delta = Math.max(0.001, Math.min(0.05, this.lastDelta || 1 / 60));
      const follow = 1 - Math.exp(-delta * (this.moveState ? 13.5 : 9.5));
      this.camera.x = this.lerp(this.camera.x, target.x, follow);
      this.camera.y = this.lerp(this.camera.y, target.y, follow);
      const snap = 1 / Math.max(1, this.pixelRatio || 1);
      this.renderCamera.x = Math.round(this.camera.x / snap) * snap;
      this.renderCamera.y = Math.round(this.camera.y / snap) * snap;
    }

    getCameraTarget() {
      const { cellSize, viewportWidth, viewportHeight, worldWidth, worldHeight } = this.boardMetrics;
      const playerCenterX = (this.player.renderX + 0.5) * cellSize;
      const playerCenterY = (this.player.renderY + 0.5) * cellSize;
      let lookAheadX = 0;
      let lookAheadY = 0;

      if (this.moveState) {
        const lookAheadFactor = Math.sin(this.moveState.progress * Math.PI * 0.5);
        const lookAheadCells = Math.min(0.8, 0.3 + this.moveState.distance * 0.035);
        lookAheadX += this.moveState.dx * cellSize * lookAheadCells * lookAheadFactor;
        lookAheadY += this.moveState.dy * cellSize * lookAheadCells * lookAheadFactor;
      }

      if (this.impactEffect) {
        const impactBlend = this.springOut(1 - this.impactEffect.time / this.impactEffect.duration) * 0.08;
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
      const cameraX = this.renderCamera?.x ?? this.camera.x;
      const cameraY = this.renderCamera?.y ?? this.camera.y;
      return {
        startX: this.clamp(Math.floor(cameraX / cellSize) - 2, 0, this.levelData.cols - 1),
        endX: this.clamp(Math.ceil((cameraX + viewportWidth) / cellSize) + 2, 0, this.levelData.cols - 1),
        startY: this.clamp(Math.floor(cameraY / cellSize) - 2, 0, this.levelData.rows - 1),
        endY: this.clamp(Math.ceil((cameraY + viewportHeight) / cellSize) + 2, 0, this.levelData.rows - 1),
      };
    }

    toScreen(cellX, cellY) {
      const { cellSize, frameX, frameY } = this.boardMetrics;
      const cameraX = this.renderCamera?.x ?? this.camera.x;
      const cameraY = this.renderCamera?.y ?? this.camera.y;
      return {
        x: frameX + cellX * cellSize - cameraX,
        y: frameY + cellY * cellSize - cameraY,
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
        return Math.max(10, shortEdge * 0.02);
      }
      return Math.max(18, shortEdge * 0.035);
    }

    promoteBufferedMove() {
      if (!this.bufferedDirection || this.moveState || this.pendingDirection || this.phase !== "playing") {
        return;
      }
      this.pendingDirection = this.bufferedDirection;
      this.bufferedDirection = null;
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

    scheduleResize() {
      if (this.resizeRafId) {
        return;
      }
      this.resizeRafId = window.requestAnimationFrame(() => {
        this.resizeRafId = 0;
        this.resizeCanvas();
      });
    }

    computePerformanceProfile(viewportWidth = window.innerWidth, viewportHeight = window.innerHeight) {
      const coarsePointer = this.isCoarsePointer();
      const reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const shortEdge = Math.max(1, Math.min(viewportWidth || 0, viewportHeight || 0));
      const longEdge = Math.max(1, Math.max(viewportWidth || 0, viewportHeight || 0));
      const viewportArea = Math.max(1, shortEdge * longEdge);
      const ultraCompact = coarsePointer && shortEdge < 420;
      const deviceMemory = Number(window.navigator?.deviceMemory || 0);
      const cpuCores = Number(window.navigator?.hardwareConcurrency || 0);
      const connection = window.navigator?.connection;
      const saveData = Boolean(connection?.saveData);
      const effectiveType = String(connection?.effectiveType || "");
      const lowPowerTouch = coarsePointer && (
        saveData ||
        effectiveType === "slow-2g" ||
        effectiveType === "2g" ||
        (deviceMemory > 0 && deviceMemory <= 3) ||
        (cpuCores > 0 && cpuCores <= 4)
      );
      const highQualityMobile = coarsePointer && !ultraCompact && !lowPowerTouch && !reducedMotion && (
        (deviceMemory >= 6 && cpuCores >= 6) ||
        (deviceMemory >= 8) ||
        (cpuCores >= 8)
      );
      const reducedEffects = reducedMotion || (coarsePointer && (shortEdge < 360 || lowPowerTouch));
      const renderBudget = coarsePointer
        ? (highQualityMobile ? 3000000 : (ultraCompact || lowPowerTouch ? 1700000 : 2200000))
        : 5600000;
      const adaptiveCap = Math.sqrt(renderBudget / viewportArea);
      const maxTouchRatio = ultraCompact ? 1.35 : (highQualityMobile ? 1.8 : 1.6);
      const pixelRatioCap = this.clamp(adaptiveCap, 1.15, coarsePointer ? maxTouchRatio : 3);
      const baseGlow = coarsePointer ? (ultraCompact || lowPowerTouch ? 0.52 : 0.74) : 1;
      const glowStrength = highQualityMobile ? Math.min(1, baseGlow + 0.18) : baseGlow;
      const backdropGlowAlpha = highQualityMobile
        ? 0.9
        : (coarsePointer ? (ultraCompact || lowPowerTouch ? 0.52 : 0.72) : 1);
      const ambientParticleCount = coarsePointer
        ? (highQualityMobile ? 5 : (ultraCompact || lowPowerTouch ? 1 : 3))
        : 14;

      return {
        isTouch: coarsePointer,
        isPhone: ultraCompact,
        highQualityMobile,
        reducedEffects,
        dynamicFocusMask: !reducedEffects || highQualityMobile,
        glowStrength,
        backdropGlowAlpha,
        pixelRatioCap,
        maxDelta: coarsePointer ? 0.16 : 0.1,
        slideDurationScale: coarsePointer ? ((ultraCompact || lowPowerTouch) ? 0.86 : 0.92) : 0.98,
        ambientParticleCount,
      };
    }

    isCompactViewport() {
      return window.innerWidth < 820 || window.innerHeight < 760 || this.isCoarsePointer();
    }

    setStatusText(fullText, compactText = fullText) {
      if (!this.isTutorialRun && !this.isMenuDemo && !this.isChallengeRun) {
        this.statusText.textContent = "";
        return;
      }
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
