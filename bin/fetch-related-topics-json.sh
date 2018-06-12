#!/usr/bin/env bash

ROOT=$(cd "$(dirname "$0")" ; cd ..; pwd -P )

RELATED_TOPICS_IDS_FILE=$1

if [ ! -e $RELATED_TOPICS_IDS_FILE ]
then
    echo >&2 "${RELATED_TOPICS_IDS_FILE} is not a valid related topics ids files."
    exit 1
fi

topicIds=$( cat $RELATED_TOPICS_IDS_FILE )

for topicId in $topicIds
do
    curl https://nyuapi.infoloom.nyc/api/hit/basket/${topicId}/?format=json > $ROOT/test/tct/${topicId}.json

    sleep 3
done
