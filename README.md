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

And include this as the first 2 lines of your app:

```js
import { register } from "@sprucelabs/path-resolver";
register({ tsConfigDirs: [__dirname] });
```

That's all!

### Options

- `tsConfigDirs:string[]` - The path to the directory containing your tsconfig, will try them each in order (helpful when building to a dir that changes relative to the tsconfig)
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
import { register } from "@sprucelabs/path-resolver";
register({ tsConfigDirs: [path.join(__dirname, "..")] });

import MyThing from "#alias";
import { somethingElse } from "#aliasWithWildcard/path/passed/through";
```
