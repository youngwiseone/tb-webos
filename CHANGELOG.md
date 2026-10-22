# Changes

## 0.1.1

Compared with the original 0.1.0 showcase submission:

- Add **Internet** to the main menu, showing the current connection type, network name, a larger TV IP address, gateway, subnet mask and DNS.
- Keep local-network connectivity separate from internet availability, including disconnected and unknown states.
- Add Refresh and refresh on return/visibility and every 30 seconds while the page is open. Clear old details if a refresh fails.
- Open LG's native Settings with General → Network selected for Wi-Fi selection and password entry. Fall back to All LG settings if the targeted launch fails.
- Add D-pad/OK/Back navigation, a network symbol, synthetic network tests and a neutral-background preview.
- Label the public bundled scene Blue horizon; retain the historical internal preference key for compatibility.
- Query connection details directly where permitted. The fixed, read-only Homebrew fallback requires the existing **Homebrew: On** opt-in; it stays off by default.

The time-of-day greeting, PS2-style intro option, six recent cards, rendering improvements and separate startup volume were already part of 0.1.0; they are retained rather than presented as new changes here.

The matching personal implementation was exercised on an LG C2 with webOS 24, including the live network readback, Refresh and the native Settings overlay. This public build uses a separate app identity and neutral assets and remains PC-tested only. No Wi-Fi change, password-entry test, public-build hardware installation or reboot test is claimed.

Personal settings, real SSIDs/IPs, credentials, owner screenshots/wallpaper, extracted firmware icons, console recordings, root/debloat scripts and device-specific startup hooks remain excluded. The launcher does not disable microphones, remove apps or alter privacy consent.
