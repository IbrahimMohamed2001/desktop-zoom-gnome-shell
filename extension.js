import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

const TSTATE = Clutter.ModifierType.MOD1_MASK;

class DesktopZoomGestureAction {
  constructor(settings, magnifierSettings, a11ySettings) {
    this._settings = settings;
    this._magnifierSettings = magnifierSettings;
    this._a11ySettings = a11ySettings;
    this._scrollTimer = GLib.get_monotonic_time();

    // Use captured-event to catch input before DING or Windows see it
    this._gestureCallbackID = global.stage.connect(
      "captured-event",
      this._handleEvent.bind(this),
    );
  }

  _handleEvent(actor, event) {
    // 1. Filter: We only care about Scroll events
    if (event.type() !== Clutter.EventType.SCROLL) {
      return Clutter.EVENT_PROPAGATE;
    }

    // 2. Filter: Check for Alt Key (MOD1)
    // Note: get_state() returns a bitmask. We check if the TSTATE bit is present.
    if ((event.get_state() & TSTATE) === 0) {
      return Clutter.EVENT_PROPAGATE;
    }

    // 3. Filter: Check Direction (Smooth or Vertical)
    const direction = event.get_scroll_direction();
    if (
      direction !== Clutter.ScrollDirection.SMOOTH &&
      direction !== Clutter.ScrollDirection.UP &&
      direction !== Clutter.ScrollDirection.DOWN
    ) {
      return Clutter.EVENT_PROPAGATE;
    }

    // --- THE LOGIC ---

    let magFactor = this._magnifierSettings.get_double("mag-factor");
    let magFactorDelta = this._settings.get_double("mag-factor-delta");
    let enableOnScroll = this._settings.get_boolean("enable-on-scroll");

    // Calculate Delta
    let delta = 0;
    if (direction === Clutter.ScrollDirection.SMOOTH) {
      delta = event.get_scroll_delta()[1]; // [dx, dy] - we want dy
    } else if (direction === Clutter.ScrollDirection.UP) {
      delta = -1;
    } else if (direction === Clutter.ScrollDirection.DOWN) {
      delta = 1;
    }

    // Apply Zoom
    magFactor = Math.max(1.0, magFactor - delta * magFactorDelta);

    // Debug log to confirm it's working
    console.log(`[Desktop Zoom] Event Captured! New Factor: ${magFactor}`);

    if (enableOnScroll) {
      // Logic: If factor is basically 1.0, disable magnifier to save battery/performance
      if (magFactor <= 1.01) {
        if (Main.magnifier.isActive()) {
          this._a11ySettings.set_boolean("screen-magnifier-enabled", false);
        }
        // Ensure we stick to 1.0 exactly when disabled
        this._magnifierSettings.set_double("mag-factor", 1.0);
      } else {
        if (!Main.magnifier.isActive()) {
          this._a11ySettings.set_boolean("screen-magnifier-enabled", true);
        }
        this._magnifierSettings.set_double("mag-factor", magFactor);
      }
    } else if (Main.magnifier.isActive()) {
      this._magnifierSettings.set_double("mag-factor", magFactor);
    } else {
      // Magnifier is off and enable-on-scroll is off -> Do nothing
      return Clutter.EVENT_PROPAGATE;
    }

    return Clutter.EVENT_STOP; // Stop DING or anyone else from seeing this event
  }

  destroy() {
    if (this._gestureCallbackID) {
      global.stage.disconnect(this._gestureCallbackID);
      this._gestureCallbackID = null;
    }
  }
}

export default class DesktopZoomExtension extends Extension {
  enable() {
    console.log("[Desktop Zoom] Enabling (Captured Mode)...");

    this._settings = this.getSettings();
    this._magnifierSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.magnifier",
    });
    this._a11ySettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.applications",
    });

    // REMOVED: The lines that reset zoom to 1.0 on enable.
    // Now it preserves your current zoom state.

    this._gestureHandler = new DesktopZoomGestureAction(
      this._settings,
      this._magnifierSettings,
      this._a11ySettings,
    );
  }

  disable() {
    console.log("[Desktop Zoom] Disabling...");

    // Cleanup only
    if (this._gestureHandler) {
      this._gestureHandler.destroy();
      this._gestureHandler = null;
    }

    this._settings = null;
    this._magnifierSettings = null;
    this._a11ySettings = null;
  }
}
