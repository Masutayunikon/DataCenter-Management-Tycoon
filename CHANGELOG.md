# Changelog

## [2.4.1] - 2026-04-17

### Bug Fixes

* progressive switch upgrade cost — 500×(1+n/4)² instead of flat 500$
* cap daily client arrivals to 1 per year elapsed, clean server badges and actions

## [2.4.0](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.3.4...datacenter-site-v2.4.0) (2026-04-17)


### Features

* auto-restart on failure + hardware generation system ([f297701](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/f2977013a749029e4b427e0043bb0ab69fbba1b2))
* bank loans, hardware aging, and SLA tiers ([df05564](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/df0556448b677581e6a71e6f243b79114caff47f))
* dynamic hardware limits in ServicesPanel + catastrophe events ([46e0e67](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/46e0e67a95f7b57f91fd378502b83408a0d25b17))
* network bandwidth per floor + startup incubator contracts ([d0c39f8](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/d0c39f837d39897dd0949094c147f8b87329fdde))


### Bug Fixes

* sync server with game logic changes (46e0e67a95f7b57f91fd378502b83408a0d25b17) ([de99c55](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/de99c5567a843514e9baaf8b1faa97230f745ad6))
* sync server with game logic changes (d0c39f837d39897dd0949094c147f8b87329fdde) ([e86c448](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/e86c4484214519da8f10d0a47586f0c07500eddb))
* sync server with game logic changes (df0556448b677581e6a71e6f243b79114caff47f) ([8bc7226](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/8bc7226dcbda6aba499fbe41acb854ef43ffb739))
* sync server with game logic changes (f2977013a749029e4b427e0043bb0ab69fbba1b2) ([0ba8ec9](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/0ba8ec90e7cd927670c74948d28f0b45b8dd0b59))

## [2.3.4](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.3.3...datacenter-site-v2.3.4) (2026-04-16)


### Bug Fixes

* sync server with game logic changes (aabdec4461ff1b1386043706e92e171de90f4d8b) ([6fbd1d2](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/6fbd1d2320d0fb81177d6ba49076ebf08b1d9743))
* trigger dual release (pool fix + sync) ([aabdec4](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/aabdec4461ff1b1386043706e92e171de90f4d8b))

## [2.3.3](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.3.2...datacenter-site-v2.3.3) (2026-04-16)


### Bug Fixes

* generate pool clients only for offered services, add TTL to stale clients ([72ffc8a](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/72ffc8affd3f260881306ad59f811ac16cd9ecdf))

## [2.3.2](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.3.1...datacenter-site-v2.3.2) (2026-04-16)


### Bug Fixes

* bump save version to 6 (settings persistence added) ([535f466](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/535f4664eb674bdeb1ed7e90bad0fbf8f0149a82))
* sync server with game logic changes (535f4664eb674bdeb1ed7e90bad0fbf8f0149a82) ([99b2839](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/99b2839351d600bb00cd0763511519066b79af6d))

## [2.3.1](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.3.0...datacenter-site-v2.3.1) (2026-04-16)


### Bug Fixes

* block unassignable client generation + persist audio settings in save ([e73bd40](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/e73bd40da339fdc7aa80ef4f611954c65387a4b5))

## [2.3.0](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.2.0...datacenter-site-v2.3.0) (2026-04-12)


### Features

* open shop on empty canvas cell click, add reputation gate for specialization skills, README ([884193b](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/884193ba837a0b98743aa970a4f62632be0d2671))
* require 365 days of single-service commitment to become specialist ([e890b22](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/e890b2221d0073b59772c224da22b9e7283c1578))


### Bug Fixes

* rebalance prices, remove server upgrade skills, add gameplay TODO ([2198c19](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/2198c19d868b2e8cebb1ca4e91bb2c5cdffad2a2))
* specialist detection now includes template-mode services ([6c721ef](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/6c721ef9947c626369c7295aa4ec8cf25096ba84))

