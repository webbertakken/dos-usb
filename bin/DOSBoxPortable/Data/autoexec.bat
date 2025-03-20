@echo off
echo DOS-USB Game Launcher
echo --------------------
echo.
echo Mounting C:\Users\Webber\Repositories\dos-usb\games\inner-worlds as C:
echo Running: game.bat
echo.

# Mount the game directory to drive C:
mount C "C:\Users\Webber\Repositories\dos-usb\games\inner-worlds"

# Also mount as CD-ROM for games that need it:
mount d "C:\Users\Webber\Repositories\dos-usb\games\inner-worlds" -t cdrom

# Go to the game drive
C:

# Start the game
game.bat

# Exit DOSBox when game is done
exit
