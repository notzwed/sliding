"use strict";

(function () {
  const installGate = document.getElementById("installGate");
  const installAction = document.getElementById("installAction");

  let deferredInstallPrompt = null;
  let promptedOnce = false;

  const isIos = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

  const isStandalone = () =>
    Boolean(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  const isInstallTargetDevice = () =>
    Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || isIos();

  const shouldRequireInstall = () => isInstallTargetDevice() && !isStandalone();

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

  installAction?.addEventListener("click", () => {
    void handleInstallAction();
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

  refreshInstallGate();
})();
