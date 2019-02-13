# The all-in-one USB driver for Windows

To build and sign the driver, check that you have the specified requirements installed and follow the steps below.

## Requirements

- [WDK](https://msdn.microsoft.com/en-us/windows/hardware/gg454513.aspx) (Required for `inf2cat` and `signtool`)
- [DigiCert High Assurance EV Root CA certificate](https://www.digicert.com/CACerts/DigiCertHighAssuranceEVRootCA.crt)

## Steps

### Generate the .cat files from the .inf files:
- Bump version number in .inf file
- `inf2cat /driver:. /os:7_X64,7_X86,8_X64,8_X86,6_3_X86,6_3_X64,Vista_X86,Vista_X64,XP_X86,XP_X64`

### Install certificates:

- Get the Tidepool certificate.
- Double-click to install.
- Also install the DigiCert High Assurance EV Root CA certificate downloaded above, as it's needed to cross-sign the Tidepool certificate.
- You can verify the certificates are installed by running `certmgr`.

### Sign both the .cat files using signtool:

- `signtool sign /v /ac "DigiCertHighAssuranceEVRootCA.crt" /s my /n "Tidepool Project" /t http://timestamp.digicert.com tidepoolvcp.cat`
- `signtool sign /v /ac "DigiCertHighAssuranceEVRootCA.crt" /s my /n "Tidepool Project" /t http://timestamp.digicert.com tidepoolhid.cat`
- `signtool sign /v /ac "DigiCertHighAssuranceEVRootCA.crt" /s my /n "Tidepool Project" /t http://timestamp.digicert.com tidepoolusb.cat`

### Verify that drivers are correctly signed:

	signtool verify /kp /v /c tidepoolvcp.cat amd64\ftser2k.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\ftser2k.sys
	signtool verify /kp /v /c tidepoolvcp.cat amd64\silabser.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\silabser.sys
	signtool verify /kp /v /c tidepoolvcp.cat amd64\tiusb.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\tiusb.sys
	signtool verify /kp /v /c tidepoolvcp.cat amd64\ser2pl64.sys
	signtool verify /kp /v /c tidepoolvcp.cat i386\ser2pl.sys
	signtool verify /kp /v /c tidepoolvcp.cat amd64\winusbcoinstaller2.dll

## Notes

- If the drivers fail to install, make sure all devices are unplugged.
- You must have administrator privileges to install drivers.
- The DigiCert certificate can also be downloaded from the [DigiCert website](
https://www.digicert.com/code-signing/driver-signing-in-windows-using-signtool.htm#download_cross_certificate).
- When you publish the new driver on the website, remember to also [whitelist](https://submit.symantec.com/whitelist/isv/) the driver with Symantec.
