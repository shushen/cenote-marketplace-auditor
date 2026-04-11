#!/bin/bash

if [ "$1" == "we" ]; then
    echo "Launching with default configuration..."
    export PROJECT_NAME="auditor-we"
    export HOST_APP_PORT=3200
elif [ "$1" == "og" ]; then
    echo "Launching with OG configuration..."
    export HOST_APP_PORT=3100
    export IS_ROA=true
    export DB_DATABASE=marketplace_auditor_og
    export HOST_DB_PORT=5430
    export PROJECT_NAME="auditor-og"
else
    echo "Usage: $0 [we|og]"
    echo "  we: Launch with default configuration"
    echo "  og: Launch with OG configuration (port 3100, og database, ROA apps)"
    exit 1
fi

docker-compose -p "$PROJECT_NAME" up --build -d
