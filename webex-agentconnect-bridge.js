/**
 * AgentConnect Webex Bridge - Headless Widget
 * Cisco Webex Contact Center Desktop Custom Widget
 */

class AgentConnectBridge extends HTMLElement {
  constructor() {
    super();

    this.eventsSent = 0;
    this.sdkInitialized = false;

    console.log('[AgentConnect Bridge] Component created');
  }

  /**
   * Called when widget is attached to DOM
   */
  connectedCallback() {
    console.log('[AgentConnect Bridge] connectedCallback triggered');

    // Prevent duplicate initialization
    if (this.sdkInitialized) {
      return;
    }

    this.initializeWebexSDK();
  }

  /**
   * Initialize Webex SDK
   */
  async initializeWebexSDK(retries = 30) {
    console.log('[AgentConnect Bridge] Checking for WxCC SDK...');

    // Wait for SDK injection
    if (
      typeof window.WxCC === 'undefined' ||
      !window.WxCC.Desktop
    ) {
      if (retries > 0) {
        console.log(
          `[AgentConnect Bridge] WxCC SDK not ready. Retrying... (${retries})`
        );

        setTimeout(() => {
          this.initializeWebexSDK(retries - 1);
        }, 1000);

        return;
      }

      console.error(
        '[AgentConnect Bridge] Webex SDK not found after retries!'
      );

      return;
    }

    console.log('[AgentConnect Bridge] WxCC SDK detected');

    try {
      // Initialize SDK
      await window.WxCC.Desktop.config.init({
        widgetName: 'AgentConnect Integration Bridge',
        widgetProvider: 'AgentConnect'
      });

      console.log('[AgentConnect Bridge] SDK initialized successfully');

      this.sdkInitialized = true;

      // Register listeners
      this.subscribeToEvents();

      // Notify parent bridge ready
      this.sendToAgentConnect('bridge:ready', {
        initialized: true
      });

    } catch (error) {
      console.error(
        '[AgentConnect Bridge] Failed to initialize SDK:',
        error
      );
    }
  }

  /**
   * Register all Webex event listeners
   */
  subscribeToEvents() {
    console.log('[AgentConnect Bridge] Registering event listeners...');

    /**
     * Agent State Updates
     */
    try {
      window.WxCC.Desktop.agentStateInfo.addEventListener(
        'updated',
        (updates) => {
          console.log(
            '[AgentConnect Bridge] Agent state updated:',
            updates
          );

          const statusUpdate = updates.find(
            (u) =>
              u.name === 'subStatus' ||
              u.name === 'status'
          );

          if (statusUpdate) {
            const isOnline =
              statusUpdate.value === 'Available' ||
              statusUpdate.value === 'LoggedIn';

            this.sendToAgentConnect('agent:status', {
              status: isOnline ? 'online' : 'offline',
              rawStatus: statusUpdate.value
            });
          }
        }
      );
    } catch (err) {
      console.error(
        '[AgentConnect Bridge] Failed registering agentStateInfo listener',
        err
      );
    }

    /**
     * Contact Offered
     */
    try {
      window.WxCC.Desktop.agentContact.addEventListener(
        'eAgentOfferContact',
        (event) => {
          console.log(
            '[AgentConnect Bridge] Contact offered:',
            event
          );

          this.handleInteractionEvent(
            'task:alerting',
            event,
            'alerting'
          );
        }
      );
    } catch (err) {
      console.error(
        '[AgentConnect Bridge] Failed registering offer listener',
        err
      );
    }

    /**
     * Contact Assigned
     */
    try {
      window.WxCC.Desktop.agentContact.addEventListener(
        'eAgentContactAssigned',
        (event) => {
          console.log(
            '[AgentConnect Bridge] Contact assigned:',
            event
          );

          this.handleInteractionEvent(
            'task:connected',
            event,
            'connected'
          );
        }
      );
    } catch (err) {
      console.error(
        '[AgentConnect Bridge] Failed registering assigned listener',
        err
      );
    }

    /**
     * Contact Ended
     */
    try {
      window.WxCC.Desktop.agentContact.addEventListener(
        'eAgentContactEnded',
        (event) => {
          console.log(
            '[AgentConnect Bridge] Contact ended:',
            event
          );

          this.handleInteractionEvent(
            'task:end',
            event,
            'ended'
          );
        }
      );
    } catch (err) {
      console.error(
        '[AgentConnect Bridge] Failed registering ended listener',
        err
      );
    }

    /**
     * Contact Wrapped Up
     */
    try {
      window.WxCC.Desktop.agentContact.addEventListener(
        'eAgentContactWrappedUp',
        (event) => {
          console.log(
            '[AgentConnect Bridge] Contact wrapped up:',
            event
          );

          this.handleInteractionEvent(
            'task:end',
            event,
            'wrapped_up'
          );
        }
      );
    } catch (err) {
      console.error(
        '[AgentConnect Bridge] Failed registering wrapup listener',
        err
      );
    }

    console.log(
      '[AgentConnect Bridge] All listeners registered successfully'
    );
  }

  /**
   * Common interaction event handler
   */
  handleInteractionEvent(type, event, state) {
    try {
      const interaction = event?.data?.interaction;

      if (!interaction) {
        console.warn(
          '[AgentConnect Bridge] No interaction data found'
        );
        return;
      }

      const payload = {
        taskId: interaction.interactionId,
        direction:
          interaction.contactDirection?.type || 'INBOUND',
        ani: interaction.callAssociatedDetails?.ani,
        dnis: interaction.callAssociatedDetails?.dn,
        callerName:
          interaction.participants?.[
            interaction.owner
          ]?.name,
        state
      };

      this.sendToAgentConnect(type, payload);

    } catch (error) {
      console.error(
        '[AgentConnect Bridge] Failed processing interaction',
        error
      );
    }
  }

  /**
   * Send messages to parent iframe/window
   */
  sendToAgentConnect(type, data) {
    const message = {
      source: 'webex-bridge',
      timestamp: new Date().toISOString(),
      type,
      data
    };

    console.log(
      '[AgentConnect Bridge] Sending message:',
      message
    );

    try {
      // Send to top window
      if (window.top && window.top !== window) {
        window.top.postMessage(message, '*');
      }

      // Send to immediate parent
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }

      this.eventsSent++;

      console.log(
        `[AgentConnect Bridge] Event sent successfully (${this.eventsSent})`
      );

    } catch (error) {
      console.error(
        '[AgentConnect Bridge] Failed sending message:',
        error
      );
    }
  }

  /**
   * Cleanup
   */
  disconnectedCallback() {
    console.log(
      '[AgentConnect Bridge] Component disconnected'
    );
  }
}

/**
 * Register custom element
 */
customElements.define(
  'agentconnect-bridge',
  AgentConnectBridge
);

console.log(
  '[AgentConnect Bridge] Custom element registered'
);

/**
 * IMPORTANT:
 * Webex does NOT automatically instantiate custom elements.
 * We must manually create and attach it to DOM.
 */
// window.addEventListener('DOMContentLoaded', () => {
//   console.log(
//     '[AgentConnect Bridge] DOM fully loaded'
//   );

//   // Prevent duplicate widget creation
//   if (!document.querySelector('agentconnect-bridge')) {
//     const widget = document.createElement(
//       'agentconnect-bridge'
//     );

//     document.body.appendChild(widget);

//     console.log(
//       '[AgentConnect Bridge] Widget instance appended to document.body'
//     );
//   } else {
//     console.log(
//       '[AgentConnect Bridge] Widget already exists'
//     );
//   }
// });