!include LogicLib.nsh
!include WinVer.nsh

!macro customInit
  SetOutPath $INSTDIR
  LogSet on
  RequestExecutionLevel admin
!macroend

!macro customInstall
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customInstall"

  UserInfo::GetAccountType
  pop $0
  ${If} $0 != "admin"
      MessageBox mb_iconstop "You need administrator rights to install the Tidepool Uploader."
      SetErrorLevel 740 ;ERROR_ELEVATION_REQUIRED
      Quit
  ${EndIf}

  ${If} ${RunningX64}
      LogText "64-bit Windows"
      ${If} ${IsWin7}
           LogText "Windows 7"
      ${EndIf}
      ExecWait "$INSTDIR\resources\resources\windows-driver\TidepoolUSBDriver_x64.exe"
  ${Else}
      LogText "32-bit Windows"
      ${If} ${IsWin7}
           LogText "Windows 7"
      ${EndIf}
      ExecWait "$INSTDIR\resources\resources\windows-driver\TidepoolUSBDriver_x86.exe"
  ${EndIf}

!macroend
