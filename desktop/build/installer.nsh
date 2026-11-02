; TypeR Studio joins "Open with" for PSD and PSB files. It never takes the double-click away
; from Photoshop: a typesetter who wants that sets it in Windows.

!macro customInstall
  WriteRegStr HKCU "Software\Classes\TypeRStudio.psd" "" "Photoshop Document"
  WriteRegStr HKCU "Software\Classes\TypeRStudio.psd\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\TypeRStudio.psd\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\.psd\OpenWithProgids" "TypeRStudio.psd" ""
  WriteRegStr HKCU "Software\Classes\.psb\OpenWithProgids" "TypeRStudio.psd" ""
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Classes\.psd\OpenWithProgids" "TypeRStudio.psd"
  DeleteRegValue HKCU "Software\Classes\.psb\OpenWithProgids" "TypeRStudio.psd"
  DeleteRegKey HKCU "Software\Classes\TypeRStudio.psd"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
