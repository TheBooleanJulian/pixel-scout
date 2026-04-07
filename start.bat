@echo off
cls
echo.
echo  PixelScout
echo  ----------
if not exist node_modules (
  echo  First run - installing dependencies...
  npm install
  echo.
)
echo  Starting... ^(close this window any time^)
echo.
npm start
