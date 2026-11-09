#! /bin/bash
set -e

# Prints the newest chart version in the Helm repository index on gh-pages.
git fetch --quiet origin gh-pages
git show origin/gh-pages:index.yaml | awk '$1 == "version:" {print $2}' | sort -V | tail -n 1
