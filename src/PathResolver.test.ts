import coreModuleLoader = require('module')
import BaseTest, { ISpruce, test } from '@sprucelabs/test'
import { ExecutionContext } from 'ava'
import PathResolver from '.'
import path from 'path'
import SpruceError from './errors/SpruceError'
import { ErrorCode } from './errors/error.types'
import { IPathResolverOptions } from './PathResolver'

/** Context just for this test */
interface IContext {
	resolver: PathResolver
}

export default class PathResolverTest extends BaseTest {
	// Setup the path resolver for each test
	protected static beforeEach(t: ExecutionContext<IContext>) {
		// Make sure we keep track of the original resolver
		// @ts-ignore
		t.context._resolveFilename = coreModuleLoader._resolveFilename
	}

	protected static afterEach(t: ExecutionContext<IContext>) {
		// Restore the module loader
		// @ts-ignore
		coreModuleLoader._resolveFilename = t.context._resolveFilename
	}

	@test(
		'Throws tsconfig not found error',
		{ cwd: '/' },
		ErrorCode.TsConfigNotFound
	)
	@test(
		'Throws invalid tsconfig error',
		{ cwd: path.join(__dirname, '../', '_test', 'invalid') },
		ErrorCode.InvalidTsConfig
	)
	protected static async throwsTsConfigNotFound(
		t: ExecutionContext<IContext>,
		spruce: ISpruce,
		options: IPathResolverOptions,
		errorCode: ErrorCode
	) {
		const error = t.throws(() => new PathResolver(options))
		if (error instanceof SpruceError) {
			const { options } = error
			t.is(options.code, errorCode, `Unexpected ErrorCode`)
		} else {
			t.log(error)
			t.fail('Got the wrong type of error back')
		}
	}

	@test(
		'can find file NOT in build',
		'#test/onlyOnRootLevel',
		'_test/onlyOnRootLevel.txt'
	)
	@test(
		'can find file built file',
		'#test/builtFile',
		'_test/build/builtFile.txt'
	)
	protected static async canAccessSpruce(
		t: ExecutionContext<IContext>,
		spruce: ISpruce,
		name: string,
		expectedEndsWith: string
	) {
		const resolver = new PathResolver({
			enable: false,
			cwd: path.join(__dirname, '..', '_test'),
			extensions: ['.txt']
		})
		const match = resolver.resolvePath(name)

		t.is(match.substr(-expectedEndsWith.length, match.length), expectedEndsWith)
	}

	@test('Test node_modules resolution')
	protected static async testNodeModuleResolution(
		t: ExecutionContext<IContext>
	) {
		const resolver = new PathResolver({
			enable: false,
			cwd: path.join(__dirname, '..', '_test'),
			extensions: ['.txt']
		})
		const error = t.throws(() =>
			resolver.resolvePath('#test:modules/never/match')
		)
		if (error instanceof SpruceError) {
			const { options } = error
			if (options.code === ErrorCode.CouldNotFindFile) {
				const { request, candidates } = options
				t.is(request, '#test:modules/never/match')

				// 1. is it checking this dir's node_modules?
				const first = candidates[0]
				const firstMatch = path.join(
					__dirname,
					'node_modules',
					'never',
					'match.txt'
				)
				t.is(firstMatch, first, 'did not look in __dirname')

				//2. it should be checking 1 dir up
				const second = candidates[1]
				const secondMatch = path.join(
					__dirname,
					'..',
					'node_modules',
					'never',
					'match.txt'
				)
				t.is(
					secondMatch,
					second,
					'did not look in node modules of this project'
				)

				//3. it should be checking the most root'est
				const thirdMatch = path.join(
					path.sep,
					'node_modules',
					'never',
					'match.txt'
				)
				t.not(
					candidates.indexOf(thirdMatch),
					-1,
					'did not look node_modules at root'
				)

				//4. last check, should be looking in home
				const homedir = require('os').homedir()
				const fourthMatch = path.join(
					homedir,
					'node_modules',
					'never',
					'match.txt'
				)

				t.not(candidates.indexOf(fourthMatch), -1, 'did not look in home dir')
			}
		} else {
			t.log(error)
			t.fail('Got the wrong type of error back')
		}
	}
}
