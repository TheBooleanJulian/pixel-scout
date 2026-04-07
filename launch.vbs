' PixelScout — silent launcher (no CMD window)
' Double-click this file to start. Use start.bat to see debug output.
Dim wsh, fso, dir
Set wsh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

' First run: show install window and wait for it
If Not fso.FolderExists(dir & "\node_modules") Then
  wsh.Run "cmd /c cd /d """ & dir & """ && npm install", 1, True
End If

' Launch silently (windowStyle 0 = hidden)
wsh.Run "cmd /c cd /d """ & dir & """ && npm start", 0, False
