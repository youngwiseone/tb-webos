# Contributing

Include your TV model, firmware and webOS version with hardware reports. Mark PC-only results as such. Keep D-pad behaviour deterministic and preserve the native LG Home fallback.

Run `npm ci`, `npm test`, `npm run build` and `npm run package`. Do not turn packaging into an install/root operation. Root service changes and new network integrations need separate review and explicit opt-in.

Never commit TV IPs, personal configuration, keys, pairing files, Steam credentials or unredacted account screenshots. Use synthetic fixtures. New art/audio must have a distributable licence and attribution; proprietary console recordings and owner-supplied wallpapers are not project assets.

Keep contributions focused and document what was actually tested. This public app has a separate identity from its personal predecessor; do not claim public-release hardware validation until it has happened.
