# em - DLTS ENM Verifier

`enm-verifier` is a command-line program for verifying the ENM website against
the Topic Curation Toolkit.

## Overview

TBD

## Getting Started

### Prerequisities

* Node.js version ? (TODO: write caveat about sorting differences between Node versions)
* [yarn](https://yarnpkg.com/)

### Installation and setup

TBD

### Quickstart

TBD

### Usage

TBD

#### Examples

TBD

### Notes on sorting of topic names

Topic names are sorted to make debugging easier and diff reports more readable.
Note that `enm-verifier` is not verifying the correctness of ENM ordering.  The
ENM custom sort specified in [NYUP-376](https://jira.nyu.edu/jira/browse/NYUP-376)
is something that is implemented outside of TCT, so it doesn't make sense to
to compare the ordering of topic names in ENM to TCT.  Also, it is technically
 challenging to reproduce the custom sort used by
 [enm|https://github.com/NYULibraries/dlts-enm], because currently the sort is
done at the database level in SQL, and it can be tricky to match the exact sorting
rules using JavaScript.  For example, here is a diff between a "Z" browse
topics list ordering and the same list sorted using `util.sortTopicNames` in this
project:

```shell
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

Neverthless, in this project topic names are sorted to make debugging easier
and diff reports more readable.
