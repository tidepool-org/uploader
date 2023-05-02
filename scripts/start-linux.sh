#!/usr/bin/env bash
export START_HOT=1 NODE_ENV=development
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_ROOT="${SCRIPT_DIR%/*}"

if [ -e $HOME/.local/share/applications/uploader.desktop ]
then
    echo "Uploader.desktop is installed."
else
    cp ../resources/linux/uploader.desktop .
    printf "Exec=sh -c \"%s/scripts/start-linux.sh %%u\"\n" $APP_ROOT >> uploader.desktop
    desktop-file-install --dir=$HOME/.local/share/applications uploader.desktop
    update-desktop-database $HOME/.local/share/applications
    rm ./uploader.desktop
    echo "Uploader.desktop now installed."
fi

# Make sure that Node.js is available in the path
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd $APP_ROOT
./node_modules/.bin/webpack-dev-server --config webpack.config.renderer.dev.babel.js --env.argv="$1"

# To debug this script, add " &> /tmp/uploader.txt" to the previous line
