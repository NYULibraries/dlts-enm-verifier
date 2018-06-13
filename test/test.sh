#!/bin/bash

ROOT=$(cd "$(dirname "$0")" ; cd ..; pwd -P )

cd $ROOT

topicIds=$( cat $ROOT/test/sample-topics-ids.txt | tr '\n' ' ' )

test1="node main.js topicpages --count-related-topics-occurrences --tct-local=test/tct/topicpages/ --enm-local=test/enm/topicpages/ -- ${topicIds}"
verify1='diff -r --exclude .commit-empty-directory reports/topicpages/ test/reports/topicpages/'

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
