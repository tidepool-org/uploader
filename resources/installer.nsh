!include LogicLib.nsh
!include WinVer.nsh

!macro customInstall
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customInstall"
  ${If} ${RunningX64}
      DetailPrint "64-bit Windows"
      ${If} ${IsWin7}
           DetailPrint "Windows 7"
      ${EndIf}
      ExecWait "$INSTDIR\resources\windows-driver\TidepoolUSBDriver_x64.exe"
  ${Else}
      DetailPrint "32-bit Windows"
      ${If} ${IsWin7}
           DetailPrint "Windows 7"
      ${EndIf}
      ExecWait "$INSTDIR\resources\windows-driver\TidepoolUSBDriver_x86.exe"
  ${EndIf}

!macroend
