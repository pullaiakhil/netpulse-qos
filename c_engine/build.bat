@echo off
rem Build NetPulse QoS C Measurement Engine on Windows
cd /d "%~dp0"
echo Compiling NetPulse QoS C Engine...

where gcc >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    gcc -O2 -Wall netpulse_engine.c -o netpulse_engine.exe -lws2_32 -liphlpapi
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] netpulse_engine.exe compiled successfully with GCC.
        exit /b 0
    )
)

where cl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    cl /O2 /W3 netpulse_engine.c /Fe:netpulse_engine.exe ws2_32.lib iphlpapi.lib
    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] netpulse_engine.exe compiled successfully with MSVC cl.exe.
        del *.obj 2>nul
        exit /b 0
    )
)

echo [WARNING] No C compiler (gcc or cl.exe) found in system PATH.
echo You can compile manually when GCC (MinGW/MSYS2) or Visual Studio build tools are available:
echo   gcc -O2 netpulse_engine.c -o netpulse_engine.exe -lws2_32 -liphlpapi
exit /b 1
