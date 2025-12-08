// Production-ready Prebid Data Collector
// Minimal version: Only locates and logs Prebid instance

(function () {
  "use strict";

  // Initialize pbjs.que before Prebid loads to ensure we run first
  // This queue executes callbacks before Prebid processes anything
  window.pbjs = window.pbjs || {};
  window.pbjs.que = window.pbjs.que || [];

  /**
   * Locate Prebid instance from _pbjsGlobals namespace array
   * Prebid can have multiple instances, so we check the global namespace
   */
  function locatePrebidInstance() {
    // Check for _pbjsGlobals array (contains all Prebid namespaces)
    if (window._pbjsGlobals && Array.isArray(window._pbjsGlobals)) {
      return window._pbjsGlobals;
    }
    return null;
  }

  /**
   * Get namespace name for an instance by finding which property on window points to it
   * Optimized to avoid iterating through all window properties (performance)
   */
  function getNamespaceName(pbjsInstance) {
    // Check if it's the default pbjs (most common case)
    if (pbjsInstance === window.pbjs) {
      return "pbjs";
    }

    // First check _pbjsGlobals for string namespaces (faster than iterating window)
    var namespaces = locatePrebidInstance();
    if (namespaces) {
      for (var i = 0; i < namespaces.length; i++) {
        if (
          typeof namespaces[i] === "string" &&
          window[namespaces[i]] === pbjsInstance
        ) {
          return namespaces[i];
        }
      }
    }

    // Last resort: search window properties (slow, but only if namespace not found above)
    // Limit search to common Prebid namespace patterns to avoid full window scan
    var commonNames = ["pbjs", "prebid", "pbjs_0", "pbjs_1"];
    for (var j = 0; j < commonNames.length; j++) {
      if (window[commonNames[j]] === pbjsInstance) {
        return commonNames[j];
      }
    }

    return "unknown";
  }

  /**
   * Get all pbjs instances (from default and all namespaces)
   * Returns array of objects with {instance, namespace}
   */
  function getAllPbjsInstances() {
    var instances = [];

    // Add default pbjs if it exists
    if (window.pbjs && typeof window.pbjs === "object") {
      instances.push({
        instance: window.pbjs,
        namespace: "pbjs",
      });
    }

    // Get all instances from _pbjsGlobals
    var namespaces = locatePrebidInstance();
    if (namespaces && namespaces.length > 0) {
      namespaces.forEach(function (namespace) {
        var pbjsInstance = null;
        var namespaceName = null;

        // If namespace is an object with pbjs property
        if (namespace && typeof namespace === "object" && namespace.pbjs) {
          pbjsInstance = namespace.pbjs;
          namespaceName = getNamespaceName(pbjsInstance);
        }
        // If namespace is a string like 'pbjs', try window[namespace]
        else if (typeof namespace === "string" && window[namespace]) {
          pbjsInstance = window[namespace];
          namespaceName = namespace;
        }

        // Add instance if found and not already in array
        if (pbjsInstance) {
          var alreadyAdded = instances.some(function (item) {
            return item.instance === pbjsInstance;
          });

          if (!alreadyAdded && pbjsInstance !== window.pbjs) {
            instances.push({
              instance: pbjsInstance,
              namespace: namespaceName || getNamespaceName(pbjsInstance),
            });
          }
        }
      });
    }

    return instances;
  }

  /**
   * Send formatted event data to backend endpoint
   * @param {Object} formattedData - The formatted event data
   */
  function sendEventToEndpoint(formattedData) {
    // Send to endpoint (fire and forget - don't block)
    fetch("http://localhost:3001/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([formattedData]),
    }).catch(function (error) {
      // Silently fail - don't log errors to avoid console spam
      // In production, you might want to queue failed requests for retry
    });
  }

  /**
   * Format bidRequested event data for backend
   * @param {Object} event - The bidRequested event
   * @returns {Object} Formatted data matching spec requirements
   */
  function formatBidRequestedData(event) {
    var bid = event.bids && event.bids[0] ? event.bids[0] : null;
    var ortb2 = event.ortb2 || (bid && bid.ortb2) || {};

    return {
      // Available from bidRequested event
      eventType: "bidRequested",
      requestId: event.auctionId || null,
      pageViewId: event.pageViewId || null,
      bidderCode: event.bidderCode || null,
      adUnitCode: bid ? bid.adUnitCode || null : null,
      adUnitRequestSizes: bid ? bid.sizes || null : null,
      adUnitFormat:
        bid && bid.mediaTypes ? Object.keys(bid.mediaTypes)[0] || null : null,
      userAgent: ortb2.device ? ortb2.device.ua || null : null,
      domain: ortb2.site ? ortb2.site.domain || null : null,
      pbjsTimeout: event.timeout || null,
      timestamp: event.auctionStart || event.start || null,
      bidderRequestId: event.bidderRequestId || null,
      sessionId: null, // TODO: Get from Prebid or partner's system
    };
  }

  /**
   * Handle bidRequested event
   * @param {Object} event - The bidRequested event
   * @param {string} namespace - The namespace name
   */
  function handleBidRequested(event, namespace) {
    console.log(`[Collector Event] ${namespace} bidRequested (raw):`, event);
    var formattedData = formatBidRequestedData(event);
    console.log(
      `[Collector Event] ${namespace} bidRequested (formatted):`,
      formattedData
    );
    sendEventToEndpoint(formattedData);
  }

  /**
   * Format bidderDone event data for backend
   * @param {Object} event - The bidderDone event
   * @returns {Object} Formatted data matching spec requirements
   */
  function formatBidderDoneData(event) {
    var bid = event.bids && event.bids[0] ? event.bids[0] : null;
    var metrics = event.metrics || (bid && bid.metrics) || {};
    var ortb2 = event.ortb2 || (bid && bid.ortb2) || {};

    // Extract latency from metrics (bidder response time)
    var latencyMs = null;
    if (metrics["adapters.client." + event.bidderCode + ".net"]) {
      var latencyArray =
        metrics["adapters.client." + event.bidderCode + ".net"];
      latencyMs =
        latencyArray && latencyArray.length > 0 ? latencyArray[0] : null;
    } else if (metrics["adapter.client.net"]) {
      var latencyArray = metrics["adapter.client.net"];
      latencyMs =
        latencyArray && latencyArray.length > 0 ? latencyArray[0] : null;
    }

    // Calculate bidder response time (total time for bidder)
    var bidderResponseTime = null;
    if (metrics["adapters.client." + event.bidderCode + ".total"]) {
      bidderResponseTime =
        metrics["adapters.client." + event.bidderCode + ".total"];
    } else if (metrics["adapter.client.total"]) {
      bidderResponseTime = metrics["adapter.client.total"];
    }

    return {
      // Available from bidderDone event
      eventType: "bidderDone",
      requestId: event.auctionId || null,
      pageViewId: event.pageViewId || null,
      bidderCode: event.bidderCode || null,
      adUnitCode: bid ? bid.adUnitCode || null : null,
      adUnitRequestSizes: bid ? bid.sizes || null : null,
      adUnitFormat:
        bid && bid.mediaTypes ? Object.keys(bid.mediaTypes)[0] || null : null,
      userAgent: ortb2.device ? ortb2.device.ua || null : null,
      domain: ortb2.site ? ortb2.site.domain || null : null,
      timestamp: event.timestamp || Date.now(),
      bidderRequestId: event.bidderRequestId || null,
      latencyMs: latencyMs,
      bidderResponseTime: bidderResponseTime,
      sessionId: null, // TODO: Get from Prebid or partner's system
    };
  }

  /**
   * Handle bidderDone event
   * @param {Object} event - The bidderDone event
   * @param {string} namespace - The namespace name
   */
  function handleBidderDone(event, namespace) {
    console.log(`[Collector Event] ${namespace} bidderDone (raw):`, event);
    var formattedData = formatBidderDoneData(event);
    console.log(
      `[Collector Event] ${namespace} bidderDone (formatted):`,
      formattedData
    );
    sendEventToEndpoint(formattedData);
  }

  /**
   * Handle bidRejected event (placeholder)
   * @param {Object} event - The bidRejected event
   * @param {string} namespace - The namespace name
   */
  function handleBidRejected(event, namespace) {
    // TODO: Implement bidRejected handler per spec.md line 15
    // Extract: bidder code, rejection reason, auction ID
    console.log(`[Collector Event] ${namespace} bidRejected:`, event);
  }

  /**
   * Handle bidderError event (placeholder)
   * @param {Object} event - The bidderError event
   * @param {string} namespace - The namespace name
   */
  function handleBidderError(event, namespace) {
    // TODO: Implement bidderError handler per spec.md line 16
    // Extract: bidder code, error type, error message, auction ID
    console.log(`[Collector Event] ${namespace} bidderError:`, event);
  }

  /**
   * Handle bidTimeout event (placeholder)
   * @param {Object} event - The bidTimeout event
   * @param {string} namespace - The namespace name
   */
  function handleBidTimeout(event, namespace) {
    // TODO: Implement bidTimeout handler per spec.md line 17
    // Extract: bidder code, timeout duration, auction ID, ad unit code
    console.log(`[Collector Event] ${namespace} bidTimeout:`, event);
  }

  /**
   * Subscribe to Prebid events and log them
   * @param {Object} pbjs - The pbjs instance to subscribe to
   * @param {string} namespace - The namespace name (e.g., 'pbjs')
   */
  function subscribeToEvents(pbjs, namespace) {
    // Specific handlers for key events
    try {
      pbjs.onEvent("bidRequested", function (event) {
        handleBidRequested(event, namespace);
      });
    } catch (error) {
      console.error(
        `[Collector] Error subscribing to ${namespace} bidRequested:`,
        error
      );
    }

    try {
      pbjs.onEvent("bidderDone", function (event) {
        handleBidderDone(event, namespace);
      });
    } catch (error) {
      console.error(
        `[Collector] Error subscribing to ${namespace} bidderDone:`,
        error
      );
    }

    // Placeholder handlers for spec.md lines 15-17
    try {
      pbjs.onEvent("bidRejected", function (event) {
        handleBidRejected(event, namespace);
      });
    } catch (error) {
      console.error(
        `[Collector] Error subscribing to ${namespace} bidRejected:`,
        error
      );
    }

    try {
      pbjs.onEvent("bidderError", function (event) {
        handleBidderError(event, namespace);
      });
    } catch (error) {
      console.error(
        `[Collector] Error subscribing to ${namespace} bidderError:`,
        error
      );
    }

    try {
      pbjs.onEvent("bidTimeout", function (event) {
        handleBidTimeout(event, namespace);
      });
    } catch (error) {
      console.error(
        `[Collector] Error subscribing to ${namespace} bidTimeout:`,
        error
      );
    }

    // Other events (generic handlers)
    var otherEventTypes = [
      "auctionInit",
      "auctionEnd",
      "bidResponse",
      "bidWon",
      "seatNonBid",
    ];

    otherEventTypes.forEach(function (eventType) {
      try {
        pbjs.onEvent(eventType, function (event) {
          console.log(`[Collector Event] ${namespace} ${eventType}:`, event);
        });
      } catch (error) {
        console.error(
          `[Collector] Error subscribing to ${namespace} ${eventType}:`,
          error
        );
      }
    });
  }

  // Track which instances we've already subscribed to (avoid duplicates)
  var subscribedInstances = [];
  var retryCount = 0;
  var MAX_RETRIES = 50; // 50 retries × 100ms = 5 seconds max

  /**
   * Initialize collector - wait for Prebid to be ready
   */
  function initCollector() {
    var instances = getAllPbjsInstances();

    if (instances.length > 0) {
      // Subscribe to events on all instances
      instances.forEach(function (item) {
        var pbjs = item.instance;
        var namespace = item.namespace;

        // Skip if already subscribed to this instance
        if (subscribedInstances.indexOf(pbjs) !== -1) {
          return;
        }

        if (typeof pbjs.onEvent === "function") {
          // Subscribe to future events
          subscribeToEvents(pbjs, namespace);

          // Mark as subscribed
          subscribedInstances.push(pbjs);
        }
      });
    } else {
      // Prebid not ready yet - retry with limit
      if (retryCount >= MAX_RETRIES) {
        console.error(
          `[Collector] Max retries (${MAX_RETRIES}) reached. Prebid not found.`
        );
        return;
      }

      retryCount++;
      setTimeout(initCollector, 100);
    }
  }

  /**
   * Setup subscription using Prebid's queue system
   * This ensures we subscribe before Prebid processes any events
   */
  function setupSubscriptionViaQueue() {
    // Add to Prebid's queue - this will execute before Prebid processes anything
    window.pbjs.que.push(function () {
      // Now pbjs is fully initialized, subscribe to events
      var instances = getAllPbjsInstances();

      if (instances.length > 0) {
        instances.forEach(function (item) {
          var pbjs = item.instance;
          var namespace = item.namespace;

          // Skip if already subscribed to this instance
          if (subscribedInstances.indexOf(pbjs) !== -1) {
            return;
          }

          if (typeof pbjs.onEvent === "function") {
            // Subscribe to future events
            subscribeToEvents(pbjs, namespace);

            // Mark as subscribed
            subscribedInstances.push(pbjs);
          }
        });
      }
    });
  }

  // Setup subscription via queue immediately (before Prebid loads)
  setupSubscriptionViaQueue();

  // Also try direct initialization as fallback (for cases where queue already processed)
  initCollector();
})();
