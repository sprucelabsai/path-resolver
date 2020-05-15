import coreModuleLoader = require('module')
import path = require('path')
import fs from 'fs'
import log from './lib/log'
import SpruceError from './errors/SpruceError'
import { ErrorCode } from './errors/error.types'

export interface IPathResolverOptions {
	/** Current working directory, i'll start here and work up directories until i find a tsconfig.json */
	cwd?: string
	/** Supported file extensions, defaults to everything setup in node */
	extensions?: string[]
	/** Should we take over module resolution? */
	enable?: boolean
}

/** Enable paths support from compiler options of the tsconfig */
export default class PathResolver {
	public compilerOptions: Record<string, any>
	public replacePaths: Record<string, string[]> = {}
	public pathCache: Record<string, string> = {}
	public cwd: string
	public baseDir: string
	public extensions: string[] = []

	public constructor(options: IPathResolverOptions) {
		const {
			cwd,
			// @ts-ignore
			extensions = Object.keys(coreModuleLoader._extensions),
			enable = true
		} = options

		// Save options needed often
		this.extensions = extensions

		// Easy to mess this up
		if (this.extensions.find(ext => ext[0] !== '.')) {
			throw new SpruceError({
				code: ErrorCode.InvalidParameters,
				friendlyMessage: 'Extensions need to start with a dot.'
			})
		}

		// We have to set these to at least something or ts will not pass lint
		this.cwd = this.baseDir = cwd || (process && process.cwd()) || '/'
		this.compilerOptions = {}

		log.info('PathResolver setup for', this.extensions)
		const configDir = PathResolver.resolveTsConfigDir(this.cwd)
		this.refreshCompilerOptions(configDir)

		log.info('Paths set as', this.replacePaths)

		if (enable) {
			this.enable()
		}
	}

	public static getInstance(options?: IPathResolverOptions): PathResolver {
		// @ts-ignore
		if (!coreModuleLoader._sprucePathResolver) {
			// @ts-ignore
			coreModuleLoader._sprucePathResolver = new PathResolver(options || {})
		}
		// @ts-ignore
		return coreModuleLoader._sprucePathResolver
	}

	public static setInstance(resolver: PathResolver) {
		// @ts-ignore
		coreModuleLoader._sprucePathResolver = resolver
	}

	/** Based on the cwd, find the directory containing the tsconfig */
	public static resolveTsConfigDir(cwd: string) {
		// Track where we are looking for the tsconfig
		const tsConfigLookupPaths: string[] = []
		const found = false
		const pathParts = cwd.split(path.sep)
		if (pathParts[0] === '') {
			pathParts[0] = path.sep
		}

		do {
			const dir = path.join(...pathParts)
			const tsConfigPath = path.join(dir, 'tsconfig.json')

			// Track everywhere i look
			tsConfigLookupPaths.push(tsConfigPath)

			if (fs.existsSync(tsConfigPath)) {
				return dir
			}
			pathParts.pop()
		} while (pathParts.length > 0 && !found)

		throw new SpruceError({
			code: ErrorCode.TsConfigNotFound,
			cwd,
			tsLookupPaths: tsConfigLookupPaths
		})
	}

	/** Refresh compiler options by sending the dir that contains the tsconfig.json (use response of PathResolver.resolveTsConfigDir) */
	public refreshCompilerOptions(tsConfigDir: string) {
		const tsConfigPath = path.join(tsConfigDir, 'tsconfig.json')
		log.info(`Loading tsconfig from ${tsConfigPath}`)
		const compilerOptions = require(tsConfigPath).compilerOptions
		if (!compilerOptions) {
			throw new SpruceError({
				code: ErrorCode.InvalidTsConfig,
				tsConfigPath,
				friendlyMessage: 'compilerOptions are missing'
			})
		}
		this.compilerOptions = compilerOptions
		this.baseDir =
			this.compilerOptions.baseUrl &&
			this.compilerOptions.baseUrl[0] === path.sep
				? this.compilerOptions.baseUrl
				: path.join(tsConfigDir, this.compilerOptions.baseUrl ?? '.')

		// Setup all replace paths based on compiler options
		Object.keys(this.compilerOptions.paths).forEach(alias => {
			this.replacePaths[
				alias.replace(/\*.?/, '(.*)')
			] = this.compilerOptions.paths[alias].map((destination: string) =>
				destination.replace(/\*.?/, '$1')
			)
		})
	}

