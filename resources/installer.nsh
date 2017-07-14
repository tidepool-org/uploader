!include LogicLib.nsh
!include WinVer.nsh

RequestExecutionLevel admin

!macro customInit

  ReadINIStr $9 "$TEMP\TidepoolUploader.ini" "InstallCount" "Value"
  IfFileExists "$TEMP\TidepoolUploader.ini" "+3" ""
    StrCpy $8 "1"
  goto +3
    IntOp $8 $9 + 1
    StrCpy $R7 "You have ran this setup program $9 times so far!\n\n"

!macroend

!macro customInstall

  Var /GLOBAL DriverDir
  StrCpy $DriverDir "$INSTDIR\resources\driver"

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

  WriteINIStr "$TEMP\TidepoolUploader.ini" "InstallCount" "Value" "$8"

!macroend
