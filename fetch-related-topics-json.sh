#!/usr/bin/env bash

ROOT=$(cd "$(dirname "$0")" ; pwd -P )

topicIds=$( cat $ROOT/related-topics-ids-for-test-sample-tct-topics.txt )

for topicId in $topicIds
do
    curl https://nyuapi.infoloom.nyc/api/hit/basket/${topicId}/?format=json > $ROOT/test/tct/${topicId}.json
    
    sleep 3
done
