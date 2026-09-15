@echo off
setlocal
set NODE=C:\Users\admin\AppData\Local\Temp\node\node-v20.11.1-win-x64\node.exe
if not exist "%NODE%" (
  echo NODE MISSING: %NODE%
  exit /b 2
)
"%NODE%" run-jest.js
endlocal
