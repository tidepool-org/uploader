# Build zip file for Chrome Web Store
rm -rf dist.zip
rm -rf dist
node_modules/.bin/webpack -p --progress --colors --output-path dist/build
node scripts/cat-config.js > dist/build/config.js
cp manifest.json dist/
cp main.js dist/
cp index.html dist/
cp *.png dist/
cp *.gif dist/
zip -r dist.zip dist
echo "Build complete: dist.zip"
