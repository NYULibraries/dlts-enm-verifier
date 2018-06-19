#!/bin/bash

ROOT=$(cd "$(dirname "$0")" ; cd ..; pwd -P )

cd $ROOT

locationIds=$( cat $ROOT/test/sample-location-ids.txt | tr '\n' ' ' )
topicIds=$( cat $ROOT/test/sample-topics-ids.txt | tr '\n' ' ' )

test1="node main.js topicpages --count-related-topics-occurrences --tct-local=test/tct/topicpages/ --enm-local=test/enm/topicpages/ -- ${topicIds}"
verify1='diff -r --exclude .commit-empty-directory reports/topicpages/ test/reports/topicpages/'

test2="node main.js browsetopicslists --enm-local=test/enm/browsetopicslists --tct-local=test/tct/browsetopicslists"
verify2='diff -r --exclude .commit-empty-directory reports/browsetopicslists/ test/reports/browsetopicslists/'

test3="node main.js solr --enm-local=test/enm/solr --tct-local=test/tct/solr -- ${locationIds}"
verify3='diff -r --exclude .commit-empty-directory reports/solr/ test/reports/solr/'

doTest() {
    local testCmd="$1"
    local verifyCmd="$2"

    eval $testCmd
    eval $verifyCmd
    if [ $? -eq 0 ]
    then
        echo "PASS: \`${testCmd}\`"
    else
        echo >&2 "FAIL: \`${testCmd}\`"
    fi
}

doTest "${test1}" "${verify1}"
doTest "${test2}" "${verify2}"
doTest "${test3}" "${verify3}"
