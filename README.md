# @sprucelabs/path-resolver

Add runtime support for the `compilerOptions.paths` of your `tsconfig.json`.

## Installation

```bash
yarn install @sprucelabs/path-resolver
```

or

```bash
npm install @sprucelabs/path-resolver
```

And include this line at the top of your app:

```js
import "@sprucelabs/path-resolver/register";
```

That's all!

### Options

- `cwd:string` - Where to start looking for your tsconfig.json. Will look up one directory at a time until it finds one or throws an Error. _NOTE:_ Make sure your tsconfig.json is being bundled with your project when building/deploying.
- `extensions:string[]` - Extensions you want to load, defaults to Module.extensions, must have dot in them `.js`, `.ts`.

### Example tsconfig.json

```json
{
	"compilerOptions": {
		"baseUrl": "",
		"outDir": "build",
		"paths": {
			"#alias": ["new/path/relative/to/baseUrl"],
			"#aliasWithWildcard/*": ["new/path/one/*", "new/path/two/*"]
		}
	}
}
```

### Example import

```js
import path from "path";
import "@sprucelabs/path-resolver/register";

import MyThing from "#alias";
import { somethingElse } from "#aliasWithWildcard/path/passed/through";
```

## Why not use [tspaths-config](https://github.com/dividab/tsconfig-paths#readme)?

This module works almost exactly the same, but when resolving modules it checks the `outDir` first, then falls back to checking the local directory. It also checks for all file extensions.

In other words, `path-resolver` works with `ts-node` and without and with built projects and without, all with one line of code.
