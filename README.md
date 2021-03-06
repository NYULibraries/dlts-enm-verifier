# em - DLTS ENM Verifier

`ev` is a command-line program for verifying an instance of an ENM website against
an instance of the Topic Curation Toolkit (TCT).

## Overview

`ev` (DLTS ENM Verifier) compares the data of ENM components against
the TCT via its JSON API and reports any discrepancies in the `reports/[COMMAND]/`
directories.

The ENM components that are verified:

* Browse Topics Lists
* The `enm-pages` Solr index, which backs the Search Results component.
* Topic Pages

`ev` can be run against live ENM and TCT instances or against sets of cached
ENM and TCT responses.  When run against live servers, `ev` automatically saves
the responses as files in `cache/enm/` and `cache/tct/`.  These files can then
be used as local "copies" of ENM and/or TCT for future verifications.

This project started out as a quick-and-dirty script to verify the throwaway
prototypes so that their output could be used as golden master files for the
[enm](https://github.com/NYULibraries/dlts-enm) tests.  Later it seemed
worthwhile to develop it it out into a more robust program that could be used on
an ongoing basis.

## Getting Started

### Prerequisities

* Node.js - version 8.x or higher.  Module `sync-request` v6.0.0 requires at
minimum Node 8.0.0.
* [yarn](https://yarnpkg.com/) - minimum version unknown.  Latest version recommended.
* Bash - for running tests.  Must be a version that supports arrays.

### Installation and setup

Clone the repo, install the dependencies:

```bash
git clone git@github.com:NYULibraries/dlts-enm-verifier.git enm-verifier
cd enm-verifier/
yarn
```

### Usage

```bash
$ ./ev

    Usage: ev [options] [command]

    Options:

      --enm-host [hostname]               ENM host (default varies by command: discovery1.dlib.nyu.edu, dlib.nyu.edu)
      --tct-host [hostname]               TCT host (default: nyuapi.infoloom.nyc)
      --enm-local [directory]             Use locally stored ENM files in <directory>
      --tct-local [directory]             Use locally stored TCT files in <directory>
      -h, --help                          output usage information

    Commands:

      browsetopicslists
      solr [locationIds...]
      topicpages [options] [topicIds...]
```

* Options: all options are top-level and apply to all commands, with the exception of one
extra option `--count-related-topics-occurrences`, which applies only to the
`topicpages` command:

```bash
$ ./ev topicpages --help

    Usage: topicpages [options] [topicIds...]

    Options:

      --count-related-topics-occurrences  Verify occurrence counts -- can be very network-intensive (default: false)
      -h, --help                          output usage information
```

* Caching: all responses from a live ENM or TCT host are automatically cached in
`cache/enm/[COMMAND]/` and `cache/tct/[COMMAND]/`, respectively.  These files
can be saved in directories that can later be used for future verifications via
the `--enm-local` and `--tct-local` command line options.  Note that the cache for
`[COMMAND]` is immediately cleared at the start of every run with corresponding
`[COMMAND]`, so any cache files needed for future use should be copied out before
the next run.

* Reports: verifications produce no output on stdout.  Results of all verifications are
recorded in `reports/[COMMAND]`.  Note that the `reports` directory for `[COMMAND]`
is immediately cleared at the start of every run with corresponding `[COMMAND]`,
so any reports files needed for future reference should be copied out before the
next run.  Reports for each `[COMMAND]`:
    * `browsetopicslists` reports:
        * `[BROWSE TOPICS LIST CATEGORY]-enm-missing-topics.json`: lists topics
that are in TCT but not on ENM category page.
        * `[BROWSE TOPICS LIST CATEGORY]-enm-extra-topics.json`: lists topics
that are on the ENM category page but not in TCT.
    * `solr` reports:
        * `[LOCATION ID]-enm-missing-[FIELD].json`: lists field values that are
in TCT but not in the ENM Solr doc for [LOCATION ID] (printed page).  [FIELD]
refers to fields in the Solr doc (e.g. `authors`, `pageLocalId`, `topicNames`,).
        * `[LOCATION ID]-enm-extra-[FIELD VALUES].json`: lists field values that
are in the ENM Solr doc for [LOCATION ID] (printed page) but not in TCT.  [FIELD]
refers to fields in the Solr doc (e.g. `authors`, `pageLocalId`, `topicNames`,).
    * `topicpages` reports:
        * `[TOPIC ID]-enm-missing-[DATA].json`: reports data present in TCT but
    not on the ENM topic page.  [DATA]:
            * topics
            * authorPublishers
            * epubs
            * linkedData
        * `[TOPIC ID]-enm-extra-[DATA].json`: reports data on the ENM topic page
     but not in TCT.  [DATA]:
            * topics
            * authorPublishers
            * epubs
            * linkedData
        * `[TOPIC ID]-occurrence-counts-discrepancies`: if
`--count-related-topics-occurrences` is on, all related topics (or TOPIC ID) for
which occurrence counts in ENM and TCT do not match are listed here, along with
their counts in each system.

#### Examples

##### Browse topics lists

Verify live prod ENM browse topics lists against live production TCT:

```bash
./ev browsetopicslists
```

Verify live dev ENM browse topics lists against live production TCT:

```bash
./ev browsetopicslists --enm-host=devweb1.dlib.nyu.edu
```

Verify local ENM browse topics lists against live production TCT:

```bash
./ev browsetopicslists --enm-local=/tmp/browsetopicslists
```

Verify live production ENM browse topics lists against local TCT files:

```bash
./ev browsetopicslists --tct-local=/tmp/tct-json-api-responses
```

##### Solr index

Verify 5 docs in live prod ENM Solr index against live prod TCT:

```bash
./ev solr -- 44 31 65 84 112
```

Verify 1 doc in live dev ENM Solr index against live prod TCT:

```bash
./ev solr --enm-host=dev-discovery.dlib.nyu.edu -- 44
```

Verify the test sample 1,000 docs in live prod ENM Solr index against local TCT
files:

```bash
./ev solr --tct-local=/tmp/tct-json-api-responses -- $( cat test/sample-location-ids.txt | tr '\n' ' ' )
```

Verify 10 locally saved docs from an ENM Solr index against live prod TCT:

```bash
./ev solr --enm-local=/tmp/solr -- 44 31 65 84 112 242 278 289 303 344
```

##### Topic pages

Verify 5 topics in live prod ENM against live prod TCT, and do not verify
occurrence counts:

```bash
./ev topicpages -- 36 62 826 885 2458
```

Verify 5 topics in live prod ENM against live prod TCT, and verify occurrence counts:

```bash
./ev topicpages --count-related-topics-occurrences -- 36 62 826 885 2458
```

Verify the test sample 16 ENM topic pages which have been saved locally
against live prod TCT, and do not verify occurrence counts:

```bash
./ev topicpages --enm-local=test/enm/topicpages -- $( cat test/sample-topics-ids.txt | tr '\n' ' ' )
```

Verify 5 ENM topic pages which have been saved locally against saved TCT files,
and verify occurrence counts:

```bash
./ev topicpages --count-related-topics-occurrences --enm-local=/tmp/topicpages --tct-local=/tmp/tct-json-api-responses -- $( cat test/sample-topics-ids.txt | tr '\n' ' ' )
```

## Running the tests

At the moment the test suite is a simple shell script that does an `ev`
verification for each component and checks that the reports match what's expected.

```bash
$ test/test.sh
PASS: `node main.js browsetopicslists --enm-local=test/enm/browsetopicslists --tct-local=test/tct/browsetopicslists`
PASS: `node main.js solr --enm-local=test/enm/solr --tct-local=test/tct/solr -- 31 44 65 84 112 242 278 289 303 344 362 434 472 529 582 604 637 652 654 733 740 743 753 803 809 827 868 933 945 995 1021 1056 1083 1092 1103 1119 1181 1282 1298 1316 1338 1369 1380 1427 1437 1439 1510 1561 1566 1575 1588 1594 1623 1685 1701 1703 1724 1746 1769 1790 1821 1827 1849 1916 1918 1939 1947 1965 1968 2048 2050 2076 2092 2123 2126 2131 2151 2167 2198 2202 2260 2274 2292 2370 2437 2447 2486 2492 2501 2551 2590 2599 2698 2707 2762 2795 2842 2848 2863 2902 2911 2924 2955 2989 3006 3015 3016 3145 3169 3172 3226 3230 3239 3249 3332 3334 3354 3356 3364 3387 3430 3455 3477 3620 3647 3737 3771 3797 3863 3904 3923 3936 3965 3975 3982 3986 3987 3993 4008 4019 4117 4234 4256 4272 4279 4295 4312 4313 4325 4346 4348 4369 4418 4438 4513 4519 4539 4550 4569 4656 4663 4691 4701 4722 4827 4832 4856 4865 4868 4877 4883 4929 4936 4958 4972 4988 5121 5164 5177 5198 5204 5208 5216 5326 5353 5357 5358 5361 5365 5370 5410 5464 5493 5519 5563 5568 5622 5640 5647 5737 5903 5912 5927 6002 6066 6072 6084 6134 6170 6187 6194 6204 6213 6264 6320 6324 6356 6362 6483 6485 6490 6527 6605 6658 6703 6779 6808 6821 6833 6890 6892 6904 6912 6917 6930 6980 7028 7049 7052 7114 7154 7180 7186 7205 7243 7258 7262 7322 7328 7354 7382 7421 7459 7481 7649 7653 7669 7730 7773 7792 7803 7825 7828 7847 7854 7863 7871 7900 7904 7944 8056 8084 8185 8233 8234 8342 8348 8352 8374 8405 8441 8529 8537 8610 8654 8697 8738 8767 8782 8788 8808 8847 8907 8908 8909 8931 8985 8995 9007 9083 9089 9203 9252 9304 9318 9323 9348 9354 9460 9503 9504 9564 9608 9610 9639 9663 9673 9767 9797 9939 9960 10050 10051 10079 10101 10108 10124 10130 10132 10197 10200 10257 10266 10318 10411 10482 10625 10638 10647 10656 10719 10732 10743 10745 10752 10755 10891 10914 10930 10989 11003 11016 11020 11068 11108 11141 11195 11206 11230 11233 11305 11407 11438 11575 11593 11604 11611 11616 11620 11649 11664 11689 11708 11717 11740 11951 11957 12054 12063 12084 12111 12146 12221 12252 12277 12295 12344 12358 12370 12466 12515 12563 12575 12587 12600 12619 12637 12682 12689 12714 12722 12734 12740 12762 12781 12786 12820 12863 12895 12959 12969 13001 13007 13028 13041 13066 13087 13091 13103 13112 13116 13120 13133 13146 13197 13209 13245 13262 13267 13275 13310 13313 13316 13364 13370 13385 13387 13395 13455 13485 13526 13574 13590 13609 13645 13646 13673 13675 13677 13681 13724 13743 13768 13776 13792 13839 13844 13865 13871 13877 13881 13922 13923 13941 13948 13992 13996 14082 14099 14157 14158 14159 14215 14247 14260 14342 14374 14379 14451 14457 14549 14563 14588 14595 14607 14642 14759 14817 14822 14824 14844 14861 14885 14899 14963 14978 14985 14992 15016 15075 15082 15190 15199 15246 15249 15296 15323 15339 15366 15398 15432 15477 15521 15529 15549 15573 15590 15654 15696 15746 15794 15809 15822 15916 15942 15983 15986 15992 16047 16127 16138 16141 16163 16183 16200 16213 16275 16291 16308 16352 16372 16406 16504 16519 16567 16622 16677 16682 16692 16737 16795 16816 16875 16884 16918 16935 16939 16946 16980 17032 17047 17108 17132 17152 17242 17243 17244 17269 17272 17278 17300 17326 17343 17356 17359 17392 17407 17449 17491 17514 17548 17551 17575 17579 17582 17584 17592 17673 17716 17717 17727 17870 17960 17979 18017 18040 18083 18090 18115 18144 18205 18243 18259 18266 18295 18317 18352 18364 18428 18441 18541 18557 18605 18613 18637 18677 18693 18720 18774 18832 18863 18892 18894 18956 18996 19010 19056 19090 19114 19150 19153 19174 19367 19379 19443 19446 19495 19498 19515 19525 19570 19584 19590 19606 19654 19671 19687 19732 19758 19763 19809 19869 19947 20008 20056 20058 20072 20079 20167 20173 20202 20204 20243 20246 20263 20327 20328 20338 20370 20407 20457 20480 20520 20529 20561 20649 20653 20661 20675 20831 20848 20852 20890 20912 20928 20934 20950 20993 21000 21011 21052 21068 21085 21088 21128 21274 21302 21305 21430 21451 21466 21502 21509 21520 21522 21535 21549 21557 21669 21693 21706 21755 21758 21825 21944 21949 21955 21967 21978 22045 22075 22085 22093 22128 22136 22267 22314 22354 22366 22373 22467 22491 22507 22577 22600 22624 22688 22692 22712 22742 22852 22955 23092 23099 23135 23161 23169 23207 23262 23297 23406 23434 23457 23463 23476 23511 23597 23700 23791 23815 23824 23825 23826 23844 23859 23886 23911 23928 23949 23961 24029 24082 24098 24190 24211 24215 24284 24343 24360 24369 24373 24382 24413 24437 24444 24471 24488 24491 24498 24537 24567 24570 24595 24625 24688 24735 24737 24742 24789 24966 25046 25068 25190 25195 25222 25229 25249 25269 25318 25473 25573 25584 25592 25613 25617 25641 25692 25723 25781 25806 25831 25861 25879 25911 25913 25932 25957 25963 25986 26007 26031 26102 26107 26166 26172 26173 26227 26244 26361 26438 26440 26571 26583 26623 26647 26722 26746 26750 26766 26782 26827 26829 26901 26941 26950 26953 26967 26983 27031 27038 27062 27103 27115 27119 27148 27208 27240 27255 27317 27370 27418 27445 27456 27471 27526 27531 27533 27559 27598 27620 27644 27649 27704 27801 27828 27833 27852 27875 27885 27887 27901 27908 27925 27932 27950 27956 28045 28085 28095 28167 28211 28236 28291 28306 28313 28326 28349 28360 28384 28431 28474 28531 28617 28638 28678 28760 28788 28824 28836 28858 28891 28910 28916 28925 28982 28984 28993 29018 29041 29047 29058 29074 29090 29093 29139 29245 29278 29283 29373 29384 29387 29432 29469 29472 29488 29497 29566 29594 29663 29686 29709 29712 29759 29762 29777 29786 29824 29847 29856 29881 29888 29892 29928 29939 30010 30063 30102 30153 30185 30195 30209 30229 30232 30253 30260 30270 30288 30302 30308 30311 30347 30353 30361 30371 30376 30418 30467 30473 30504 30520 30549 30555 30580 30649 30656 30692 30695 30708 30726 30788 `
PASS: `node main.js topicpages --count-related-topics-occurrences --tct-local=test/tct/topicpages/ --enm-local=test/enm/topicpages/ -- 36 62 826 885 2458 3131 7672 7907 9640 11928 14034 21488 22256 26141 43816 24756 `
$
```

## Notes on sorting of topic names

Note that `ev` is not verifying the correctness of the ordering topic names in ENM.
The ENM custom sort specified in [NYUP-376](https://jira.nyu.edu/jira/browse/NYUP-376)
is something that is implemented outside of TCT, so it doesn't make sense to
to compare the ordering of topic names in ENM to TCT.  Also, it is technically
 challenging to reproduce the custom sort used by
 [enm|https://github.com/NYULibraries/dlts-enm], because currently the sort is
done at the database level in SQL, and it can be tricky to match the exact sorting
rules using JavaScript.  For example, here is a diff between a "Z" browse
topics list ordering and the same list sorted using `util.sortTopicNames` in this
project:

```bash
1a2
>     "Z-Trip | Topic ID: 42419",
11d11
<     "Zagreb | Topic ID: 41897",
13c13
<     "Zahm, Barbara | Topic ID: 47348",
---
>     "Zagreb | Topic ID: 41897",
14a15
>     "Zahm, Barbara | Topic ID: 47348",
21d21
<     "Zalkind, Norman | Topic ID: 40150",
22a23
>     "Zalkind, Norman | Topic ID: 40150",
40d40
<     "Zeckhauser, Richard | Topic ID: 21267",
41a42
>     "Zeckhauser, Richard | Topic ID: 21267",
57d57
<     "Zhang, Bin | Topic ID: 9982",
59d58
<     "Zhang, Yimou | Topic ID: 2110",
60a60,61
>     "Zhang, Bin | Topic ID: 9982",
>     "Zhang, Yimou | Topic ID: 2110",
88a90,91
>     "Zionism -- of Jewish feminists | Topic ID: 34450",
>     "Zionism -- of Jewish New Left | Topic ID: 34451",
92,94d94
<     "Zionism -- of Jewish feminists | Topic ID: 34450",
<     "Zionism -- of Jewish New Left | Topic ID: 34451",
<     "Zionism, varieties of | Topic ID: 23620",
100a101
>     "Zionism, varieties of | Topic ID: 23620",
110d110
<     "Zohar | Topic ID: 18173",
117a118
>     "Zohar | Topic ID: 18173",
121d121
<     "Zombiecon | Topic ID: 10762",
123a124
>     "Zombiecon | Topic ID: 10762",
127d127
<     "zoning laws | Topic ID: 43817",
128a129
>     "zoning laws | Topic ID: 43817",
137d137
<     "Z-Trip | Topic ID: 42419",
143d142
<     "Zuniga, Markos Moulitsas | Topic ID: 9985",
144a144
>     "Zuniga, Markos Moulitsas | Topic ID: 9985",
```

The sorting rules for non-alphanumeric characters like space, "-", and "," are
clearly different.

That said, in this project topic names are sorted using to make diff reports more
readable and debugging easier.  There are multiple sorting functions used, but
they all ultimately rely on `util.ignoreWrappingDoubleQuotesCaseInsensitiveSort`.
