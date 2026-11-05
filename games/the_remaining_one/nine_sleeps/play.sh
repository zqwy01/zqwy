#!/usr/bin/env bash
# Launch КЕРН · ДЕВЯТЬ СНОВ with a Range-capable local server.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 tools/serve.py --open "$@"
