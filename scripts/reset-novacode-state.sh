#!/bin/sh

# Accept optional parameter for VS Code directory
# Can be: full path, relative path, or just directory name (default: "Code")
# Examples:
#   ./reset-novacode-state.sh                          # uses default "Code"
#   ./reset-novacode-state.sh VSCodium                 # uses "VSCodium"
#   ./reset-novacode-state.sh "Code - Insiders"        # uses "Code - Insiders"
#   ./reset-novacode-state.sh ~/custom/path            # uses full path

VSCODE_DIR="${1:-Code}"

# Expand ~ to $HOME if present
VSCODE_DIR="${VSCODE_DIR/#\~/$HOME}"

# If the path exists as a directory, use it directly
# Otherwise, treat it as a directory name under ~/Library/Application Support/
if [[ -d "$VSCODE_DIR" ]]; then
    VSCODE_DIR="$VSCODE_DIR"
else
    VSCODE_DIR="$HOME/Library/Application Support/$VSCODE_DIR"
fi

echo "Novacode state is being reset for: $VSCODE_DIR"
echo "This probably doesn't work while VS Code is running."

# Reset the secrets:
sqlite3 "$VSCODE_DIR/User/globalStorage/state.vscdb" \
"DELETE FROM ItemTable WHERE \
    key = 'novacode.nova-code' OR \
    key LIKE 'workbench.view.extension.nova-code%' OR \
    key LIKE 'secret://{\"extensionId\":\"novacode.nova-code\",%';"

# delete all novacode state files:
rm -rf "$VSCODE_DIR/User/globalStorage/novacode.nova-code/"

# clear some of the vscode cache that I've observed contains novacode related entries:
rm -f "$VSCODE_DIR/CachedProfilesData/__default__profile__/extensions.user.cache"
