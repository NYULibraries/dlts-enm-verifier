#!/bin/bash

ROOT=$(cd "$(dirname "$0")" ; cd ..; pwd -P )

cd $ROOT

locationIds=$( cat $ROOT/test/sample-location-ids.txt | tr '\n' ' ' )
topicIds=$( cat $ROOT/test/sample-topics-ids.txt | tr '\n' ' ' )

test[1]="node main.js browsetopicslists --enm-local=test/enm/browsetopicslists --tct-local=test/tct/browsetopicslists"
verify[1]='diff -r --exclude .commit-empty-directory reports/browsetopicslists/ test/reports/browsetopicslists/'

test[2]="node main.js solr --enm-local=test/enm/solr --tct-local=test/tct/solr -- ${locationIds}"
verify[2]='diff -r --exclude .commit-empty-directory reports/solr/ test/reports/solr/'

test[3]="node main.js topicpages --count-related-topics-occurrences --tct-local=test/tct/topicpages/ --enm-local=test/enm/topicpages/ -- ${topicIds}"
verify[3]='diff -r --exclude .commit-empty-directory reports/topicpages/ test/reports/topicpages/'

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

testIndexes=( 1 2 3 )

if [ $# -gt 0 ]
then
    testIndexes=( "$@" )
fi

for num in "${testIndexes[@]}"
do
    doTest "${test[$num]}" "${verify[$num]}"
done
