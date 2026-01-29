import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class DesktopZoomPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    // 1. Get Settings
    // We use 'this.getSettings()' provided by the class instance
    const extensionSettings = this.getSettings();

    const magnifierSettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.magnifier",
    });
    const a11ySettings = new Gio.Settings({
      schema_id: "org.gnome.desktop.a11y.applications",
    });

    // 2. Create Page & Groups
    const page = new Adw.PreferencesPage();
    const groupGeneral = new Adw.PreferencesGroup({ title: "General" });
    const groupZoom = new Adw.PreferencesGroup({ title: "Zoom Behavior" });

    page.add(groupGeneral);
    page.add(groupZoom);

    // --- ROW 1: System Zoom Switch ---
    const sysZoomRow = new Adw.ActionRow({ title: "System Zoom Enabled" });
    const sysZoomSwitch = new Gtk.Switch({
      active: a11ySettings.get_boolean("screen-magnifier-enabled"),
      valign: Gtk.Align.CENTER,
    });

    // Bind directly to system settings
    a11ySettings.bind(
      "screen-magnifier-enabled",
      sysZoomSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    sysZoomRow.add_suffix(sysZoomSwitch);
    groupGeneral.add(sysZoomRow);

    // --- ROW 2: Enable on Scroll ---
    const scrollRow = new Adw.ActionRow({ title: "Enable on Scroll" });
    const scrollSwitch = new Gtk.Switch({
      active: extensionSettings.get_boolean("enable-on-scroll"),
      valign: Gtk.Align.CENTER,
    });

    extensionSettings.bind(
      "enable-on-scroll",
      scrollSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    scrollRow.add_suffix(scrollSwitch);
    groupGeneral.add(scrollRow);

    // --- ROW 3: Zoom Factor (Current Level) ---
    const factorRow = new Adw.ActionRow({ title: "Current Zoom Level" });
    const factorAdj = new Gtk.Adjustment({
      lower: 1.0,
      upper: 20.0,
      step_increment: 0.25,
      value: magnifierSettings.get_double("mag-factor"),
    });
    const factorSpin = new Gtk.SpinButton({
      digits: 2,
      climb_rate: 0.25,
      adjustment: factorAdj,
      valign: Gtk.Align.CENTER,
    });

    magnifierSettings.bind(
      "mag-factor",
      factorSpin,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    factorRow.add_suffix(factorSpin);
    groupZoom.add(factorRow);

    // --- ROW 4: Zoom Delta (Speed) ---
    const deltaRow = new Adw.ActionRow({ title: "Zoom Speed" });
    const deltaAdj = new Gtk.Adjustment({
      lower: 0.01,
      upper: 2.0,
      step_increment: 0.05,
      value: extensionSettings.get_double("mag-factor-delta"),
    });
    const deltaSpin = new Gtk.SpinButton({
      digits: 2,
      climb_rate: 0.05,
      adjustment: deltaAdj,
      valign: Gtk.Align.CENTER,
    });

    extensionSettings.bind(
      "mag-factor-delta",
      deltaAdj,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    deltaRow.add_suffix(deltaSpin);
    groupZoom.add(deltaRow);

    // Add page to window
    window.add(page);
  }
}
