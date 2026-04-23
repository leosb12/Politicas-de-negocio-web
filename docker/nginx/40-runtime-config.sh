#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-}"
API_BASE_URL="${API_BASE_URL%/}"
export API_BASE_URL

IA_API_BASE_URL="${IA_API_BASE_URL:-}"
IA_API_BASE_URL="${IA_API_BASE_URL%/}"
export IA_API_BASE_URL

envsubst '${API_BASE_URL} ${IA_API_BASE_URL}' < /usr/share/nginx/html/runtime-config.js.template > /usr/share/nginx/html/runtime-config.js
