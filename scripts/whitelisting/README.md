## av-submit.js

Use: `yarn av-whitelist`

This script will submit the latest release of Uploader to the following antivirus vendors:

- Kaspersky, by submitting an XML file via FTP
- McAfee, by submitting a form via e-mail

If you want to update the McAfee template, you'll need Tidepool AWS SES CLI credentials (with permissions to update e-mail templates) as well as the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html), and run:

```
aws ses update-template --cli-input-json file://scripts/mcafee-template.json
```

You also need to set the following environment variables for the script to work (available in 1Password):

```
FTP_AV_PASSWORD_TIDEPOOL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

This script is currently set up to run automatically on Appveyor when a release is tagged.
