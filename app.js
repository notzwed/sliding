"use strict";

(function () {
  const ONBOARDING_REWARD = 2000;
  const GUEST_WALLET_KEY = "slidey_guest_wallet";
  const installGate = document.getElementById("installGate");
  const installAction = document.getElementById("installAction");
  const accountState = document.getElementById("accountState");
  const accountEmail = document.getElementById("accountEmail");
  const accountPassword = document.getElementById("accountPassword");
  const registerAction = document.getElementById("registerAction");
  const loginAction = document.getElementById("loginAction");
  const logoutAction = document.getElementById("logoutAction");

  let deferredInstallPrompt = null;
  let promptedOnce = false;
  let supabaseClient = null;
  let currentUser = null;
  let walletOrbs = 0;

  const isIos = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  const isStandalone = () =>
    Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  const isInstallTargetDevice = () =>
    Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || isIos();

  const shouldRequireInstall = () => isInstallTargetDevice() && !isStandalone();

  const setAccountText = (text) => {
    if (accountState) {
      accountState.textContent = text;
    }
  };

  const setAuthButtonsState = (busy) => {
    if (registerAction) {
      registerAction.disabled = busy;
    }
    if (loginAction) {
      loginAction.disabled = busy;
    }
    if (logoutAction) {
      logoutAction.disabled = busy;
    }
    if (accountEmail) {
      accountEmail.disabled = busy;
    }
    if (accountPassword) {
      accountPassword.disabled = busy;
    }
  };

  const setWallet = (value) => {
    walletOrbs = Math.max(0, Math.floor(Number(value) || 0));
    window.localStorage.setItem(GUEST_WALLET_KEY, String(walletOrbs));

    if (window.__slideyGame && typeof window.__slideyGame.setWalletOrbs === "function") {
      window.__slideyGame.setWalletOrbs(walletOrbs);
      return;
    }

    const runValue = document.getElementById("runValue");
    if (runValue) {
      runValue.textContent = String(walletOrbs).padStart(2, "0");
    }
  };

  const extractBalance = (rpcData) => {
    if (typeof rpcData === "number") {
      return rpcData;
    }
    if (Array.isArray(rpcData) && rpcData.length > 0) {
      const row = rpcData[0];
      if (row && typeof row.orb_balance !== "undefined") {
        return row.orb_balance;
      }
    }
    if (rpcData && typeof rpcData === "object" && typeof rpcData.orb_balance !== "undefined") {
      return rpcData.orb_balance;
    }
    return null;
  };

  const fetchProfile = async (userId) => {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("orb_balance,reward_granted,email")
      .eq("id", userId)
      .single();
    if (error) {
      throw error;
    }
    return data;
  };

  const ensureProfile = async (user) => {
    const payload = {
      id: user.id,
      email: user.email || null
    };
    const { error } = await supabaseClient.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) {
      throw error;
    }
  };

  const grantSignupReward = async () => {
    try {
      const { data, error } = await supabaseClient.rpc("grant_signup_reward", {
        reward_amount: ONBOARDING_REWARD
      });
      if (error) {
        throw error;
      }
      const balance = extractBalance(data);
      if (balance !== null) {
        return balance;
      }
    } catch (_error) {
    }

    const profile = await fetchProfile(currentUser.id);
    if (profile.reward_granted) {
      return profile.orb_balance || 0;
    }

    const target = (profile.orb_balance || 0) + ONBOARDING_REWARD;
    const { data, error } = await supabaseClient
      .from("profiles")
      .update({ orb_balance: target, reward_granted: true })
      .eq("id", currentUser.id)
      .eq("reward_granted", false)
      .select("orb_balance")
      .single();

    if (error) {
      throw error;
    }

    return data.orb_balance || target;
  };

  const addOrbsRemote = async (delta) => {
    try {
      const { data, error } = await supabaseClient.rpc("increment_player_orbs", {
        orb_delta: delta
      });
      if (error) {
        throw error;
      }
      const balance = extractBalance(data);
      if (balance !== null) {
        return balance;
      }
    } catch (_error) {
    }

    const profile = await fetchProfile(currentUser.id);
    const target = (profile.orb_balance || 0) + delta;
    const { data, error } = await supabaseClient
      .from("profiles")
      .update({ orb_balance: target })
      .eq("id", currentUser.id)
      .select("orb_balance")
      .single();
    if (error) {
      throw error;
    }
    return data.orb_balance || target;
  };

  const syncWalletFromAccount = async () => {
    if (!supabaseClient || !currentUser) {
      return;
    }

    await ensureProfile(currentUser);
    const rewardedBalance = await grantSignupReward();
    const profile = await fetchProfile(currentUser.id);
    const finalBalance = Math.max(profile.orb_balance || 0, rewardedBalance || 0);
    setWallet(finalBalance);
    setAccountText(`${currentUser.email || "Player"} • ${finalBalance} orbs`);
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
      setAccountText(`Guest mode • ${walletOrbs} orbs`);
      return;
    }

    supabaseClient = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  };

  const handleRegister = async () => {
    if (!supabaseClient || !accountEmail || !accountPassword) {
      return;
    }

    const email = accountEmail.value.trim();
    const password = accountPassword.value;
    if (!email || !password) {
      setAccountText("Insert email and password");
      return;
    }

    setAuthButtonsState(true);
    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) {
        throw error;
      }

      if (data.user && data.session) {
        currentUser = data.user;
        await syncWalletFromAccount();
        setAccountText(`${email} • bonus +${ONBOARDING_REWARD} granted`);
      } else {
        setAccountText("Registration done. Confirm email, then login.");
      }
    } catch (error) {
      setAccountText(`Register failed: ${error.message || "unknown error"}`);
    } finally {
      setAuthButtonsState(false);
    }
  };

  const handleLogin = async () => {
    if (!supabaseClient || !accountEmail || !accountPassword) {
      return;
    }

    const email = accountEmail.value.trim();
    const password = accountPassword.value;
    if (!email || !password) {
      setAccountText("Insert email and password");
      return;
    }

    setAuthButtonsState(true);
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      currentUser = data.user || null;
      if (currentUser) {
        await syncWalletFromAccount();
      }
    } catch (error) {
      setAccountText(`Login failed: ${error.message || "unknown error"}`);
    } finally {
      setAuthButtonsState(false);
    }
  };

  const handleLogout = async () => {
    if (!supabaseClient) {
      return;
    }
    setAuthButtonsState(true);
    try {
      await supabaseClient.auth.signOut();
      currentUser = null;
      setWallet(Number(window.localStorage.getItem(GUEST_WALLET_KEY) || 0));
      setAccountText(`Guest mode • ${walletOrbs} orbs`);
    } finally {
      setAuthButtonsState(false);
    }
  };

  const bootAuth = async () => {
    bootstrapSupabase();
    if (!supabaseClient) {
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    currentUser = data.session?.user || null;
    if (currentUser) {
      await syncWalletFromAccount();
    }

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        try {
          await syncWalletFromAccount();
        } catch (error) {
          setAccountText(`Sync failed: ${error.message || "error"}`);
        }
      } else {
        setWallet(Number(window.localStorage.getItem(GUEST_WALLET_KEY) || 0));
        setAccountText(`Guest mode • ${walletOrbs} orbs`);
      }
    });
  };

  installAction?.addEventListener("click", () => {
    void handleInstallAction();
  });

  registerAction?.addEventListener("click", () => {
    void handleRegister();
  });

  loginAction?.addEventListener("click", () => {
    void handleLogin();
  });

  logoutAction?.addEventListener("click", () => {
    void handleLogout();
  });

  window.addEventListener("slidey:orbs-earned", (event) => {
    const gained = Math.max(0, Math.floor(Number(event.detail?.gained) || 0));
    if (gained <= 0) {
      return;
    }

    if (!supabaseClient || !currentUser) {
      setWallet(walletOrbs + gained);
      setAccountText(`Guest mode • ${walletOrbs} orbs`);
      return;
    }

    void (async () => {
      try {
        const remoteBalance = await addOrbsRemote(gained);
        setWallet(remoteBalance);
        setAccountText(`${currentUser.email || "Player"} • ${walletOrbs} orbs`);
      } catch (error) {
        setAccountText(`Wallet sync failed: ${error.message || "error"}`);
      }
    })();
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

  const initialGuestWallet = Number(window.localStorage.getItem(GUEST_WALLET_KEY) || 0);
  setWallet(initialGuestWallet);
  setAccountText(`Guest mode • ${walletOrbs} orbs`);
  refreshInstallGate();
  void bootAuth();
})();
