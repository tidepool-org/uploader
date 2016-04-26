#!/usr/bin/env bash

echo ""
echo "### Building docs static website with GitBook... ###"
echo ""

./node_modules/.bin/gitbook build

echo ""
echo "### Syncing docs static website to web/ directory... ###"
echo ""

rsync -rv --delete-before --exclude '.git/' _book/ web/

echo ""
echo "### Cleaning up GitBook build... ###"
echo ""

rm -rf _book/

echo "### Final step is to navigate into web/, confirm the changes and commit them..."
echo "Then push to gh-pages branch. ###"
echo ""