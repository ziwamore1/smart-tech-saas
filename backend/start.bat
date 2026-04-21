@echo off
set NODE_OPTIONS=--max-old-space-size=4096
echo Starting SmartTech Backend...
npx ts-node --transpile-only src/main.ts
