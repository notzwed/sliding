"use strict";

(function () {
  const GUEST_WALLET_KEY = "slidey_wallet";
  const GUEST_LEVEL_KEY = "slidey_highest_level";
  const BEST_TIME_KEY = "slidey_best_time_ms";
  const LEVEL_TOP_CACHE_KEY = "slidey_level_top_cache";
  const TUTORIAL_COMPLETED_KEY = "slidey_tutorial_completed";
  const UNLOCKED_SHAPES_KEY = "slidey_unlocked_shapes";
  const SELECTED_SHAPE_KEY = "slidey_selected_shape";
  const DEVICE_ID_KEY = "slidey_device_id";
  const REMOTE_TABLE = "player_profiles";
  const CHALLENGE_TABLE = "challenge_presence";
  const LEVEL_RECORDS_TABLE = "level_records";
  const DAILY_RUNS_TABLE = "daily_runs";
  const REMOTE_COMMIT_API = "https://api.github.com/repos/notzwed/sliding/commits/main";
  const LAST_REMOTE_COMMIT_KEY = "slidey_last_remote_commit";
  const DAILY_RUN_CACHE_KEY = "slidey_daily_cache_v1";
  const DAILY_ATTEMPTS_KEY = "slidey_daily_attempts_v1";
  const DAILY_REWARD_CLAIMS_KEY = "slidey_daily_reward_claims_v1";
  const DAILY_LEVEL = 10;
  const DAILY_UNLOCK_LEVEL = 10;
  const DAILY_MAX_ATTEMPTS = 3;
  const DAILY_LEADERBOARD_LIMIT = 10;
  const GLOBAL_LEADERBOARD_LIMIT = 50;
  const ACTIVE_LEADERBOARD_WINDOW_MS = 2 * 60 * 60 * 1000;
  const CHAOS_MIN_LEVEL = 15;
  const CHAOS_MAX_PLAYERS = 4;
  const CHAOS_ROUNDS_TO_WIN = 2;
  const CHAOS_TOTAL_ROUNDS = 3;
  const CHAOS_CONTROL_DEVICE = "_chaos_control";

  const installGate = document.getElementById("installGate");
  const installAction = document.getElementById("installAction");
  const appUpdateBtn = document.getElementById("appUpdateBtn");
  const startupSplash = document.getElementById("startupSplash");
  const startMenu = document.getElementById("startMenu");
  const bestTimeValue = document.getElementById("bestTimeValue");
  const menuOrbsValue = document.getElementById("menuOrbsValue");
  const startRunBtn = document.getElementById("startRunBtn");
  const dailyRunBtn = document.getElementById("dailyRunBtn");
  const challengeBtn = document.getElementById("challengeBtn");
  const storeBtn = document.getElementById("storeBtn");
  const tutorialBtn = document.getElementById("tutorialBtn");
  const shopMenu = document.getElementById("shopMenu");
  const closeShopBtn = document.getElementById("closeShopBtn");
  const challengeMenu = document.getElementById("challengeMenu");
  const createChallengeBtn = document.getElementById("createChallengeBtn");
  const joinChallengeBtn = document.getElementById("joinChallengeBtn");
  const closeChallengeBtn = document.getElementById("closeChallengeBtn");
  const copyChallengeBtn = document.getElementById("copyChallengeBtn");
  const challengeCodeValue = document.getElementById("challengeCodeValue");
  const challengeCodeInput = document.getElementById("challengeCodeInput");
  const challengeJoinPanel = document.getElementById("challengeJoinPanel");
  const challengeJoinConfirmBtn = document.getElementById("challengeJoinConfirmBtn");
  const challengeJoinCancelBtn = document.getElementById("challengeJoinCancelBtn");
  const challengeStatusText = document.getElementById("challengeStatusText");
  const challengeModeClassicBtn = document.getElementById("challengeModeClassicBtn");
  const challengeModeChaosBtn = document.getElementById("challengeModeChaosBtn");
  const challengeModeHint = document.getElementById("challengeModeHint");
  const chaosStartBtn = document.getElementById("chaosStartBtn");
  const chaosVotePanel = document.getElementById("chaosVotePanel");
  const chaosVoteTitle = document.getElementById("chaosVoteTitle");
  const chaosMapVoteGroup = document.getElementById("chaosMapVoteGroup");
  const chaosModVoteGroup = document.getElementById("chaosModVoteGroup");
  const chaosVoteOptionButtons = Array.from(document.querySelectorAll(".chaos-vote-option"));
  const challengeResultScreen = document.getElementById("challengeResultScreen");
  const challengeFirstValue = document.getElementById("challengeFirstValue");
  const challengeLastValue = document.getElementById("challengeLastValue");
  const challengeResultDetail = document.getElementById("challengeResultDetail");
  const challengeResultCloseBtn = document.getElementById("challengeResultCloseBtn");
  const dailyMenu = document.getElementById("dailyMenu");
  const dailyDateLabel = document.getElementById("dailyDateLabel");
  const dailyStatusText = document.getElementById("dailyStatusText");
  const dailyLeaderboardList = document.getElementById("dailyLeaderboardList");
  const dailyStartBtn = document.getElementById("dailyStartBtn");
  const dailyCloseBtn = document.getElementById("dailyCloseBtn");
  const globalLeaderboardBtn = document.getElementById("globalLeaderboardBtn");
  const globalLeaderboardMenu = document.getElementById("globalLeaderboardMenu");
  const globalLbTabOrbs = document.getElementById("globalLbTabOrbs");
  const globalLbTabTime = document.getElementById("globalLbTabTime");
  const globalLbTabLevels = document.getElementById("globalLbTabLevels");
  const globalLeaderboardStatus = document.getElementById("globalLeaderboardStatus");
  const globalLeaderboardList = document.getElementById("globalLeaderboardList");
  const globalLeaderboardCloseBtn = document.getElementById("globalLeaderboardCloseBtn");
  const shopOrbsValue = document.getElementById("shopOrbsValue");
  const shapeButtons = Array.from(document.querySelectorAll(".shop-button[data-shape]"));

  const SHAPE_CATALOG = [
    { shape: "square", cost: 0 },
    { shape: "triangle", cost: 60 },
    { shape: "circle", cost: 90 },
    { shape: "diamond", cost: 130 },
    { shape: "hex", cost: 170 },
    { shape: "star", cost: 220 },
    { shape: "capsule", cost: 280 },
    { shape: "cross", cost: 350 },
    { shape: "droplet", cost: 430 },
    { shape: "heart", cost: 520 },
    { shape: "moon", cost: 630 },
    { shape: "crown", cost: 900 },
    { shape: "bolt", cost: 1060 },
    { shape: "cog", cost: 1230 },
    { shape: "hourglass", cost: 1600 },
    { shape: "kite", cost: 1800 },
    { shape: "orbit", cost: 2050 }
  ];
  const ALLOWED_SHAPES = new Set(SHAPE_CATALOG.map((item) => item.shape));

  let deferredInstallPrompt = null;
  let promptedOnce = false;
  let supabaseClient = null;
  let deviceId = "";
  let walletOrbs = 0;
  let highestLevel = 1;
  let tutorialCompleted = false;
  let selectedShape = "square";
  let unlockedShapes = new Set(["square"]);
  let levelTopCache = {};
  let challengePushTimer = null;
  let challengePullTimer = null;
  let challengeCountdownTimer = null;
  let challengeRealtimeChannel = null;
  let challengeRoom = "";
  let challengeResultAutoCloseTimer = null;
  let challengeLocalResult = null;
  let challengeOpponentResult = null;
  let challengeResultShown = false;
  let challengeMode = "classic";
  let chaosHost = false;
  let chaosLoopTimer = null;
  let chaosLoopBusy = false;
  let chaosLastPresencePushAt = 0;
  let chaosState = null;
  let chaosPlayerMeta = {
    mapVote: "",
    modifierVote: "",
    stage: "lobby",
    round: 1,
    result: "playing",
    runMs: 0
  };
  let dailyInfo = null;
  let dailyLeaderboard = [];
  let dailyTopReplay = null;
  let globalLeaderboardState = {
    orbs: [],
    time: [],
    levels: []
  };
  let globalLeaderboardTab = "orbs";
  let globalLeaderboardFetchedAt = 0;
  let globalLeaderboardLoading = false;
  let globalLeaderboardBaseStatus = "";
  let globalLeaderboardRanks = { orbs: null, time: null, levels: null };
  let remoteSupportsBestTime = true;
  let profileHeartbeatTimer = null;
  let swRegistration = null;
  let appUpdateReady = false;
  let latestRemoteCommitSha = "";
  let swControllerReloaded = false;
  let updateApplyInProgress = false;
  let updateCheckIntervalId = null;
  let lastUpdateCheckAt = 0;
  let startupSplashDone = false;

  const isIos = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  const isStandalone = () =>
    Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  const isInstallTargetDevice = () =>
    Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || isIos();

  const shouldRequireInstall = () => isInstallTargetDevice() && !isStandalone();

  const setUpdateSpotlight = (enabled) => {
    document.body.classList.toggle("update-prompt-active", Boolean(enabled));
  };

  const showAppUpdateButton = (label = "Update Available", spotlight = false) => {
    if (!appUpdateBtn) {
      return;
    }
    appUpdateBtn.textContent = label;
    appUpdateBtn.classList.remove("hidden");
    appUpdateBtn.setAttribute("aria-hidden", "false");
    setUpdateSpotlight(spotlight);
  };

  const hideAppUpdateButton = () => {
    if (!appUpdateBtn) {
      return;
    }
    appUpdateBtn.classList.add("hidden");
    appUpdateBtn.setAttribute("aria-hidden", "true");
    setUpdateSpotlight(false);
  };

  const setupClientHardening = () => {
    // Browser devtools cannot be fully blocked, this only adds lightweight client-side deterrence.
    window.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      const blocked =
        key === "f12" ||
        (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (event.ctrlKey && key === "u");
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, { capture: true });
  };

  const markRemoteCommitSeen = (sha) => {
    if (!sha) {
      return;
    }
    window.localStorage.setItem(LAST_REMOTE_COMMIT_KEY, sha);
  };

  const getSeenRemoteCommit = () => window.localStorage.getItem(LAST_REMOTE_COMMIT_KEY) || "";

  const getNeedsCommitRefresh = () => {
    const seen = getSeenRemoteCommit();
    return Boolean(latestRemoteCommitSha && seen && latestRemoteCommitSha !== seen);
  };

  const runStartupSplash = () => {
    if (!startupSplash || startupSplashDone) {
      return;
    }
    startupSplashDone = true;
    const reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reducedMotion) {
      startupSplash.classList.add("is-done");
      return;
    }
    startupSplash.classList.add("is-playing");
    const revealDelayMs = 3000;
    const doneDelayMs = 4100;
    window.setTimeout(() => {
      startupSplash.classList.add("is-revealing");
    }, revealDelayMs);
    window.setTimeout(() => {
      startupSplash.classList.remove("is-playing", "is-revealing");
      startupSplash.classList.add("is-done");
    }, doneDelayMs);
  };

  const requestServiceWorkerUpdate = async () => {
    if (!swRegistration) {
      return false;
    }
    try {
      await swRegistration.update();
    } catch (_error) {
      return false;
    }
    if (swRegistration.waiting) {
      handleUpdateReady();
      return true;
    }
    return false;
  };

  const applyPendingUpdate = async () => {
    if (!swRegistration) {
      return;
    }
    if (updateApplyInProgress) {
      return;
    }
    updateApplyInProgress = true;
    showAppUpdateButton("Updating...", true);
    const waiting = swRegistration.waiting;
    if (waiting) {
      if (latestRemoteCommitSha) {
        markRemoteCommitSeen(latestRemoteCommitSha);
      }
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => {
        updateApplyInProgress = false;
      }, 4000);
      return;
    }
    const hasWaitingAfterUpdate = await requestServiceWorkerUpdate();
    if (hasWaitingAfterUpdate) {
      if (latestRemoteCommitSha) {
        markRemoteCommitSeen(latestRemoteCommitSha);
      }
      swRegistration.waiting?.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => {
        updateApplyInProgress = false;
      }, 4000);
      return;
    }
    if (isStandalone() && getNeedsCommitRefresh()) {
      if (latestRemoteCommitSha) {
        markRemoteCommitSeen(latestRemoteCommitSha);
      }
      const url = new URL(window.location.href);
      url.searchParams.set("refresh", String(Date.now()));
      window.location.replace(url.toString());
      return;
    }
    showAppUpdateButton("No Update Yet", false);
    window.setTimeout(() => {
      if (!appUpdateReady) {
        hideAppUpdateButton();
      }
    }, 1600);
    updateApplyInProgress = false;
  };

  const handleUpdateReady = () => {
    appUpdateReady = true;
    showAppUpdateButton("Update Ready", true);
    if (isStandalone()) {
      window.setTimeout(() => {
        void applyPendingUpdate();
      }, 250);
    }
  };

  const monitorServiceWorkerRegistration = (registration) => {
    if (!registration) {
      return;
    }
    swRegistration = registration;
    if (registration.waiting) {
      handleUpdateReady();
    }
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) {
        return;
      }
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          handleUpdateReady();
        }
      });
    });
  };

  const checkForRemoteCommitUpdate = async () => {
    try {
      const response = await fetch(REMOTE_COMMIT_API, {
        method: "GET",
        cache: "no-store"
      });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const sha = typeof payload?.sha === "string" ? payload.sha : "";
      if (!sha) {
        return;
      }
      latestRemoteCommitSha = sha;
      const seen = getSeenRemoteCommit();
      if (!seen) {
        markRemoteCommitSeen(sha);
        return false;
      }
      if (sha !== seen) {
        showAppUpdateButton("Update Ready", true);
        await requestServiceWorkerUpdate();
        if (swRegistration?.waiting) {
          handleUpdateReady();
        }
        return true;
      }
      if (!appUpdateReady) {
        hideAppUpdateButton();
      }
      return false;
    } catch (_error) {
      return false;
    }
  };

  const checkForAppUpdates = async ({ force = false } = {}) => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastUpdateCheckAt < 15000) {
      return;
    }
    lastUpdateCheckAt = now;
    await requestServiceWorkerUpdate();
    await checkForRemoteCommitUpdate();
  };

  const readNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : fallback;
  };

  const formatTime = (milliseconds) => {
    const safe = Math.max(0, readNumber(milliseconds, 0));
    if (safe <= 0) {
      return "--:--.--";
    }
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const centiseconds = Math.floor((safe % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  };

  const updateBestTimeDisplay = (bestMs) => {
    if (!bestTimeValue) {
      return;
    }
    bestTimeValue.textContent = formatTime(bestMs);
  };

  const updateMenuOrbsDisplay = () => {
    if (menuOrbsValue) {
      menuOrbsValue.textContent = String(walletOrbs).padStart(2, "0");
    }
    if (shopOrbsValue) {
      shopOrbsValue.textContent = String(walletOrbs).padStart(2, "0");
    }
  };

  const readLevelTopCache = () => {
    const raw = window.localStorage.getItem(LEVEL_TOP_CACHE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      return parsed;
    } catch (_error) {
      return {};
    }
  };

  const persistLevelTopCache = () => {
    window.localStorage.setItem(LEVEL_TOP_CACHE_KEY, JSON.stringify(levelTopCache));
  };

  const getPlayerAlias = () => {
    const tail = deviceId.slice(-4).toUpperCase();
    return `P-${tail}`;
  };

  const getBestTimeMsLocal = () =>
    Math.max(0, readNumber(window.localStorage.getItem(BEST_TIME_KEY), 0));

  const applyLevelTopToGame = (level) => {
    const key = String(Math.max(1, readNumber(level, 1)));
    const record = levelTopCache[key];
    if (!record || !window.__slideyGame?.setLevelTopRecord) {
      return;
    }
    window.__slideyGame.setLevelTopRecord(Number(key), readNumber(record.timeMs, 0), record.name || "Top");
  };

  const cacheLevelTop = (level, timeMs, name = "Top") => {
    const lv = Math.max(1, readNumber(level, 1));
    const t = Math.max(1, readNumber(timeMs, 0));
    if (!t) {
      return;
    }
    levelTopCache[String(lv)] = { timeMs: t, name };
    persistLevelTopCache();
    applyLevelTopToGame(lv);
  };

  const readUnlockedShapes = () => {
    const raw = window.localStorage.getItem(UNLOCKED_SHAPES_KEY);
    if (!raw) {
      return new Set(["square"]);
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const safe = new Set(parsed.filter((value) => ALLOWED_SHAPES.has(value)));
        safe.add("square");
        return safe;
      }
    } catch (_error) {
    }
    return new Set(["square"]);
  };

  const persistShapeState = () => {
    window.localStorage.setItem(UNLOCKED_SHAPES_KEY, JSON.stringify(Array.from(unlockedShapes)));
    window.localStorage.setItem(SELECTED_SHAPE_KEY, selectedShape);
  };

  const getOrCreateDeviceId = () => {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const randomTail = Math.random().toString(36).slice(2, 10);
    const generated = `slidey-${Date.now().toString(36)}-${randomTail}`;
    window.localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  };

  const applyWalletToGame = () => {
    if (window.__slideyGame && typeof window.__slideyGame.setWalletOrbs === "function") {
      window.__slideyGame.setWalletOrbs(walletOrbs);
      return;
    }

    const runValue = document.getElementById("runValue");
    if (runValue) {
      runValue.textContent = String(walletOrbs).padStart(2, "0");
    }
  };

  const applyProgressToGame = () => {
    if (!window.__slideyGame || typeof window.__slideyGame.setUnlockedLevel !== "function") {
      return;
    }
    window.__slideyGame.setUnlockedLevel(highestLevel);
  };

  const applyShapeToGame = () => {
    if (!window.__slideyGame || typeof window.__slideyGame.setPlayerShape !== "function") {
      return;
    }
    window.__slideyGame.setPlayerShape(selectedShape);
  };

  const updateShapeButtons = () => {
    for (const button of shapeButtons) {
      const shape = button.dataset.shape;
      if (!shape) {
        continue;
      }
      const config = SHAPE_CATALOG.find((item) => item.shape === shape);
      if (!config) {
        continue;
      }
      const unlocked = unlockedShapes.has(shape);
      const selected = selectedShape === shape;
      button.classList.toggle("is-selected", selected);

      if (unlocked) {
        button.textContent = selected ? "Selected" : "Select";
        button.disabled = selected;
      } else {
        button.textContent = walletOrbs >= config.cost ? "Buy" : `Need ${config.cost}`;
        button.disabled = walletOrbs < config.cost;
      }
    }
  };

  const hideStartMenu = () => {
    if (!startMenu) {
      return;
    }
    startMenu.classList.add("hidden");
    startMenu.setAttribute("aria-hidden", "true");
    globalLeaderboardBtn?.classList.add("hidden");
  };

  const showStartMenu = () => {
    if (!startMenu) {
      return;
    }
    startMenu.classList.remove("hidden");
    startMenu.setAttribute("aria-hidden", "false");
    globalLeaderboardBtn?.classList.remove("hidden");
  };

  const hideShopMenu = () => {
    if (!shopMenu) {
      return;
    }
    shopMenu.classList.add("hidden");
    shopMenu.setAttribute("aria-hidden", "true");
  };

  const hideChallengeMenu = () => {
    if (!challengeMenu) {
      return;
    }
    challengeJoinPanel?.classList.add("hidden");
    challengeJoinPanel?.setAttribute("aria-hidden", "true");
    challengeMenu.classList.add("hidden");
    challengeMenu.setAttribute("aria-hidden", "true");
  };

  const hideGlobalLeaderboardMenu = () => {
    if (!globalLeaderboardMenu) {
      return;
    }
    globalLeaderboardMenu.classList.add("hidden");
    globalLeaderboardMenu.setAttribute("aria-hidden", "true");
  };

  const openChallengeJoinPanel = () => {
    challengeJoinPanel?.classList.remove("hidden");
    challengeJoinPanel?.setAttribute("aria-hidden", "false");
    if (challengeCodeInput) {
      challengeCodeInput.focus();
      challengeCodeInput.select();
    }
  };

  const closeChallengeJoinPanel = ({ clear = false } = {}) => {
    challengeJoinPanel?.classList.add("hidden");
    challengeJoinPanel?.setAttribute("aria-hidden", "true");
    if (clear && challengeCodeInput) {
      challengeCodeInput.value = "";
    }
  };

  const showChallengeMenu = () => {
    if (!challengeMenu) {
      return;
    }
    hideShopMenu();
    hideDailyMenu();
    hideGlobalLeaderboardMenu();
    challengeMenu.classList.remove("hidden");
    challengeMenu.setAttribute("aria-hidden", "false");
    closeChallengeJoinPanel();
    updateChallengeModeUi();
  };

  const updateChallengeModeUi = () => {
    const chaosUnlocked = highestLevel >= CHAOS_MIN_LEVEL;
    if (challengeMode === "chaos" && !chaosUnlocked) {
      challengeMode = "classic";
    }
    const classicActive = challengeMode === "classic";
    challengeModeClassicBtn?.classList.toggle("is-active", classicActive);
    challengeModeClassicBtn?.setAttribute("aria-selected", classicActive ? "true" : "false");
    challengeModeChaosBtn?.classList.toggle("is-active", !classicActive);
    challengeModeChaosBtn?.setAttribute("aria-selected", classicActive ? "false" : "true");
    if (challengeModeChaosBtn) {
      challengeModeChaosBtn.disabled = !chaosUnlocked;
    }
    if (challengeModeHint) {
      challengeModeHint.textContent = classicActive
        ? "Classic: 1v1 speed race on the same seeded map."
        : (chaosUnlocked
          ? "Chaos: up to 4 players, votes + best-of-3. Unlock at level 15."
          : "Chaos unlocks at level 15.");
    }
    if (chaosVotePanel) {
      const visible = challengeMode === "chaos";
      chaosVotePanel.classList.toggle("hidden", !visible);
      chaosVotePanel.setAttribute("aria-hidden", visible ? "false" : "true");
    }
    if (chaosStartBtn) {
      const showStart = challengeMode === "chaos" && chaosHost && (!chaosState || chaosState.stage === "lobby");
      chaosStartBtn.classList.toggle("hidden", !showStart);
    }
  };

  const setChallengeMode = (mode) => {
    if (mode !== "classic" && mode !== "chaos") {
      return;
    }
    if (mode === "chaos" && highestLevel < CHAOS_MIN_LEVEL) {
      setChallengeStatus(`Chaos unlocks at level ${CHAOS_MIN_LEVEL}.`);
      return;
    }
    challengeMode = mode;
    updateChallengeModeUi();
    if (mode === "chaos") {
      setChallengeStatus("Chaos mode ready. Create a code or join one.");
    } else {
      setChallengeStatus("Create or enter a 5-character challenge code.");
    }
  };

  const setChaosVoteUi = (stage, currentVote = "") => {
    const mapStage = stage === "vote_map";
    const modStage = stage === "vote_modifier";
    chaosMapVoteGroup?.classList.toggle("hidden", !mapStage);
    chaosModVoteGroup?.classList.toggle("hidden", !modStage);
    if (chaosVoteTitle) {
      chaosVoteTitle.textContent = mapStage ? "Vote Map Size" : (modStage ? "Vote Modifier" : "Chaos");
    }
    for (const button of chaosVoteOptionButtons) {
      const value = button.dataset.voteValue || "";
      button.classList.toggle("is-selected", value === currentVote);
    }
  };

  const setChallengeStatus = (text) => {
    if (challengeStatusText) {
      challengeStatusText.textContent = text;
    }
  };

  const hideChallengeResultScreen = () => {
    if (challengeResultAutoCloseTimer) {
      window.clearTimeout(challengeResultAutoCloseTimer);
      challengeResultAutoCloseTimer = null;
    }
    if (!challengeResultScreen) {
      return;
    }
    challengeResultScreen.classList.add("hidden");
    challengeResultScreen.setAttribute("aria-hidden", "true");
  };

  const showChallengeResultScreen = (firstLabel, lastLabel, detailText) => {
    if (!challengeResultScreen) {
      return;
    }
    if (challengeFirstValue) {
      challengeFirstValue.textContent = firstLabel;
    }
    if (challengeLastValue) {
      challengeLastValue.textContent = lastLabel;
    }
    if (challengeResultDetail) {
      challengeResultDetail.textContent = detailText;
    }
    challengeResultScreen.classList.remove("hidden");
    challengeResultScreen.setAttribute("aria-hidden", "false");
  };

  const showShopMenu = () => {
    if (!shopMenu) {
      return;
    }
    hideChallengeMenu();
    hideDailyMenu();
    hideGlobalLeaderboardMenu();
    updateMenuOrbsDisplay();
    updateShapeButtons();
    shopMenu.classList.remove("hidden");
    shopMenu.setAttribute("aria-hidden", "false");
  };

  const hideDailyMenu = () => {
    if (!dailyMenu) {
      return;
    }
    dailyMenu.classList.add("hidden");
    dailyMenu.setAttribute("aria-hidden", "true");
  };

  const renderDailyLeaderboard = () => {
    if (!dailyLeaderboardList) {
      return;
    }
    dailyLeaderboardList.textContent = "";
    const visibleEntries = Array.isArray(dailyLeaderboard) ? dailyLeaderboard.slice(0, DAILY_LEADERBOARD_LIMIT) : [];
    if (!visibleEntries.length) {
      const empty = document.createElement("li");
      empty.textContent = "No runs yet for today.";
      dailyLeaderboardList.appendChild(empty);
      return;
    }
    visibleEntries.forEach((entry, index) => {
      const li = document.createElement("li");
      const mark = entry.device_id === deviceId ? " (You)" : "";
      li.textContent = `#${index + 1} ${entry.player_alias || "Player"}${mark} - ${formatTime(entry.time_ms)}`;
      dailyLeaderboardList.appendChild(li);
    });
  };

  const setDailyStatus = (text) => {
    if (dailyStatusText) {
      dailyStatusText.textContent = text;
    }
  };

  const setGlobalLeaderboardStatus = (text) => {
    globalLeaderboardBaseStatus = text || "";
    if (globalLeaderboardStatus) {
      const rank = readNumber(globalLeaderboardRanks[globalLeaderboardTab], 0);
      let suffix = "";
      if (rank > GLOBAL_LEADERBOARD_LIMIT) {
        suffix = ` Your rank: #${rank} (outside top ${GLOBAL_LEADERBOARD_LIMIT}).`;
      } else if (rank > 0) {
        suffix = ` Your rank: #${rank}.`;
      }
      globalLeaderboardStatus.textContent = `${globalLeaderboardBaseStatus}${suffix}`.trim();
    }
  };

  const getActiveCutoffIso = () => new Date(Date.now() - ACTIVE_LEADERBOARD_WINDOW_MS).toISOString();

  const formatGlobalPlayerName = (entryDeviceId) => {
    if (typeof entryDeviceId === "string" && entryDeviceId === deviceId) {
      return "You";
    }
    const tail = typeof entryDeviceId === "string" ? entryDeviceId.slice(-4).toUpperCase() : "----";
    return `P-${tail}`;
  };

  const getGlobalLeaderboardEntriesForTab = () => {
    if (globalLeaderboardTab === "time") {
      return Array.isArray(globalLeaderboardState.time) ? globalLeaderboardState.time : [];
    }
    if (globalLeaderboardTab === "levels") {
      return Array.isArray(globalLeaderboardState.levels) ? globalLeaderboardState.levels : [];
    }
    return Array.isArray(globalLeaderboardState.orbs) ? globalLeaderboardState.orbs : [];
  };

  const renderGlobalLeaderboard = () => {
    if (!globalLeaderboardList) {
      return;
    }
    const tabs = [globalLbTabOrbs, globalLbTabTime, globalLbTabLevels];
    tabs.forEach((tab) => {
      if (!tab) {
        return;
      }
      tab.classList.toggle("is-active", tab.dataset.tab === globalLeaderboardTab);
    });
    globalLeaderboardList.textContent = "";
    const entries = getGlobalLeaderboardEntriesForTab().slice(0, GLOBAL_LEADERBOARD_LIMIT);
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.textContent = "No entries available yet.";
      globalLeaderboardList.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const li = document.createElement("li");
      const name = formatGlobalPlayerName(entry.device_id);
      if (globalLeaderboardTab === "time") {
        li.textContent = `#${index + 1} ${name} - ${formatTime(entry.best_time_ms)}`;
      } else if (globalLeaderboardTab === "levels") {
        li.textContent = `#${index + 1} ${name} - Lv ${Math.max(1, readNumber(entry.highest_level, 1))} | ${Math.max(0, readNumber(entry.wallet_orbs, 0))} orbs`;
      } else {
        li.textContent = `#${index + 1} ${name} - ${Math.max(0, readNumber(entry.wallet_orbs, 0))} orbs`;
      }
      globalLeaderboardList.appendChild(li);
    });
  };

  const setGlobalLeaderboardTab = (tab) => {
    const next = tab === "time" || tab === "levels" ? tab : "orbs";
    globalLeaderboardTab = next;
    renderGlobalLeaderboard();
    setGlobalLeaderboardStatus(globalLeaderboardBaseStatus);
  };

  const refreshGlobalLeaderboard = async ({ force = false } = {}) => {
    if (!globalLeaderboardMenu) {
      return;
    }
    const now = Date.now();
    if (!force && now - globalLeaderboardFetchedAt < 20000) {
      renderGlobalLeaderboard();
      return;
    }
    if (globalLeaderboardLoading) {
      return;
    }
    globalLeaderboardLoading = true;
    globalLeaderboardBtn?.setAttribute("aria-busy", "true");
    setGlobalLeaderboardStatus("Loading global leaderboard...");

    const localSnapshot = {
      device_id: deviceId,
      wallet_orbs: walletOrbs,
      highest_level: highestLevel,
      best_time_ms: getBestTimeMsLocal()
    };
    const cutoffIso = getActiveCutoffIso();

    try {
      if (!supabaseClient) {
        globalLeaderboardState = {
          orbs: [localSnapshot],
          levels: [localSnapshot],
          time: localSnapshot.best_time_ms > 0 ? [localSnapshot] : []
        };
        globalLeaderboardRanks = {
          orbs: 1,
          levels: 1,
          time: localSnapshot.best_time_ms > 0 ? 1 : null
        };
        globalLeaderboardFetchedAt = now;
        setGlobalLeaderboardStatus("Offline mode: local profile only.");
        renderGlobalLeaderboard();
        return;
      }

      const orbsQuery = supabaseClient
        .from(REMOTE_TABLE)
        .select("device_id,wallet_orbs")
        .gte("updated_at", cutoffIso)
        .order("wallet_orbs", { ascending: false })
        .limit(GLOBAL_LEADERBOARD_LIMIT);
      const levelsQuery = supabaseClient
        .from(REMOTE_TABLE)
        .select("device_id,highest_level,wallet_orbs")
        .gte("updated_at", cutoffIso)
        .order("highest_level", { ascending: false })
        .order("wallet_orbs", { ascending: false })
        .limit(GLOBAL_LEADERBOARD_LIMIT);

      const orbsRankQuery = supabaseClient
        .from(REMOTE_TABLE)
        .select("device_id", { count: "exact", head: true })
        .gte("updated_at", cutoffIso)
        .gt("wallet_orbs", Math.max(0, walletOrbs));
      const levelsHigherQuery = supabaseClient
        .from(REMOTE_TABLE)
        .select("device_id", { count: "exact", head: true })
        .gte("updated_at", cutoffIso)
        .gt("highest_level", Math.max(1, highestLevel));
      const levelsSameHigherOrbsQuery = supabaseClient
        .from(REMOTE_TABLE)
        .select("device_id", { count: "exact", head: true })
        .gte("updated_at", cutoffIso)
        .eq("highest_level", Math.max(1, highestLevel))
        .gt("wallet_orbs", Math.max(0, walletOrbs));

      const pending = [orbsQuery, levelsQuery, orbsRankQuery, levelsHigherQuery, levelsSameHigherOrbsQuery];
      if (remoteSupportsBestTime) {
        pending.push(
          supabaseClient
            .from(REMOTE_TABLE)
            .select("device_id,best_time_ms")
            .gte("updated_at", cutoffIso)
            .gt("best_time_ms", 0)
            .order("best_time_ms", { ascending: true })
            .limit(GLOBAL_LEADERBOARD_LIMIT)
        );
        if (localSnapshot.best_time_ms > 0) {
          pending.push(
            supabaseClient
              .from(REMOTE_TABLE)
              .select("device_id", { count: "exact", head: true })
              .gte("updated_at", cutoffIso)
              .gt("best_time_ms", 0)
              .lt("best_time_ms", localSnapshot.best_time_ms)
          );
        }
      }

      const responses = await Promise.all(pending);
      const orbsRes = responses[0];
      const levelsRes = responses[1];
      const orbsRankRes = responses[2];
      const levelsHigherRes = responses[3];
      const levelsSameHigherOrbsRes = responses[4];
      let timeData = [];
      let timeError = null;
      let timeRankRes = null;

      if (remoteSupportsBestTime) {
        const timeRes = responses[5];
        timeData = Array.isArray(timeRes.data) ? timeRes.data : [];
        timeError = timeRes.error || null;
        timeRankRes = localSnapshot.best_time_ms > 0 ? responses[6] : null;
        if (timeError && timeError.code === "42703") {
          remoteSupportsBestTime = false;
          timeError = null;
          timeData = [];
          timeRankRes = null;
        }
      }

      const orbsData = Array.isArray(orbsRes.data) ? orbsRes.data : [];
      const levelsData = Array.isArray(levelsRes.data) ? levelsRes.data : [];
      globalLeaderboardState = {
        orbs: orbsData,
        levels: levelsData,
        time: timeData
      };
      const orbsHigher = Math.max(0, readNumber(orbsRankRes.count, 0));
      const levelsHigher = Math.max(0, readNumber(levelsHigherRes.count, 0));
      const levelsSameHigher = Math.max(0, readNumber(levelsSameHigherOrbsRes.count, 0));
      const timeHigher = timeRankRes ? Math.max(0, readNumber(timeRankRes.count, 0)) : 0;
      globalLeaderboardRanks = {
        orbs: orbsHigher + 1,
        levels: levelsHigher + levelsSameHigher + 1,
        time: localSnapshot.best_time_ms > 0 ? (timeHigher + 1) : null
      };
      globalLeaderboardFetchedAt = Date.now();

      const hasTableError = [orbsRes.error, levelsRes.error, timeError].some((error) => error && error.code === "42P01");
      if (hasTableError) {
        setGlobalLeaderboardStatus("Leaderboard not active yet on server schema.");
      } else if (orbsRes.error || levelsRes.error || timeError) {
        setGlobalLeaderboardStatus("Leaderboard partially available, retry in a moment.");
      } else {
        setGlobalLeaderboardStatus(`Showing active players from last 2 hours. Updated ${new Date(globalLeaderboardFetchedAt).toLocaleTimeString()}.`);
      }
      renderGlobalLeaderboard();
    } catch (_error) {
      globalLeaderboardState = {
        orbs: [localSnapshot],
        levels: [localSnapshot],
        time: localSnapshot.best_time_ms > 0 ? [localSnapshot] : []
      };
      globalLeaderboardRanks = {
        orbs: 1,
        levels: 1,
        time: localSnapshot.best_time_ms > 0 ? 1 : null
      };
      setGlobalLeaderboardStatus("Leaderboard unavailable, showing local profile.");
      renderGlobalLeaderboard();
    } finally {
      globalLeaderboardLoading = false;
      globalLeaderboardBtn?.removeAttribute("aria-busy");
    }
  };

  const showGlobalLeaderboardMenu = () => {
    if (!globalLeaderboardMenu) {
      return;
    }
    hideShopMenu();
    hideChallengeMenu();
    hideDailyMenu();
    globalLeaderboardMenu.classList.remove("hidden");
    globalLeaderboardMenu.setAttribute("aria-hidden", "false");
    setGlobalLeaderboardTab(globalLeaderboardTab);
    void refreshGlobalLeaderboard({ force: false });
  };

  const showDailyMenu = () => {
    if (!dailyMenu) {
      return;
    }
    hideShopMenu();
    hideChallengeMenu();
    hideGlobalLeaderboardMenu();
    dailyInfo = buildDailyInfo();
    if (dailyDateLabel) {
      dailyDateLabel.textContent = formatDailyDateLabel(dailyInfo.dateKey);
    }
    syncDailyAccessUi(dailyInfo.dateKey);
    dailyMenu.classList.remove("hidden");
    dailyMenu.setAttribute("aria-hidden", "false");
    setDailyStatusWithAccess("Loading daily leaderboard...");
    renderDailyLeaderboard();
    void processDailyTopRewards();
    void refreshDailyLeaderboard();
  };

  const withGame = (callback) => {
    if (!window.__slideyGame) {
      return false;
    }
    callback(window.__slideyGame);
    return true;
  };

  const startNormalRun = () => {
    stopChallengeSync();
    if (!tutorialCompleted) {
      startTutorialRun();
      return;
    }
    const started = withGame((game) => {
      game.clearGhostState?.();
      game.setUnlockedLevel(highestLevel);
      game.startRun(highestLevel);
    });
    if (started) {
      hideShopMenu();
      hideChallengeMenu();
      hideGlobalLeaderboardMenu();
      hideStartMenu();
    }
  };

  const startTutorialRun = () => {
    stopChallengeSync();
    const started = withGame((game) => {
      game.clearGhostState?.();
      game.startTutorialRun();
    });
    if (started) {
      hideShopMenu();
      hideChallengeMenu();
      hideGlobalLeaderboardMenu();
      hideStartMenu();
    }
  };

  const clearChallengeCountdown = () => {
    if (challengeCountdownTimer) {
      window.clearInterval(challengeCountdownTimer);
      challengeCountdownTimer = null;
    }
  };

  const stopChallengeSync = () => {
    clearChallengeCountdown();
    clearChaosLoop();
    hideChallengeResultScreen();
    if (challengePushTimer) {
      window.clearInterval(challengePushTimer);
      challengePushTimer = null;
    }
    if (challengePullTimer) {
      window.clearInterval(challengePullTimer);
      challengePullTimer = null;
    }
    if (challengeRealtimeChannel && supabaseClient) {
      void supabaseClient.removeChannel(challengeRealtimeChannel);
      challengeRealtimeChannel = null;
    }
    if (supabaseClient && challengeRoom) {
      const room = challengeRoom;
      const wasChaosHost = chaosHost;
      challengeRoom = "";
      void supabaseClient
        .from(CHALLENGE_TABLE)
        .delete()
        .eq("challenge_code", room)
        .eq("device_id", deviceId)
        .then(() => {
        })
        .catch(() => {
        });
      if (wasChaosHost) {
        void supabaseClient
          .from(CHALLENGE_TABLE)
          .delete()
          .eq("challenge_code", room)
          .eq("device_id", CHAOS_CONTROL_DEVICE)
          .then(() => {
          })
          .catch(() => {
          });
      }
    }
    challengeRoom = "";
    challengeLocalResult = null;
    challengeOpponentResult = null;
    challengeResultShown = false;
    chaosHost = false;
    chaosLastPresencePushAt = 0;
    chaosState = null;
    chaosPlayerMeta = {
      mapVote: "",
      modifierVote: "",
      stage: "lobby",
      round: 1,
      result: "playing",
      runMs: 0
    };
    updateChallengeModeUi();
  };

  const randomCodeChunk = (size) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < size; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  };

  const hashStringToSeed = (value) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const readDailyAttempts = () => {
    try {
      const raw = window.localStorage.getItem(DAILY_ATTEMPTS_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  };

  const writeDailyAttempts = (attempts) => {
    window.localStorage.setItem(DAILY_ATTEMPTS_KEY, JSON.stringify(attempts));
  };

  const getDailyAttemptsUsed = (dateKey) => {
    const attempts = readDailyAttempts();
    return Math.max(0, readNumber(attempts[dateKey], 0));
  };

  const getDailyAttemptsRemaining = (dateKey) =>
    Math.max(0, DAILY_MAX_ATTEMPTS - getDailyAttemptsUsed(dateKey));

  const isDailyUnlocked = () => highestLevel >= DAILY_UNLOCK_LEVEL;

  const consumeDailyAttempt = (dateKey) => {
    const attempts = readDailyAttempts();
    const used = Math.max(0, readNumber(attempts[dateKey], 0));
    attempts[dateKey] = Math.min(DAILY_MAX_ATTEMPTS, used + 1);
    writeDailyAttempts(attempts);
    return getDailyAttemptsRemaining(dateKey);
  };

  const syncDailyAccessUi = (dateKey = getDailyDateKey()) => {
    const unlocked = isDailyUnlocked();
    const remaining = unlocked ? getDailyAttemptsRemaining(dateKey) : 0;
    if (dailyRunBtn) {
      // Keep Daily menu accessible for everyone so leaderboard is always visible.
      dailyRunBtn.disabled = false;
      dailyRunBtn.textContent = "Daily";
      dailyRunBtn.setAttribute("aria-disabled", "false");
    }
    if (dailyStartBtn) {
      const canStart = unlocked && remaining > 0;
      dailyStartBtn.disabled = !canStart;
      dailyStartBtn.setAttribute("aria-disabled", String(!canStart));
      if (!unlocked) {
        dailyStartBtn.textContent = `Unlock Lv${DAILY_UNLOCK_LEVEL}`;
      } else if (canStart) {
        dailyStartBtn.textContent = `Start Daily (${remaining}/${DAILY_MAX_ATTEMPTS})`;
      } else {
        dailyStartBtn.textContent = "No Attempts Left";
      }
    }
  };

  const setDailyStatusWithAccess = (base = "") => {
    const key = dailyInfo?.dateKey || getDailyDateKey();
    syncDailyAccessUi(key);
    if (!isDailyUnlocked()) {
      setDailyStatus(`Leaderboard available. Daily run unlocks at level ${DAILY_UNLOCK_LEVEL} (current: ${highestLevel}).`);
      return;
    }
    const remaining = getDailyAttemptsRemaining(key);
    if (remaining <= 0) {
      setDailyStatus(`No Daily attempts left (${DAILY_MAX_ATTEMPTS}/${DAILY_MAX_ATTEMPTS}). Reset at 06:00 Italy.`);
      return;
    }
    const suffix = `Attempts left: ${remaining}/${DAILY_MAX_ATTEMPTS}.`;
    setDailyStatus(base ? `${base} ${suffix}` : suffix);
  };

  const applyDailyGhostToGame = () => {
    withGame((game) => {
      if (!dailyTopReplay || !Array.isArray(dailyTopReplay.replay)) {
        game.clearDailyReplayGhost?.();
        return;
      }
      game.setDailyReplayGhost?.(dailyTopReplay.replay, dailyTopReplay.shape || "square");
    });
  };

  const startDailyRun = () => {
    stopChallengeSync();
    dailyInfo = buildDailyInfo();
    if (!isDailyUnlocked()) {
      setDailyStatusWithAccess();
      return;
    }
    if (getDailyAttemptsRemaining(dailyInfo.dateKey) <= 0) {
      setDailyStatusWithAccess();
      return;
    }
    const started = withGame((game) => {
      game.clearGhostState?.();
      game.startDailyRun?.(dailyInfo.level, { seed: dailyInfo.seed, dateKey: dailyInfo.dateKey });
      applyDailyGhostToGame();
    });
    if (started) {
      consumeDailyAttempt(dailyInfo.dateKey);
      syncDailyAccessUi(dailyInfo.dateKey);
      hideShopMenu();
      hideChallengeMenu();
      hideDailyMenu();
      hideGlobalLeaderboardMenu();
      hideStartMenu();
    }
  };

  const getRomeDateParts = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        map[part.type] = part.value;
      }
    }
    return {
      year: readNumber(map.year, 1970),
      month: readNumber(map.month, 1),
      day: readNumber(map.day, 1),
      hour: readNumber(map.hour, 0)
    };
  };

  const toDateKey = (year, month, day) =>
    `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;

  const shiftDateKey = (dateKey, days) => {
    if (!/^\d{8}$/.test(dateKey || "")) {
      return dateKey;
    }
    const y = Number.parseInt(dateKey.slice(0, 4), 10);
    const m = Number.parseInt(dateKey.slice(4, 6), 10) - 1;
    const d = Number.parseInt(dateKey.slice(6, 8), 10);
    const dt = new Date(Date.UTC(y, m, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return toDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  };

  const getDailyDateKey = (date = new Date()) => {
    const romeNow = getRomeDateParts(date);
    if (romeNow.hour >= 6) {
      return toDateKey(romeNow.year, romeNow.month, romeNow.day);
    }
    const previousRome = getRomeDateParts(new Date(date.getTime() - 24 * 60 * 60 * 1000));
    return toDateKey(previousRome.year, previousRome.month, previousRome.day);
  };

  const formatDailyDateLabel = (dateKey) => {
    if (!/^\d{8}$/.test(dateKey || "")) {
      return "Daily";
    }
    const y = Number.parseInt(dateKey.slice(0, 4), 10);
    const m = Number.parseInt(dateKey.slice(4, 6), 10) - 1;
    const d = Number.parseInt(dateKey.slice(6, 8), 10);
    const dt = new Date(Date.UTC(y, m, d));
    return `Seed ${dateKey} - ${dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "Europe/Rome" })} (reset 06:00 Italy)`;
  };

  const buildDailyInfo = () => {
    const dateKey = getDailyDateKey();
    const seed = hashStringToSeed(`daily:${dateKey}:slidey`);
    return { dateKey, seed, level: DAILY_LEVEL };
  };

  const readDailyCache = () => {
    try {
      const raw = window.localStorage.getItem(DAILY_RUN_CACHE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  };

  const writeDailyCache = (cache) => {
    window.localStorage.setItem(DAILY_RUN_CACHE_KEY, JSON.stringify(cache));
  };

  const readDailyRewardClaims = () => {
    try {
      const raw = window.localStorage.getItem(DAILY_REWARD_CLAIMS_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  };

  const writeDailyRewardClaims = (claims) => {
    window.localStorage.setItem(DAILY_REWARD_CLAIMS_KEY, JSON.stringify(claims));
  };

  const processDailyTopRewards = async () => {
    if (!supabaseClient || !deviceId) {
      return;
    }
    const currentCycleKey = getDailyDateKey();
    const previousCycleKey = shiftDateKey(currentCycleKey, -1);
    const claims = readDailyRewardClaims();
    if (claims[previousCycleKey]) {
      return;
    }

    const rewardsByRank = { 1: 60, 2: 50, 3: 20 };
    const { data, error } = await supabaseClient
      .from(DAILY_RUNS_TABLE)
      .select("device_id,time_ms")
      .eq("date_key", previousCycleKey)
      .order("time_ms", { ascending: true })
      .limit(3);

    if (error) {
      if (error.code === "42P01") {
        return;
      }
      return;
    }

    const top = Array.isArray(data) ? data : [];
    const rankIndex = top.findIndex((entry) => entry.device_id === deviceId);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 0;
    const reward = rewardsByRank[rank] || 0;
    if (reward > 0) {
      setLocalState(walletOrbs + reward, highestLevel);
      void upsertRemoteProfile().catch(() => {
      });
      if (dailyInfo && dailyInfo.dateKey === currentCycleKey) {
        setDailyStatus(`Daily reward received: +${reward} orbs for rank #${rank} (previous cycle).`);
      }
    }
    claims[previousCycleKey] = {
      claimedAt: Date.now(),
      reward,
      rank
    };
    writeDailyRewardClaims(claims);
  };

  const buildChallengeInfo = () => {
    const room = randomCodeChunk(5);
    const level = Math.max(1, Math.min(highestLevel, 99));
    const seed = hashStringToSeed(`${room}:${level}`);
    const startAtMs = Date.now() + 15000;
    const code = room;
    return { room, seed, level, startAtMs, code };
  };

  const parseChallengeCode = (raw) => {
    if (!raw || typeof raw !== "string") {
      return null;
    }
    const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{5}$/.test(normalized)) {
      return null;
    }
    const room = normalized;
    const seed = hashStringToSeed(`${room}:${highestLevel}`);
    return {
      code: room,
      room,
      seed: seed >>> 0,
      level: Math.max(1, Math.min(99, highestLevel)),
      startAtMs: Date.now() + 15000
    };
  };

  const parseWaitingToken = (phaseToken) => {
    if (typeof phaseToken !== "string") {
      return null;
    }
    const parts = phaseToken.split("|");
    if (parts[0] !== "waiting" || parts.length < 3) {
      return null;
    }
    const startAtSec = Number.parseInt(parts[1], 10);
    const level = Number.parseInt(parts[2], 10);
    if (!Number.isFinite(startAtSec) || !Number.isFinite(level)) {
      return null;
    }
    const hostLevel = Math.max(1, Math.min(99, Math.floor(level)));
    return {
      startAtMs: startAtSec * 1000,
      level: hostLevel
    };
  };

  const createChaosRoundSeed = (room, round, mapChoice, modifierChoice) =>
    hashStringToSeed(`${room}|${round}|${mapChoice}|${modifierChoice}`);

  const getChaosLevelForMap = (mapChoice) => {
    if (mapChoice === "small") {
      return 8;
    }
    if (mapChoice === "large") {
      return 22;
    }
    return 14;
  };

  const createChaosControl = (room, hostId) => ({
    mode: "chaos",
    stage: "lobby",
    hostId,
    round: 1,
    totalRounds: CHAOS_TOTAL_ROUNDS,
    wins: {},
    mapChoice: "",
    modifierChoice: "",
    level: 14,
    seed: createChaosRoundSeed(room, 1, "medium", "none"),
    startAtMs: 0,
    voteDeadlineMs: 0,
    updatedAtMs: Date.now()
  });

  const encodeChaosControl = (state) => `chaos_ctrl:${JSON.stringify(state)}`;
  const decodeChaosControl = (token) => {
    if (typeof token !== "string" || !token.startsWith("chaos_ctrl:")) {
      return null;
    }
    try {
      const parsed = JSON.parse(token.slice("chaos_ctrl:".length));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  };

  const encodeChaosPlayer = (state) => `chaos_p:${JSON.stringify(state)}`;
  const decodeChaosPlayer = (token) => {
    if (typeof token !== "string" || !token.startsWith("chaos_p:")) {
      return null;
    }
    try {
      const parsed = JSON.parse(token.slice("chaos_p:".length));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  };

  const chaosPlayerPayload = (override = {}) => ({
    stage: chaosPlayerMeta.stage || "lobby",
    round: readNumber(chaosPlayerMeta.round, 1),
    mapVote: chaosPlayerMeta.mapVote || "",
    modifierVote: chaosPlayerMeta.modifierVote || "",
    result: chaosPlayerMeta.result || "playing",
    runMs: readNumber(chaosPlayerMeta.runMs, 0),
    ...override,
    updatedAtMs: Date.now()
  });

  const upsertChaosControl = async (room, controlState) => {
    if (!supabaseClient) {
      return;
    }
    const payload = {
      challenge_code: room,
      device_id: CHAOS_CONTROL_DEVICE,
      level: Math.max(1, readNumber(controlState.level, 14)),
      pos_x: 0,
      pos_y: 0,
      render_x: 0,
      render_y: 0,
      shape: "square",
      phase: encodeChaosControl({ ...controlState, updatedAtMs: Date.now() }),
      updated_at: new Date().toISOString()
    };
    await supabaseClient.from(CHALLENGE_TABLE).upsert(payload, { onConflict: "challenge_code,device_id" });
  };

  const upsertChaosPlayerState = async (room, snapshot, override = {}) => {
    if (!supabaseClient) {
      return;
    }
    const payload = {
      challenge_code: room,
      device_id: deviceId,
      level: readNumber(snapshot?.level, chaosState?.level || highestLevel),
      pos_x: Number.isFinite(snapshot?.x) ? snapshot.x : 0,
      pos_y: Number.isFinite(snapshot?.y) ? snapshot.y : 0,
      render_x: Number.isFinite(snapshot?.renderX) ? snapshot.renderX : 0,
      render_y: Number.isFinite(snapshot?.renderY) ? snapshot.renderY : 0,
      shape: typeof snapshot?.shape === "string" ? snapshot.shape : selectedShape,
      phase: encodeChaosPlayer(chaosPlayerPayload(override)),
      updated_at: new Date().toISOString()
    };
    await supabaseClient.from(CHALLENGE_TABLE).upsert(payload, { onConflict: "challenge_code,device_id" });
  };

  const readChaosRows = async (room) => {
    if (!supabaseClient || !room) {
      return { control: null, players: [] };
    }
    const { data, error } = await supabaseClient
      .from(CHALLENGE_TABLE)
      .select("device_id,level,pos_x,pos_y,render_x,render_y,shape,phase,updated_at")
      .eq("challenge_code", room)
      .order("updated_at", { ascending: false })
      .limit(32);
    if (error || !Array.isArray(data)) {
      return { control: null, players: [] };
    }
    let control = null;
    const players = [];
    const now = Date.now();
    for (const row of data) {
      if (row.device_id === CHAOS_CONTROL_DEVICE) {
        control = decodeChaosControl(row.phase || "");
        continue;
      }
      const player = decodeChaosPlayer(row.phase || "");
      if (!player) {
        continue;
      }
      const updatedAt = Date.parse(row.updated_at || "");
      if (Number.isFinite(updatedAt) && now - updatedAt > 8000) {
        continue;
      }
      players.push({
        deviceId: row.device_id,
        level: readNumber(row.level, 1),
        x: Number(row.pos_x),
        y: Number(row.pos_y),
        renderX: Number(row.render_x),
        renderY: Number(row.render_y),
        shape: row.shape,
        updatedAt,
        ...player
      });
    }
    return { control, players };
  };

  const pickVoteWinner = (players, key, fallback) => {
    const counts = new Map();
    for (const player of players) {
      const vote = typeof player[key] === "string" ? player[key] : "";
      if (!vote) {
        continue;
      }
      counts.set(vote, (counts.get(vote) || 0) + 1);
    }
    if (!counts.size) {
      return fallback;
    }
    let bestVote = fallback;
    let bestCount = -1;
    for (const [vote, count] of counts.entries()) {
      if (count > bestCount) {
        bestVote = vote;
        bestCount = count;
      }
    }
    return bestVote;
  };

  const publishChallengeLobby = async (info) => {
    if (!supabaseClient) {
      return;
    }
    const waitingToken = `waiting|${Math.floor(info.startAtMs / 1000)}|${info.level}`;
    const payload = {
      challenge_code: info.room,
      device_id: deviceId,
      level: info.level,
      pos_x: 0,
      pos_y: 0,
      render_x: 0,
      render_y: 0,
      shape: selectedShape,
      phase: waitingToken,
      updated_at: new Date().toISOString()
    };
    await supabaseClient.from(CHALLENGE_TABLE).upsert(payload, { onConflict: "challenge_code,device_id" });
  };

  const resolveChallengeLobby = async (room) => {
    if (!supabaseClient) {
      return null;
    }
    const { data, error } = await supabaseClient
      .from(CHALLENGE_TABLE)
      .select("level,phase,updated_at")
      .eq("challenge_code", room)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) {
      return null;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      return null;
    }
    const waiting = parseWaitingToken(row.phase || "");
    const hostLevel = Math.max(1, Math.min(99, readNumber(row.level, 1)));
    return {
      level: waiting?.level || hostLevel,
      startAtMs: waiting?.startAtMs || (Date.now() + 10000)
    };
  };

  const parsePhaseToken = (token) => {
    if (typeof token !== "string" || token.length === 0) {
      return { phase: "playing", runMs: 0 };
    }
    const [phaseRaw, runRaw] = token.split("|");
    const phase = (phaseRaw || "playing").toLowerCase();
    const runMs = Math.max(0, readNumber(runRaw, 0));
    if (phase !== "won" && phase !== "lost") {
      return { phase: "playing", runMs: 0 };
    }
    return { phase, runMs };
  };

  const updateLocalChallengeResult = (snapshot) => {
    if (!snapshot) {
      return { phaseToken: "playing", parsed: { phase: "playing", runMs: 0 } };
    }
    const parsed = parsePhaseToken(`${snapshot.phase}|${snapshot.runTimeMs}`);
    if ((parsed.phase === "won" || parsed.phase === "lost") && !challengeLocalResult) {
      challengeLocalResult = {
        phase: parsed.phase,
        runMs: parsed.runMs
      };
    }
    const phaseToken = parsed.phase === "playing" ? "playing" : `${parsed.phase}|${parsed.runMs}`;
    return { phaseToken, parsed };
  };

  const updateOpponentChallengeResult = (phaseToken) => {
    const parsed = parsePhaseToken(phaseToken);
    if (parsed.phase === "won" || parsed.phase === "lost") {
      challengeOpponentResult = {
        phase: parsed.phase,
        runMs: parsed.runMs
      };
    }
    return parsed;
  };

  const enforceChallengeStopFromOpponentWin = () => {
    if (challengeLocalResult) {
      return;
    }
    challengeLocalResult = { phase: "lost", runMs: 0, forced: true };
    withGame((game) => {
      game.forceChallengeLoss?.();
    });
  };

  const closeChallengeAfterResult = () => {
    stopChallengeSync();
    window.__slideyGame?.clearGhostState?.();
    window.__slideyGame?.enterMenuDemo?.();
    hideShopMenu();
    hideChallengeMenu();
    showStartMenu();
  };

  const maybeResolveChallengeResult = () => {
    if (challengeResultShown || !challengeLocalResult || !challengeOpponentResult) {
      return;
    }

    let first = "YOU";
    let last = "OPPONENT";
    let detail = "";

    if (challengeLocalResult.phase === "won" && challengeOpponentResult.phase === "won") {
      const youFirst = challengeLocalResult.runMs <= challengeOpponentResult.runMs;
      first = youFirst ? "YOU" : "OPPONENT";
      last = youFirst ? "OPPONENT" : "YOU";
      detail = `Finish times - You: ${formatTime(challengeLocalResult.runMs)} | Opponent: ${formatTime(challengeOpponentResult.runMs)}`;
    } else if (challengeLocalResult.phase === "won" && challengeOpponentResult.phase === "lost") {
      first = "YOU";
      last = "OPPONENT";
      detail = `You finished first in ${formatTime(challengeLocalResult.runMs)}.`;
    } else if (challengeLocalResult.phase === "lost" && challengeOpponentResult.phase === "won") {
      first = "OPPONENT";
      last = "YOU";
      detail = `Opponent finished first in ${formatTime(challengeOpponentResult.runMs)}.`;
    } else {
      first = "NO WINNER";
      last = "BOTH COLLAPSED";
      detail = "No one reached the gate.";
    }

    challengeResultShown = true;
    showChallengeResultScreen(first, last, detail);
    setChallengeStatus("Challenge finished.");
    challengeResultAutoCloseTimer = window.setTimeout(() => {
      closeChallengeAfterResult();
    }, 9000);
  };

  const clearChaosLoop = () => {
    if (chaosLoopTimer) {
      window.clearInterval(chaosLoopTimer);
      chaosLoopTimer = null;
    }
    chaosLoopBusy = false;
  };

  const updateChaosStatus = (control, players) => {
    const count = players.length;
    if (!control) {
      setChallengeStatus("Chaos unavailable: control state missing.");
      return;
    }
    if (control.stage === "lobby") {
      setChaosVoteUi("lobby");
      setChallengeStatus(`Chaos lobby: ${count}/${CHAOS_MAX_PLAYERS} players. Waiting for host.`);
      return;
    }
    if (control.stage === "vote_map") {
      const remaining = Math.max(0, Math.ceil((readNumber(control.voteDeadlineMs, Date.now()) - Date.now()) / 1000));
      setChaosVoteUi("vote_map", chaosPlayerMeta.mapVote || "");
      setChallengeStatus(`Vote map size (${remaining}s). Players: ${count}/${CHAOS_MAX_PLAYERS}.`);
      return;
    }
    if (control.stage === "vote_modifier") {
      const remaining = Math.max(0, Math.ceil((readNumber(control.voteDeadlineMs, Date.now()) - Date.now()) / 1000));
      setChaosVoteUi("vote_modifier", chaosPlayerMeta.modifierVote || "");
      setChallengeStatus(`Vote challenge modifier (${remaining}s).`);
      return;
    }
    if (control.stage === "countdown") {
      const remaining = Math.max(0, Math.ceil((readNumber(control.startAtMs, Date.now()) - Date.now()) / 1000));
      setChaosVoteUi("countdown");
      setChallengeStatus(`Chaos round ${control.round}/${control.totalRounds} starts in ${remaining}s.`);
      return;
    }
    if (control.stage === "playing") {
      setChaosVoteUi("playing");
      setChallengeStatus(`Chaos round ${control.round}/${control.totalRounds} live - ${String(control.modifierChoice || "none").replace("_", " ")}.`);
      return;
    }
    if (control.stage === "finished") {
      setChaosVoteUi("finished");
      setChallengeStatus("Chaos match finished.");
    }
  };

  const resolveChaosFinal = (control, players) => {
    const wins = control?.wins && typeof control.wins === "object" ? control.wins : {};
    const standings = players
      .map((player) => ({
        deviceId: player.deviceId,
        wins: readNumber(wins[player.deviceId], 0)
      }))
      .sort((a, b) => b.wins - a.wins);
    if (!standings.length) {
      showChallengeResultScreen("NO WINNER", "-", "No valid players found.");
      return;
    }
    const firstId = standings[0].deviceId;
    const lastId = standings[standings.length - 1].deviceId;
    const first = firstId === deviceId ? "YOU" : `P-${firstId.slice(-4).toUpperCase()}`;
    const last = lastId === deviceId ? "YOU" : `P-${lastId.slice(-4).toUpperCase()}`;
    const detail = standings
      .map((entry, index) => {
        const name = entry.deviceId === deviceId ? "You" : `P-${entry.deviceId.slice(-4).toUpperCase()}`;
        return `#${index + 1} ${name} (${entry.wins}W)`;
      })
      .join(" | ");
    showChallengeResultScreen(first, last, detail);
  };

  const launchChaosRound = (control) => {
    if (!control) {
      return;
    }
    const round = Math.max(1, readNumber(control.round, 1));
    const totalRounds = Math.max(1, readNumber(control.totalRounds, CHAOS_TOTAL_ROUNDS));
    const level = Math.max(1, readNumber(control.level, getChaosLevelForMap(control.mapChoice || "medium")));
    const seed = Number.isFinite(control.seed) ? (control.seed >>> 0) : createChaosRoundSeed(challengeRoom, round, control.mapChoice || "medium", control.modifierChoice || "none");
    const modifier = typeof control.modifierChoice === "string" ? control.modifierChoice : "none";
    const timeLimitSec = modifier === "time_limit" ? Math.max(14, Math.round(level * 0.9 + 9)) : 0;
    withGame((game) => {
      game.clearGhostState?.();
      game.startChallengeRun(level, {
        seed,
        code: challengeRoom,
        chaos: {
          modifier,
          round,
          totalRounds,
          timeLimitSec
        }
      });
    });
  };

  const hostAdvanceChaosState = async (room, control, players) => {
    if (!chaosHost || !control || !room) {
      return;
    }
    const now = Date.now();
    if (control.stage === "vote_map") {
      const eligible = players.filter((player) => readNumber(player.round, 1) === readNumber(control.round, 1));
      const allVoted = eligible.length > 0 && eligible.every((player) => typeof player.mapVote === "string" && player.mapVote.length > 0);
      if (allVoted || now >= readNumber(control.voteDeadlineMs, now + 1)) {
        const mapChoice = pickVoteWinner(eligible, "mapVote", "medium");
        const next = {
          ...control,
          stage: "vote_modifier",
          mapChoice,
          level: getChaosLevelForMap(mapChoice),
          voteDeadlineMs: now + 14000
        };
        await upsertChaosControl(room, next);
      }
      return;
    }
    if (control.stage === "vote_modifier") {
      const eligible = players.filter((player) => readNumber(player.round, 1) === readNumber(control.round, 1));
      const allVoted = eligible.length > 0 && eligible.every((player) => typeof player.modifierVote === "string" && player.modifierVote.length > 0);
      if (allVoted || now >= readNumber(control.voteDeadlineMs, now + 1)) {
        const modifierChoice = pickVoteWinner(eligible, "modifierVote", "none");
        const round = Math.max(1, readNumber(control.round, 1));
        const seed = createChaosRoundSeed(room, round, control.mapChoice || "medium", modifierChoice);
        const next = {
          ...control,
          stage: "countdown",
          modifierChoice,
          seed,
          startAtMs: now + 5500
        };
        await upsertChaosControl(room, next);
      }
      return;
    }
    if (control.stage !== "playing") {
      return;
    }
    const round = Math.max(1, readNumber(control.round, 1));
    const roundPlayers = players.filter((player) => readNumber(player.round, 1) === round);
    const finished = roundPlayers.filter((player) => player.result === "won" || player.result === "lost");
    if (!finished.length || finished.length < roundPlayers.length) {
      return;
    }
    const winners = roundPlayers
      .filter((player) => player.result === "won")
      .sort((a, b) => readNumber(a.runMs, 0) - readNumber(b.runMs, 0));
    const wins = { ...(control.wins || {}) };
    if (winners.length) {
      const winnerId = winners[0].deviceId;
      wins[winnerId] = readNumber(wins[winnerId], 0) + 1;
    }
    const topWins = Object.values(wins).reduce((best, value) => Math.max(best, readNumber(value, 0)), 0);
    const roundDone = round >= CHAOS_TOTAL_ROUNDS || topWins >= CHAOS_ROUNDS_TO_WIN;
    if (roundDone) {
      await upsertChaosControl(room, { ...control, stage: "finished", wins });
      return;
    }
    await upsertChaosControl(room, {
      ...control,
      stage: "countdown",
      round: round + 1,
      wins,
      seed: createChaosRoundSeed(room, round + 1, control.mapChoice || "medium", control.modifierChoice || "none"),
      startAtMs: now + 5000
    });
  };

  const runChaosLoop = (room) => {
    clearChaosLoop();
    chaosLoopTimer = window.setInterval(async () => {
      if (!challengeRoom || challengeMode !== "chaos") {
        return;
      }
      if (chaosLoopBusy) {
        return;
      }
      chaosLoopBusy = true;
      try {
        const { control, players } = await readChaosRows(room);
        if (!control) {
          return;
        }
        const now = Date.now();
        if (now - chaosLastPresencePushAt >= 1200) {
          chaosLastPresencePushAt = now;
          await upsertChaosPlayerState(room, window.__slideyGame?.getChallengeSnapshot?.() || null, {
            stage: chaosPlayerMeta.stage,
            round: chaosPlayerMeta.round,
            mapVote: chaosPlayerMeta.mapVote,
            modifierVote: chaosPlayerMeta.modifierVote,
            result: chaosPlayerMeta.result,
            runMs: chaosPlayerMeta.runMs
          });
        }
        chaosState = control;
        chaosPlayerMeta.stage = typeof control.stage === "string" ? control.stage : chaosPlayerMeta.stage;
        const local = players.find((player) => player.deviceId === deviceId) || null;
        if (local) {
          chaosPlayerMeta.mapVote = typeof local.mapVote === "string" ? local.mapVote : "";
          chaosPlayerMeta.modifierVote = typeof local.modifierVote === "string" ? local.modifierVote : "";
          chaosPlayerMeta.round = readNumber(local.round, chaosPlayerMeta.round);
        }
        updateChallengeModeUi();
        updateChaosStatus(control, players);
        if (chaosHost) {
          await hostAdvanceChaosState(room, control, players);
        }

        if (control.stage === "countdown") {
          const startAt = readNumber(control.startAtMs, 0);
          if (startAt > 0 && Date.now() >= startAt) {
            if (chaosHost) {
              await upsertChaosControl(room, { ...control, stage: "playing" });
            }
            launchChaosRound(control);
            chaosPlayerMeta.stage = "playing";
            chaosPlayerMeta.round = readNumber(control.round, 1);
            chaosPlayerMeta.result = "playing";
            chaosPlayerMeta.runMs = 0;
          }
        }

        if (control.stage === "playing") {
          const snapshot = window.__slideyGame?.getChallengeSnapshot?.();
          if (snapshot) {
            if (snapshot.phase === "won" || snapshot.phase === "lost") {
              chaosPlayerMeta.result = snapshot.phase;
              chaosPlayerMeta.runMs = readNumber(snapshot.runTimeMs, 0);
            } else {
              chaosPlayerMeta.result = "playing";
            }
            chaosPlayerMeta.stage = "playing";
            chaosPlayerMeta.round = readNumber(control.round, 1);
            await upsertChaosPlayerState(room, snapshot, {
              stage: "playing",
              round: chaosPlayerMeta.round,
              result: chaosPlayerMeta.result,
              runMs: chaosPlayerMeta.runMs
            });
          }
          const ghosts = players
            .filter((player) => player.deviceId !== deviceId && readNumber(player.round, 1) === readNumber(control.round, 1))
            .slice(0, 3)
            .map((player) => ({
              x: Number(player.x),
              y: Number(player.y),
              renderX: Number(player.renderX),
              renderY: Number(player.renderY),
              shape: player.shape
            }));
          window.__slideyGame?.setGhostStates?.(ghosts);
        } else {
          window.__slideyGame?.clearGhostState?.();
        }

        if (control.stage === "finished") {
          clearChaosLoop();
          resolveChaosFinal(control, players);
          setChallengeStatus("Chaos finished.");
          challengeResultAutoCloseTimer = window.setTimeout(() => {
            closeChallengeAfterResult();
          }, 9000);
        }
      } finally {
        chaosLoopBusy = false;
      }
    }, 180);
  };

  const beginChallengeSync = (room) => {
    challengeRoom = room;
    challengeLocalResult = null;
    challengeOpponentResult = null;
    challengeResultShown = false;
    withGame((game) => {
      game.clearGhostState?.();
    });
    if (!supabaseClient) {
      return;
    }

    challengeRealtimeChannel = supabaseClient.channel(`challenge-room-${room}`, {
      config: { broadcast: { self: false } }
    });
    challengeRealtimeChannel
      .on("broadcast", { event: "snapshot" }, ({ payload }) => {
        if (!payload || payload.deviceId === deviceId) {
          return;
        }
        const opponentParsed = updateOpponentChallengeResult(payload.phaseToken || payload.phase || "playing");
        if (opponentParsed.phase === "won") {
          enforceChallengeStopFromOpponentWin();
        }
        window.__slideyGame?.setGhostState?.({
          x: Number(payload.x),
          y: Number(payload.y),
          renderX: Number(payload.renderX),
          renderY: Number(payload.renderY),
          shape: payload.shape
        });
        maybeResolveChallengeResult();
      })
      .subscribe();

    challengePushTimer = window.setInterval(() => {
      if (!challengeRoom) {
        return;
      }
      const snapshot = window.__slideyGame?.getChallengeSnapshot?.();
      if (!snapshot) {
        return;
      }
      const { phaseToken, parsed } = updateLocalChallengeResult(snapshot);
      if (parsed.phase === "won" && !challengeOpponentResult) {
        challengeOpponentResult = { phase: "lost", runMs: 0, forced: true };
      }
      const payload = {
        challenge_code: challengeRoom,
        device_id: deviceId,
        level: snapshot.level,
        pos_x: snapshot.x,
        pos_y: snapshot.y,
        render_x: snapshot.renderX,
        render_y: snapshot.renderY,
        shape: snapshot.shape,
        phase: phaseToken,
        updated_at: new Date().toISOString()
      };
      void supabaseClient.from(CHALLENGE_TABLE).upsert(payload, { onConflict: "challenge_code,device_id" }).then(() => {
      }).catch(() => {
      });
      void challengeRealtimeChannel?.send({
        type: "broadcast",
        event: "snapshot",
        payload: {
          deviceId,
          x: snapshot.x,
          y: snapshot.y,
          renderX: snapshot.renderX,
          renderY: snapshot.renderY,
          shape: snapshot.shape,
          phaseToken,
          phase: parsed.phase,
          at: Date.now()
        }
      });
      maybeResolveChallengeResult();
    }, 85);

    challengePullTimer = window.setInterval(async () => {
      if (!challengeRoom) {
        return;
      }
      const { data, error } = await supabaseClient
        .from(CHALLENGE_TABLE)
        .select("pos_x,pos_y,render_x,render_y,shape,phase,updated_at")
        .eq("challenge_code", challengeRoom)
        .neq("device_id", deviceId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) {
        return;
      }
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        window.__slideyGame?.clearGhostState?.();
        return;
      }
      const updatedAt = Date.parse(row.updated_at || "");
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt > 4000) {
        window.__slideyGame?.clearGhostState?.();
        return;
      }
      updateOpponentChallengeResult(row.phase || "playing");
      const opponentParsed = parsePhaseToken(row.phase || "playing");
      if (opponentParsed.phase === "won") {
        enforceChallengeStopFromOpponentWin();
      }
      window.__slideyGame?.setGhostState?.({
        x: Number(row.pos_x),
        y: Number(row.pos_y),
        renderX: Number(row.render_x),
        renderY: Number(row.render_y),
        shape: row.shape
      });
      maybeResolveChallengeResult();
    }, 85);
  };

  const launchChallenge = (info) => {
    if (challengeMode === "chaos") {
      clearChallengeCountdown();
      clearChaosLoop();
      hideChallengeResultScreen();
    } else {
      stopChallengeSync();
      hideChallengeResultScreen();
    }
    hideShopMenu();
    showChallengeMenu();
    hideStartMenu();
    if (challengeCodeValue) {
      challengeCodeValue.textContent = info.code;
    }
    if (challengeMode === "chaos") {
      challengeRoom = info.room;
      setChallengeStatus("Chaos lobby connected.");
      runChaosLoop(info.room);
      updateChallengeModeUi();
      return;
    }
    setChallengeStatus("Challenge countdown started.");

    const startAt = Math.max(Date.now(), info.startAtMs);

    clearChallengeCountdown();
    challengeCountdownTimer = window.setInterval(() => {
      const remaining = Math.max(0, startAt - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      setChallengeStatus(`Starting in ${seconds}s. Code: ${info.code}`);
      if (remaining <= 0) {
        clearChallengeCountdown();
        hideChallengeMenu();
        withGame((game) => {
          game.clearGhostState?.();
          game.startChallengeRun(info.level, { seed: info.seed, code: info.room });
        });
        beginChallengeSync(info.room);
      }
    }, 120);
  };

  const ensureGameReady = () => {
    if (!window.__slideyGame) {
      window.setTimeout(ensureGameReady, 80);
      return;
    }
    applyWalletToGame();
    applyProgressToGame();
    applyShapeToGame();
    window.__slideyGame.enterMenuDemo();
    void ensureLevelTopForLevel(window.__slideyGame.level || 1);
    const bestMs = typeof window.__slideyGame.getBestTimeMs === "function"
      ? window.__slideyGame.getBestTimeMs()
      : readNumber(window.localStorage.getItem(BEST_TIME_KEY), 0);
    updateBestTimeDisplay(bestMs);
    updateMenuOrbsDisplay();
    updateShapeButtons();
    hideShopMenu();
    hideChallengeMenu();
    if (!tutorialCompleted) {
      hideStartMenu();
      window.__slideyGame.startTutorialRun();
      return;
    }
    showStartMenu();
  };

  const handleTutorialComplete = (event) => {
    const alreadyCompleted = tutorialCompleted;
    tutorialCompleted = true;
    window.localStorage.setItem(TUTORIAL_COMPLETED_KEY, "1");

    if (!alreadyCompleted) {
      const reward = Math.max(0, readNumber(event.detail?.reward, 20));
      if (reward > 0) {
        setLocalState(walletOrbs + reward, highestLevel);
      }
      if (supabaseClient) {
        void upsertRemoteProfile().catch(() => {
        });
      }
    }
  };

  const createChaosLobby = async () => {
    if (highestLevel < CHAOS_MIN_LEVEL) {
      setChallengeStatus(`Chaos unlocks at level ${CHAOS_MIN_LEVEL}.`);
      return;
    }
    if (!supabaseClient) {
      setChallengeStatus("Chaos requires online sync.");
      return;
    }
    stopChallengeSync();
    closeChallengeJoinPanel({ clear: true });
    const info = buildChallengeInfo();
    if (challengeCodeValue) {
      challengeCodeValue.textContent = info.code;
    }
    if (challengeCodeInput) {
      challengeCodeInput.value = info.code;
      challengeCodeInput.select();
    }
    copyChallengeBtn?.classList.remove("hidden");
    chaosHost = true;
    chaosPlayerMeta = {
      mapVote: "",
      modifierVote: "",
      stage: "lobby",
      round: 1,
      result: "playing",
      runMs: 0
    };
    const control = createChaosControl(info.room, deviceId);
    await upsertChaosControl(info.room, control);
    await upsertChaosPlayerState(info.room, null, {
      stage: "lobby",
      round: 1,
      result: "playing",
      runMs: 0,
      mapVote: "",
      modifierVote: ""
    });
    setChallengeStatus("Chaos code created. Share it with up to 3 players.");
    launchChallenge(info);
  };

  const joinChaosLobby = async () => {
    if (highestLevel < CHAOS_MIN_LEVEL) {
      setChallengeStatus(`Chaos unlocks at level ${CHAOS_MIN_LEVEL}.`);
      return;
    }
    if (!supabaseClient) {
      setChallengeStatus("Chaos requires online sync.");
      return;
    }
    stopChallengeSync();
    const raw = challengeCodeInput?.value || "";
    const parsed = parseChallengeCode(raw);
    if (!parsed) {
      setChallengeStatus("Invalid code. Use exactly 5 characters.");
      challengeCodeInput?.focus();
      challengeCodeInput?.select();
      return;
    }
    const { control, players } = await readChaosRows(parsed.room);
    if (!control || control.mode !== "chaos") {
      setChallengeStatus("Chaos lobby not found for this code.");
      return;
    }
    const uniquePlayers = new Set(players.map((player) => player.deviceId));
    if (!uniquePlayers.has(deviceId) && uniquePlayers.size >= CHAOS_MAX_PLAYERS) {
      setChallengeStatus("Chaos lobby full (max 4 players).");
      return;
    }
    chaosHost = control.hostId === deviceId;
    chaosPlayerMeta = {
      mapVote: "",
      modifierVote: "",
      stage: "lobby",
      round: 1,
      result: "playing",
      runMs: 0
    };
    await upsertChaosPlayerState(parsed.room, null, {
      stage: "lobby",
      round: 1,
      result: "playing",
      runMs: 0
    });
    if (challengeCodeValue) {
      challengeCodeValue.textContent = parsed.code;
    }
    copyChallengeBtn?.classList.remove("hidden");
    setChallengeStatus("Chaos lobby joined. Waiting for host to start.");
    closeChallengeJoinPanel({ clear: true });
    launchChallenge({
      code: parsed.code,
      room: parsed.room,
      level: getChaosLevelForMap(control.mapChoice || "medium"),
      seed: readNumber(control.seed, 0),
      startAtMs: Date.now() + 12000
    });
  };

  const createChallenge = () => {
    if (challengeMode === "chaos") {
      void createChaosLobby();
      return;
    }
    closeChallengeJoinPanel({ clear: true });
    const info = buildChallengeInfo();
    if (challengeCodeValue) {
      challengeCodeValue.textContent = info.code;
    }
    if (challengeCodeInput) {
      challengeCodeInput.value = info.code;
      challengeCodeInput.select();
    }
    copyChallengeBtn?.classList.remove("hidden");
    setChallengeStatus("Code created. Share these 5 characters with your friend.");
    if (supabaseClient) {
      void publishChallengeLobby(info).then(() => {
        launchChallenge(info);
      }).catch(() => {
        setChallengeStatus("Unable to publish challenge lobby.");
      });
      return;
    }
    launchChallenge(info);
  };

  const joinChallenge = async () => {
    if (challengeMode === "chaos") {
      await joinChaosLobby();
      return;
    }
    const raw = challengeCodeInput?.value || "";
    if (!raw) {
      setChallengeStatus("Enter a 5-character challenge code.");
      challengeCodeInput?.focus();
      return;
    }
    const parsed = parseChallengeCode(raw);
    if (!parsed) {
      setChallengeStatus("Invalid code. Use exactly 5 characters.");
      challengeCodeInput?.focus();
      challengeCodeInput?.select();
      return;
    }

    let level = parsed.level;
    let startAtMs = parsed.startAtMs;
    if (supabaseClient) {
      const lobby = await resolveChallengeLobby(parsed.room);
      if (!lobby) {
        setChallengeStatus("Host lobby not found for this 5-character code.");
        return;
      }
      level = lobby.level;
      startAtMs = lobby.startAtMs;
    }

    const seed = hashStringToSeed(`${parsed.room}:${level}`);
    const info = {
      code: parsed.code,
      room: parsed.room,
      level,
      seed,
      startAtMs
    };

    if (info.startAtMs < Date.now() - 1000) {
      setChallengeStatus("Code expired. Ask for a fresh challenge code.");
      return;
    }
    if (challengeCodeValue) {
      challengeCodeValue.textContent = info.code;
    }
    copyChallengeBtn?.classList.remove("hidden");
    setChallengeStatus("Challenge accepted. Get ready for the start.");
    closeChallengeJoinPanel({ clear: true });
    launchChallenge(info);
  };

  const startChaosMatch = async () => {
    if (!supabaseClient || !challengeRoom || !chaosHost) {
      return;
    }
    const { control, players } = await readChaosRows(challengeRoom);
    if (!control || control.mode !== "chaos") {
      setChallengeStatus("Chaos control not found.");
      return;
    }
    if (players.length < 2) {
      setChallengeStatus("Need at least 2 players to start Chaos.");
      return;
    }
    const next = {
      ...control,
      stage: "vote_map",
      round: 1,
      totalRounds: CHAOS_TOTAL_ROUNDS,
      wins: {},
      mapChoice: "",
      modifierChoice: "",
      voteDeadlineMs: Date.now() + 14000
    };
    await upsertChaosControl(challengeRoom, next);
    setChallengeStatus("Chaos started. Vote map size now.");
  };

  const submitChaosVote = async (voteType, voteValue) => {
    if (!supabaseClient || !challengeRoom || challengeMode !== "chaos") {
      return;
    }
    if (voteType === "map") {
      chaosPlayerMeta.mapVote = voteValue;
      setChaosVoteUi("vote_map", voteValue);
    } else if (voteType === "modifier") {
      chaosPlayerMeta.modifierVote = voteValue;
      setChaosVoteUi("vote_modifier", voteValue);
    } else {
      return;
    }
    await upsertChaosPlayerState(challengeRoom, window.__slideyGame?.getChallengeSnapshot?.() || null, {
      stage: chaosPlayerMeta.stage,
      round: chaosPlayerMeta.round,
      mapVote: chaosPlayerMeta.mapVote,
      modifierVote: chaosPlayerMeta.modifierVote,
      result: chaosPlayerMeta.result,
      runMs: chaosPlayerMeta.runMs
    });
    setChallengeStatus("Vote sent.");
  };

  const copyChallengeCode = async () => {
    const code = (challengeCodeValue?.textContent || "").trim();
    if (!code || code === "------") {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setChallengeStatus("Code copied.");
    } catch (_error) {
      setChallengeStatus("Auto-copy failed. Copy it manually.");
    }
  };

  const spendOrbs = (amount) => {
    const cost = Math.max(0, readNumber(amount, 0));
    if (walletOrbs < cost) {
      return false;
    }
    setLocalState(walletOrbs - cost, highestLevel);
    if (supabaseClient) {
      void upsertRemoteProfile().catch(() => {
      });
    }
    return true;
  };

  const setShape = (shape) => {
    selectedShape = shape;
    persistShapeState();
    applyShapeToGame();
    updateShapeButtons();
  };

  const buyOrSelectShape = (shape, cost) => {
    const unlocked = unlockedShapes.has(shape);
    if (!unlocked) {
      if (!spendOrbs(cost)) {
        return;
      }
      unlockedShapes.add(shape);
      persistShapeState();
    }
    setShape(shape);
  };

  const setLocalState = (nextWallet, nextHighestLevel) => {
    walletOrbs = Math.max(0, readNumber(nextWallet, walletOrbs));
    highestLevel = Math.max(1, readNumber(nextHighestLevel, highestLevel));
    window.localStorage.setItem(GUEST_WALLET_KEY, String(walletOrbs));
    window.localStorage.setItem(GUEST_LEVEL_KEY, String(highestLevel));
    applyWalletToGame();
    applyProgressToGame();
    updateMenuOrbsDisplay();
    updateShapeButtons();
    syncDailyAccessUi();
    updateChallengeModeUi();
  };

  const setButtonLabel = () => {
    if (!installAction) {
      return;
    }

    installAction.classList.remove("is-hint");

    if (deferredInstallPrompt) {
      installAction.textContent = promptedOnce ? "Install Slidey to Play" : "Add Slidey to Home Screen to Play";
      return;
    }

    if (isIos()) {
      installAction.textContent = "Share, then tap Add to Home Screen for Slidey";
      installAction.classList.add("is-hint");
      return;
    }

    installAction.textContent = "Install Slidey from the Browser Menu to Play";
    installAction.classList.add("is-hint");
  };

  const refreshInstallGate = () => {
    const locked = shouldRequireInstall();
    window.__neonInstallLock = locked;

    if (!installGate) {
      return;
    }

    document.body.classList.toggle("install-locked", locked);
    installGate.classList.toggle("hidden", !locked);
    installGate.setAttribute("aria-hidden", String(!locked));

    if (locked) {
      setButtonLabel();
    }
  };

  const handleInstallAction = async () => {
    if (!shouldRequireInstall() || !installAction) {
      return;
    }

    if (!deferredInstallPrompt) {
      promptedOnce = true;
      setButtonLabel();
      return;
    }

    installAction.disabled = true;
    deferredInstallPrompt.prompt();

    try {
      await deferredInstallPrompt.userChoice;
    } catch (_error) {
    }

    deferredInstallPrompt = null;
    promptedOnce = true;
    installAction.disabled = false;
    refreshInstallGate();
  };

  const bootstrapSupabase = () => {
    const url = window.SLIDEY_SUPABASE_URL;
    const anonKey = window.SLIDEY_SUPABASE_ANON_KEY;

    if (!url || !anonKey || !window.supabase || typeof window.supabase.createClient !== "function") {
      return;
    }

    supabaseClient = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  };

  const fetchLevelTopRecord = async (level) => {
    const lv = Math.max(1, readNumber(level, 1));
    if (!supabaseClient) {
      const cached = levelTopCache[String(lv)] || null;
      return cached ? { level: lv, best_time_ms: readNumber(cached.timeMs, 0), holder_name: cached.name || "Top" } : null;
    }
    const { data, error } = await supabaseClient
      .from(LEVEL_RECORDS_TABLE)
      .select("level,best_time_ms,holder_name")
      .eq("level", lv)
      .single();

    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01") {
        const cached = levelTopCache[String(lv)] || null;
        return cached ? { level: lv, best_time_ms: readNumber(cached.timeMs, 0), holder_name: cached.name || "Top" } : null;
      }
      return null;
    }
    if (!data) {
      return null;
    }
    return data;
  };

  const ensureLevelTopForLevel = async (level) => {
    const lv = Math.max(1, readNumber(level, 1));
    const record = await fetchLevelTopRecord(lv);
    if (!record) {
      applyLevelTopToGame(lv);
      return;
    }
    const timeMs = Math.max(1, readNumber(record.best_time_ms, 0));
    if (!timeMs) {
      return;
    }
    cacheLevelTop(lv, timeMs, record.holder_name || "Top");
  };

  const maybeUpdateLevelTopRecord = async (level, timeMs) => {
    const lv = Math.max(1, readNumber(level, 1));
    const currentTime = Math.max(1, readNumber(timeMs, 0));
    if (!currentTime) {
      return;
    }
    const cached = levelTopCache[String(lv)];
    const cachedTime = cached ? readNumber(cached.timeMs, 0) : 0;
    if (cachedTime > 0 && currentTime >= cachedTime) {
      return;
    }

    if (!supabaseClient) {
      cacheLevelTop(lv, currentTime, getPlayerAlias());
      return;
    }

    const existing = await fetchLevelTopRecord(lv);
    const existingTime = existing ? readNumber(existing.best_time_ms, 0) : 0;
    if (existingTime > 0 && currentTime >= existingTime) {
      cacheLevelTop(lv, existingTime, existing.holder_name || "Top");
      return;
    }

    const payload = {
      level: lv,
      best_time_ms: currentTime,
      holder_name: getPlayerAlias(),
      holder_device_id: deviceId
    };
    const { error } = await supabaseClient.from(LEVEL_RECORDS_TABLE).upsert(payload, { onConflict: "level" });
    if (!error) {
      cacheLevelTop(lv, currentTime, payload.holder_name);
    }
  };

  const refreshDailyLeaderboard = async () => {
    dailyInfo = buildDailyInfo();
    const cache = readDailyCache();
    const cachedDay = cache[dailyInfo.dateKey];
    if (cachedDay && Array.isArray(cachedDay.entries)) {
      dailyLeaderboard = cachedDay.entries;
    } else {
      dailyLeaderboard = [];
    }
    renderDailyLeaderboard();

    if (!supabaseClient) {
      setDailyStatusWithAccess("Offline mode: leaderboard local.");
      dailyTopReplay = dailyLeaderboard.find((entry) => entry.device_id !== deviceId && Array.isArray(entry.replay)) || null;
      applyDailyGhostToGame();
      return;
    }

    let data = null;
    let error = null;
    const fullRes = await supabaseClient
      .from(DAILY_RUNS_TABLE)
      .select("date_key,device_id,player_alias,time_ms,replay,shape")
      .eq("date_key", dailyInfo.dateKey)
      .order("time_ms", { ascending: true })
      .limit(DAILY_LEADERBOARD_LIMIT);
    data = fullRes.data;
    error = fullRes.error;
    if (error && error.code === "42703") {
      const legacyRes = await supabaseClient
        .from(DAILY_RUNS_TABLE)
        .select("date_key,device_id,time_ms")
        .eq("date_key", dailyInfo.dateKey)
        .order("time_ms", { ascending: true })
        .limit(DAILY_LEADERBOARD_LIMIT);
      data = legacyRes.data;
      error = legacyRes.error;
    }

    if (error) {
      if (error.code === "42P01") {
        setDailyStatusWithAccess("Daily online not active yet. Local daily tracking enabled.");
        dailyTopReplay = dailyLeaderboard.find((entry) => entry.device_id !== deviceId && Array.isArray(entry.replay)) || null;
        applyDailyGhostToGame();
        return;
      }
      setDailyStatusWithAccess("Leaderboard unavailable, retry later.");
      return;
    }

    dailyLeaderboard = Array.isArray(data) ? data.map((entry) => ({
      date_key: entry.date_key,
      device_id: entry.device_id,
      player_alias: entry.player_alias || (entry.device_id === deviceId ? getPlayerAlias() : `P-${String(entry.device_id || "").slice(-4).toUpperCase()}`),
      time_ms: readNumber(entry.time_ms, 0),
      replay: Array.isArray(entry.replay) ? entry.replay : [],
      shape: entry.shape || "square"
    })) : [];
    cache[dailyInfo.dateKey] = { entries: dailyLeaderboard };
    writeDailyCache(cache);
    renderDailyLeaderboard();
    const myEntry = dailyLeaderboard.find((entry) => entry.device_id === deviceId);
    if (myEntry) {
      setDailyStatusWithAccess(`Your best today: ${formatTime(myEntry.time_ms)}.`);
    } else {
      setDailyStatusWithAccess("Run the daily seed and place your time.");
    }
    dailyTopReplay = dailyLeaderboard.find((entry) => entry.device_id !== deviceId && Array.isArray(entry.replay)) || null;
    applyDailyGhostToGame();
  };

  const submitDailyRun = async ({ dateKey, level, timeMs, replay, shape }) => {
    if (!dateKey || !Number.isFinite(timeMs) || timeMs <= 0) {
      return;
    }
    const safeReplay = Array.isArray(replay) ? replay.slice(0, 256) : [];
    const cache = readDailyCache();
    const day = cache[dateKey] && Array.isArray(cache[dateKey].entries) ? cache[dateKey].entries : [];
    const existingLocal = day.find((entry) => entry.device_id === deviceId);
    if (!existingLocal || timeMs < existingLocal.time_ms) {
      const nextEntry = {
        date_key: dateKey,
        device_id: deviceId,
        player_alias: getPlayerAlias(),
        time_ms: Math.floor(timeMs),
        replay: safeReplay,
        shape: shape || selectedShape
      };
      const filtered = day.filter((entry) => entry.device_id !== deviceId);
      filtered.push(nextEntry);
      filtered.sort((a, b) => a.time_ms - b.time_ms);
      cache[dateKey] = { entries: filtered.slice(0, DAILY_LEADERBOARD_LIMIT) };
      writeDailyCache(cache);
    }

    if (!supabaseClient) {
      await refreshDailyLeaderboard();
      return;
    }

    const { data: existing, error: existingError } = await supabaseClient
      .from(DAILY_RUNS_TABLE)
      .select("time_ms")
      .eq("date_key", dateKey)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existingError) {
      if (existingError.code === "42P01") {
        await refreshDailyLeaderboard();
        return;
      }
      await refreshDailyLeaderboard();
      return;
    }
    const prev = existing ? readNumber(existing.time_ms, 0) : 0;
    if (prev > 0 && timeMs >= prev) {
      await refreshDailyLeaderboard();
      return;
    }

    const payload = {
      date_key: dateKey,
      device_id: deviceId,
      player_alias: getPlayerAlias(),
      level: Math.max(1, readNumber(level, DAILY_LEVEL)),
      time_ms: Math.floor(timeMs),
      replay: safeReplay,
      shape: shape || selectedShape
    };

    let upsertError = null;
    const fullUpsert = await supabaseClient.from(DAILY_RUNS_TABLE).upsert(payload, { onConflict: "date_key,device_id" });
    upsertError = fullUpsert.error;
    if (upsertError && upsertError.code === "42703") {
      const legacyPayload = {
        date_key: dateKey,
        device_id: deviceId,
        level: Math.max(1, readNumber(level, DAILY_LEVEL)),
        time_ms: Math.floor(timeMs)
      };
      const legacyUpsert = await supabaseClient.from(DAILY_RUNS_TABLE).upsert(legacyPayload, { onConflict: "date_key,device_id" });
      upsertError = legacyUpsert.error;
    }
    if (upsertError && upsertError.code !== "42P01") {
      await refreshDailyLeaderboard();
      return;
    }
    await refreshDailyLeaderboard();
  };

  const fetchRemoteProfile = async () => {
    if (remoteSupportsBestTime) {
      const withBest = await supabaseClient
        .from(REMOTE_TABLE)
        .select("wallet_orbs,highest_level,best_time_ms")
        .eq("device_id", deviceId)
        .single();
      if (!withBest.error) {
        return withBest.data || null;
      }
      if (withBest.error.code === "42703") {
        remoteSupportsBestTime = false;
      } else if (withBest.error.code !== "PGRST116") {
        throw withBest.error;
      } else {
        return null;
      }
    }

    const { data, error } = await supabaseClient
      .from(REMOTE_TABLE)
      .select("wallet_orbs,highest_level")
      .eq("device_id", deviceId)
      .single();
    if (error && error.code !== "PGRST116") {
      throw error;
    }
    return data || null;
  };

  const upsertRemoteProfile = async () => {
    const localBest = getBestTimeMsLocal();
    const payload = {
      device_id: deviceId,
      wallet_orbs: walletOrbs,
      highest_level: highestLevel
    };
    if (remoteSupportsBestTime) {
      const withBestPayload = {
        ...payload,
        best_time_ms: localBest > 0 ? localBest : null
      };
      const { error } = await supabaseClient.from(REMOTE_TABLE).upsert(withBestPayload, { onConflict: "device_id" });
      if (!error) {
        return;
      }
      if (error.code === "42703") {
        remoteSupportsBestTime = false;
      } else {
        throw error;
      }
    }
    const { error } = await supabaseClient.from(REMOTE_TABLE).upsert(payload, { onConflict: "device_id" });
    if (error) {
      throw error;
    }
  };

  const startProfileHeartbeat = () => {
    if (profileHeartbeatTimer) {
      window.clearInterval(profileHeartbeatTimer);
      profileHeartbeatTimer = null;
    }
    if (!supabaseClient) {
      return;
    }
    profileHeartbeatTimer = window.setInterval(() => {
      void upsertRemoteProfile().catch(() => {
      });
    }, 5 * 60 * 1000);
  };

  const syncWithRemote = async () => {
    if (!supabaseClient) {
      return;
    }

    const remote = await fetchRemoteProfile();
    if (!remote) {
      await upsertRemoteProfile();
      return;
    }

    const mergedWallet = Math.max(walletOrbs, readNumber(remote.wallet_orbs, 0));
    const mergedLevel = Math.max(highestLevel, readNumber(remote.highest_level, 1));
    const remoteBest = Math.max(0, readNumber(remote.best_time_ms, 0));
    const localBest = getBestTimeMsLocal();
    const mergedBest = localBest > 0 && remoteBest > 0 ? Math.min(localBest, remoteBest) : Math.max(localBest, remoteBest);
    if (mergedBest > 0 && (localBest <= 0 || mergedBest < localBest)) {
      window.localStorage.setItem(BEST_TIME_KEY, String(mergedBest));
      updateBestTimeDisplay(mergedBest);
    }
    setLocalState(mergedWallet, mergedLevel);
    await upsertRemoteProfile();
  };

  const onOrbsEarned = (event) => {
    const gained = Math.max(0, readNumber(event.detail?.gained, 0));
    const unlockedLevel = Math.max(
      1,
      readNumber(
        event.detail?.unlockedLevel,
        readNumber(event.detail?.level, 1)
      )
    );

    setLocalState(walletOrbs + gained, Math.max(highestLevel, unlockedLevel));

    if (supabaseClient) {
      void upsertRemoteProfile().catch(() => {
      });
    }
  };

  const init = () => {
    runStartupSplash();
    setupClientHardening();
    deviceId = getOrCreateDeviceId();
    walletOrbs = Math.max(0, readNumber(window.localStorage.getItem(GUEST_WALLET_KEY), 0));
    highestLevel = Math.max(1, readNumber(window.localStorage.getItem(GUEST_LEVEL_KEY), 1));
    tutorialCompleted = window.localStorage.getItem(TUTORIAL_COMPLETED_KEY) === "1";
    levelTopCache = readLevelTopCache();
    unlockedShapes = readUnlockedShapes();
    const storedShape = window.localStorage.getItem(SELECTED_SHAPE_KEY);
    selectedShape = unlockedShapes.has(storedShape) && ALLOWED_SHAPES.has(storedShape) ? storedShape : "square";
    persistShapeState();
    if (challengeCodeValue) {
      challengeCodeValue.textContent = "------";
    }
    if (challengeCodeInput) {
      challengeCodeInput.value = "";
    }
    closeChallengeJoinPanel();
    copyChallengeBtn?.classList.add("hidden");
    setChallengeStatus("Create or enter a 5-character challenge code.");
    setChallengeMode("classic");
    updateChallengeModeUi();
    hideChallengeResultScreen();
    updateBestTimeDisplay(readNumber(window.localStorage.getItem(BEST_TIME_KEY), 0));
    updateMenuOrbsDisplay();
    updateShapeButtons();
    applyWalletToGame();
    applyProgressToGame();
    applyShapeToGame();
    syncDailyAccessUi();
    bootstrapSupabase();
    refreshInstallGate();

    if (supabaseClient) {
      void syncWithRemote().catch(() => {
      });
      startProfileHeartbeat();
      void processDailyTopRewards().catch(() => {
      });
    }

    ensureGameReady();
  };

  installAction?.addEventListener("click", () => {
    void handleInstallAction();
  });
  startRunBtn?.addEventListener("click", startNormalRun);
  dailyRunBtn?.addEventListener("click", showDailyMenu);
  challengeBtn?.addEventListener("click", showChallengeMenu);
  challengeModeClassicBtn?.addEventListener("click", () => {
    setChallengeMode("classic");
  });
  challengeModeChaosBtn?.addEventListener("click", () => {
    setChallengeMode("chaos");
  });
  tutorialBtn?.addEventListener("click", startTutorialRun);
  storeBtn?.addEventListener("click", showShopMenu);
  closeShopBtn?.addEventListener("click", hideShopMenu);
  createChallengeBtn?.addEventListener("click", createChallenge);
  joinChallengeBtn?.addEventListener("click", openChallengeJoinPanel);
  challengeJoinConfirmBtn?.addEventListener("click", () => {
    void joinChallenge();
  });
  challengeJoinCancelBtn?.addEventListener("click", () => {
    closeChallengeJoinPanel({ clear: true });
  });
  chaosStartBtn?.addEventListener("click", () => {
    void startChaosMatch();
  });
  for (const button of chaosVoteOptionButtons) {
    button.addEventListener("click", () => {
      const voteType = button.dataset.voteType || "";
      const voteValue = button.dataset.voteValue || "";
      void submitChaosVote(voteType, voteValue);
    });
  }
  copyChallengeBtn?.addEventListener("click", () => {
    void copyChallengeCode();
  });
  closeChallengeBtn?.addEventListener("click", () => {
    stopChallengeSync();
    hideChallengeMenu();
    hideGlobalLeaderboardMenu();
    closeChallengeJoinPanel({ clear: true });
    showStartMenu();
  });
  dailyStartBtn?.addEventListener("click", startDailyRun);
  dailyCloseBtn?.addEventListener("click", () => {
    hideDailyMenu();
    hideGlobalLeaderboardMenu();
    showStartMenu();
  });
  globalLeaderboardBtn?.addEventListener("click", showGlobalLeaderboardMenu);
  globalLbTabOrbs?.addEventListener("click", () => {
    setGlobalLeaderboardTab("orbs");
  });
  globalLbTabTime?.addEventListener("click", () => {
    setGlobalLeaderboardTab("time");
  });
  globalLbTabLevels?.addEventListener("click", () => {
    setGlobalLeaderboardTab("levels");
  });
  globalLeaderboardCloseBtn?.addEventListener("click", () => {
    hideGlobalLeaderboardMenu();
    showStartMenu();
  });
  challengeCodeInput?.addEventListener("input", () => {
    challengeCodeInput.value = challengeCodeInput.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5);
  });
  challengeCodeInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeChallengeJoinPanel({ clear: true });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void joinChallenge();
    }
  });
  challengeResultCloseBtn?.addEventListener("click", () => {
    closeChallengeAfterResult();
  });
  for (const button of shapeButtons) {
    button.addEventListener("click", () => {
      const shape = button.dataset.shape;
      const cost = readNumber(button.dataset.cost, 0);
      if (!shape || !ALLOWED_SHAPES.has(shape)) {
        return;
      }
      buyOrSelectShape(shape, cost);
    });
  }

  window.addEventListener("slidey:orbs-earned", onOrbsEarned);
  window.addEventListener("slidey:tutorial-complete", handleTutorialComplete);
  window.addEventListener("slidey:best-time-updated", (event) => {
    updateBestTimeDisplay(readNumber(event.detail?.bestTimeMs, 0));
    if (supabaseClient) {
      void upsertRemoteProfile().catch(() => {
      });
    }
  });
  window.addEventListener("slidey:return-to-main", () => {
    stopChallengeSync();
    window.__slideyGame?.clearGhostState?.();
    window.__slideyGame?.clearDailyReplayGhost?.();
    window.__slideyGame?.enterMenuDemo?.();
    hideShopMenu();
    hideChallengeMenu();
    hideDailyMenu();
    hideGlobalLeaderboardMenu();
    hideChallengeResultScreen();
    showStartMenu();
  });
  window.addEventListener("slidey:daily-finished", (event) => {
    const dateKey = typeof event.detail?.dateKey === "string" ? event.detail.dateKey : getDailyDateKey();
    const level = readNumber(event.detail?.level, DAILY_LEVEL);
    const timeMs = readNumber(event.detail?.timeMs, 0);
    const replay = Array.isArray(event.detail?.replay) ? event.detail.replay : [];
    const shape = typeof event.detail?.shape === "string" ? event.detail.shape : selectedShape;
    if (timeMs > 0) {
      void submitDailyRun({ dateKey, level, timeMs, replay, shape });
    }
  });
  window.addEventListener("slidey:level-started", (event) => {
    const level = readNumber(event.detail?.level, 1);
    void ensureLevelTopForLevel(level);
  });
  window.addEventListener("slidey:level-completed-time", (event) => {
    const level = readNumber(event.detail?.level, 1);
    const timeMs = readNumber(event.detail?.timeMs, 0);
    if (timeMs > 0) {
      void maybeUpdateLevelTopRecord(level, timeMs);
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    refreshInstallGate();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    refreshInstallGate();
  });

  window.addEventListener("pageshow", refreshInstallGate);
  window.addEventListener("resize", refreshInstallGate);
  window.addEventListener("orientationchange", refreshInstallGate);
  window.addEventListener("pagehide", () => {
    if (profileHeartbeatTimer) {
      window.clearInterval(profileHeartbeatTimer);
      profileHeartbeatTimer = null;
    }
  });

  if (window.matchMedia) {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    displayModeQuery.addEventListener?.("change", refreshInstallGate);
  }

  appUpdateBtn?.addEventListener("click", () => {
    void applyPendingUpdate();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("./sw.js").then((registration) => {
          monitorServiceWorkerRegistration(registration);
          void checkForAppUpdates({ force: true });
          updateCheckIntervalId = window.setInterval(() => {
            void checkForAppUpdates();
          }, 60000);
        }).catch(() => {
        });
      },
      { once: true }
    );

    const triggerForegroundUpdateCheck = () => {
      void checkForAppUpdates({ force: true });
    };
    window.addEventListener("online", triggerForegroundUpdateCheck);
    window.addEventListener("focus", triggerForegroundUpdateCheck);
    window.addEventListener("pageshow", triggerForegroundUpdateCheck);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        triggerForegroundUpdateCheck();
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (swControllerReloaded) {
        return;
      }
      swControllerReloaded = true;
      updateApplyInProgress = false;
      if (updateCheckIntervalId) {
        window.clearInterval(updateCheckIntervalId);
        updateCheckIntervalId = null;
      }
      if (latestRemoteCommitSha) {
        markRemoteCommitSeen(latestRemoteCommitSha);
      }
      window.location.reload();
    });
  }

  hideAppUpdateButton();
  init();
})();
