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
register({ tsConfigDir: __dirname });
```

That's all!

### Options

- `tsConfigDir:string` - The path to the directory containing your tsconfig
- `extensions:string[]` - Extensions you want to load, defaults to Module.extensions

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
import MyThing from "#alias";
import { somethingElse } from "#aliasWithWildcard/path/passed/through";
```
