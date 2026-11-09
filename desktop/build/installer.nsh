; TypeR Studio joins "Open with" for PSD and PSB files. It never takes the double-click away
; from Photoshop: a typesetter who wants that sets it in Windows.

!macro customInstall
  WriteRegStr HKCU "Software\Classes\TypeRStudio.psd" "" "Photoshop Document"
  WriteRegStr HKCU "Software\Classes\TypeRStudio.psd\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\TypeRStudio.psd\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\.psd\OpenWithProgids" "TypeRStudio.psd" ""
  WriteRegStr HKCU "Software\Classes\.psb\OpenWithProgids" "TypeRStudio.psd" ""
  ; typer-studio:// : TypeR for Photoshop's "Open in TypeR Studio"
  WriteRegStr HKCU "Software\Classes\typer-studio" "" "URL:TypeR Studio"
  WriteRegStr HKCU "Software\Classes\typer-studio" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\typer-studio\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ; The builder keeps a copy of this installer, only to make the next app update a smaller
  ; download. App updates are rare, and it would weigh as much as the download forever.
  Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\typer-studio-updater"
    DeleteRegKey HKCU "Software\Classes\typer-studio"
  ${endIf}
  DeleteRegValue HKCU "Software\Classes\.psd\OpenWithProgids" "TypeRStudio.psd"
  DeleteRegValue HKCU "Software\Classes\.psb\OpenWithProgids" "TypeRStudio.psd"
  DeleteRegKey HKCU "Software\Classes\TypeRStudio.psd"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
