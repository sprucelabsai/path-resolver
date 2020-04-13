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

And include this as the first line of your app:

```js
import "@sprucelabs/path-resolver";
```

That's all!

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
