# Carelink csv file uploader

Uploads raw carelink csv data into the tidepool platform

### Usage

- --carelink 	-c path to the carelink csv file path
- --environment -e the envirnment to load the data into local, devel, staging or prod environments, defaults to staging
- --username 	-u username who that data is being loaded for
- --password 	-p password for this user
- --timezone 	-t named timezone, default is 'America/Los_Angeles'

```
node csv_loader.js -c /Users/jhbate/Downloads/CareLink-Export-1391151846463.csv  -e local  -u <your_username> -p <your_pw>

```
