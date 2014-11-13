# Build zip file for Chrome Web Store
rm -rf dist.zip
rm -rf dist
npm run build-bundle
cp manifest.json dist/
cp main.js dist/
cp index.html dist/
cp *.png dist/
cp *.gif dist/
zip -r dist.zip dist
echo "Build complete: dist.zip"
