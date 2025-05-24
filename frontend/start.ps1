# PowerShell script to start the Social Food Delivery System

Write-Host "Starting Social Food Delivery System..." -ForegroundColor Green
Write-Host "Please follow these steps to run the application:" -ForegroundColor Yellow

Write-Host "`n1. Open two separate PowerShell windows" -ForegroundColor Cyan
Write-Host "2. In the first window, run these commands:" -ForegroundColor Cyan
Write-Host "   cd ../backend" -ForegroundColor White
Write-Host "   npm install" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White

Write-Host "`n3. In the second window, run these commands:" -ForegroundColor Cyan
Write-Host "   npm install" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White

Write-Host "`nOption 2: Use the Windows-specific start script (NEW!)" -ForegroundColor Cyan
Write-Host "   npm install" -ForegroundColor White
Write-Host "   npm run windows-start" -ForegroundColor White
Write-Host "   (This will open both frontend and backend in separate terminal windows)" -ForegroundColor White

Write-Host "`nOption 3: If you prefer concurrently:" -ForegroundColor Cyan
Write-Host "   npm install" -ForegroundColor White
Write-Host "   npm run start" -ForegroundColor White

Write-Host "`nIMPORTANT: PowerShell doesn't support the '&&' operator used in package.json scripts." -ForegroundColor Red
Write-Host "If you see an error about '&&', use the separate command approach shown above." -ForegroundColor Red

Write-Host "`nProject structure information:" -ForegroundColor Green
Write-Host "- All dependencies are now located in their respective directories (frontend/ and backend/)" -ForegroundColor White
Write-Host "- Root node_modules folder and package.json have been removed" -ForegroundColor White
Write-Host "- See README.md for more detailed instructions" -ForegroundColor White
