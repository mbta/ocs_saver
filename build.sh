#!/bin/sh

# Bundles and packages a TypeScript entrypoint for AWS Lambda.
#
# Example: `build.sh src/lambda.ts` would output a bundled file `dist/lambda.js`
# plus a `dist/lambda.zip` containing that file but with the name `index.js`.

set -e

esbuild=node_modules/.bin/esbuild

if [ ! -f $esbuild ]; then
  echo "$esbuild does not exist; ensure dependencies are installed."
  exit 1
fi

if ! which zip > /dev/null; then
  echo "\`which zip\` did not find anything; ensure \`zip\` is installed."
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: build.sh <entrypoint>"
  exit 1
fi

basename=$(basename "$1")
module=${basename%.ts}
outfile="dist/$module.js"

$esbuild "$1" --bundle --outfile="$outfile" --platform=node --target=node14

cp "$outfile" dist/index.js

# zip doesn't have an "overwrite output file" option, so use stdout redirection
zip -j - dist/index.js > dist/"$module".zip

rm dist/index.js
