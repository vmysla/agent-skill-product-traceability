#!/usr/bin/env bash
# Product Traceability - uninstaller. Removes Product Traceability, Product Traceability Light
# and v1. Records in your projects (docs/product-traceability/) and native memory stay in place.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/install.sh" --uninstall
