#!/bin/bash

ROOT=$(cd "$(dirname "$0")" ; cd ..; pwd -P )

cd $ROOT

topicIds='36 62 826 885 2458 3131 7672 7907 9640 11928 14034 21488 22256 26141 43816'

test1="node main.js --no-cache --use-tct-local=test/tct/ --use-enm-local=test/enm/ -- ${topicIds}"
verify1='diff -r --exclude .commit-empty-directory reports/ test/reports/'

test2="node main.js --cache -- ${topicIds}"
verify2='diff -r --exclude .commit-empty-directory cache/tct/ test/verify-tct-cache/'

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
doTest "${test2}" "${verify2}"