## [2.2.0](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.1.1...datacenter-site-v2.2.0) (2026-04-11)


### Features

* pool qui ne se reset plus et moins de generation ([b44bab9](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/b44bab9f3ef1b17f078e7c28d76f38073edfd134))


### Bug Fixes

* add debug logs for install_server action ([e6bd608](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/e6bd608ad01de517e02138853da3961254ff5fe4))
* add SERVER_DESCRIPTION and SERVER_IMAGE_URL env vars ([188ea0a](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/188ea0a94e31350903436e0081a1d592ed5388c6))
* fix rack ([b44bab9](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/b44bab9f3ef1b17f078e7c28d76f38073edfd134))

## [2.1.1](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.1.0...datacenter-site-v2.1.1) (2026-04-11)


### Bug Fixes

* trigger release-please ([a7d4fbc](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/a7d4fbc6f08d5fe827d90cb7905a7867b3a3eda1))
* use repo root as docker context to include src/game imports ([e92574e](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/e92574e4ccb22f7516657078d9aa810a2db6bcbf))

## [2.1.0](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.0.3...datacenter-site-v2.1.0) (2026-04-11)


### Features

* add env var support for server config + runtipi app definitions ([c4c368e](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/c4c368eab58573d032348ca2212ca2beec51133c))


### Bug Fixes

* inline SERVICES data in server to remove frontend import ([de7030c](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/de7030c5453a97166a7de0a8390b042a613b1002))
* trigger release-please ([7de5222](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/7de522212232230d94d74ceb0d81f58d53521b94))

## [2.0.3](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.0.2...datacenter-site-v2.0.3) (2026-04-11)


### Bug Fixes

* remove release-please manifest from repo, let it self-manage ([110f974](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/110f974373b695189229f1b3c92fb7e6e894f4b2))
* separate PRs with version in title, align tag-name with actual tags ([159b8c0](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/159b8c0cb8f30c6431f2702ad99c4459d7b997af))
* trigger release-please ([c3ff683](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/c3ff683a0ecd0b123ce335e4bd8bac1b83b9a9f1))

## [2.0.2](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.0.1...datacenter-site-v2.0.2) (2026-04-11)


### Bug Fixes

* revert to single grouped release PR ([313e096](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/313e096793fbd20c9c10789ac313f782dac9d84d))
* static group PR title instead of branch name ([e7acde9](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/e7acde91ce083c039cc0215e6d1b06ae95e11d80))

## [2.0.1](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v2.0.0...datacenter-site-v2.0.1) (2026-04-11)


### Bug Fixes

* add site/server label in release PR titles ([5309a45](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/5309a4533fec080fae9424695163747f8f4b6fd0))
* build Docker only on version tags, eliminate double builds ([833f159](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/833f1596fcd452bc0ff0642896fc33d89938d502))
* separate release PRs per package and add dev dockerfile ([132d2df](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/132d2dfeb7a9bcd89604fd8eedd09fa6e91d8418))

## [2.0.0](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v1.0.0...datacenter-site-v2.0.0) (2026-04-11)


### ⚠ BREAKING CHANGES

* initial public release

### Features

* initial public release ([dc44725](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/dc44725509ff022e6e777861656927dd6cf6c735))


### Bug Fixes

* customize release-please PR title to 'release: v${version}' ([6075a0f](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/6075a0f172e471f176310029ab86c18bb44667b5))
* reset all packages to v1.0.0 ([793d6ae](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/793d6ae4a6ddbc7b29e4fc4b90b715e4a9932ef4))
* trigger release-please ([8590117](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/85901177eea09207fe87060505035aba613f99f2))

## [0.2.0](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/compare/datacenter-site-v0.1.0...datacenter-site-v0.2.0) (2026-04-11)


### ⚠ BREAKING CHANGES

* initial public release

### Features

* initial public release ([dc44725](https://github.com/Masutayunikon/DataCenter-Management-Tycoon/commit/dc44725509ff022e6e777861656927dd6cf6c735))
