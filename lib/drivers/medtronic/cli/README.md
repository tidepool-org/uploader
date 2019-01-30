# Blob Loader

The `blob_loader.js` script directly uploads a JSON blob file to the targeted environment.

This script requires Node v7.9.0.

To execute:

1. In the top-level directory of the repository:
    1. Ensure the latest Node modules are installed via `yarn`. For example:
        ```
        yarn install
        ```
    1. Source the appropriate environment configuration file from the `config` directory. For example:
        ```
        source config/staging.sh
        ```
1. Change the current directory to `lib/drivers/medtronic/cli`. For example:
    ```
    cd lib/drivers/medtronic/cli
    ```
1. Execute the `blob_loader.js` script via `node` given the following template:
    ```
    node -r babel-register ./blob_loader.js -f '<BLOB_FILE.JSON>' -u '<TIDEPOOL_USERNAME>' -p '<TIDEPOOL_PASSWORD>' -t '<TIME_ZONE_NAME>'
    ```
    Replace `<BLOB_FILE.JSON>` with the absolute or relative path to the JSON blob file, `<TIDEPOOL_USERNAME>` and `<TIDEPOOL_PASSWORD>` with the username and password for a previously created DSA on the targeted environment, and `<TIME_ZONE_NAME>` with a valid IANA time zone name for the upload. For example:
    ```
    node -r babel-register ./blob_loader.js -f 'my_medtronic_blob.json' -u 'my@email.com' -p 'my_password' -t 'US/Pacific'
    ```
