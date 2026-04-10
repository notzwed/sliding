"use strict";

(function () {
  const GUEST_WALLET_KEY = "slidey_wallet";
  const GUEST_LEVEL_KEY = "slidey_highest_level";
  const DEVICE_ID_KEY = "slidey_device_id";
  const REMOTE_TABLE = "player_profiles";

  const installGate = document.getElementById("installGate");
  const installAction = document.getElementById("installAction");

  let deferredInstallPrompt = null;
  let promptedOnce = false;
  let supabaseClient = null;
  let deviceId = "";
  let walletOrbs = 0;
  let highestLevel = 1;

  const isIos = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  const isStandalone = () =>
    Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  const isInstallTargetDevice = () =>
    Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || isIos();

  const shouldRequireInstall = () => isInstallTargetDevice() && !isStandalone();

  const readNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : fallback;
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

  const setLocalState = (nextWallet, nextHighestLevel) => {
    walletOrbs = Math.max(0, readNumber(nextWallet, walletOrbs));
    highestLevel = Math.max(1, readNumber(nextHighestLevel, highestLevel));
    window.localStorage.setItem(GUEST_WALLET_KEY, String(walletOrbs));
    window.localStorage.setItem(GUEST_LEVEL_KEY, String(highestLevel));
    applyWalletToGame();
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
    const level = Math.max(1, readNumber(event.detail?.level, 1));

    setLocalState(walletOrbs + gained, Math.max(highestLevel, level));

    if (supabaseClient) {
      void upsertRemoteProfile().catch(() => {
      });
    }
  };

  const init = () => {
    deviceId = getOrCreateDeviceId();
    walletOrbs = Math.max(0, readNumber(window.localStorage.getItem(GUEST_WALLET_KEY), 0));
    highestLevel = Math.max(1, readNumber(window.localStorage.getItem(GUEST_LEVEL_KEY), 1));
    applyWalletToGame();
    bootstrapSupabase();
    refreshInstallGate();

    if (supabaseClient) {
      void syncWithRemote().catch(() => {
      });
    }
  };

  installAction?.addEventListener("click", () => {
    void handleInstallAction();
  });

  window.addEventListener("slidey:orbs-earned", onOrbsEarned);

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
