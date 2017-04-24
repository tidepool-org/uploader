!include LogicLib.nsh
!include WinVer.nsh

RequestExecutionLevel admin

!macro customInstall

  UserInfo::GetAccountType
  pop $0
  ${If} $0 != "admin"
      MessageBox mb_iconstop "You need administrator rights to install the Tidepool Uploader."
      SetErrorLevel 740 ;ERROR_ELEVATION_REQUIRED
      Quit
  ${EndIf}

  ${If} ${RunningX64}
      DetailPrint "64-bit Windows"
      ${If} ${IsWin7}
           DetailPrint "Windows 7"
      ${EndIf}
      ExecWait "$INSTDIR\resources\resources\windows-driver\TidepoolUSBDriver_x64.exe"
  ${Else}
      DetailPrint "32-bit Windows"
      ${If} ${IsWin7}
           DetailPrint "Windows 7"
      ${EndIf}
      ExecWait "$INSTDIR\resources\resources\windows-driver\TidepoolUSBDriver_x86.exe"
  ${EndIf}

!macroend
