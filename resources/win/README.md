# The all-in-one USB driver for Windows

To build and sign the driver, check that you have the specified requirements installed and follow the steps below.

## Requirements

- [WDK](https://docs.microsoft.com/windows-hardware/drivers/download-the-wdk) (Required for `signtool`)

## Steps

Use the Developer Command Prompt for Visual Studio instead of the regular Command Prompt to make sure all the paths are set up correctly:

- `cd <uploader_directory>resources\win`
- `makecab /f TidepoolUSBDriver.ddf`
- `signtool sign /v /tr http://timestamp.digicert.com /td sha256 /fd sha256 /s my /n "Tidepool Project" /sha1 <tidepool_cert_thumbprint> disk1\TidepoolUSBDriver.cab` (You'll need the hardware token and the password in 1Password - if the SafeNet client does not prompt you for a password, you're not using the right certificate. Also replace the thumbprint/serial with that of the certificate you're using, and remember to install the root certs on the token when you're doing this for the first time.)

This `.cab` can then be submitted to the hardware dashboard at: https://partner.microsoft.com/en-us/dashboard/hardware/ (search 1Password for "Microsoft Hardware Dashboard" login details). Select all non-ARM64 options for `Requested Signatures` when submitting. If it's the first time you're using the certificate, you need to [add it to Partner Center](https://docs.microsoft.com/en-us/windows-hardware/drivers/dashboard/update-a-code-signing-certificate).

Download the signed drivers from the hardware portal and replace the existing drivers the `resources/win/` directory.

### Verify that drivers are correctly signed:

	signtool verify /kp /v /c tidepoolvcp.cat amd64\ftser2k.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\ftser2k.sys
	signtool verify /kp /v /c tidepoolvcp.cat amd64\silabser.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\silabser.sys
	signtool verify /kp /v /c tidepoolvcp.cat amd64\tiusb.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\tiusb.sys
	signtool verify /kp /v /c tidepoolvcp.cat amd64\ser2pl64.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\ser2pl.sys
	signtool verify /kp /v /c phdc_driver.cat amd64\wdfcoinstaller01009.dll

## Notes

- If the drivers fail to install, make sure all devices are unplugged.
- You must have administrator privileges to install drivers.

For more details on attestation signing, see:
- https://www.davidegrayson.com/signing/
- https://docs.microsoft.com/en-gb/windows-hardware/drivers/dashboard/attestation-signing-a-kernel-driver-for-public-release#test-your-driver-on-windows-10
