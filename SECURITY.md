# Security and local development

The app does not expose a network server. Root discovery/picture features use an existing Homebrew Channel root service only after opt-in or an explicit picture-setting action. The Internet page tries a read-only local status API; its fixed Homebrew fallback requires the existing Homebrew opt-in. It does not query passwords, scan devices or call an external IP service. Do not load untrusted scripts in the app or expose root services/SSH to the internet.

The optional Steam relay accepts a bearer token and a fixed friends endpoint. Bind it only to loopback or the intended private interface and restrict its firewall to the TV. Never publish API keys, relay tokens, pairing files or configuration exports.

Vite and the webOS CLI are development tools, not code running in the TV bundle. The inherited toolchain has transitive npm audit advisories, including webOS CLI dependencies with no upstream fix; a compatible audit update was applied, but the tree is not claimed advisory-free. Do not expose development/inspection servers to untrusted networks or feed untrusted archives/patterns into the CLI. The preview remains local. Changes to the build toolchain need independent compatibility testing rather than a forced major upgrade.

Use GitHub's private vulnerability reporting if enabled. Never attach real secrets to a public issue. Model/firmware details and a minimal synthetic reproduction are sufficient for ordinary bug reports.
