#!/bin/sh
docker compose -f compose.yaml -f compose.gpu.yaml -f compose.ui.yaml down