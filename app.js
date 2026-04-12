"use strict";

(function () {
  const GUEST_WALLET_KEY = "slidey_wallet";
  const GUEST_LEVEL_KEY = "slidey_highest_level";
  const BEST_TIME_KEY = "slidey_best_time_ms";
  const TUTORIAL_COMPLETED_KEY = "slidey_tutorial_completed";
  const UNLOCKED_SHAPES_KEY = "slidey_unlocked_shapes";
  const SELECTED_SHAPE_KEY = "slidey_selected_shape";
  const DEVICE_ID_KEY = "slidey_device_id";
  const REMOTE_TABLE = "player_profiles";
  const CHALLENGE_TABLE = "challenge_presence";
  const CHALLENGE_PREFIX = "SLD";

  const installGate = document.getElementById("installGate");
  const installAction = document.getElementById("installAction");
  const startMenu = document.getElementById("startMenu");
  const bestTimeValue = document.getElementById("bestTimeValue");
  const menuOrbsValue = document.getElementById("menuOrbsValue");
  const startRunBtn = document.getElementById("startRunBtn");
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
  const challengeStatusText = document.getElementById("challengeStatusText");
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
    { shape: "droplet", cost: 430 }
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
  let challengePushTimer = null;
  let challengePullTimer = null;
  let challengeCountdownTimer = null;
  let challengeRealtimeChannel = null;
  let challengeRoom = "";

  const isIos = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  const isStandalone = () =>
    Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  const isInstallTargetDevice = () =>
    Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || isIos();

  const shouldRequireInstall = () => isInstallTargetDevice() && !isStandalone();

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
  };

  const showStartMenu = () => {
    if (!startMenu) {
      return;
    }
    startMenu.classList.remove("hidden");
    startMenu.setAttribute("aria-hidden", "false");
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
    challengeMenu.classList.add("hidden");
    challengeMenu.setAttribute("aria-hidden", "true");
  };

  const showChallengeMenu = () => {
    if (!challengeMenu) {
      return;
    }
    hideShopMenu();
    challengeMenu.classList.remove("hidden");
    challengeMenu.setAttribute("aria-hidden", "false");
  };

  const setChallengeStatus = (text) => {
    if (challengeStatusText) {
      challengeStatusText.textContent = text;
    }
  };

  const showShopMenu = () => {
    if (!shopMenu) {
      return;
    }
    hideChallengeMenu();
    updateMenuOrbsDisplay();
    updateShapeButtons();
    shopMenu.classList.remove("hidden");
    shopMenu.setAttribute("aria-hidden", "false");
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
      return;
    }
    challengeRoom = "";
  };

  const randomCodeChunk = (size) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < size; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  };

  const buildChallengeInfo = () => {
    const room = randomCodeChunk(6);
    const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0);
    const level = Math.max(1, Math.min(highestLevel, 99));
    const startAtMs = Date.now() + 15000;
    const startAtSec = Math.floor(startAtMs / 1000);
    const code = `${CHALLENGE_PREFIX}-${room}-${seed.toString(36).toUpperCase()}-${level.toString(36).toUpperCase()}-${startAtSec.toString(36).toUpperCase()}`;
    return { room, seed, level, startAtMs, code };
  };

  const parseChallengeCode = (raw) => {
    if (!raw || typeof raw !== "string") {
      return null;
    }
    const code = raw.trim().toUpperCase();
    const match = /^SLD-([A-Z0-9]{6})-([A-Z0-9]+)-([A-Z0-9]+)-([A-Z0-9]+)$/.exec(code);
    if (!match) {
      return null;
    }
    const room = match[1];
    const seed = Number.parseInt(match[2], 36);
    const level = Number.parseInt(match[3], 36);
    const startAtSec = Number.parseInt(match[4], 36);
    if (!Number.isFinite(seed) || !Number.isFinite(level) || !Number.isFinite(startAtSec)) {
      return null;
    }
    return {
      code,
      room,
      seed: seed >>> 0,
      level: Math.max(1, Math.min(99, Math.floor(level))),
      startAtMs: Math.floor(startAtSec) * 1000
    };
  };

  const beginChallengeSync = (room) => {
    challengeRoom = room;
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
        window.__slideyGame?.setGhostState?.({
          x: Number(payload.x),
          y: Number(payload.y),
          renderX: Number(payload.renderX),
          renderY: Number(payload.renderY),
          shape: payload.shape
        });
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
      const payload = {
        challenge_code: challengeRoom,
        device_id: deviceId,
        level: snapshot.level,
        pos_x: snapshot.x,
        pos_y: snapshot.y,
        render_x: snapshot.renderX,
        render_y: snapshot.renderY,
        shape: snapshot.shape,
        phase: snapshot.phase,
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
          phase: snapshot.phase,
          at: Date.now()
        }
      });
    }, 140);

    challengePullTimer = window.setInterval(async () => {
      if (!challengeRoom) {
        return;
      }
      const { data, error } = await supabaseClient
        .from(CHALLENGE_TABLE)
        .select("pos_x,pos_y,render_x,render_y,shape,updated_at")
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
      window.__slideyGame?.setGhostState?.({
        x: Number(row.pos_x),
        y: Number(row.pos_y),
        renderX: Number(row.render_x),
        renderY: Number(row.render_y),
        shape: row.shape
      });
    }, 220);
  };

  const launchChallenge = (info) => {
    stopChallengeSync();
    hideShopMenu();
    showChallengeMenu();
    hideStartMenu();
    if (challengeCodeValue) {
      challengeCodeValue.textContent = info.code;
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

  const createChallenge = () => {
    const info = buildChallengeInfo();
    if (challengeCodeValue) {
      challengeCodeValue.textContent = info.code;
    }
    copyChallengeBtn?.classList.remove("hidden");
    setChallengeStatus("Code created. Share it with your friend. Countdown is live.");
    launchChallenge(info);
  };

  const joinChallenge = () => {
    const raw = window.prompt("Enter a challenge code");
    if (!raw) {
      return;
    }
    const info = parseChallengeCode(raw);
    if (!info) {
      setChallengeStatus("Invalid code.");
      return;
    }
    if (info.startAtMs < Date.now() - 1000) {
      setChallengeStatus("Code expired. Ask for a fresh challenge code.");
      return;
    }
    if (challengeCodeValue) {
      challengeCodeValue.textContent = info.code;
    }
    copyChallengeBtn?.classList.remove("hidden");
    setChallengeStatus("Challenge accepted. Get ready for the start.");
    launchChallenge(info);
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

  const fetchRemoteProfile = async () => {
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
    const payload = {
      device_id: deviceId,
      wallet_orbs: walletOrbs,
      highest_level: highestLevel
    };
    const { error } = await supabaseClient.from(REMOTE_TABLE).upsert(payload, { onConflict: "device_id" });
    if (error) {
      throw error;
    }
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
    setupClientHardening();
    deviceId = getOrCreateDeviceId();
    walletOrbs = Math.max(0, readNumber(window.localStorage.getItem(GUEST_WALLET_KEY), 0));
    highestLevel = Math.max(1, readNumber(window.localStorage.getItem(GUEST_LEVEL_KEY), 1));
    tutorialCompleted = window.localStorage.getItem(TUTORIAL_COMPLETED_KEY) === "1";
    unlockedShapes = readUnlockedShapes();
    const storedShape = window.localStorage.getItem(SELECTED_SHAPE_KEY);
    selectedShape = unlockedShapes.has(storedShape) && ALLOWED_SHAPES.has(storedShape) ? storedShape : "square";
    persistShapeState();
    if (challengeCodeValue) {
      challengeCodeValue.textContent = "------";
    }
    copyChallengeBtn?.classList.add("hidden");
    setChallengeStatus("Create or enter a challenge code.");
    updateBestTimeDisplay(readNumber(window.localStorage.getItem(BEST_TIME_KEY), 0));
    updateMenuOrbsDisplay();
    applyWalletToGame();
    applyProgressToGame();
    bootstrapSupabase();
    refreshInstallGate();

    if (supabaseClient) {
      void syncWithRemote().catch(() => {
      });
    }

    ensureGameReady();
  };

  installAction?.addEventListener("click", () => {
    void handleInstallAction();
  });
  startRunBtn?.addEventListener("click", startNormalRun);
  challengeBtn?.addEventListener("click", showChallengeMenu);
  tutorialBtn?.addEventListener("click", startTutorialRun);
  storeBtn?.addEventListener("click", showShopMenu);
  closeShopBtn?.addEventListener("click", hideShopMenu);
  createChallengeBtn?.addEventListener("click", createChallenge);
  joinChallengeBtn?.addEventListener("click", joinChallenge);
  copyChallengeBtn?.addEventListener("click", () => {
    void copyChallengeCode();
  });
  closeChallengeBtn?.addEventListener("click", () => {
    stopChallengeSync();
    hideChallengeMenu();
    showStartMenu();
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
  });
  window.addEventListener("slidey:return-to-main", () => {
    stopChallengeSync();
    window.__slideyGame?.clearGhostState?.();
    hideShopMenu();
    hideChallengeMenu();
    showStartMenu();
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

  if (window.matchMedia) {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    displayModeQuery.addEventListener?.("change", refreshInstallGate);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {
        });
      },
      { once: true }
    );
  }

  init();
})();