	/** Enable this loader */
	public enable() {
		// Do we already have an instance running?
		// @ts-ignore
		if (coreModuleLoader._originalResolveFilename) {
			throw new SpruceError({ code: ErrorCode.AlreadyRunning })
		}

		// Store original resolveFilename from core module loader to be called after the we do the mapping below
		//@ts-ignore
		coreModuleLoader._originalResolveFilename =
			//@ts-ignore
			coreModuleLoader._resolveFilename

		// Override _resolveFilename to do our mapping based on tsconfig
		//@ts-ignore
		coreModuleLoader._resolveFilename = (
			request: string,
			parent: coreModuleLoader,
			isMain: boolean
		) => {
			const resolved = this.resolvePath(request)
			// @ts-ignore
			return coreModuleLoader._originalResolveFilename(resolved, parent, isMain)
		}
	}

	/** Put things back how they are supposed to be */
	public disable() {
		// @ts-ignore
		coreModuleLoader._resolveFilename =
			// @ts-ignore
			coreModuleLoader._originalResolveFilename ||
			// @ts-ignore
			coreModuleLoader._resolveFilename

		// @ts-ignore
		delete coreModuleLoader._originalResolveFilename
	}

	/** Pass a path and i'll lookup places to find it based on your tsconfig */
	public resolvePath(request: string): string {
		// If already found, return now
		if (this.pathCache[request]) {
			return this.pathCache[request]
		}

		let foundMatch = false
		const attemptedPaths: string[] = []
		const pathPatterns = Object.keys(this.replacePaths)
		for (const pattern of pathPatterns) {
			// Does the requested match our patterns?
			const regex = new RegExp(pattern)
			if (request.match(regex)) {
				// Check each path to find one that exists
				for (const candidatePath of this.replacePaths[pattern]) {
					const candidates = []
					const name = request.replace(regex, candidatePath)

					// If this pointing to a file in a node_modules dir, lets do the node loading process
					// https://nodejs.org/api/modules.html#modules_all_together
					const isNodeModule = name.search('node_modules') > -1
					if (isNodeModule) {
						// Get everything to the right of node_modules
						let moduleName = name.split('node_modules').pop()
						const localPath =
							name === path.join('node_modules', moduleName || 'missing')
								? '.'
								: name.split('node_modules').shift()

						if (moduleName && localPath) {
							if (moduleName[0] === path.sep) {
								moduleName = moduleName.substr(1)
							}
							if (moduleName && localPath) {
								const matchedName = moduleName
								// Attach it to EVERY path node is going to look
								// @ts-ignore
								const paths: string[] = coreModuleLoader.globalPaths
								paths.forEach(item =>
									candidates.push(path.join(item, matchedName))
								)

								// Also look ALL the way up the directory tree
								const fullPath = path.join(this.baseDir, localPath)
								const fullPathParts = fullPath.split(path.sep)
								do {
									const testPath = path.join(
										fullPathParts.join(path.sep) || path.sep,
										'node_modules',
										moduleName
									)
									candidates.push(testPath)
									fullPathParts.pop()
								} while (fullPathParts.length > 0)
							}
						}
					} else {
						// Basic path alias, use our rules
						// Try relative to output (build) dir
						if (typeof this.compilerOptions.outDir === 'string') {
							candidates.push(
								path.join(this.baseDir, this.compilerOptions.outDir, name)
							)
						}

						// Try relative to cwd
						candidates.push(path.join(this.baseDir, name))
					}

					// Does this candidate exist? if so, mutate the request so core loads it correctly
					foundMatch = true

					// Attempt all candidates against all file extensions
					for (const candidate of candidates) {
						let pathIsDirectory = false
						try {
							pathIsDirectory = fs.lstatSync(candidate).isDirectory()
						} catch (e) {
							log.trace(e)
						}

						for (const ext of this.extensions) {
							const fullPath = candidate + ext
							const pathsToAttempt = [fullPath]

							// Check for index file if it's a path
							if (pathIsDirectory) {
								pathsToAttempt.push(path.join(candidate, `index${ext}`))
							}

							for (let i = 0; i < pathsToAttempt.length; i += 1) {
								const pathToAttempt = pathsToAttempt[i]
								attemptedPaths.push(pathToAttempt)
								if (fs.existsSync(pathToAttempt)) {
									log.info(`${request} mapped to -> ${pathToAttempt}`)
									this.pathCache[request] = pathToAttempt
									return pathToAttempt
								}
							}
						}
					}
				}
			}
		}

		// If we found a match on paths, but the file did not exist
		if (foundMatch) {
			throw new SpruceError({
				code: ErrorCode.CouldNotFindFile,
				request,
				candidates: attemptedPaths
			})
		}

		// It did not match any of our patterns, so pass it back as is
		this.pathCache[request] = request

		return request
	}
}
