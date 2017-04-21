!include LogicLib.nsh
!include WinVer.nsh

!macro customInit
  SetOutPath $INSTDIR
  LogSet on
!macroend

!macro customInstall
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customInstall"
  ${If} ${RunningX64}
      LogText "64-bit Windows"
      ${If} ${IsWin7}
           LogText "Windows 7"
      ${EndIf}
      ExecWait "$INSTDIR\resources\windows-driver\TidepoolUSBDriver_x64.exe"
  ${Else}
      LogText "32-bit Windows"
      ${If} ${IsWin7}
           LogText "Windows 7"
      ${EndIf}
      ExecWait "${INSTDIR}\resources\resources\windows-driver\TidepoolUSBDriver_x86.exe"
  ${EndIf}

!macroend
