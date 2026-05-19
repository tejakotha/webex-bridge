/**
 * AgentConnect Webex Bridge - WxCC Headless Safe Version
 * NO Custom Elements, NO DOM dependency
 */

(function () {
  console.log("[AgentConnect Bridge] script loaded");

  let initialized = false;

  /**
   * Wait for WxCC SDK
   */
  function waitForWxCC(timeout = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const check = () => {
        if (window.WxCC?.Desktop) {
          return resolve(window.WxCC.Desktop);
        }

        if (Date.now() - start > timeout) {
          return reject(new Error("WxCC SDK timeout"));
        }

        setTimeout(check, 250);
      };

      check();
    });
  }

  /**
   * Main init
   */
  async function init() {
    if (initialized) return;
    initialized = true;

    console.log("[AgentConnect Bridge] initializing...");

    try {
      const Desktop = await waitForWxCC();

      await Desktop.config.init({
        widgetName: "AgentConnect Integration Bridge",
        widgetProvider: "AgentConnect",
      });

      console.log("[AgentConnect Bridge] WxCC initialized");

      subscribeToEvents(Desktop);
    } catch (err) {
      console.error("[AgentConnect Bridge] init failed:", err);
    }
  }

  /**
   * Event subscriptions
   */
  function subscribeToEvents(Desktop) {
    console.log("[AgentConnect Bridge] subscribing to events");

    // Agent state changes
    Desktop.agentStateInfo.addEventListener("updated", (updates) => {
      const statusUpdate = updates.find(
        (u) => u.name === "subStatus" || u.name === "status",
      );

      if (!statusUpdate) return;

      const isOnline =
        statusUpdate.value === "Available" || statusUpdate.value === "LoggedIn";

      postToParent("agent:status", {
        status: isOnline ? "online" : "offline",
      });
    });

    // Incoming call (IMPORTANT)
    Desktop.agentContact.addEventListener("eAgentOfferContact", (event) => {
      const interaction = event?.data?.interaction;
      if (!interaction) return;

      postToParent("task:alerting", {
        taskId: interaction.interactionId,
        direction: interaction.contactDirection?.type || "INBOUND",
        ani: interaction.callAssociatedDetails?.ani,
        dnis: interaction.callAssociatedDetails?.dn,
        callerName: interaction.participants?.[interaction.owner]?.name,
        state: "alerting",
      });
    });

    // Call accepted
    Desktop.agentContact.addEventListener("eAgentContactAssigned", (event) => {
      const interaction = event?.data?.interaction;
      if (!interaction) return;

      postToParent("task:connected", {
        taskId: interaction.interactionId,
        state: "connected",
      });
    });

    // Call ended
    Desktop.agentContact.addEventListener("eAgentContactEnded", (event) => {
      const interaction = event?.data?.interaction;
      if (!interaction) return;

      postToParent("task:end", {
        taskId: interaction.interactionId,
        state: "ended",
      });
    });

    console.log("[AgentConnect Bridge] event listeners ready");
  }

  /**
   * Send to parent window (AgentConnect CRM)
   */
  function postToParent(type, data) {
    const message = {
      source: "webex-bridge",
      type,
      data,
    };

    try {
      window.parent?.postMessage(message, "*");
      window.top?.postMessage(message, "*");
    } catch (e) {
      console.error("[AgentConnect Bridge] postMessage failed", e);
    }
  }

  /**
   * WxCC entry points (VERY IMPORTANT)
   */
  window.addEventListener("load", init);
  document.addEventListener("DOMContentLoaded", init);

  // fallback in case WxCC loads late
  setTimeout(init, 2000);
})();
