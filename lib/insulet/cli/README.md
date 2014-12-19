# Insulet file uploader

Uploads raw insulet file into the tidepool platform

### Setup 

Configuration values (for example the URL of the Tidepool Platform) are set via environment variables. If you need to add a config value, modify the `.config.js` file. To set config values (do this before building the app), you can use Shell scripts that export environment variables, for example:

```bash
$ source config/local.sh
```

### Usage

```
node insulet_cli.js -f /path/to/<your_insulet_file> -u <your_username> -p <your_pw>

```

- --file 		
  - short code -f
  - path to the Insulet file
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

