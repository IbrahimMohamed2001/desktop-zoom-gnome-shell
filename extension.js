import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import Meta from "gi://Meta"; // Added Meta for debugging if needed

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

// KEY SETTING:
// MOD1 = Alt
// MOD4 = Super (Windows Key)
// CONTROL_MASK = Ctrl
const ZOOM_MODIFIER = Clutter.ModifierType.MOD1_MASK;

class DesktopZoomGestureAction {
  constructor(settings, magnifierSettings, a11ySettings) {
    this._settings = settings;
    this._magnifierSettings = magnifierSettings;
    this._a11ySettings = a11ySettings;

    // Connect to the global stage capture phase
    this._gestureCallbackID = global.stage.connect(
      "captured-event",
      this._handleEvent.bind(this),
    );
  }

  _handleEvent(actor, event) {
    // 1. Only care about SCROLL
    if (event.type() !== Clutter.EventType.SCROLL) {
      return Clutter.EVENT_PROPAGATE;
    }

    // 2. CHECK MODIFIER (The "Gatekeeper")
    // We use a bitwise AND. If Alt is held, the result is non-zero.
    const state = event.get_state();
    if ((state & ZOOM_MODIFIER) === 0) {
      return Clutter.EVENT_PROPAGATE;
    }

    // 3. LOGGING (To debug the "Window" issue)
    // If we get here, we are scrolling while holding ALT.
    // If you see this log when over the desktop, we have won.
    // If you DO NOT see this log when over the desktop, System is stealing the input.
    console.log("[Desktop Zoom] Alt+Scroll detected!");

    const direction = event.get_scroll_direction();

    let magFactor = this._magnifierSettings.get_double("mag-factor");
    let magFactorDelta = this._settings.get_double("mag-factor-delta");
    let enableOnScroll = this._settings.get_boolean("enable-on-scroll");

    // Calculate Delta
    let delta = 0;
    if (direction === Clutter.ScrollDirection.SMOOTH) {
      delta = event.get_scroll_delta()[1];
    } else if (direction === Clutter.ScrollDirection.UP) {
      delta = -1;
    } else if (direction === Clutter.ScrollDirection.DOWN) {
      delta = 1;
    } else {
      return Clutter.EVENT_PROPAGATE;
    }

    // Apply Zoom
    magFactor = Math.max(1.0, magFactor - delta * magFactorDelta);

    if (enableOnScroll) {
      if (magFactor <= 1.01) {
        if (Main.magnifier.isActive()) {
          this._a11ySettings.set_boolean("screen-magnifier-enabled", false);
        }
        this._magnifierSettings.set_double("mag-factor", 1.0);
      } else {
        if (!Main.magnifier.isActive()) {
          this._a11ySettings.set_boolean("screen-magnifier-enabled", true);
        }
        this._magnifierSettings.set_double("mag-factor", magFactor);
      }
    } else if (Main.magnifier.isActive()) {
      this._magnifierSettings.set_double("mag-factor", magFactor);
    }

    // STOP PROPAGATION
    // This prevents the event from reaching the window/DING/Desktop
    return Clutter.EVENT_STOP;
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
    console.log("[Desktop Zoom] Enabled.");
    this._settings = this.getSettings();
    this._magnifierSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.magnifier",
    });
    this._a11ySettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.applications",
    });

    this._gestureHandler = new DesktopZoomGestureAction(
      this._settings,
      this._magnifierSettings,
      this._a11ySettings,
    );
  }

  disable() {
    console.log("[Desktop Zoom] Disabled.");
    if (this._gestureHandler) {
      this._gestureHandler.destroy();
      this._gestureHandler = null;
    }
    this._settings = null;
    this._magnifierSettings = null;
    this._a11ySettings = null;
  }
}
