import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

// The modifier key (Alt)
const TSTATE = Clutter.ModifierType.MOD1_MASK;

// A helper class to handle the scroll events
class DesktopZoomGestureAction {
  constructor(actor, settings, magnifierSettings, a11ySettings) {
    this._actor = actor;
    this._settings = settings;
    this._magnifierSettings = magnifierSettings;
    this._a11ySettings = a11ySettings;

    this._scrollTimer = GLib.get_monotonic_time();

    // Connect the scroll event
    this._gestureCallbackID = this._actor.connect(
      "scroll-event",
      this._handleEvent.bind(this),
    );
  }

  _handleEvent(actor, event) {
    // Check if Alt (MOD1) is held down
    if (
      (event.get_state() & TSTATE) === TSTATE &&
      event.get_scroll_direction() === Clutter.ScrollDirection.SMOOTH
    ) {
      // Get current settings
      let magFactor = this._magnifierSettings.get_double("mag-factor");
      let magFactorDelta = this._settings.get_double("mag-factor-delta");
      let enableOnScroll = this._settings.get_boolean("enable-on-scroll");

      // Debounce/Timer check (optional, kept from original logic)
      const now = GLib.get_monotonic_time();
      this._scrollTimer = now;

      // Calculate new zoom level
      // delta_y is usually at index 1
      const v = event.get_scroll_delta()[1];
      magFactor = Math.max(1.0, magFactor - v * magFactorDelta);

      console.log(`[Desktop Zoom] Factor: ${magFactor}`);

      if (enableOnScroll) {
        this._magnifierSettings.set_double("mag-factor", magFactor);

        // If we are basically at 1.0, disable the magnifier to save resources
        if (magFactor <= 1.005) {
          this._a11ySettings.set_boolean("screen-magnifier-enabled", false);
        } else if (!Main.magnifier.isActive()) {
          // Note: accessing Main.magnifier directly is safer than St.Settings for active state
          this._a11ySettings.set_boolean("screen-magnifier-enabled", true);
        }
      } else if (Main.magnifier.isActive()) {
        this._magnifierSettings.set_double("mag-factor", magFactor);
      } else {
        return Clutter.EVENT_PROPAGATE; // Let other actors handle it
      }

      return Clutter.EVENT_STOP; // Stop event propagation (we handled it)
    }

    return Clutter.EVENT_PROPAGATE;
  }

  destroy() {
    if (this._actor && this._gestureCallbackID) {
      this._actor.disconnect(this._gestureCallbackID);
      this._gestureCallbackID = null;
    }
  }
}

// The Main Extension Class
export default class DesktopZoomExtension extends Extension {
  enable() {
    console.log("[Desktop Zoom] Enabling...");

    // 1. Get Settings
    this._settings = this.getSettings();

    // For system settings (magnifier/a11y), we still need direct Gio.Settings
    this._magnifierSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.magnifier",
    });
    this._a11ySettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.applications",
    });

    // 2. Reset zoom to 1.0 on load (optional, based on original code)
    this._magnifierSettings.set_double("mag-factor", 1.0);
    this._a11ySettings.set_boolean("screen-magnifier-enabled", false);

    // 3. Initialize the gesture handler on the global stage
    // global.stage is the root actor of the shell
    this._gestureHandler = new DesktopZoomGestureAction(
      global.stage,
      this._settings,
      this._magnifierSettings,
      this._a11ySettings,
    );
  }

  disable() {
    console.log("[Desktop Zoom] Disabling...");

    // Reset zoom
    if (this._magnifierSettings) {
      this._magnifierSettings.set_double("mag-factor", 1.0);
    }
    if (this._a11ySettings) {
      this._a11ySettings.set_boolean("screen-magnifier-enabled", false);
    }

    // Clean up handler
    if (this._gestureHandler) {
      this._gestureHandler.destroy();
      this._gestureHandler = null;
    }

    this._settings = null;
    this._magnifierSettings = null;
    this._a11ySettings = null;
  }
}
