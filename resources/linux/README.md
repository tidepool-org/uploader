## Uploading OneTouch meters in the browser

If uploading OneTouch Verio, Verio Flex, Verio Reflect, Select Plus Flex or Ultra Plus Flex meters in the browser (e.g. using `yarn dev-web`), you need to:

- Install the [Tidepool Uploader Helper web extension](https://chromewebstore.google.com/detail/tidepool-uploader-helper/nejgoemnddedidafdoppamlbijokiahb)
- Place `helper-linux` from [Uploader Helper](https://github.com/tidepool-org/uploader-helper/releases) in `/usr/local/bin`
- Place `org.tidepool.uploader-helper.json` in `~/.config/google-chrome/NativeMessagingHosts` (change the path in the .json file if you used a different folder in the previous step)
