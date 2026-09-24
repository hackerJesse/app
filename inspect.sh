#!/bin/bash
echo INSPECT_START > /app/inspect_log.txt
echo --ENV-- >> /app/inspect_log.txt
cat /app/frontend/.env >> /app/inspect_log.txt 2>&1
echo --APPJSON-- >> /app/inspect_log.txt
cat /app/frontend/app.json >> /app/inspect_log.txt 2>&1
echo --EASJSON-- >> /app/inspect_log.txt
cat /app/frontend/eas.json >> /app/inspect_log.txt 2>&1
echo --GREP-API-- >> /app/inspect_log.txt
grep -rn "EXPO_PUBLIC" /app/frontend/src /app/frontend/app 2>&1 | head -30 >> /app/inspect_log.txt
echo INSPECT_DONE >> /app/inspect_log.txt
