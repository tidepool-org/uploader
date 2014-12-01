# Carelink csv file uploader

Uploads raw carelink csv data into the tidepool platform

### Usage

- --file 		(short code -f) path to the carelink csv file path
- --environment (short code -e) the envirnment to load the data into local, devel, staging or prod environments, defaults to staging
- --username 	(short code -u) username who that data is being loaded for
- --password 	(short code -p) password for this user
- --timezone 	(short code -t) named timezone, default is 'America/Los_Angeles'

```
node csv_loader.js -f /Users/jhbate/Downloads/CareLink-Export-1391151846463.csv  -e local  -u <your_username> -p <your_pw>

```
