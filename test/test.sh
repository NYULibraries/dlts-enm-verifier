#!/bin/bash

ROOT=$(cd "$(dirname "$0")" ; cd ..; pwd -P )

cd $ROOT

topicIds=$( cat $ROOT/test/sample-topics-ids.txt | tr '\n' ' ' )

test1="node main.js --no-cache --count-related-topics-occurrences --use-tct-local=test/tct/ --use-enm-local=test/enm/ -- ${topicIds}"
verify1='diff -r --exclude .commit-empty-directory reports/ test/reports/'

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

rm $ROOT/reports/*

doTest "${test1}" "${verify1}"
