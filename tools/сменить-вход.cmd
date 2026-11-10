@echo off
chcp 65001 >nul
title Смена имени и пароля курса
cd /d "%~dp0.."
echo.
echo   СМЕНА ИМЕНИ И ПАРОЛЯ КУРСА
echo.
echo   Имя и пароль вместе образуют ключ. В files ничего не хранится -
echo   только обёрнутый ключ данных, поэтому контент не перешифровывается.
echo.
set /p NM=  Имя: 
echo   Пароль вводится скрытно, дважды.
echo.
node "tools\set-password.mjs" --name "%NM%"
echo.
echo   Готово. Чтобы изменение попало на сайт: git add data/keys.json ^&^& git commit -m "смена входа" ^&^& git push
echo.
pause
