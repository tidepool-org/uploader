!include LogicLib.nsh
!include WinVer.nsh

RequestExecutionLevel admin

!macro customInstall

  Var DriverDir
  StrCpy $DriverDir "$INSTDIR\resources\resources\windows-driver"

  Section
    ${If} ${RunningX64}
      DetailPrint "64-bit Windows"
    ${else}
      DetailPrint "32-bit Windows"
    ${EndIf}

    ${If} ${IsWin7}
      DetailPrint "Windows 7"
    ${EndIf}
  SectionEnd

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
