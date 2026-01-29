import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import Meta from "gi://Meta";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

const ZOOM_MODIFIER = Clutter.ModifierType.MOD1_MASK;

class DesktopZoomGestureAction {
  constructor(settings, magnifierSettings, a11ySettings) {
    this._settings = settings;
    this._magnifierSettings = magnifierSettings;
    this._a11ySettings = a11ySettings;

    this._gestureCallbackID = global.stage.connect(
      "captured-event",
      this._handleEvent.bind(this),
    );
  }

  _handleEvent(actor, event) {
    if (event.type() !== Clutter.EventType.SCROLL) {
      return Clutter.EVENT_PROPAGATE;
    }

    const state = event.get_state();
    if ((state & ZOOM_MODIFIER) === 0) {
      return Clutter.EVENT_PROPAGATE;
    }

    const direction = event.get_scroll_direction();

    // --- LOGGING VARIABLES ---
    let magFactor = this._magnifierSettings.get_double("mag-factor");
    let magFactorDelta = this._settings.get_double("mag-factor-delta");
    let enableOnScroll = this._settings.get_boolean("enable-on-scroll");
    let isSystemZoomActive = Main.magnifier.isActive();

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

    // --- VERBOSE LOGGING ---
    console.log(`[Desktop Zoom] DEBUG:
            Delta: ${delta}
            Current Factor: ${magFactor}
            Speed Setting: ${magFactorDelta}
            Enable-on-scroll: ${enableOnScroll}
            System Zoom Active: ${isSystemZoomActive}
        `);

    // Apply Zoom Calculation
    let newMagFactor = Math.max(1.0, magFactor - delta * magFactorDelta);
    console.log(`[Desktop Zoom] Target Factor: ${newMagFactor}`);

    if (enableOnScroll) {
      if (newMagFactor <= 1.01) {
        if (isSystemZoomActive) {
          console.log("[Desktop Zoom] ACTION: Disabling System Zoom");
          this._a11ySettings.set_boolean("screen-magnifier-enabled", false);
        }
        this._magnifierSettings.set_double("mag-factor", 1.0);
      } else {
        if (!isSystemZoomActive) {
          console.log("[Desktop Zoom] ACTION: Enabling System Zoom");
          this._a11ySettings.set_boolean("screen-magnifier-enabled", true);
        }
        this._magnifierSettings.set_double("mag-factor", newMagFactor);
      }
    } else if (isSystemZoomActive) {
      console.log("[Desktop Zoom] ACTION: Updating Factor (Active)");
      this._magnifierSettings.set_double("mag-factor", newMagFactor);
    } else {
      console.log(
        "[Desktop Zoom] IGNORED: Zoom inactive and Enable-on-Scroll is OFF.",
      );
    }

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
    console.log("[Desktop Zoom] Enabling Debug Mode...");
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
    if (this._gestureHandler) {
      this._gestureHandler.destroy();
      this._gestureHandler = null;
    }
    this._settings = null;
    this._magnifierSettings = null;
    this._a11ySettings = null;
  }
}
