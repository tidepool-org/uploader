# Insulet file uploader

Uploads raw insulet file into the tidepool platform

### Setup

Configuration values (for example the URL of the Tidepool Platform) are set via environment variables. If you need to add a config value, modify the `.config.js` file. To set config values (do this before building the app), you can use Shell scripts that export environment variables, for example:

```bash
$ source config/local.sh
```

### Usage

From the base uploader directory:

```
node -r @babel/register lib/drivers/insulet/cli/ibf_loader.js -f </path/to/Insulet-file.ibf> -u <username> -p <password>

```

- --file 		
  - short code -f
  - path to the insulet ibf file path
- --username 	
  - short code -u
  - username who that data is being loaded for
- --password 	
  - short code -p
  - password for this user
- --timezone 	
  - short code -t
  - named timezone
  - default is config.DEFAULT_TIMEZONE
