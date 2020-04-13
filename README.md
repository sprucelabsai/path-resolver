# @sprucelabs/path-resolver

Add runtime support for the `compilerOptions.paths` of your `tsconfig.json`.

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
