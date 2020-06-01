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

	@test('Works up the directory tree to find the tsconfig')
	protected static async findTsConfigDir(t: ExecutionContext<IContext>) {
		const startPath = path.join(__dirname, '..', '_test', 'build')
		const tsConfigDir = PathResolver.resolveTsConfigDir(startPath)
		const expected = path.join(__dirname, '..', '_test')

		t.is(tsConfigDir, expected, 'Did not correctly resolve the tsconfig path')
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
				const homedir = require('os').homedir()
				const firstMatch = path.join(
					homedir,
					'.node_modules',
					'never',
					'match.txt'
				)

				t.not(candidates.indexOf(firstMatch), -1, 'did not look in home dir')

				//2. it should be checking 1 dir up
				const secondMatch = path.join(
					__dirname,
					'..',
					'node_modules',
					'never',
					'match.txt'
				)
				t.not(
					candidates.indexOf(secondMatch),
					-1,
					'did not look node_modules of this project'
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
			}
		} else {
			t.log(error)
			t.fail('Got the wrong type of error back')
		}
	}

	@test('Test core module resolution')
	protected static async testCoreModuleResolution(
		t: ExecutionContext<IContext>
	) {
		const resolver = new PathResolver({
			enable: false,
			cwd: path.join(__dirname, '..', '_test'),
			extensions: ['.txt']
		})

		t.is(resolver.resolvePath('vm'), 'vm')
	}

	@test('Test absolute path resolution')
	protected static async testAbsolutePathResolution(
		t: ExecutionContext<IContext>
	) {
		const expected = path.resolve(__dirname, '..', '_test', 'pathTest.ts')

		const resolver = new PathResolver({
			enable: false,
			cwd: path.join(__dirname, '..', 'register'),
			extensions: ['.ts']
		})

		t.is(resolver.resolvePath(expected), expected)
	}
}
