@echo off
cd /d "c:\Users\garze\.gemini\antigravity\scratch\appointment-manager"
echo Starting email blast at %date% %time% >> scripts\email_log.txt
"C:\Program Files\nodejs\npx.cmd" tsx scripts/send_welcome_email.ts >> scripts\email_log.txt 2>&1
echo Finished email blast at %date% %time% >> scripts\email_log.txt
