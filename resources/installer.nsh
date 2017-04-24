!include LogicLib.nsh
!include WinVer.nsh

RequestExecutionLevel admin

!macro customInstall

  Var /GLOBAL DriverDir
  StrCpy $DriverDir "$INSTDIR\resources\resources\windows-driver"

  ${If} ${RunningX64}
    MessageBox MB_OK "64-bit Windows"
  ${else}
    MessageBox MB_OK "32-bit Windows"
  ${EndIf}

  ${If} ${IsWin7}
    MessageBox MB_OK "Windows 7"
  ${EndIf}

  UserInfo::GetAccountType
  pop $0
  ${If} $0 != "admin"
      MessageBox mb_iconstop "You need administrator rights to install the Tidepool Uploader."
      SetErrorLevel 740 ;ERROR_ELEVATION_REQUIRED
      Quit
  ${EndIf}

  ${If} ${RunningX64}
      ${If} ${IsWin7}
        ; 64-bit Windows 7
        CopyFiles $DriverDir\win7x64\* $DriverDir\amd64
      ${EndIf}
      ExecWait "$DriverDir\TidepoolUSBDriver_x64.exe"
  ${Else}
      ${If} ${IsWin7}
        ; 32-bit Windows 7
        CopyFiles $DriverDir\win7x86\* $DriverDir\i386
      ${EndIf}
      ExecWait "$DriverDir\TidepoolUSBDriver_x86.exe"
  ${EndIf}

!macroend
