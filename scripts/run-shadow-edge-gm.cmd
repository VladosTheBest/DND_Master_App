@echo off
setlocal

echo Starting Shadow Edge GM backend on http://localhost:8080
start "Shadow Edge Backend" /b cmd /c "npm run server"

echo Starting Vite frontend on http://localhost:5173
start "Shadow Edge Frontend" /b cmd /c "npm run dev --workspace @shadow-edge/web"

echo.
echo Shadow Edge GM: http://localhost:5173
echo Keep this run configuration open while the app is running.
