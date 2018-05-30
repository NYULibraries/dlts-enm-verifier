#!/bin/bash

ROOT=$(cd "$(dirname "$0")" ; cd ..; pwd -P )

cd $ROOT

test1='node main.js --no-cache --use-tct-local=test/tct/ --use-enm-local=test/enm/ --  36 62 826 885 2458 3131 7672 7907 9640 11928 14034 21488 22256 26141 43816'

eval $test1
diff -r --exclude .commit-empty-directory reports/ test/reports/
if [ $? -eq 0 ]
then
    echo "PASS: \`${test1}\`"
else
    echo >&2 "FAIL: \`${test1}\`"
fi
