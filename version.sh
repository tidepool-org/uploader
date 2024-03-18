# Read the node version from the .nvmrc file
NVMRC_FILE=".nvmrc"
if [[ -f "$NVMRC_FILE" ]]; then
  ARTIFACT_NODE_VERSION=$(cat "$NVMRC_FILE")
  export ARTIFACT_NODE_VERSION
fi

export START_NODE_VERSION="${ARTIFACT_NODE_VERSION}"
